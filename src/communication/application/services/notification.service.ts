import { Injectable } from "@nestjs/common";
import { LoggerService, type Logger } from "../../../shared/logging/logger.service";
import { Notification } from "../../domain/entities/notification.entity";
import { NotificationRepository } from "../../domain/repositories/notification.repository";
import { EmailService } from "../../domain/services/email.service.interface";
import {
  BookingLegReminderData,
  BookingReminderData,
  BookingStatusUpdateData,
  NotificationFactoryService,
} from "../../domain/services/notification-factory.service";
import { SmsService } from "../../domain/services/sms.service.interface";

@Injectable()
export class NotificationService {
  private readonly logger: Logger;
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationFactory: NotificationFactoryService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(NotificationService.name);
  }

  async sendBookingStartReminders(data: BookingReminderData): Promise<string> {
    try {
      const notifications = this.notificationFactory.createBookingStartReminders(data);

      for (const notification of notifications) {
        await this.notificationRepository.save(notification);
        await this.deliverNotification(notification);
      }

      this.logger.info(
        `Sent ${notifications.length} booking start reminder notifications for booking ${data.bookingId}`,
      );

      return `Sent ${notifications.length} booking start reminders`;
    } catch (error) {
      this.logger.error(`Failed to send booking start reminders: ${error.message}`);
      throw error;
    }
  }

  async sendBookingEndReminders(data: BookingReminderData): Promise<string> {
    try {
      const notifications = this.notificationFactory.createBookingEndReminders(data);

      for (const notification of notifications) {
        await this.notificationRepository.save(notification);
        await this.deliverNotification(notification);
      }

      this.logger.info(
        `Sent ${notifications.length} booking end reminder notifications for booking ${data.bookingId}`,
      );

      return `Sent ${notifications.length} booking end reminders`;
    } catch (error) {
      this.logger.error(`Failed to send booking end reminders: ${error.message}`);
      throw error;
    }
  }

  async sendBookingLegStartReminders(data: BookingLegReminderData): Promise<string> {
    try {
      const notifications = this.notificationFactory.createBookingLegStartReminders(data);

      for (const notification of notifications) {
        await this.notificationRepository.save(notification);
        await this.deliverNotification(notification);
      }

      this.logger.info(
        `Sent ${notifications.length} booking leg start reminder notifications for leg ${data.bookingLegId}`,
      );

      return `Sent ${notifications.length} booking leg start reminders`;
    } catch (error) {
      this.logger.error(`Failed to send booking leg start reminders: ${error.message}`);
      throw error;
    }
  }

  async sendBookingStatusUpdate(data: BookingStatusUpdateData): Promise<string> {
    try {
      const notification = this.notificationFactory.createBookingStatusUpdateNotification(data);

      if (!notification) {
        return "No notification sent - recipient has no contact information";
      }

      await this.notificationRepository.save(notification);
      await this.deliverNotification(notification);

      this.logger.info(`Sent booking status update notification for booking ${data.bookingId}`);

      return "Sent booking status update notification";
    } catch (error) {
      this.logger.error(`Failed to send booking status update: ${error.message}`);
      throw error;
    }
  }

  async processPendingNotifications(): Promise<string> {
    const pendingNotifications = await this.notificationRepository.findPendingNotifications();
    let successCount = 0;
    let failureCount = 0;

    for (const notification of pendingNotifications) {
      try {
        await this.deliverNotification(notification);
        successCount++;
      } catch (error) {
        failureCount++;
        this.logger.error(`Failed to deliver notification ${notification.id}: ${error.message}`);
      }
    }

    const result = `Processed ${pendingNotifications.length} pending notifications: ${successCount} successful, ${failureCount} failed`;
    this.logger.info(result);
    return result;
  }

  async retryFailedNotifications(): Promise<string> {
    const failedNotifications = await this.notificationRepository.findNotificationsToRetry();
    let retryCount = 0;

    for (const notification of failedNotifications) {
      try {
        notification.retry();
        await this.notificationRepository.save(notification);
        await this.deliverNotification(notification);
        retryCount++;
      } catch (error) {
        this.logger.error(`Failed to retry notification ${notification.id}: ${error.message}`);
      }
    }

    const result = `Retried ${retryCount} failed notifications`;
    this.logger.info(result);
    return result;
  }

  async sendNotification(notification: Notification): Promise<void> {
    await this.notificationRepository.save(notification);
    await this.deliverNotification(notification);
  }

  private async deliverNotification(notification: Notification): Promise<void> {
    notification.recordAttempt();

    try {
      if (notification.needsEmailDelivery()) {
        await this.deliverEmail(notification);
      }

      if (notification.needsSmsDelivery()) {
        await this.deliverSms(notification);
      }

      notification.markAsSent();
      await this.notificationRepository.save(notification);

      this.logger.info(`Successfully delivered notification ${notification.id}`);
    } catch (error) {
      notification.markAsFailed(error.message);
      await this.notificationRepository.save(notification);
      throw error;
    }
  }

  private async deliverEmail(notification: Notification): Promise<void> {
    if (!notification.getRecipient().hasEmail()) {
      throw new Error("Recipient has no email address");
    }

    const content = notification.getContent().interpolate();
    const htmlContent = await this.emailService.renderTemplate(content);

    const response = await this.emailService.sendEmail({
      to: notification.getRecipient().email,
      subject: content.subject,
      htmlContent,
      textContent: content.body,
    });

    if (!response.success) {
      throw new Error(`Email delivery failed: ${response.error}`);
    }
  }

  private async deliverSms(notification: Notification): Promise<void> {
    if (!notification.getRecipient().hasPhoneNumber()) {
      throw new Error("Recipient has no phone number");
    }

    const content = notification.getContent().interpolate();

    const response = await this.smsService.send({
      to: notification.getRecipient().phoneNumber,
      message: content.body,
    });

    if (!response.success) {
      throw new Error(`SMS delivery failed: ${response.error}`);
    }
  }
}
