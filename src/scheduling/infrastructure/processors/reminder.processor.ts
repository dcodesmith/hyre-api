import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { LoggerService } from "../../../shared/logging/logger.service";
import { ReminderJobData } from "../../application/services/scheduler.service";
import { ReminderProcessingService } from "../services/reminder-processing.service";

@Processor("reminder-emails")
@Injectable()
export class ReminderProcessor {
  constructor(
    private readonly reminderProcessingService: ReminderProcessingService,
    private readonly logger: LoggerService,
  ) {}

  @Process("booking-start-reminder")
  async handleBookingStartReminder(job: Job<ReminderJobData>) {
    this.logger.log(`Processing booking start reminder job: ${job.id}`);

    try {
      const result = await this.reminderProcessingService.processBookingStartReminders();

      this.logger.log(`Booking start reminders processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process booking start reminders: ${error.message}`,
error.stack);
      throw error;
    }
  }

  @Process("booking-end-reminder")
  async handleBookingEndReminder(job: Job<ReminderJobData>) {
    this.logger.log(`Processing booking end reminder job: ${job.id}`);

    try {
      const result = await this.reminderProcessingService.processBookingEndReminders();

      this.logger.log(`Booking end reminders processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process booking end reminders: ${error.message}`,
error.stack);
      throw error;
    }
  }

  @Process("booking-leg-start-reminder")
  async handleBookingLegStartReminder(job: Job<ReminderJobData>) {
    this.logger.log(`Processing booking leg start reminder job: ${job.id}`);

    try {
      const result = await this.reminderProcessingService.processBookingLegStartReminders();

      this.logger.log(`Booking leg start reminders processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process booking leg start reminders: ${error.message}`,
error.stack);
      throw error;
    }
  }

  @Process("booking-leg-end-reminder")
  async handleBookingLegEndReminder(job: Job<ReminderJobData>) {
    this.logger.log(`Processing booking leg end reminder job: ${job.id}`);

    try {
      const result = await this.reminderProcessingService.processBookingLegEndReminders();

      this.logger.log(`Booking leg end reminders processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process booking leg end reminders: ${error.message}`,
error.stack);
      throw error;
    }
  }

  // Handle manual trigger jobs
  @Process("manual-trip-start-reminder")
  async handleManualTripStartReminder(job: Job<ReminderJobData>) {
    return this.handleBookingStartReminder(job);
  }

  @Process("manual-trip-end-reminder")
  async handleManualTripEndReminder(job: Job<ReminderJobData>) {
    return this.handleBookingEndReminder(job);
  }

  @Process("manual-leg-start-reminder")
  async handleManualLegStartReminder(job: Job<ReminderJobData>) {
    return this.handleBookingLegStartReminder(job);
  }

  @Process("manual-leg-end-reminder")
  async handleManualLegEndReminder(job: Job<ReminderJobData>) {
    return this.handleBookingLegEndReminder(job);
  }
}
