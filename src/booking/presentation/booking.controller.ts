import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { User } from "../../iam/domain/entities/user.entity";
import {
  CurrentUser,
  OptionalCurrentUser,
} from "../../iam/infrastructure/decorators/user.decorator";
import { JwtAuthGuard } from "../../iam/infrastructure/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../iam/infrastructure/guards/optional-jwt-auth.guard";
import { ZodBody, ZodParam, ZodQuery } from "../../shared/decorators/zod-body.decorator";
import { LoggerService } from "../../shared/logging/logger.service";
import { BookingApplicationService } from "../application/services/booking-application.service";
import { PaymentStatusResult } from "../application/services/booking-payment.service";
import { ChauffeurAssignmentService } from "../application/services/chauffeur-assignment.service";
import { BookingPeriodFactory } from "../domain/value-objects/booking-period.factory";
import {
  AssignChauffeurDto,
  assignChauffeurSchema,
  GetAvailableChauffeursDto,
  getAvailableChauffeursSchema,
  UnassignChauffeurDto,
  unassignChauffeurSchema,
} from "./dto/assign-chauffeur.dto";
import { type CreateBookingDto, CreateBookingSchema } from "./dto/create-booking.dto";
import { PaymentStatusQueryDto, PaymentStatusQuerySchema } from "./dto/payment-status.dto";

@Controller("bookings")
export class BookingController {
  constructor(
    private readonly bookingService: BookingApplicationService,
    private readonly chauffeurAssignmentService: ChauffeurAssignmentService,
    private readonly logger: LoggerService,
  ) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async createBooking(
    @ZodBody(CreateBookingSchema) dto: CreateBookingDto,
    @OptionalCurrentUser() user: User | undefined,
  ) {
    const result = await this.bookingService.createPendingBooking(dto, user);

    // Return enhanced response format matching migration guide
    return {
      success: true,
      data: {
        bookingId: result.booking.getId(),
        bookingReference: result.booking.getBookingReference(),
        checkoutUrl: result.checkoutUrl,
        paymentIntentId: result.paymentIntentId,
        totalAmount: result.totalAmount,
        breakdown: result.breakdown,
        booking: {
          startDate: result.booking.getStartDateTime().toISOString(),
          endDate: result.booking.getEndDateTime().toISOString(),
          type: result.booking.getBookingType(),
          pickupAddress: result.booking.getPickupAddress(),
          dropOffAddress: result.booking.getDropOffAddress(),
        },
      },
      message: "Booking created successfully. Please complete payment.",
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getBookings(@CurrentUser() currentUser: User) {
    return this.bookingService.getBookings(currentUser);
  }

  @Put(":id/cancel")
  @UseGuards(JwtAuthGuard)
  async cancelBooking(
    @ZodParam(z.string()) bookingId: string,
    @CurrentUser() currentUser: User,
    @ZodBody(z.string().optional()) reason?: string,
  ) {
    return this.bookingService.cancelBooking(bookingId, currentUser, reason);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getBooking(@Param("id") bookingId: string, @CurrentUser() currentUser: User) {
    return this.bookingService.getBookingById(bookingId, currentUser);
  }

  @Put(":id/assign-chauffeur")
  @UseGuards(JwtAuthGuard)
  async assignChauffeur(
    @ZodParam(z.string()) bookingId: string,
    @ZodBody(assignChauffeurSchema) dto: AssignChauffeurDto,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.info("Assigning chauffeur to booking", {
      bookingId,
      chauffeurId: dto.chauffeurId,
      assignedBy: currentUser.getId(),
    });

    // Get the booking entity first (with authorization check)
    const booking = await this.bookingService.getBookingEntityById(bookingId, currentUser);

    // Assign chauffeur
    const result = await this.chauffeurAssignmentService.assignChauffeurToBooking(booking, {
      bookingId,
      chauffeurId: dto.chauffeurId,
      assignedBy: currentUser.getId(),
    });

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return {
      success: true,
      message: result.message,
      bookingReference: result.bookingReference,
      chauffeurId: result.chauffeurId,
    };
  }

  @Put(":id/unassign-chauffeur")
  @UseGuards(JwtAuthGuard)
  async unassignChauffeur(
    @Param("id") bookingId: string,
    @ZodBody(unassignChauffeurSchema) dto: UnassignChauffeurDto,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.info("Unassigning chauffeur from booking", {
      bookingId,
      unassignedBy: currentUser.getId(),
      reason: dto.reason,
    });

    // Get the booking entity first (with authorization check)
    const booking = await this.bookingService.getBookingEntityById(bookingId, currentUser);

    // Unassign chauffeur
    const result = await this.chauffeurAssignmentService.unassignChauffeurFromBooking(booking, {
      bookingId,
      unassignedBy: currentUser.getId(),
      reason: dto.reason,
    });

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return {
      success: true,
      message: result.message,
      bookingReference: result.bookingReference,
    };
  }

  @Get("available-chauffeurs")
  @UseGuards(JwtAuthGuard)
  async getAvailableChauffeurs(
    @ZodQuery(getAvailableChauffeursSchema) query: GetAvailableChauffeursDto,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.info("Getting available chauffeurs", {
      fleetOwnerId: query.fleetOwnerId || currentUser.getId(),
      dateRange: `${query.startDate} to ${query.endDate}`,
    });

    // Use provided fleet owner ID or current user ID
    const fleetOwnerId = query.fleetOwnerId || currentUser.getId();

    // Validate permissions - only fleet owners can see their chauffeurs, admin/staff can see all
    if (query.fleetOwnerId && query.fleetOwnerId !== currentUser.getId()) {
      if (!currentUser.isAdminOrStaff()) {
        throw new ForbiddenException(
          "Insufficient permissions to view chauffeurs for another fleet owner",
        );
      }
    }

    // Create booking period for availability check (using reconstitute to bypass validation)
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    // TODO: Use the correct booking type based on the query
    const bookingPeriod = BookingPeriodFactory.reconstitute("DAY", startDate, endDate);

    // Get available chauffeurs
    const chauffeurs = await this.chauffeurAssignmentService.getAvailableChauffeurs(
      fleetOwnerId,
      bookingPeriod,
    );

    return {
      success: true,
      chauffeurs,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  @Get(":id/chauffeur-availability/:chauffeurId")
  @UseGuards(JwtAuthGuard)
  async checkChauffeurAvailability(
    @Param("id") bookingId: string,
    @Param("chauffeurId") chauffeurId: string,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.info("Checking chauffeur availability", {
      bookingId,
      chauffeurId,
      requestedBy: currentUser.getId(),
    });

    // Get the booking entity to extract date range (with authorization check)
    const booking = await this.bookingService.getBookingEntityById(bookingId, currentUser);

    // Check availability
    const availability = await this.chauffeurAssignmentService.checkChauffeurAvailability(
      chauffeurId,
      booking.getBookingPeriod(),
      bookingId,
    );

    return {
      success: true,
      availability,
      bookingId,
      chauffeurId,
    };
  }

  @Get(":id/payment-status")
  async getPaymentStatus(
    @ZodParam(z.string()) bookingId: string,
    @ZodQuery(PaymentStatusQuerySchema) query: PaymentStatusQueryDto,
  ): Promise<PaymentStatusResult> {
    this.logger.info("Payment status API called", {
      bookingId,
      transactionId: query.transaction_id,
    });

    const result: PaymentStatusResult = await this.bookingService.handlePaymentStatusCallback(
      bookingId,
      query,
    );

    this.logger.info("Payment status API response", {
      bookingId,
      success: result.success,
      status: result.bookingStatus,
    });

    return result;
  }
}
