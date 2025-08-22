import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { BookingApplicationService } from "../../../booking/application/services/booking-application.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { StatusUpdateJobData } from "../../application/services/scheduler.service";

@Processor("status-updates")
@Injectable()
export class StatusUpdateProcessor {
  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly logger: LoggerService,
  ) {}

  @Process("confirmed-to-active")
  async handleConfirmedToActive(job: Job<StatusUpdateJobData>) {
    this.logger.log(`Processing confirmed to active status update job: ${job.id}`);

    try {
      const result = await this.bookingApplicationService.processBookingStatusUpdates();

      this.logger.log(`Confirmed to active updates processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process confirmed to active updates: ${error.message}`,
error.stack);
      throw error;
    }
  }

  @Process("active-to-completed")
  async handleActiveToCompleted(job: Job<StatusUpdateJobData>) {
    this.logger.log(`Processing active to completed status update job: ${job.id}`);

    try {
      const result = await this.bookingApplicationService.processBookingStatusUpdates();

      this.logger.log(`Active to completed updates processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process active to completed updates: ${error.message}`,
error.stack);
      throw error;
    }
  }

  // Handle manual trigger jobs
  @Process("manual-confirmed-to-active")
  async handleManualConfirmedToActive(job: Job<StatusUpdateJobData>) {
    return this.handleConfirmedToActive(job);
  }

  @Process("manual-active-to-completed")
  async handleManualActiveToCompleted(job: Job<StatusUpdateJobData>) {
    return this.handleActiveToCompleted(job);
  }
}
