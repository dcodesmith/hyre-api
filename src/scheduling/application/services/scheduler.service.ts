import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Queue } from "bull";
import { type Logger, LoggerService } from "../../../shared/logging/logger.service";

export interface ReminderJobData {
  type: "trip-start" | "trip-end" | "leg-start" | "leg-end";
  timestamp: string;
}

export interface StatusUpdateJobData {
  type: "confirmed-to-active" | "active-to-completed";
  timestamp: string;
}

export interface ProcessingJobData {
  type: "pending-payouts" | "pending-notifications";
  timestamp: string;
}

@Injectable()
export class SchedulerService {
  private readonly logger: Logger;

  constructor(
    @InjectQueue("reminder-emails") private readonly reminderQueue: Queue,
    @InjectQueue("status-updates") private readonly statusQueue: Queue,
    @InjectQueue("processing-jobs") private readonly processingQueue: Queue,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(SchedulerService.name);
  }

  // Booking leg start reminders - every hour from 6-11 AM and at 10 PM
  @Cron("0 6-11,22 * * *")
  async scheduleBookingLegStartReminders() {
    const jobData: ReminderJobData = {
      type: "leg-start",
      timestamp: new Date().toISOString(),
    };

    await this.reminderQueue.add("booking-leg-start-reminder", jobData, {
      priority: 10,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });

    this.logger.info("Scheduled booking leg start reminder job");
  }

  // Booking leg end reminders - at 4 AM and hourly from 6-11 PM
  @Cron("0 4,18-23 * * *")
  async scheduleBookingLegEndReminders() {
    const jobData: ReminderJobData = {
      type: "leg-end",
      timestamp: new Date().toISOString(),
    };

    await this.reminderQueue.add("booking-leg-end-reminder", jobData, {
      priority: 10,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });

    this.logger.info("Scheduled booking leg end reminder job");
  }

  // Booking start reminders - every hour from 6-11 AM and at 10 PM
  @Cron("0 6-11,22 * * *")
  async scheduleBookingStartReminders() {
    const jobData: ReminderJobData = {
      type: "trip-start",
      timestamp: new Date().toISOString(),
    };

    await this.reminderQueue.add("booking-start-reminder", jobData, {
      priority: 8,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });

    this.logger.info("Scheduled booking start reminder job");
  }

  // Booking end reminders - at 4 AM and hourly from 6-11 PM
  @Cron("0 4,18-23 * * *")
  async scheduleBookingEndReminders() {
    const jobData: ReminderJobData = {
      type: "trip-end",
      timestamp: new Date().toISOString(),
    };

    await this.reminderQueue.add("booking-end-reminder", jobData, {
      priority: 8,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });

    this.logger.info("Scheduled booking end reminder job");
  }

  // Status updates: confirmed to active - hourly from 7 AM to 12 PM and at 11 PM
  @Cron("0 7-12,23 * * *")
  async scheduleConfirmedToActiveUpdates() {
    const jobData: StatusUpdateJobData = {
      type: "confirmed-to-active",
      timestamp: new Date().toISOString(),
    };

    await this.statusQueue.add("confirmed-to-active", jobData, {
      priority: 15,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });

    this.logger.info("Scheduled confirmed to active status update job");
  }

  // Status updates: active to completed - at midnight, 5 AM, and hourly from 7-11 PM
  @Cron("0 0,5,19-23 * * *")
  async scheduleActiveToCompletedUpdates() {
    const jobData: StatusUpdateJobData = {
      type: "active-to-completed",
      timestamp: new Date().toISOString(),
    };

    await this.statusQueue.add("active-to-completed", jobData, {
      priority: 15,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });

    this.logger.info("Scheduled active to completed status update job");
  }

  // Process pending payouts - every 30 minutes during business hours
  @Cron("*/30 6-18 * * 1-5")
  async schedulePendingPayoutProcessing() {
    const jobData: ProcessingJobData = {
      type: "pending-payouts",
      timestamp: new Date().toISOString(),
    };

    await this.processingQueue.add("process-pending-payouts", jobData, {
      priority: 20,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    });

    this.logger.info("Scheduled pending payout processing job");
  }

  // Process pending notifications - every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async schedulePendingNotificationProcessing() {
    const jobData: ProcessingJobData = {
      type: "pending-notifications",
      timestamp: new Date().toISOString(),
    };

    await this.processingQueue.add("process-pending-notifications", jobData, {
      priority: 25,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });

    this.logger.info("Scheduled pending notification processing job");
  }

  // Manual job triggering methods for testing and administration
  async triggerManualReminderJob(
    type: "trip-start" | "trip-end" | "leg-start" | "leg-end",
  ): Promise<void> {
    const jobData: ReminderJobData = {
      type,
      timestamp: new Date().toISOString(),
    };

    const jobName = `manual-${type}-reminder`;
    await this.reminderQueue.add(jobName, jobData, {
      priority: 30, // Higher priority for manual jobs
    });

    this.logger.info(`Manually triggered ${type} reminder job`);
  }

  async triggerManualStatusUpdate(
    type: "confirmed-to-active" | "active-to-completed",
  ): Promise<void> {
    const jobData: StatusUpdateJobData = {
      type,
      timestamp: new Date().toISOString(),
    };

    const jobName = `manual-${type}`;
    await this.statusQueue.add(jobName, jobData, {
      priority: 30,
    });

    this.logger.info(`Manually triggered ${type} status update job`);
  }

  async triggerManualProcessing(type: "pending-payouts" | "pending-notifications"): Promise<void> {
    const jobData: ProcessingJobData = {
      type,
      timestamp: new Date().toISOString(),
    };

    const jobName = `manual-${type}`;
    await this.processingQueue.add(jobName, jobData, {
      priority: 30,
    });

    this.logger.info(`Manually triggered ${type} processing job`);
  }

  // Queue statistics
  async getQueueStats() {
    const [reminderStats, statusStats, processingStats] = await Promise.all([
      this.getQueueStatistics(this.reminderQueue),
      this.getQueueStatistics(this.statusQueue),
      this.getQueueStatistics(this.processingQueue),
    ]);

    return {
      timestamp: new Date().toISOString(),
      queues: {
        "reminder-emails": reminderStats,
        "status-updates": statusStats,
        "processing-jobs": processingStats,
      },
    };
  }

  private async getQueueStatistics(queue: Queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }
}
