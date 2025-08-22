import { vi } from "vitest";
import { NotificationContent } from "../value-objects/notification-content.vo";
import { NotificationType } from "../value-objects/notification-type.vo";
import { Recipient, RecipientRole } from "../value-objects/recipient.vo";
import {
  DeliveryChannel,
  Notification,
  type NotificationProps,
  NotificationStatus,
} from "./notification.entity";

describe("Notification Entity", () => {
  const validRecipient = Recipient.create(
    "customer-123",
    "John Doe",
    RecipientRole.CUSTOMER,
    "john@example.com",
    "+1234567890",
  );

  const validContent = NotificationContent.create(
    "Booking Confirmed",
    "Your booking has been confirmed.",
    { bookingReference: "BK-123" },
  );

  const validType = NotificationType.bookingStatusUpdate();

  /**
   * Helper function to create a fresh notification instance for each test.
   */
  const createNotification = (
    type = validType,
    recipient = validRecipient,
    content = validContent,
    channel = DeliveryChannel.EMAIL,
    bookingId?: string,
    bookingLegId?: string,
  ) => Notification.create(type, recipient, content, channel, bookingId, bookingLegId);

  /**
   * Helper function to create a notification with specific props by reconstituting it.
   */
  const createNotificationWithProps = (props: Partial<NotificationProps>): Notification => {
    const defaultProps: NotificationProps = {
      id: "notification-123",
      type: validType,
      recipient: validRecipient,
      content: validContent,
      channel: DeliveryChannel.EMAIL,
      status: NotificationStatus.PENDING,
      attemptCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...props,
    };
    return Notification.reconstitute(defaultProps);
  };

  /**
   * Creates a sent notification for testing status transitions.
   */
  const createSentNotification = (): Notification => {
    const notification = createNotificationWithProps({});
    notification.markAsSent();
    return notification;
  };

  /**
   * Creates a failed notification for testing retry functionality.
   */
  const createFailedNotification = (attemptCount = 1): Notification => {
    const notification = createNotificationWithProps({ attemptCount });
    notification.markAsFailed("Test failure reason");
    return notification;
  };

  // Restores timers after each test to prevent interference
  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Creation ---
  describe("Creation", () => {
    it("should create a new notification with valid parameters", () => {
      const notification = createNotification();

      expect(notification.getType()).toBe(validType);
      expect(notification.getRecipient()).toBe(validRecipient);
      expect(notification.getContent()).toBe(validContent);
      expect(notification.getChannel()).toBe(DeliveryChannel.EMAIL);
      expect(notification.getStatus()).toBe(NotificationStatus.PENDING);
      expect(notification.getAttemptCount()).toBe(0);
    });

    it("should create notification with booking context", () => {
      const notification = createNotification(
        validType,
        validRecipient,
        validContent,
        DeliveryChannel.SMS,
        "booking-456",
        "leg-789",
      );

      expect(notification.getChannel()).toBe(DeliveryChannel.SMS);
      expect(notification.getBookingId()).toBe("booking-456");
      expect(notification.getBookingLegId()).toBe("leg-789");
    });

    it("should throw error when recipient missing email for email channel", () => {
      const recipientWithoutEmail = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        undefined,
        "+1234567890",
      );

      expect(() =>
        createNotification(validType, recipientWithoutEmail, validContent, DeliveryChannel.EMAIL),
      ).toThrow("Recipient does not have email for email notification");
    });

    it("should throw error when recipient missing phone for SMS channel", () => {
      const recipientWithoutPhone = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );

      expect(() =>
        createNotification(validType, recipientWithoutPhone, validContent, DeliveryChannel.SMS),
      ).toThrow("Recipient does not have phone number for SMS notification");
    });

    it("should throw error when recipient missing both contacts for BOTH channel", () => {
      const recipientWithoutPhone = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );

      expect(() =>
        createNotification(validType, recipientWithoutPhone, validContent, DeliveryChannel.BOTH),
      ).toThrow("Recipient must have both email and phone number for multi-channel notification");
    });
  });

  describe("Reconstitution", () => {
    it("should reconstitute notification from props", () => {
      const props: NotificationProps = {
        id: "notification-123",
        type: NotificationType.bookingStatusUpdate(),
        recipient: validRecipient,
        content: validContent,
        channel: DeliveryChannel.BOTH,
        status: NotificationStatus.SENT,
        bookingId: "booking-456",
        attemptCount: 1,
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const notification = Notification.reconstitute(props);

      expect(notification.getType()).toStrictEqual(NotificationType.bookingStatusUpdate());
      expect(notification.getChannel()).toBe(DeliveryChannel.BOTH);
      expect(notification.getStatus()).toBe(NotificationStatus.SENT);
      expect(notification.getBookingId()).toBe("booking-456");
      expect(notification.getAttemptCount()).toBe(1);
    });
  });

  describe("Status: Mark as Sent", () => {
    it("should mark a pending notification as sent", () => {
      const notification = createNotificationWithProps({});

      notification.markAsSent();

      expect(notification.getStatus()).toBe(NotificationStatus.SENT);
      expect(notification.getSentAt()).toBeInstanceOf(Date);
    });

    it("should throw error when marking non-pending notification as sent", () => {
      const sentNotification = createSentNotification();

      expect(() => sentNotification.markAsSent()).toThrow(
        "Notification notification-123 cannot be marked as sent from SENT status",
      );
    });
  });

  describe("Status: Mark as Delivered", () => {
    it("should mark a sent notification as delivered", () => {
      const notification = createSentNotification();

      notification.markAsDelivered();

      expect(notification.getStatus()).toBe(NotificationStatus.DELIVERED);
      expect(notification.getDeliveredAt()).toBeInstanceOf(Date);
    });

    it("should throw error when marking non-sent notification as delivered", () => {
      const notification = createNotificationWithProps({});

      expect(() => notification.markAsDelivered()).toThrow(
        "Notification notification-123 cannot be marked as delivered from PENDING status",
      );
    });
  });

  describe("Status: Mark as Failed", () => {
    it("should mark a notification as failed with reason", () => {
      const notification = createNotificationWithProps({});

      notification.markAsFailed("Network timeout");

      expect(notification.getStatus()).toBe(NotificationStatus.FAILED);
      expect(notification.getFailureReason()).toBe("Network timeout");
      expect(notification.getLastAttemptAt()).toBeInstanceOf(Date);
    });

    it("should throw error when marking as failed without reason", () => {
      const notification = createNotificationWithProps({});

      expect(() => notification.markAsFailed("")).toThrow(
        "Failure reason cannot be empty",
      );
    });

    it("should throw error when marking as failed with whitespace-only reason", () => {
      const notification = createNotificationWithProps({});

      expect(() => notification.markAsFailed("   ")).toThrow(
        "Failure reason cannot be empty",
      );
    });
  });

  describe("Attempt Tracking", () => {
    it("should record attempt and increment count", () => {
      const notification = createNotificationWithProps({});

      notification.recordAttempt();

      expect(notification.getAttemptCount()).toBe(1);
      expect(notification.getLastAttemptAt()).toBeInstanceOf(Date);
    });

    it("should increment attempt count on multiple attempts", () => {
      const notification = createNotificationWithProps({});

      notification.recordAttempt();
      notification.recordAttempt();
      notification.recordAttempt();

      expect(notification.getAttemptCount()).toBe(3);
    });
  });

  describe("Retry Logic", () => {
    it("should allow retry when failed and under attempt limit", () => {
      const notification = createFailedNotification(2);

      expect(notification.canRetry()).toBeTruthy();
    });

    it("should not allow retry when attempt limit exceeded", () => {
      const notification = createFailedNotification(3);

      expect(notification.canRetry()).toBeFalsy();
    });

    it("should not allow retry when not in failed status", () => {
      const notification = createSentNotification();

      expect(notification.canRetry()).toBeFalsy();
    });

    it("should retry a failed notification", () => {
      const notification = createFailedNotification(2);

      notification.retry();

      expect(notification.getStatus()).toBe(NotificationStatus.PENDING);
      expect(notification.getFailureReason()).toBeUndefined();
    });

    it("should throw error when retrying notification that exceeded attempts", () => {
      const notification = createFailedNotification(3);

      expect(() => notification.retry()).toThrow("Notification notification-123 cannot be retried: attempt count is 3, exceeds maximum of 3");
    });

    it("should throw error when retrying non-failed notification", () => {
      const notification = createSentNotification();

      expect(() => notification.retry()).toThrow("Notification notification-123 cannot be retried: status is SENT, not FAILED");
    });
  });

  describe("Channel Requirements", () => {
    it("should correctly identify email delivery needs", () => {
      const emailNotification = createNotification(
        validType,
        validRecipient,
        validContent,
        DeliveryChannel.EMAIL,
      );
      const smsNotification = createNotification(
        validType,
        validRecipient,
        validContent,
        DeliveryChannel.SMS,
      );
      const bothNotification = createNotification(
        validType,
        validRecipient,
        validContent,
        DeliveryChannel.BOTH,
      );

      expect(emailNotification.needsEmailDelivery()).toBeTruthy();
      expect(smsNotification.needsEmailDelivery()).toBeFalsy();
      expect(bothNotification.needsEmailDelivery()).toBeTruthy();
    });

    it("should correctly identify SMS delivery needs", () => {
      const emailNotification = createNotification(
        validType,
        validRecipient,
        validContent,
        DeliveryChannel.EMAIL,
      );
      const smsNotification = createNotification(
        validType,
        validRecipient,
        validContent,
        DeliveryChannel.SMS,
      );
      const bothNotification = createNotification(
        validType,
        validRecipient,
        validContent,
        DeliveryChannel.BOTH,
      );

      expect(emailNotification.needsSmsDelivery()).toBeFalsy();
      expect(smsNotification.needsSmsDelivery()).toBeTruthy();
      expect(bothNotification.needsSmsDelivery()).toBeTruthy();
    });
  });

  describe("Status Checks", () => {
    it("should correctly identify status states", () => {
      const pendingNotification = createNotificationWithProps({
        status: NotificationStatus.PENDING,
      });
      const sentNotification = createNotificationWithProps({ status: NotificationStatus.SENT });
      const deliveredNotification = createNotificationWithProps({
        status: NotificationStatus.DELIVERED,
      });
      const failedNotification = createNotificationWithProps({ status: NotificationStatus.FAILED });

      expect(pendingNotification.isPending()).toBeTruthy();
      expect(pendingNotification.isSent()).toBeFalsy();
      expect(pendingNotification.isDelivered()).toBeFalsy();
      expect(pendingNotification.isFailed()).toBeFalsy();

      expect(sentNotification.isPending()).toBeFalsy();
      expect(sentNotification.isSent()).toBeTruthy();
      expect(sentNotification.isDelivered()).toBeFalsy();
      expect(sentNotification.isFailed()).toBeFalsy();

      expect(deliveredNotification.isPending()).toBeFalsy();
      expect(deliveredNotification.isSent()).toBeFalsy();
      expect(deliveredNotification.isDelivered()).toBeTruthy();
      expect(deliveredNotification.isFailed()).toBeFalsy();

      expect(failedNotification.isPending()).toBeFalsy();
      expect(failedNotification.isSent()).toBeFalsy();
      expect(failedNotification.isDelivered()).toBeFalsy();
      expect(failedNotification.isFailed()).toBeTruthy();
    });
  });

  describe("Getters and Properties", () => {
    it("should return all property values correctly", () => {
      const sentAt = new Date();
      const deliveredAt = new Date();
      const lastAttemptAt = new Date();
      const createdAt = new Date();
      const updatedAt = new Date();

      const notification = createNotificationWithProps({
        id: "notification-456",
        type: NotificationType.bookingStatusUpdate(),
        channel: DeliveryChannel.BOTH,
        status: NotificationStatus.DELIVERED,
        bookingId: "booking-789",
        bookingLegId: "leg-101",
        attemptCount: 2,
        sentAt,
        deliveredAt,
        lastAttemptAt,
        failureReason: "Previous failure",
        createdAt,
        updatedAt,
      });

      expect(notification.getType()).toStrictEqual(NotificationType.bookingStatusUpdate());
      expect(notification.getRecipient()).toBe(validRecipient);
      expect(notification.getContent()).toBe(validContent);
      expect(notification.getChannel()).toBe(DeliveryChannel.BOTH);
      expect(notification.getStatus()).toBe(NotificationStatus.DELIVERED);
      expect(notification.getBookingId()).toBe("booking-789");
      expect(notification.getBookingLegId()).toBe("leg-101");
      expect(notification.getAttemptCount()).toBe(2);
      expect(notification.getSentAt()).toBe(sentAt);
      expect(notification.getDeliveredAt()).toBe(deliveredAt);
      expect(notification.getLastAttemptAt()).toBe(lastAttemptAt);
      expect(notification.getFailureReason()).toBe("Previous failure");
      expect(notification.getCreatedAt()).toBe(createdAt);
      expect(notification.getUpdatedAt()).toBe(updatedAt);
    });
  });

  describe("Edge Cases", () => {
    it("should handle notification without booking context", () => {
      const notification = createNotification();

      expect(notification.getBookingId()).toBeUndefined();
      expect(notification.getBookingLegId()).toBeUndefined();
    });

    it("should handle multiple status transitions correctly", () => {
      const notification = createNotificationWithProps({});

      expect(notification.isPending()).toBeTruthy();

      notification.markAsSent();
      expect(notification.isSent()).toBeTruthy();

      notification.markAsDelivered();
      expect(notification.isDelivered()).toBeTruthy();
    });

    it("should handle retry workflow correctly", () => {
      const notification = createNotificationWithProps({});

      // Initial attempt fails
      notification.recordAttempt();
      notification.markAsFailed("Network error");
      expect(notification.isFailed()).toBeTruthy();
      expect(notification.getAttemptCount()).toBe(1);

      // Retry
      notification.retry();
      expect(notification.isPending()).toBeTruthy();
      expect(notification.getFailureReason()).toBeUndefined();

      // Second attempt fails
      notification.recordAttempt();
      notification.markAsFailed("Timeout");
      expect(notification.getAttemptCount()).toBe(2);

      // Can still retry
      expect(notification.canRetry()).toBeTruthy();
    });

    it("should handle different recipient roles", () => {
      const chauffeurRecipient = Recipient.create(
        "chauffeur-123",
        "Jane Driver",
        RecipientRole.CHAUFFEUR,
        "jane@example.com",
        "+0987654321",
      );

      const notification = createNotification(
        NotificationType.bookingStatusUpdate(),
        chauffeurRecipient,
        validContent,
        DeliveryChannel.SMS,
      );

      expect(notification.getRecipient().role).toBe(RecipientRole.CHAUFFEUR);
      expect(notification.needsSmsDelivery()).toBeTruthy();
      expect(notification.needsEmailDelivery()).toBeFalsy();
    });
  });
});
