import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { PayoutService } from "../../../payment/application/services/payout.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { ProcessingJobData } from "../../application/services/scheduler.service";

@Processor("processing-jobs")
@Injectable()
export class ProcessingProcessor {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
  ) {}

  @Process("process-pending-payouts")
  async handlePendingPayouts(job: Job<ProcessingJobData>) {
    this.logger.log(`Processing pending payouts job: ${job.id}`, "ProcessingProcessor");

    try {
      const result = await this.payoutService.processPendingPayouts();

      this.logger.log(`Pending payouts processed: ${result}`, "ProcessingProcessor");

      return { success: true, result };
    } catch (error) {
      this.logger.error(
        `Failed to process pending payouts: ${error.message}`,
        error.stack,
        "ProcessingProcessor",
      );
      throw error;
    }
  }

  @Process("process-pending-notifications")
  async handlePendingNotifications(job: Job<ProcessingJobData>) {
    this.logger.log(`Processing pending notifications job: ${job.id}`, "ProcessingProcessor");

    try {
      const result = await this.notificationService.processPendingNotifications();

      this.logger.log(`Pending notifications processed: ${result}`, "ProcessingProcessor");

      return { success: true, result };
    } catch (error) {
      this.logger.error(
        `Failed to process pending notifications: ${error.message}`,
        error.stack,
        "ProcessingProcessor",
      );
      throw error;
    }
  }

  // Handle manual trigger jobs
  @Process("manual-pending-payouts")
  async handleManualPendingPayouts(job: Job<ProcessingJobData>) {
    return this.handlePendingPayouts(job);
  }

  @Process("manual-pending-notifications")
  async handleManualPendingNotifications(job: Job<ProcessingJobData>) {
    return this.handlePendingNotifications(job);
  }
}
