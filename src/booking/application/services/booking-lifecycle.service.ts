import { Inject, Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { User } from "../../../iam/domain/entities/user.entity";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingLegEndedEvent } from "../../domain/events/booking-leg-ended.event";
import { BookingLegStartedEvent } from "../../domain/events/booking-leg-started.event";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingAuthorizationService } from "../../domain/services/booking-authorization.service";
import { BookingDomainService } from "../../domain/services/booking-domain.service";
import { BookingLegQueryService } from "../queries/booking-leg-query.service";

/**
 * Application service responsible for booking lifecycle operations
 * Following SRP - focused only on booking status transitions and lifecycle management
 * Delegates authorization decisions to BookingAuthorizationService (domain layer)
 *
 * IMPORTANT: Status changes are LEG-BASED with MINUTE-PRECISION
 * - Uses BookingLegQueryService for leg-based status change queries
 * - Query service checks leg start/end times (not booking start/end)
 * - Minute-precision window ensures exact timing (09:00:00.000 to 09:00:59.999)
 */
@Injectable()
export class BookingLifecycleService {
  constructor(
    @Inject("BookingRepository") private readonly bookingRepository: BookingRepository,
    private readonly bookingAuthorizationService: BookingAuthorizationService,
    private readonly bookingDomainService: BookingDomainService,
    private readonly queryService: BookingLegQueryService,
    private readonly eventBus: EventBus,
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

  /**
   * Process leg starts and booking activations
   *
   * IMPORTANT: Three separate concerns handled together:
   * 1. LEG STATUS: Activate individual leg (PENDING → ACTIVE)
   * 2. LEG NOTIFICATIONS: Send notification for EVERY leg that starts
   * 3. BOOKING ACTIVATION: Activate booking when FIRST leg starts (CONFIRMED → ACTIVE)
   *
   * - Queries ALL legs where legStartTime falls within current minute
   * - For each leg: Activate leg status, publish BookingLegStartedEvent (notification)
   * - For bookings: Check if CONFIRMED and activate (idempotent - only first leg activates)
   * - Query returns DTOs with ALL notification data (no N+1 queries)
   * - Fat event pattern - handlers receive all data needed
   */
  async processBookingActivations(): Promise<number> {
    const startingLegs = await this.queryService.findStartingLegsForNotification();
    let processedCount = 0;

    for (const legNotification of startingLegs) {
      try {
        // active each leg and publish event. Need booking leg domain here, so I can do leg.activate() and save leg
        await this.eventBus.publish(new BookingLegStartedEvent(legNotification));
        this.logger.log(
          `Published leg started event for booking ${legNotification.bookingReference}, leg ${legNotification.legId}`,
        );

        // activate the booking itself here, publishing the BookingActivatedEvent here doesn't send any notifications

        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process leg start for booking ${legNotification.bookingReference}: ${error.message}`,
          error.stack,
        );
      }
    }

    return processedCount;
  }

  /**
   * Process leg ends and booking completions
   *
   * IMPORTANT: Three separate concerns handled together:
   * 1. LEG STATUS: Complete individual leg (ACTIVE → COMPLETED)
   * 2. LEG NOTIFICATIONS: Send notification for EVERY leg that ends
   * 3. BOOKING COMPLETION: Complete booking ONLY when booking ends TODAY (ACTIVE → COMPLETED)
   *
   * - Queries ALL legs where legEndTime falls within current minute
   * - For each leg: Complete leg status, publish BookingLegEndedEvent (notification)
   * - For bookings: Check if endDate is today and complete (domain validates this)
   * - Query returns DTOs with ALL notification data (no N+1 queries)
   * - Fat event pattern - handlers receive all data needed
   */
  async processBookingCompletions(): Promise<number> {
    const endingLegs = await this.queryService.findEndingLegsForNotification();
    let processedCount = 0;

    for (const legNotification of endingLegs) {
      try {
        // complete each leg and publish event. Need booking leg domain here, so I can do leg.complete() and save leg

        await this.eventBus.publish(new BookingLegEndedEvent(legNotification));
        this.logger.log(
          `Published leg ended event for booking ${legNotification.bookingReference}, leg ${legNotification.legId}`,
        );

        // Handle booking completion (only once per booking, only if endDate is today)
        // complete the booking itself here, publishing the BookingCompletedEvent here doesn't send any notifications

        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process leg end for booking ${legNotification.bookingReference}: ${error.message}`,
          error.stack,
        );
      }
    }

    return processedCount;
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
