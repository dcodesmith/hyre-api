import { Inject, Injectable } from "@nestjs/common";
import { Notification } from "../../domain/entities/notification.entity";
import {
  NotificationBatchProcessingError,
  NotificationEmailDeliveryError,
  NotificationReminderCreationError,
  NotificationSmsDeliveryError,
  NotificationStatusUpdateError,
  NotificationTemplateRenderingError,
} from "../../domain/errors/notification.errors";
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
  constructor(
    @Inject("NotificationRepository")
    private readonly notificationRepository: NotificationRepository,
    @Inject(NotificationFactoryService)
    private readonly notificationFactory: NotificationFactoryService,
    @Inject(EmailService)
    private readonly emailService: EmailService,
    @Inject(SmsService)
    private readonly smsService: SmsService,
  ) {}

  async sendBookingStartReminders(data: BookingReminderData): Promise<string> {
    try {
      const notifications = this.notificationFactory.createBookingStartReminders(data);

      for (const notification of notifications) {
        await this.notificationRepository.save(notification);
        await this.deliverNotification(notification);
      }

      return `Sent ${notifications.length} booking start reminders`;
    } catch (error) {
      throw new NotificationReminderCreationError("start", data.bookingId, error.message);
    }
  }

  async sendBookingEndReminders(data: BookingReminderData): Promise<string> {
    try {
      const notifications = this.notificationFactory.createBookingEndReminders(data);

      for (const notification of notifications) {
        await this.notificationRepository.save(notification);
        await this.deliverNotification(notification);
      }

      return `Sent ${notifications.length} booking end reminders`;
    } catch (error) {
      throw new NotificationReminderCreationError("end", data.bookingId, error.message);
    }
  }

  async sendBookingLegStartReminders(data: BookingLegReminderData): Promise<string> {
    try {
      const notifications = this.notificationFactory.createBookingLegStartReminders(data);

      for (const notification of notifications) {
        await this.notificationRepository.save(notification);
        await this.deliverNotification(notification);
      }

      return `Sent ${notifications.length} booking leg start reminders`;
    } catch (error) {
      throw new NotificationReminderCreationError("leg-start", data.bookingId, error.message);
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

      return "Sent booking status update notification";
    } catch (error) {
      throw new NotificationStatusUpdateError(
        data.bookingId,
        data.status,
        error.message,
        data.customerId,
      );
    }
  }

  async processPendingNotifications(): Promise<string> {
    const pendingNotifications = await this.notificationRepository.findPendingNotifications();
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const notification of pendingNotifications) {
      try {
        await this.deliverNotification(notification);
        successCount++;
      } catch (error) {
        failureCount++;
        errors.push(`Notification ${notification.id}: ${error.message}`);
      }
    }

    if (failureCount > 0) {
      throw new NotificationBatchProcessingError(
        "pending",
        pendingNotifications.length,
        successCount,
        failureCount,
        errors,
      );
    }

    return `Processed ${pendingNotifications.length} pending notifications: ${successCount} successful, ${failureCount} failed`;
  }

  async retryFailedNotifications(): Promise<string> {
    const failedNotifications = await this.notificationRepository.findNotificationsToRetry();
    let retryCount = 0;
    const errors: string[] = [];

    for (const notification of failedNotifications) {
      try {
        notification.retry();
        await this.notificationRepository.save(notification);
        await this.deliverNotification(notification);
        retryCount++;
      } catch (error) {
        errors.push(`Notification ${notification.id}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new NotificationBatchProcessingError(
        "retry",
        failedNotifications.length,
        retryCount,
        failedNotifications.length - retryCount,
        errors,
      );
    }

    return `Retried ${retryCount} failed notifications`;
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
    } catch (error) {
      notification.markAsFailed(error.message);
      await this.notificationRepository.save(notification);
      throw error;
    }
  }

  private async deliverEmail(notification: Notification): Promise<void> {
    if (!notification.getRecipient().hasEmail()) {
      throw new NotificationEmailDeliveryError(
        notification.id,
        "Recipient has no email address",
        notification.getRecipient().id,
      );
    }

    const content = notification.getContent().interpolate();
    let htmlContent: string;

    try {
      htmlContent = await this.emailService.renderTemplate(content);
    } catch (error) {
      throw new NotificationTemplateRenderingError(
        notification.id,
        error.message,
        notification.getRecipient().id,
      );
    }

    const response = await this.emailService.sendEmail({
      to: notification.getRecipient().email,
      subject: content.subject,
      htmlContent,
      textContent: content.body,
    });

    if (!response.success) {
      throw new NotificationEmailDeliveryError(
        notification.id,
        response.error || "Unknown email service error",
        notification.getRecipient().id,
      );
    }
  }

  private async deliverSms(notification: Notification): Promise<void> {
    if (!notification.getRecipient().hasPhoneNumber()) {
      throw new NotificationSmsDeliveryError(
        notification.id,
        "Recipient has no phone number",
        notification.getRecipient().id,
      );
    }

    const content = notification.getContent().interpolate();

    const response = await this.smsService.send({
      to: notification.getRecipient().phoneNumber,
      message: content.body,
    });

    if (!response.success) {
      throw new NotificationSmsDeliveryError(
        notification.id,
        response.error || "Unknown SMS service error",
        notification.getRecipient().id,
      );
    }
  }
}
