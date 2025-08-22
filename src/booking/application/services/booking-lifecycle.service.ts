import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingDomainService } from "../../domain/services/booking-domain.service";

/**
 * Application service responsible for booking lifecycle operations
 * Following SRP - focused only on booking status transitions and lifecycle management
 */
@Injectable()
export class BookingLifecycleService {
  constructor(
    @Inject("BookingRepository") private readonly bookingRepository: BookingRepository,
    private readonly bookingDomainService: BookingDomainService,
    private readonly prisma: PrismaService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<void> {
    const booking = await this.findBookingOrThrow(bookingId);

    // Use domain service for consistent cancellation logic
    this.bookingDomainService.cancelBooking(booking, reason);

    await this.saveBookingAndPublishEvents(booking);

    this.logger.log(`Cancelled booking ${booking.getBookingReference()} with reason: ${reason}`);
  }

  async processBookingStatusUpdates(): Promise<string> {
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

    // Process active to completed transitions
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

    const result = `Processed status updates: ${activatedCount} activated, ${completedCount} completed`;
    this.logger.log(result);
    return result;
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
