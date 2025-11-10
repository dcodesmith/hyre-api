import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { PayoutService } from "../../../payment/application/services/payout.service";
import { LoggerService, type Logger } from "../../../shared/logging/logger.service";
import { ProcessingJobData } from "../../application/services/scheduler.service";

@Processor("processing-jobs")
@Injectable()
export class ProcessingProcessor {
  private readonly logger: Logger;
  constructor(
    private readonly payoutService: PayoutService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(ProcessingProcessor.name);
  }

  @Process("process-pending-payouts")
  async handlePendingPayouts(job: Job<ProcessingJobData>) {
    this.logger.info(`Processing pending payouts job: ${job.id}`);

    try {
      const result = await this.payoutService.processPendingPayouts();

      this.logger.info(`Pending payouts processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process pending payouts: ${error.message}`);
      throw error;
    }
  }

  @Process("process-pending-notifications")
  async handlePendingNotifications(job: Job<ProcessingJobData>) {
    this.logger.info(`Processing pending notifications job: ${job.id}`);

    try {
      const result = await this.notificationService.processPendingNotifications();

      this.logger.info(`Pending notifications processed: ${result}`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Failed to process pending notifications: ${error.message}`);
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
