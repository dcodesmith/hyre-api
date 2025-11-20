import { Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingLegEndReminderEvent } from "../../domain/events/booking-leg-end-reminder.event";
import { BookingLegStartReminderEvent } from "../../domain/events/booking-leg-start-reminder.event";
import { BookingLegQueryService } from "../queries/booking-leg-query.service";

/**
 * Booking Reminder Service
 *
 * IMPORTANT: All reminders are LEG-BASED, not booking-based
 * - Each booking can have multiple legs (multi-day bookings)
 * - Reminders are sent 1 HOUR before each leg starts/ends
 * - This ensures customers/chauffeurs are reminded for EACH day's journey
 *
 * Responsibilities:
 * - Orchestrate leg reminder processing workflow
 * - Use dedicated query service to fetch read models (CQRS read side)
 * - Publish domain events for cross-context communication
 * - Handle errors and logging
 *
 * Why we use BookingReminderQueryService instead of BookingRepository:
 * - BookingRepository returns domain entities (Booking) for write operations
 * - BookingReminderQueryService returns read models (DTOs) optimized for reminder queries
 * - This follows CQRS: separate models for commands (writes) and queries (reads)
 * - Query service fetches all related data in one query (no N+1 problem)
 * - Domain entities don't need to know about cross-aggregate data projection
 * - Dedicated query service maintains single responsibility principle
 */
@Injectable()
export class BookingReminderService {
  constructor(
    private readonly bookingLegQueryService: BookingLegQueryService,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Process leg start reminders - sent 1 HOUR before each leg starts
   *
   * This eliminates N+1 query problem and separates read/write concerns (CQRS)
   */
  async processBookingLegStartReminders(): Promise<number> {
    // Single query with all related data (read model)
    const legs = await this.bookingLegQueryService.findEligibleLegsForStartRemindersWithData();
    let published = 0;

    for (const leg of legs) {
      try {
        // Pass the entire DTO object instead of 15 individual parameters
        this.eventBus.publish(new BookingLegStartReminderEvent(leg));
        published++;
      } catch (error) {
        this.logger.error(
          `Failed to process booking leg start reminder for ${leg.legId}: ${error.message}`,
        );
      }
    }

    return published;
  }

  /**
   * Process leg end reminders - sent 1 HOUR before each leg ends
   *
   * This eliminates N+1 query problem and separates read/write concerns (CQRS)
   */
  async processBookingLegEndReminders(): Promise<number> {
    // Single query with all related data (read model)
    const legs = await this.bookingLegQueryService.findEligibleLegsForEndRemindersWithData();
    let published = 0;

    for (const leg of legs) {
      try {
        this.eventBus.publish(new BookingLegEndReminderEvent(leg));
        published++;
      } catch (error) {
        this.logger.error(
          `Failed to process booking leg end reminder for ${leg.legId}: ${error.message}`,
        );
      }
    }

    return published;
  }
}
