import { Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { CreateBookingResponse } from "../../domain/interfaces/booking.interface";
import { CreateBookingDto } from "../../presentation/dto/create-booking.dto";
import { PaymentStatusQueryDto } from "../../presentation/dto/payment-status.dto";
import { BookingCreationService } from "./booking-creation.service";
import { BookingLifecycleService } from "./booking-lifecycle.service";
import { BookingPaymentService, PaymentStatusResult } from "./booking-payment.service";
import { BookingQueryService } from "./booking-query.service";

/**
 * Main application service that orchestrates booking operations
 * Following the Facade pattern - delegates to specialized services
 * Maintains backward compatibility while improving internal structure
 */
@Injectable()
export class BookingApplicationService {
  constructor(
    private readonly bookingCreationService: BookingCreationService,
    private readonly bookingPaymentService: BookingPaymentService,
    private readonly bookingLifecycleService: BookingLifecycleService,
    private readonly bookingQueryService: BookingQueryService,
    private readonly logger: LoggerService,
  ) {}

  async createPendingBooking(dto: CreateBookingDto, user?: User): Promise<CreateBookingResponse> {
    // Create the booking using the specialized creation service
    const { booking: savedBooking, bookingPeriod } =
      await this.bookingCreationService.createPendingBooking(dto, user);

    // Create payment intent and attach to booking
    const { paymentIntentId, checkoutUrl } =
      await this.bookingPaymentService.createAndAttachPaymentIntent(
        savedBooking,
        user,
        dto,
        bookingPeriod,
      );

    this.logger.log(
      `Created pending booking ${savedBooking.getBookingReference()} with total amount: ${savedBooking.getTotalAmount()?.toString()}`,
    );

    return {
      booking: savedBooking,
      totalAmount: savedBooking.getTotalAmount() || 0,
      netTotal: savedBooking.getNetTotal() || 0,
      fleetOwnerPayoutAmountNet: savedBooking.getFleetOwnerPayoutAmountNet() || 0,
      checkoutUrl,
      paymentIntentId,
      breakdown: {
        netTotal: savedBooking.getNetTotal() || 0,
        platformServiceFee: savedBooking.getPlatformServiceFeeAmount() || 0,
        vat: savedBooking.getVatAmount() || 0,
        totalAmount: savedBooking.getTotalAmount() || 0,
      },
    };
  }

  async confirmBookingWithPayment(bookingId: string, paymentId: string): Promise<void> {
    return this.bookingPaymentService.confirmBookingWithPayment(bookingId, paymentId);
  }

  async cancelBooking(bookingId: string, currentUser: User, reason?: string): Promise<void> {
    return this.bookingLifecycleService.cancelBooking(bookingId, currentUser, reason);
  }

  async processBookingStatusUpdates(): Promise<string> {
    return this.bookingLifecycleService.processBookingStatusUpdates();
  }

  async processBookingActivations(): Promise<number> {
    return this.bookingLifecycleService.processBookingActivations();
  }

  async processBookingCompletions(): Promise<number> {
    return this.bookingLifecycleService.processBookingCompletions();
  }

  async findBookingsEligibleForStartReminders(): Promise<string[]> {
    return this.bookingQueryService.findBookingsEligibleForStartReminders();
  }

  async findBookingsEligibleForEndReminders(): Promise<string[]> {
    return this.bookingQueryService.findBookingsEligibleForEndReminders();
  }

  async getBookingById(bookingId: string, currentUser: User): Promise<Booking> {
    return this.bookingQueryService.getBookingById(bookingId, currentUser);
  }

  async getBookingByIdInternally(bookingId: string): Promise<Booking> {
    return this.bookingQueryService.getBookingByIdInternal(bookingId);
  }

  async handlePaymentStatusCallback(
    bookingId: string,
    query: PaymentStatusQueryDto,
  ): Promise<PaymentStatusResult> {
    return this.bookingPaymentService.handlePaymentStatusCallback(bookingId, query);
  }

  async getBookings(currentUser: User): Promise<Booking[]> {
    return this.bookingQueryService.getBookings(currentUser);
  }
}
