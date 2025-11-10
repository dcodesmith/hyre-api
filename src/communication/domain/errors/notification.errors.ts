import { BaseDomainError } from "../../../shared/domain/errors/base-domain.error";

export abstract class NotificationDomainError extends BaseDomainError {
  readonly context = "notification";
}

export class NotificationRecipientMissingEmailError extends NotificationDomainError {
  readonly code = "NOTIFICATION_RECIPIENT_MISSING_EMAIL";
  constructor(recipientId?: string) {
    super("Recipient does not have email for email notification", { recipientId });
  }
}

export class NotificationRecipientMissingPhoneError extends NotificationDomainError {
  readonly code = "NOTIFICATION_RECIPIENT_MISSING_PHONE";
  constructor(recipientId?: string) {
    super("Recipient does not have phone number for SMS notification", { recipientId });
  }
}

export class NotificationRecipientMissingBothContactsError extends NotificationDomainError {
  readonly code = "NOTIFICATION_RECIPIENT_MISSING_BOTH_CONTACTS";
  constructor(recipientId?: string) {
    super("Recipient must have both email and phone number for multi-channel notification", {
      recipientId,
    });
  }
}

export class NotificationCannotBeMarkedAsSentError extends NotificationDomainError {
  readonly code = "NOTIFICATION_CANNOT_BE_MARKED_AS_SENT";
  constructor(notificationId: string, currentStatus: string) {
    super(`Notification ${notificationId} cannot be marked as sent from ${currentStatus} status`, {
      notificationId,
      currentStatus,
    });
  }
}

export class NotificationCannotBeMarkedAsDeliveredError extends NotificationDomainError {
  readonly code = "NOTIFICATION_CANNOT_BE_MARKED_AS_DELIVERED";
  constructor(notificationId: string, currentStatus: string) {
    super(
      `Notification ${notificationId} cannot be marked as delivered from ${currentStatus} status`,
      {
        notificationId,
        currentStatus,
      },
    );
  }
}

export class NotificationFailureReasonRequiredError extends NotificationDomainError {
  readonly code = "NOTIFICATION_FAILURE_REASON_REQUIRED";
  constructor(notificationId: string) {
    super(`Failure reason cannot be empty for notification ${notificationId}`, { notificationId });
  }
}

export class NotificationCannotBeRetriedError extends NotificationDomainError {
  readonly code = "NOTIFICATION_CANNOT_BE_RETRIED";
  constructor(notificationId: string, reason: string) {
    super(`Notification ${notificationId} cannot be retried: ${reason}`, {
      notificationId,
      reason,
    });
  }
}

export class NotificationEmailDeliveryError extends NotificationDomainError {
  readonly code = "NOTIFICATION_EMAIL_DELIVERY_ERROR";
  constructor(notificationId: string, emailServiceError: string, recipientId?: string) {
    super(`Email delivery failed for notification ${notificationId}: ${emailServiceError}`, {
      notificationId,
      emailServiceError,
      recipientId,
    });
  }
}

export class NotificationSmsDeliveryError extends NotificationDomainError {
  readonly code = "NOTIFICATION_SMS_DELIVERY_ERROR";
  constructor(notificationId: string, smsServiceError: string, recipientId?: string) {
    super(`SMS delivery failed for notification ${notificationId}: ${smsServiceError}`, {
      notificationId,
      smsServiceError,
      recipientId,
    });
  }
}

export class NotificationTemplateRenderingError extends NotificationDomainError {
  readonly code = "NOTIFICATION_TEMPLATE_RENDERING_ERROR";
  constructor(notificationId: string, templateError: string, recipientId?: string) {
    super(`Failed to render email template for notification ${notificationId}: ${templateError}`, {
      notificationId,
      templateError,
      recipientId,
    });
  }
}

export class NotificationServiceConfigurationError extends NotificationDomainError {
  readonly code = "NOTIFICATION_SERVICE_CONFIGURATION_ERROR";
  constructor(missingService: "email" | "sms" | "factory" | "repository", originalError: string) {
    super(
      `Notification service configuration error: ${missingService} service not available - ${originalError}`,
      {
        missingService,
        originalError,
      },
    );
  }
}

export class NotificationBatchProcessingError extends NotificationDomainError {
  readonly code = "NOTIFICATION_BATCH_PROCESSING_ERROR";
  constructor(
    batchType: "pending" | "retry",
    totalCount: number,
    successCount: number,
    failureCount: number,
    errors: string[],
  ) {
    super(
      `Batch processing failed for ${batchType} notifications: ${successCount}/${totalCount} successful, ${failureCount} failed`,
      {
        batchType,
        totalCount,
        successCount,
        failureCount,
        errors,
      },
    );
  }
}

export class NotificationReminderCreationError extends NotificationDomainError {
  readonly code = "NOTIFICATION_REMINDER_CREATION_ERROR";
  constructor(
    reminderType: "start" | "end" | "leg-start",
    bookingId: string,
    originalError: string,
  ) {
    super(
      `Failed to create ${reminderType} reminder notifications for booking ${bookingId}: ${originalError}`,
      {
        reminderType,
        bookingId,
        originalError,
      },
    );
  }
}

export class NotificationStatusUpdateError extends NotificationDomainError {
  readonly code = "NOTIFICATION_STATUS_UPDATE_ERROR";
  constructor(bookingId: string, status: string, originalError: string, recipientId?: string) {
    super(
      `Failed to send status update notification for booking ${bookingId} (${status}): ${originalError}`,
      {
        bookingId,
        status,
        originalError,
        recipientId,
      },
    );
  }
}
