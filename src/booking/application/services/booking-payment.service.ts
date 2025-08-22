import { Inject, Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { TypedConfigService } from "../../../shared/config/typed-config.service";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import {
  BookingCannotBeConfirmedError,
  BookingNotFoundError,
} from "../../domain/errors/booking.errors";
import { PaymentIntentCreationError } from "../../domain/errors/booking-time.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingCustomerResolverService } from "../../domain/services/booking-customer-resolver.service";
import { TimeProcessingResult } from "../../domain/services/booking-time-processor.service";
import { PaymentVerificationService } from "../../domain/services/external/payment-verification.interface";
import { PaymentIntentService } from "../../domain/services/payment-intent.service";
import { PaymentCallbackUrl } from "../../domain/value-objects/payment-callback-url.vo";
import { CreateBookingDto } from "../../presentation/dto/create-booking.dto";
import { PaymentStatusQueryDto } from "../../presentation/dto/payment-status.dto";

export interface PaymentStatusResult {
  success: boolean;
  bookingId: string;
  bookingReference: string;
  bookingStatus: string;
  transactionId?: string;
  message?: string;
  paymentVerified?: boolean;
}

// Import the proper types from domain
export interface PaymentIntentCreationResult {
  checkoutUrl: string;
  paymentIntentId: string;
}

/**
 * Application service responsible for booking payment operations
 * Following SRP - focused only on payment-related booking operations
 */
@Injectable()
export class BookingPaymentService {
  constructor(
    @Inject("BookingRepository") private readonly bookingRepository: BookingRepository,
    @Inject("PaymentIntentService") private readonly paymentIntentService: PaymentIntentService,
    @Inject("PaymentVerificationService")
    private readonly paymentVerificationService: PaymentVerificationService,
    private readonly bookingCustomerResolver: BookingCustomerResolverService,
    private readonly prisma: PrismaService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
    private readonly configService: TypedConfigService,
  ) {}

  async createAndAttachPaymentIntent(
    booking: Booking,
    user: User | undefined,
    dto: CreateBookingDto,
    timeResult: TimeProcessingResult,
  ): Promise<PaymentIntentCreationResult> {
    const paymentCustomer = this.bookingCustomerResolver.resolvePaymentCustomer(user, {
      email: dto.email,
      name: dto.name,
      phoneNumber: dto.phoneNumber,
    });

    const bookingIdVal = booking.getId();

    if (!bookingIdVal) {
      this.logger.error(
        `Cannot create payment intent: booking has no ID (ref ${booking.getBookingReference()})`,
      );
      throw new PaymentIntentCreationError(
        "Booking must be persisted (have an ID) before creating a payment intent",
      );
    }

    const callbackUrl = PaymentCallbackUrl.create(this.configService.app.domain, bookingIdVal);

    const paymentIntent = await this.paymentIntentService.createPaymentIntent({
      amount: booking.getTotalAmount() || 0,
      customer: paymentCustomer.toPaymentService(),
      metadata: {
        booking_id: booking.getId(),
        booking_reference: booking.getBookingReference(),
        car_id: dto.carId,
        booking_type: dto.bookingType,
        start_date: timeResult.startDateTime.toISOString(),
        end_date: timeResult.endDateTime.toISOString(),
      },
      callbackUrl: callbackUrl.toString(),
    });

    if (paymentIntent.success) {
      booking.setPaymentIntent(paymentIntent.paymentIntentId);

      return {
        checkoutUrl: paymentIntent.checkoutUrl,
        paymentIntentId: paymentIntent.paymentIntentId,
      };
    }

    this.logger.error(
      `Failed to create payment intent for booking ${booking.getBookingReference()}: ${paymentIntent.error}`,
    );
    throw new PaymentIntentCreationError(paymentIntent.error);
  }

  async confirmBookingWithPayment(bookingId: string, paymentId: string): Promise<void> {
    const booking = await this.findBookingOrThrow(bookingId);

    if (!booking.isPending()) {
      throw new BookingCannotBeConfirmedError(bookingId, booking.getStatus().toString());
    }

    booking.confirmWithPayment(paymentId);

    await this.saveBookingAndPublishEvents(booking);

    this.logger.log("Booking confirmed with payment");
  }

  async handlePaymentStatusCallback(
    bookingId: string,
    query: PaymentStatusQueryDto,
  ): Promise<PaymentStatusResult> {
    this.logger.info("Processing payment status callback", {
      bookingId,
      transactionId: query.transaction_id,
      status: query.status,
    });

    try {
      // Find the booking
      const booking = await this.findBookingOrThrow(bookingId);

      // If booking is already confirmed/active/completed, redirect to success
      if (booking.isConfirmed() || booking.isActive() || booking.isCompleted()) {
        this.logger.info(`Booking ${bookingId} already confirmed, status: ${booking.getStatus()}`);
        return {
          success: true,
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          bookingStatus: booking.getStatus().toString(),
          transactionId: query.transaction_id,
          message: "Booking already confirmed",
        };
      }

      // If we have a transaction ID from Flutterwave, verify the payment
      if (query.transaction_id && booking.isPending()) {
        this.logger.info(`Verifying payment for transaction: ${query.transaction_id}`);
        return await this.verifyPaymentTransaction(booking, query);
      }

      // No transaction ID provided or booking not pending
      if (booking.isPending()) {
        // Still processing, show pending status
        return {
          success: true,
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          bookingStatus: booking.getStatus().toString(),
          transactionId: query.transaction_id,
          message: "Payment still processing",
        };
      }

      // Default status based on current booking
      return {
        success: true,
        bookingId: booking.getId(),
        bookingReference: booking.getBookingReference(),
        bookingStatus: booking.getStatus().toString(),
        transactionId: query.transaction_id,
        message: `Booking status: ${booking.getStatus().toString()}`,
      };
    } catch (error) {
      this.logger.error(
        `Error handling payment status callback for booking ${bookingId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        bookingId: bookingId,
        bookingReference: "UNKNOWN",
        bookingStatus: "UNKNOWN",
        transactionId: query?.transaction_id,
        message: `Error processing payment status: ${error.message}`,
      };
    }
  }

  private async verifyPaymentTransaction(
    booking: Booking,
    query: PaymentStatusQueryDto,
  ): Promise<PaymentStatusResult> {
    const bookingId = booking.getId();
    try {
      if (!booking.getPaymentIntent()) {
        this.logger.warn(
          `No paymentIntent stored for booking ${bookingId}; cannot verify transaction ${query.transaction_id}`,
        );
        return {
          success: false,
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          bookingStatus: booking.getStatus().toString(),
          transactionId: query.transaction_id,
          message: "Payment intent missing; cannot verify payment yet",
          paymentVerified: false,
        };
      }

      const paymentVerification = await this.paymentVerificationService.verifyPayment({
        transactionId: query.transaction_id,
        paymentIntentId: booking.getPaymentIntent(),
      });

      if (paymentVerification.isSuccess) {
        this.logger.info(`Payment verified successfully for booking ${bookingId}`);

        // Confirm the booking with the payment
        await this.confirmBookingWithPayment(bookingId, query.transaction_id);

        return {
          success: true,
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          bookingStatus: "CONFIRMED",
          transactionId: query.transaction_id,
          message: "Payment verified and booking confirmed",
          paymentVerified: true,
        };
      } else {
        this.logger.error(
          `Payment verification failed for booking ${bookingId}: ${paymentVerification.errorMessage}`,
        );
        return {
          success: false,
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          bookingStatus: booking.getStatus().toString(),
          transactionId: query.transaction_id,
          message: `Payment verification failed: ${paymentVerification.errorMessage}`,
          paymentVerified: false,
        };
      }
    } catch (verificationError) {
      this.logger.error(
        `Payment verification error for booking ${bookingId}: ${verificationError.error}`,
      );

      return {
        success: false,
        bookingId: booking.getId(),
        bookingReference: booking.getBookingReference(),
        bookingStatus: booking.getStatus().toString(),
        transactionId: query.transaction_id,
        message: "Payment verification failed due to technical error",
      };
    }
  }

  private async findBookingOrThrow(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    return booking;
  }

  private async saveBookingAndPublishEvents(booking: Booking): Promise<Booking> {
    // Collect events to publish after transaction commits
    const eventsToPublish: Booking[] = [];

    // Use transaction to ensure atomicity of booking save and event preparation
    const savedBooking = await this.prisma.$transaction(async (tx) => {
      // Save booking within transaction
      const saved = await this.bookingRepository.saveWithTransaction(booking, tx);

      // If this is a new booking, mark it as created to trigger domain events
      if (!booking.getId() && saved.getId()) {
        saved.markAsCreated();
        eventsToPublish.push(saved); // Prepare for event publishing
      }

      return saved;
    });

    // After transaction commits successfully, publish events
    for (const bookingWithEvents of eventsToPublish) {
      await this.domainEventPublisher.publish(bookingWithEvents);
    }

    return savedBooking;
  }
}
