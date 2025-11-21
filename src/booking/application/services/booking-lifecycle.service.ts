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
import { BookingLegNotificationReadModel } from "../dtos/booking-leg-notification-read-model.dto";
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

  /**
   * Process leg starts and booking activations
   *
   * IMPORTANT: Three separate concerns handled together:
   * 1. LEG STATUS: Activate individual leg (CONFIRMED → ACTIVE)
   * 2. LEG NOTIFICATIONS: Send notification for EVERY leg that starts
   * 3. BOOKING ACTIVATION: Activate booking when FIRST leg starts (CONFIRMED → ACTIVE)
   *
   * Implementation follows DDD principles:
   * - Query returns DTOs with notification data (CQRS read side)
   * - Load booking aggregates for domain operations (write side)
   * - Domain entity validates state transitions
   * - Batch save all modified aggregates in single transaction
   * - Publish events with notification data after successful save
   */
  async processBookingActivations(): Promise<number> {
    // Step 1: Get legs with notification data (for events)
    const startingLegDTOs = await this.queryService.findStartingLegsForNotification();

    if (startingLegDTOs.length === 0) {
      return 0;
    }

    // Step 2: Load booking aggregates (batch load)
    const bookingIds = [...new Set(startingLegDTOs.map((leg) => leg.bookingId))];
    const bookings = await this.bookingRepository.findByIds(bookingIds);
    const bookingMap = new Map(bookings.map((booking) => [booking.getId(), booking]));

    let processedCount = 0;
    const processedLegs: BookingLegNotificationReadModel[] = [];
    const modifiedBookingIds = new Set<string>();

    // Step 3: Process each leg through its booking aggregate
    for (const legDTO of startingLegDTOs) {
      try {
        const booking = bookingMap.get(legDTO.bookingId);
        if (!booking) {
          this.logger.error(`Booking ${legDTO.bookingId} not found for leg ${legDTO.legId}`);
          continue;
        }

        // Domain operation with validation
        booking.activateLeg(legDTO.legId);

        processedLegs.push(legDTO);
        modifiedBookingIds.add(legDTO.bookingId);
        processedCount++;
      } catch (error) {
        this.logger.error(`Failed to activate leg ${legDTO.legId}: ${error.message}`, error.stack);
      }
    }

    // Step 4: Save all modified aggregates in single transaction
    const modifiedBookings = bookings.filter((b) => modifiedBookingIds.has(b.getId()));
    await this.bookingRepository.saveAll(modifiedBookings);

    // Step 5: Publish events for successfully processed legs
    for (const legDTO of processedLegs) {
      await this.eventBus.publish(new BookingLegStartedEvent(legDTO));
      this.logger.log(
        `Published leg started event for booking ${legDTO.bookingReference}, leg ${legDTO.legId}`,
      );
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
   * Implementation follows DDD principles:
   * - Query returns DTOs with notification data (CQRS read side)
   * - Load booking aggregates for domain operations (write side)
   * - Domain entity validates state transitions
   * - Batch save all modified aggregates in single transaction
   * - Publish events with notification data after successful save
   */
  async processBookingCompletions(): Promise<number> {
    // Step 1: Get legs with notification data (for events)
    const endingLegDTOs = await this.queryService.findEndingLegsForNotification();

    if (endingLegDTOs.length === 0) {
      return 0;
    }

    // Step 2: Load booking aggregates (batch load)
    const bookingIds = [...new Set(endingLegDTOs.map((leg) => leg.bookingId))];
    const bookings = await this.bookingRepository.findByIds(bookingIds);
    const bookingMap = new Map(bookings.map((booking) => [booking.getId(), booking]));

    let processedCount = 0;
    const processedLegs: BookingLegNotificationReadModel[] = [];
    const modifiedBookingIds = new Set<string>();

    // Step 3: Process each leg through its booking aggregate
    for (const legDTO of endingLegDTOs) {
      try {
        const booking = bookingMap.get(legDTO.bookingId);
        if (!booking) {
          this.logger.error(`Booking ${legDTO.bookingId} not found for leg ${legDTO.legId}`);
          continue;
        }

        // Domain operation with validation
        booking.completeLeg(legDTO.legId);

        processedLegs.push(legDTO);
        modifiedBookingIds.add(legDTO.bookingId);
        processedCount++;
      } catch (error) {
        this.logger.error(`Failed to complete leg ${legDTO.legId}: ${error.message}`, error.stack);
      }
    }

    // Step 4: Save all modified aggregates in single transaction
    const modifiedBookings = bookings.filter((booking) => modifiedBookingIds.has(booking.getId()));
    await this.bookingRepository.saveAll(modifiedBookings);

    // Step 5: Publish events for successfully processed legs
    for (const legDTO of processedLegs) {
      await this.eventBus.publish(new BookingLegEndedEvent(legDTO));
      this.logger.log(
        `Published leg ended event for booking ${legDTO.bookingReference}, leg ${legDTO.legId}`,
      );
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
