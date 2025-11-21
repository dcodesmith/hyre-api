import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { BookingReminderService } from "../../../booking/application/services/booking-reminder.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { ReminderJobData } from "../../application/services/scheduler.service";

@Processor("reminder-emails")
@Injectable()
export class ReminderProcessor extends WorkerHost {
  constructor(
    private readonly bookingReminderService: BookingReminderService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ReminderJobData>) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ReminderJobData>) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<ReminderJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`, error.stack);
  }

  /**
   * IMPORTANT: All booking reminders are LEG-BASED
   * - Each booking can have multiple legs (multi-day bookings)
   * - Reminders are sent 1 HOUR before each leg starts/ends
   */
  async process(job: Job<ReminderJobData>): Promise<any> {
    switch (job.name) {
      // LEG START REMINDERS (1 hour before leg starts)
      case "booking-leg-start-reminder":
      case "manual-leg-start-reminder":
        return this.handleBookingLegStartReminder(job);

      // LEG END REMINDERS (1 hour before leg ends)
      case "booking-leg-end-reminder":
      case "manual-leg-end-reminder":
        return this.handleBookingLegEndReminder(job);

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async handleBookingLegStartReminder(_job: Job<ReminderJobData>) {
    try {
      const count = await this.bookingReminderService.processBookingLegStartReminders();
      return { success: true, remindersPublished: count };
    } catch (error) {
      this.logger.error(`Failed to process booking leg start reminders: ${error.message}`);
      throw error;
    }
  }

  private async handleBookingLegEndReminder(_job: Job<ReminderJobData>) {
    try {
      const count = await this.bookingReminderService.processBookingLegEndReminders();
      return { success: true, remindersPublished: count };
    } catch (error) {
      this.logger.error(`Failed to process booking leg end reminders: ${error.message}`);
      throw error;
    }
  }
}
