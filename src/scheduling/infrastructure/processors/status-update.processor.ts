import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { BookingApplicationService } from "../../../booking/application/services/booking-application.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { StatusUpdateJobData } from "../../application/services/scheduler.service";

@Processor("status-updates")
@Injectable()
export class StatusUpdateProcessor extends WorkerHost {
  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  @OnWorkerEvent("active")
  onActive(job: Job<StatusUpdateJobData>) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<StatusUpdateJobData>) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<StatusUpdateJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`, error.stack);
  }

  async process(job: Job<StatusUpdateJobData>): Promise<any> {
    switch (job.name) {
      case "confirmed-to-active":
      case "manual-confirmed-to-active":
        return this.handleConfirmedToActive(job);
      case "active-to-completed":
      case "manual-active-to-completed":
        return this.handleActiveToCompleted(job);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async handleConfirmedToActive(job: Job<StatusUpdateJobData>) {
    this.logger.log(`Processing confirmed to active status update job: ${job.id}`);

    try {
      const activatedCount = await this.bookingApplicationService.processBookingActivations();
      const result = `Activated ${activatedCount} booking(s)`;

      this.logger.log(`Confirmed to active updates processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process confirmed to active updates: ${error.message}`);
      throw error;
    }
  }

  private async handleActiveToCompleted(job: Job<StatusUpdateJobData>) {
    this.logger.log(`Processing active to completed status update job: ${job.id}`);

    try {
      const completedCount = await this.bookingApplicationService.processBookingCompletions();
      const result = `Completed ${completedCount} booking(s)`;

      this.logger.log(`Active to completed updates processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process active to completed updates: ${error.message}`);
      throw error;
    }
  }

}
