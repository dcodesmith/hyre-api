import { Inject, Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingAuthorizationService } from "../../domain/services/booking-authorization.service";
import { BookingDomainService } from "../../domain/services/booking-domain.service";

/**
 * Application service responsible for booking lifecycle operations
 * Following SRP - focused only on booking status transitions and lifecycle management
 * Delegates authorization decisions to BookingAuthorizationService (domain layer)
 */
@Injectable()
export class BookingLifecycleService {
  constructor(
    @Inject("BookingRepository") private readonly bookingRepository: BookingRepository,
    private readonly bookingAuthorizationService: BookingAuthorizationService,
    private readonly bookingDomainService: BookingDomainService,
    private readonly prisma: PrismaService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {}

  async cancelBooking(bookingId: string, currentUser: User, reason?: string): Promise<void> {
    const booking = await this.findBookingOrThrow(bookingId);

    // Check if user has permission to cancel this booking
    // Only the customer who created the booking or admins/staff can cancel
    const { isAuthorized } = this.bookingAuthorizationService.canCancelBooking(
      currentUser,
      booking,
    );

    if (!isAuthorized) {
      // Information Disclosure Prevention - Don't reveal if booking exists but user isn't authorized
      this.logger.warn("User not authorized to cancel booking", {
        userId: currentUser.getId(),
        bookingId: booking.getId(),
        bookingReference: booking.getBookingReference(),
        reason,
      });
      throw new BookingNotFoundError(bookingId);
    }

    // Use domain service for consistent cancellation logic
    this.bookingDomainService.cancelBooking(booking, reason);

    await this.saveBookingAndPublishEvents(booking);

    this.logger.log(`Cancelled booking ${booking.getBookingReference()} with reason: ${reason}`);
  }

  async processBookingStatusUpdates(): Promise<string> {
    const activatedCount = await this.processBookingActivations();
    const completedCount = await this.processBookingCompletions();

    const result = `Processed status updates: ${activatedCount} activated, ${completedCount} completed`;
    this.logger.log(result);
    return result;
  }

  async processBookingActivations(): Promise<number> {
    const confirmedBookings = await this.bookingRepository.findEligibleForActivation();
    let activatedCount = 0;

    for (const booking of confirmedBookings) {
      try {
        // Use domain service for consistent validation and activation logic
        this.bookingDomainService.activateBooking(booking);
        await this.saveBookingAndPublishEvents(booking);

        activatedCount++;
        this.logger.log(`Auto-activated booking: ${booking.getBookingReference()}`);
      } catch (error) {
        this.logger.error(
          `Failed to activate booking ${booking.getBookingReference()}: ${error.message}`,
          error.stack,
        );
      }
    }

    return activatedCount;
  }

  async processBookingCompletions(): Promise<number> {
    const activeBookings = await this.bookingRepository.findEligibleForCompletion();
    let completedCount = 0;

    for (const booking of activeBookings) {
      try {
        // Use domain service for consistent validation and completion logic
        this.bookingDomainService.completeBooking(booking);
        await this.saveBookingAndPublishEvents(booking);

        completedCount++;
        this.logger.log(`Auto-completed booking: ${booking.getBookingReference()}`);
      } catch (error) {
        this.logger.error(
          `Failed to complete booking ${booking.getBookingReference()}: ${error.message}`,
          error.stack,
        );
      }
    }

    return completedCount;
  }

  private async findBookingOrThrow(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    return booking;
  }

  private async saveBookingAndPublishEvents(booking: Booking): Promise<Booking> {
    // Use transaction to ensure atomicity of booking save
    const savedBooking = await this.prisma.$transaction(async (tx) => {
      // Save booking within transaction
      const saved = await this.bookingRepository.saveWithTransaction(booking, tx);

      // If this is a new booking, mark it as created to trigger domain events
      if (!booking.getId() && saved.getId()) {
        saved.markAsCreated();
      }

      return saved;
    });

    // After transaction commits successfully, publish events from the original aggregate
    // We use the ORIGINAL 'booking' aggregate (not 'savedBooking') because:
    // - saveWithTransaction returns a reconstituted instance with an empty event list
    // - The original aggregate has the uncommitted events (cancellation, activation, completion, etc.)
    // - For existing bookings, events already have the correct booking ID
    // - For new bookings, savedBooking.markAsCreated() adds events to the saved instance
    const aggregateToPublish = !booking.getId() && savedBooking.getId() ? savedBooking : booking;

    if (aggregateToPublish.getUncommittedEvents().length > 0) {
      await this.domainEventPublisher.publish(aggregateToPublish);
    }

    return savedBooking;
  }
}
