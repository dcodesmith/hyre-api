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
