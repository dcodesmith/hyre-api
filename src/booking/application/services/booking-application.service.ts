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
import { BookingReminderService } from "./booking-reminder.service";

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
    private readonly bookingReminderService: BookingReminderService,
    private readonly logger: LoggerService,
  ) {}

  async createPendingBooking(dto: CreateBookingDto, user?: User): Promise<CreateBookingResponse> {
    // Create the booking using the specialized creation service
    const { booking, bookingPeriod, customer } =
      await this.bookingCreationService.createPendingBooking(dto, user);

    // Create payment intent and attach to booking
    const { paymentIntentId, checkoutUrl } =
      await this.bookingPaymentService.createAndAttachPaymentIntent(
        booking,
        customer,
        bookingPeriod,
      );

    this.logger.log(
      `Created pending booking ${booking.getBookingReference()} with total amount: ${booking.getTotalAmount()?.toString()}`,
    );

    return {
      booking,
      totalAmount: booking.getTotalAmount() || 0,
      netTotal: booking.getNetTotal() || 0,
      fleetOwnerPayoutAmountNet: booking.getFleetOwnerPayoutAmountNet() || 0,
      checkoutUrl,
      paymentIntentId,
      breakdown: {
        netTotal: booking.getNetTotal() || 0,
        platformServiceFee: booking.getPlatformServiceFeeAmount() || 0,
        vat: booking.getVatAmount() || 0,
        totalAmount: booking.getTotalAmount() || 0,
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

  /**
   * Process leg start reminders - sent 1 HOUR before each leg starts
   * All reminders are LEG-BASED to support multi-day bookings
   */
  async processBookingLegStartReminders(): Promise<number> {
    return this.bookingReminderService.processBookingLegStartReminders();
  }

  /**
   * Process leg end reminders - sent 1 HOUR before each leg ends
   * All reminders are LEG-BASED to support multi-day bookings
   */
  async processBookingLegEndReminders(): Promise<number> {
    return this.bookingReminderService.processBookingLegEndReminders();
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
