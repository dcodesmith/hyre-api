import { Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
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
import { BookingApplicationService } from "../application/services/booking-appication.service";
import { PaymentStatusResult } from "../application/services/booking-payment.service";
import { ChauffeurAssignmentService } from "../application/services/chauffeur-assignment.service";
import { DateRange } from "../domain/value-objects/date-range.vo";
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
          startDate: result.booking.getDateRange().startDate.toISOString(),
          endDate: result.booking.getDateRange().endDate.toISOString(),
          type: result.booking.getBookingType().value,
          pickupAddress: result.booking.getPickupAddress(),
          dropOffAddress: result.booking.getDropOffAddress(),
        },
      },
      message: "Booking created successfully. Please complete payment.",
    };
  }

  @Put(":id/cancel")
  async cancelBooking(
    @ZodParam(z.string()) id: string,
    @ZodBody(z.string().optional()) reason?: string,
  ) {
    return this.bookingService.cancelBooking(id, reason);
  }

  @Put(":id/assign-chauffeur")
  @UseGuards(JwtAuthGuard)
  async assignChauffeur(
    @Param("id") bookingId: string,
    @ZodBody(assignChauffeurSchema) dto: AssignChauffeurDto,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.info("Assigning chauffeur to booking", {
      bookingId,
      chauffeurId: dto.chauffeurId,
      assignedBy: currentUser.getId(),
    });

    // Get the booking first
    const booking = await this.bookingService.getBookingById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Assign chauffeur
    const result = await this.chauffeurAssignmentService.assignChauffeurToBooking(booking, {
      bookingId,
      chauffeurId: dto.chauffeurId,
      assignedBy: currentUser.getId(),
    });

    if (!result.success) {
      throw new Error(result.message);
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

    // Get the booking first
    const booking = await this.bookingService.getBookingById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Unassign chauffeur
    const result = await this.chauffeurAssignmentService.unassignChauffeurFromBooking(booking, {
      bookingId,
      unassignedBy: currentUser.getId(),
      reason: dto.reason,
    });

    if (!result.success) {
      throw new Error(result.message);
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
        throw new Error("Insufficient permissions to view chauffeurs for another fleet owner");
      }
    }

    // Create date range
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    const dateRange = DateRange.create(startDate, endDate);

    // Get available chauffeurs
    const chauffeurs = await this.chauffeurAssignmentService.getAvailableChauffeurs(
      fleetOwnerId,
      dateRange,
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

    // Get the booking to extract date range
    const booking = await this.bookingService.getBookingById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check availability
    const availability = await this.chauffeurAssignmentService.checkChauffeurAvailability(
      chauffeurId,
      booking.getDateRange(),
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
