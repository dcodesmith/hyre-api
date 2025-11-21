import { Test, TestingModule } from "@nestjs/testing";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { BookingLegStartReminderEvent } from "../../../booking/domain/events/booking-leg-start-reminder.event";
import { BookingLegEndReminderEvent } from "../../../booking/domain/events/booking-leg-end-reminder.event";
import { BookingReminderReadModel } from "../../../booking/application/dtos/booking-reminder-read-model.dto";
import { LoggerService } from "../../../shared/logging/logger.service";
import { NotificationService } from "../services/notification.service";
import {
  BookingLegStartReminderHandler,
  BookingLegEndReminderHandler,
} from "./booking-leg-reminder.handler";

describe("BookingLegReminderHandlers", () => {
  let module: TestingModule;
  let notificationService: NotificationService;

  const createMockEventData = (
    overrides?: Partial<BookingReminderReadModel>,
  ): BookingReminderReadModel => ({
    bookingId: "booking-123",
    bookingReference: "BK-2024-001",
    startDate: new Date("2024-01-15T09:00:00Z"),
    endDate: new Date("2024-01-15T18:00:00Z"),
    pickupLocation: "123 Main St",
    returnLocation: "456 Oak Ave",
    customerId: "customer-456",
    customerEmail: "customer@example.com",
    customerName: "John Doe",
    customerPhone: "+1234567890",
    chauffeurId: "chauffeur-789",
    chauffeurEmail: "chauffeur@example.com",
    chauffeurName: "Jane Driver",
    chauffeurPhone: "+0987654321",
    carId: "car-101",
    carName: "Mercedes S-Class",
    legId: "leg-001",
    legStartDate: new Date("2024-01-15T09:00:00Z"),
    legEndDate: new Date("2024-01-15T18:00:00Z"),
    legPickupLocation: "123 Main St",
    legReturnLocation: "456 Oak Ave",
    ...overrides,
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        BookingLegStartReminderHandler,
        BookingLegEndReminderHandler,
        {
          provide: NotificationService,
          useValue: {
            sendBookingLegStartReminders: vi.fn().mockResolvedValue(undefined),
            sendBookingLegEndReminders: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            createLogger: vi.fn().mockReturnValue({
              info: vi.fn(),
              error: vi.fn(),
            }),
          },
        },
      ],
    }).compile();

    notificationService = module.get<NotificationService>(NotificationService);
  });

  describe("BookingLegStartReminderHandler", () => {
    let handler: BookingLegStartReminderHandler;

    beforeEach(() => {
      handler = module.get<BookingLegStartReminderHandler>(BookingLegStartReminderHandler);
    });

    it("should send booking leg start reminder with correct data", async () => {
      const eventData = createMockEventData();
      const event = new BookingLegStartReminderEvent(eventData);

      await handler.handle(event);

      expect(notificationService.sendBookingLegStartReminders).toHaveBeenCalledWith({
        bookingId: "booking-123",
        bookingReference: "BK-2024-001",
        bookingLegId: "leg-001",
        customerName: "John Doe",
        chauffeurName: "Jane Driver",
        carName: "Mercedes S-Class",
        legStartTime: eventData.legStartDate.toISOString(),
        legEndTime: eventData.legEndDate.toISOString(),
        pickupLocation: "123 Main St",
        returnLocation: "456 Oak Ave",
        customerId: "customer-456",
        customerEmail: "customer@example.com",
        customerPhone: "+1234567890",
        chauffeurId: "chauffeur-789",
        chauffeurEmail: "chauffeur@example.com",
        chauffeurPhone: "+0987654321",
      });
    });

    it("should use default chauffeur name when not provided", async () => {
      const eventData = createMockEventData({ chauffeurName: null });
      const event = new BookingLegStartReminderEvent(eventData);

      await handler.handle(event);

      expect(notificationService.sendBookingLegStartReminders).toHaveBeenCalledWith(
        expect.objectContaining({
          chauffeurName: "Chauffeur",
        }),
      );
    });

    it("should not throw when reminder fails", async () => {
      const eventData = createMockEventData();
      const event = new BookingLegStartReminderEvent(eventData);

      vi.mocked(notificationService.sendBookingLegStartReminders).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe("BookingLegEndReminderHandler", () => {
    let handler: BookingLegEndReminderHandler;

    beforeEach(() => {
      handler = module.get<BookingLegEndReminderHandler>(BookingLegEndReminderHandler);
    });

    it("should send booking leg end reminder with correct data", async () => {
      const eventData = createMockEventData();
      const event = new BookingLegEndReminderEvent(eventData);

      await handler.handle(event);

      expect(notificationService.sendBookingLegEndReminders).toHaveBeenCalledWith({
        bookingId: "booking-123",
        bookingReference: "BK-2024-001",
        bookingLegId: "leg-001",
        customerName: "John Doe",
        chauffeurName: "Jane Driver",
        carName: "Mercedes S-Class",
        legStartTime: eventData.legStartDate.toISOString(),
        legEndTime: eventData.legEndDate.toISOString(),
        pickupLocation: "123 Main St",
        returnLocation: "456 Oak Ave",
        customerId: "customer-456",
        customerEmail: "customer@example.com",
        customerPhone: "+1234567890",
        chauffeurId: "chauffeur-789",
        chauffeurEmail: "chauffeur@example.com",
        chauffeurPhone: "+0987654321",
      });
    });

    it("should use default chauffeur name when not provided", async () => {
      const eventData = createMockEventData({ chauffeurName: null });
      const event = new BookingLegEndReminderEvent(eventData);

      await handler.handle(event);

      expect(notificationService.sendBookingLegEndReminders).toHaveBeenCalledWith(
        expect.objectContaining({
          chauffeurName: "Chauffeur",
        }),
      );
    });

    it("should not throw when reminder fails", async () => {
      const eventData = createMockEventData();
      const event = new BookingLegEndReminderEvent(eventData);

      vi.mocked(notificationService.sendBookingLegEndReminders).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });
});
