import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { PayoutService } from "../../../payment/application/services/payout.service";
import { type Logger, LoggerService } from "../../../shared/logging/logger.service";
import { ProcessingJobData } from "../../application/services/scheduler.service";

@Processor("processing-jobs")
@Injectable()
export class ProcessingProcessor extends WorkerHost {
  private readonly logger: Logger;
  constructor(
    private readonly payoutService: PayoutService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    super();
    this.logger = this.loggerService.createLogger(ProcessingProcessor.name);
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ProcessingJobData>) {
    this.logger.info(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ProcessingJobData>) {
    this.logger.info(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<ProcessingJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }

  async process(job: Job<ProcessingJobData>): Promise<any> {
    switch (job.name) {
      case "process-pending-payouts":
      case "manual-pending-payouts":
        return this.handlePendingPayouts(job);
      case "process-pending-notifications":
      case "manual-pending-notifications":
        return this.handlePendingNotifications(job);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async handlePendingPayouts(job: Job<ProcessingJobData>) {
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

  private async handlePendingNotifications(job: Job<ProcessingJobData>) {
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
}
