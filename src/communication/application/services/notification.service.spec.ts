import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { Recipient } from "../../domain/value-objects/recipient.vo";
import { NotificationService } from "./notification.service";

describe("NotificationService", () => {
  let service: NotificationService;
  let mockNotificationRepository: NotificationRepository;
  let mockNotificationFactory: NotificationFactoryService;
  let mockNotification: Notification;
  let mockEmailService: EmailService;
  let mockSmsService: SmsService;

  const mockBookingReminderData: BookingReminderData = {
    bookingId: "booking-123",
    bookingReference: "BK-123",
    customerName: "John Doe",
    chauffeurName: "Jane Doe",
    carName: "Car 1",
    startTime: "2025-01-15T10:00:00Z",
    endTime: "2025-01-15T18:00:00Z",
    pickupLocation: "123 Main St",
    returnLocation: "456 Oak Ave",
    customerId: "customer-123",
    customerEmail: "customer@example.com",
    customerPhone: "+1234567890",
    chauffeurId: "chauffeur-123",
    chauffeurEmail: "chauffeur@example.com",
    chauffeurPhone: "+234987654321",
  };

  const mockBookingLegReminderData: BookingLegReminderData = {
    bookingId: "booking-123",
    bookingLegId: "leg-123",
    customerName: "John Doe",
    chauffeurName: "Jane Doe",
    carName: "Car 1",
    legStartTime: "2025-01-15T10:00:00Z",
    legEndTime: "2025-01-15T18:00:00Z",
    pickupLocation: "123 Main St",
    returnLocation: "456 Oak Ave",
    customerId: "customer-123",
    customerEmail: "customer@example.com",
    customerPhone: "+1234567890",
    chauffeurId: "chauffeur-123",
    chauffeurEmail: "chauffeur@example.com",
    chauffeurPhone: "+234987654321",
  };

  const mockBookingStatusUpdateData: BookingStatusUpdateData = {
    bookingId: "booking-123",
    bookingReference: "BK-123",
    customerName: "John Doe",
    carName: "Car 1",
    status: "CONFIRMED",
    startDate: "2025-01-15",
    endDate: "2025-01-15",
    pickupLocation: "123 Main St",
    returnLocation: "456 Oak Ave",
    customerId: "customer-123",
    customerEmail: "customer@example.com",
    customerPhone: "+1234567890",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: "NotificationRepository",
          useValue: {
            save: vi.fn(),
            findPendingNotifications: vi.fn(),
            findNotificationsToRetry: vi.fn(),
          },
        },
        {
          provide: NotificationFactoryService,
          useValue: {
            createBookingStartReminders: vi.fn(),
            createBookingEndReminders: vi.fn(),
            createBookingLegStartReminders: vi.fn(),
            createBookingStatusUpdateNotification: vi.fn(),
          },
        },

        {
          provide: EmailService,
          useValue: {
            sendEmail: vi.fn(),
            renderTemplate: vi.fn(),
          },
        },
        {
          provide: SmsService,
          useValue: {
            send: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    mockNotificationRepository = module.get<NotificationRepository>("NotificationRepository");
    mockNotificationFactory = module.get<NotificationFactoryService>(NotificationFactoryService);
    mockEmailService = module.get<EmailService>(EmailService);
    mockSmsService = module.get<SmsService>(SmsService);

    // Create a proper mock notification
    mockNotification = {
      id: "notification-123",
      recordAttempt: vi.fn(),
      markAsSent: vi.fn(),
      markAsFailed: vi.fn(),
      retry: vi.fn(),
      needsEmailDelivery: vi.fn(() => true),
      needsSmsDelivery: vi.fn(() => false),
      getRecipient: vi.fn(() => ({
        id: "recipient-123",
        hasEmail: vi.fn(() => true),
        hasPhoneNumber: vi.fn(() => false),
        email: "test@example.com",
        phoneNumber: "+1234567890",
      })),
      getContent: vi.fn(() => ({
        interpolate: vi.fn(() => ({
          subject: "Test Subject",
          body: "Test Body",
        })),
      })),
    } as unknown as Notification;

    vi.mocked(mockNotificationFactory.createBookingStartReminders).mockReturnValue([
      mockNotification,
    ]);
    vi.mocked(mockNotificationFactory.createBookingEndReminders).mockReturnValue([
      mockNotification,
    ]);
    vi.mocked(mockNotificationFactory.createBookingLegStartReminders).mockReturnValue([
      mockNotification,
    ]);
    vi.mocked(mockNotificationFactory.createBookingStatusUpdateNotification).mockReturnValue(
      mockNotification,
    );
    vi.mocked(mockEmailService.renderTemplate).mockResolvedValue("<html>Test HTML</html>");
    vi.mocked(mockEmailService.sendEmail).mockResolvedValue({ success: true });
    vi.mocked(mockSmsService.send).mockResolvedValue({ success: true });
  });

  describe("sendBookingStartReminders", () => {
    it("should send booking start reminders successfully", async () => {
      const result = await service.sendBookingStartReminders(mockBookingReminderData);

      expect(mockNotificationFactory.createBookingStartReminders).toHaveBeenCalledWith(
        mockBookingReminderData,
      );
      expect(mockNotificationRepository.save).toHaveBeenCalledWith(mockNotification);
      expect(mockNotification.recordAttempt).toHaveBeenCalled();
      expect(mockNotification.markAsSent).toHaveBeenCalled();
      expect(result).toBe("Sent 1 booking start reminders");
    });

    it("should handle errors when sending booking start reminders", async () => {
      vi.mocked(mockNotificationFactory.createBookingStartReminders).mockReturnValue([
        mockNotification,
      ]);
      vi.mocked(mockEmailService.sendEmail).mockResolvedValue({
        success: false,
        error: "Email delivery failed",
      });

      await expect(service.sendBookingStartReminders(mockBookingReminderData)).rejects.toThrow();
      expect(mockNotification.markAsFailed).toHaveBeenCalledWith(
        "Email delivery failed for notification notification-123: Email delivery failed",
      );
    });
  });

  describe("sendBookingEndReminders", () => {
    it("should send booking end reminders successfully", async () => {
      const result = await service.sendBookingEndReminders(mockBookingReminderData);

      expect(mockNotificationFactory.createBookingEndReminders).toHaveBeenCalledWith(
        mockBookingReminderData,
      );
      expect(mockNotificationRepository.save).toHaveBeenCalledWith(mockNotification);
      expect(result).toBe("Sent 1 booking end reminders");
    });

    it("should handle errors when sending booking end reminders", async () => {
      vi.mocked(mockNotification.recordAttempt).mockImplementation(() => {
        throw new Error("Notification delivery failed");
      });

      await expect(service.sendBookingEndReminders(mockBookingReminderData)).rejects.toThrow(
        "Notification delivery failed",
      );
    });
  });

  describe("sendBookingLegStartReminders", () => {
    it("should send booking leg start reminders successfully", async () => {
      const result = await service.sendBookingLegStartReminders(mockBookingLegReminderData);

      expect(mockNotificationFactory.createBookingLegStartReminders).toHaveBeenCalledWith(
        mockBookingLegReminderData,
      );
      expect(mockNotificationRepository.save).toHaveBeenCalledWith(mockNotification);
      expect(result).toBe("Sent 1 booking leg start reminders");
    });

    it("should handle errors when sending booking leg start reminders", async () => {
      vi.mocked(mockNotification.needsSmsDelivery).mockReturnValue(true);
      vi.mocked(mockNotification.needsEmailDelivery).mockReturnValue(false);
      vi.mocked(mockNotification.getRecipient).mockReturnValue({
        hasEmail: vi.fn(() => false),
        hasPhoneNumber: vi.fn(() => true),
        email: "",
        phoneNumber: "+1234567890",
      } as unknown as Recipient);
      vi.mocked(mockSmsService.send).mockResolvedValue({
        success: false,
        error: "SMS delivery failed",
      });

      await expect(
        service.sendBookingLegStartReminders(mockBookingLegReminderData),
      ).rejects.toThrow();
      expect(mockNotification.markAsFailed).toHaveBeenCalledWith(
        "SMS delivery failed for notification notification-123: SMS delivery failed",
      );
    });
  });

  describe("sendBookingStatusUpdate", () => {
    it("should send booking status update successfully", async () => {
      const result = await service.sendBookingStatusUpdate(mockBookingStatusUpdateData);

      expect(mockNotificationFactory.createBookingStatusUpdateNotification).toHaveBeenCalledWith(
        mockBookingStatusUpdateData,
      );
      expect(mockNotificationRepository.save).toHaveBeenCalledWith(mockNotification);
      expect(result).toBe("Sent booking status update notification");
    });

    it("should handle case when no notification is created", async () => {
      vi.mocked(mockNotificationFactory.createBookingStatusUpdateNotification).mockReturnValue(
        null,
      );

      const result = await service.sendBookingStatusUpdate(mockBookingStatusUpdateData);

      expect(result).toBe("No notification sent - recipient has no contact information");
      expect(mockNotificationRepository.save).not.toHaveBeenCalled();
    });

    it("should handle errors when sending booking status update", async () => {
      vi.mocked(mockNotification.recordAttempt).mockImplementation(() => {
        throw new Error("Delivery failed");
      });

      await expect(service.sendBookingStatusUpdate(mockBookingStatusUpdateData)).rejects.toThrow(
        "Delivery failed",
      );
    });
  });

  describe("processPendingNotifications", () => {
    it("should process pending notifications successfully", async () => {
      const pendingNotifications = [
        mockNotification,
        { ...mockNotification, id: "notification-456" },
      ];
      vi.mocked(mockNotificationRepository.findPendingNotifications).mockResolvedValue(
        pendingNotifications as Notification[],
      );

      const result = await service.processPendingNotifications();

      expect(mockNotificationRepository.findPendingNotifications).toHaveBeenCalled();
      expect(result).toBe("Processed 2 pending notifications: 2 successful, 0 failed");
    });

    it("should handle failures when processing pending notifications", async () => {
      const pendingNotifications = [mockNotification];

      vi.mocked(mockNotificationRepository.findPendingNotifications).mockResolvedValue(
        pendingNotifications,
      );
      vi.mocked(mockNotification.recordAttempt).mockImplementation(() => {
        throw new Error("Delivery failed");
      });

      await expect(service.processPendingNotifications()).rejects.toThrow(
        "Batch processing failed for pending notifications: 0/1 successful, 1 failed",
      );
    });
  });

  describe("retryFailedNotifications", () => {
    it("should retry failed notifications successfully", async () => {
      const failedNotifications = [mockNotification];
      vi.mocked(mockNotificationRepository.findNotificationsToRetry).mockResolvedValue(
        failedNotifications,
      );

      const result = await service.retryFailedNotifications();

      expect(mockNotificationRepository.findNotificationsToRetry).toHaveBeenCalled();
      expect(mockNotification.retry).toHaveBeenCalled();
      expect(mockNotificationRepository.save).toHaveBeenCalledWith(mockNotification);
      expect(result).toBe("Retried 1 failed notifications");
    });

    it("should handle errors when retrying failed notifications", async () => {
      const failedNotifications = [mockNotification];

      vi.mocked(mockNotificationRepository.findNotificationsToRetry).mockResolvedValue(
        failedNotifications,
      );
      vi.mocked(mockNotification.retry).mockImplementation(() => {
        throw new Error("Retry failed");
      });

      await expect(service.retryFailedNotifications()).rejects.toThrow(
        "Batch processing failed for retry notifications: 0/1 successful, 1 failed",
      );
    });
  });

  describe("sendNotification", () => {
    it("should send notification successfully", async () => {
      await service.sendNotification(mockNotification);

      expect(mockNotificationRepository.save).toHaveBeenCalledWith(mockNotification);
      expect(mockNotification.recordAttempt).toHaveBeenCalled();
      expect(mockNotification.markAsSent).toHaveBeenCalled();
    });
  });

  describe("deliverNotification - email delivery", () => {
    it("should deliver email notification successfully", async () => {
      await service.sendNotification(mockNotification);

      expect(mockNotification.needsEmailDelivery).toHaveBeenCalled();
      expect(mockEmailService.renderTemplate).toHaveBeenCalled();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: "test@example.com",
        subject: "Test Subject",
        htmlContent: "<html>Test HTML</html>",
        textContent: "Test Body",
      });
      expect(mockNotification.markAsSent).toHaveBeenCalled();
    });

    it("should handle email delivery failure", async () => {
      vi.mocked(mockEmailService.sendEmail).mockResolvedValue({
        success: false,
        error: "Email failed",
      });

      await expect(service.sendNotification(mockNotification)).rejects.toThrow(
        "Email delivery failed for notification notification-123: Email failed",
      );
      expect(mockNotification.markAsFailed).toHaveBeenCalledWith(
        "Email delivery failed for notification notification-123: Email failed",
      );
    });

    it("should handle missing email address", async () => {
      vi.mocked(mockNotification.getRecipient).mockReturnValue({
        hasEmail: vi.fn(() => false),
        hasPhoneNumber: vi.fn(() => false),
        email: "",
        phoneNumber: "",
      } as unknown as Recipient);

      await expect(service.sendNotification(mockNotification)).rejects.toThrow(
        "Email delivery failed for notification notification-123: Recipient has no email address",
      );
      expect(mockNotification.markAsFailed).toHaveBeenCalledWith(
        "Email delivery failed for notification notification-123: Recipient has no email address",
      );
    });
  });

  describe("deliverNotification - SMS delivery", () => {
    beforeEach(() => {
      vi.mocked(mockNotification.needsEmailDelivery).mockReturnValue(false);
      vi.mocked(mockNotification.needsSmsDelivery).mockReturnValue(true);
      vi.mocked(mockNotification.getRecipient).mockReturnValue({
        hasEmail: vi.fn(() => false),
        hasPhoneNumber: vi.fn(() => true),
        email: "",
        phoneNumber: "+1234567890",
      } as unknown as Recipient);
    });

    it("should deliver SMS notification successfully", async () => {
      await service.sendNotification(mockNotification);

      expect(mockNotification.needsSmsDelivery).toHaveBeenCalled();
      expect(mockSmsService.send).toHaveBeenCalledWith({
        to: "+1234567890",
        message: "Test Body",
      });
      expect(mockNotification.markAsSent).toHaveBeenCalled();
    });

    it("should handle SMS delivery failure", async () => {
      vi.mocked(mockSmsService.send).mockResolvedValue({ success: false, error: "SMS failed" });

      await expect(service.sendNotification(mockNotification)).rejects.toThrow(
        "SMS delivery failed for notification notification-123: SMS failed",
      );
      expect(mockNotification.markAsFailed).toHaveBeenCalledWith(
        "SMS delivery failed for notification notification-123: SMS failed",
      );
    });

    it("should handle missing phone number", async () => {
      vi.mocked(mockNotification.getRecipient).mockReturnValue({
        hasEmail: vi.fn(() => false),
        hasPhoneNumber: vi.fn(() => false),
        email: "",
        phoneNumber: "",
      } as unknown as Recipient);

      await expect(service.sendNotification(mockNotification)).rejects.toThrow(
        "SMS delivery failed for notification notification-123: Recipient has no phone number",
      );
      expect(mockNotification.markAsFailed).toHaveBeenCalledWith(
        "SMS delivery failed for notification notification-123: Recipient has no phone number",
      );
    });
  });
});
