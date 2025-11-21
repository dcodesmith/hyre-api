import { Test, TestingModule } from "@nestjs/testing";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { BookingLegStartedEvent } from "../../../booking/domain/events/booking-leg-started.event";
import { BookingLegEndedEvent } from "../../../booking/domain/events/booking-leg-ended.event";
import { BookingLegNotificationReadModel } from "../../../booking/application/dtos/booking-leg-notification-read-model.dto";
import { LoggerService } from "../../../shared/logging/logger.service";
import { NotificationService } from "../services/notification.service";
import { BookingLegStartedHandler, BookingLegEndedHandler } from "./booking-leg-notification.handler";

describe("BookingLegNotificationHandlers", () => {
  let module: TestingModule;
  let notificationService: NotificationService;

  const createMockEventData = (
    overrides?: Partial<BookingLegNotificationReadModel>,
  ): BookingLegNotificationReadModel => ({
    bookingId: "booking-123",
    bookingReference: "BK-2024-001",
    bookingStatus: "CONFIRMED",
    bookingStartDate: new Date("2024-01-15T09:00:00Z"),
    bookingEndDate: new Date("2024-01-15T18:00:00Z"),
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
    startDate: new Date("2024-01-15T09:00:00Z"),
    endDate: new Date("2024-01-15T18:00:00Z"),
    pickupLocation: "123 Main St",
    returnLocation: "456 Oak Ave",
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
        BookingLegStartedHandler,
        BookingLegEndedHandler,
        {
          provide: NotificationService,
          useValue: {
            sendBookingStatusUpdate: vi.fn().mockResolvedValue(undefined),
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

  describe("BookingLegStartedHandler", () => {
    let handler: BookingLegStartedHandler;

    beforeEach(() => {
      handler = module.get<BookingLegStartedHandler>(BookingLegStartedHandler);
    });

    it("should send booking status update with ACTIVE status when leg starts", async () => {
      const eventData = createMockEventData();
      const event = new BookingLegStartedEvent(eventData);

      await handler.handle(event);

      expect(notificationService.sendBookingStatusUpdate).toHaveBeenCalledWith({
        bookingId: "booking-123",
        bookingReference: "BK-2024-001",
        customerName: "John Doe",
        carName: "Mercedes S-Class",
        status: "ACTIVE",
        startDate: eventData.legStartDate.toISOString(),
        endDate: eventData.legEndDate.toISOString(),
        pickupLocation: "123 Main St",
        returnLocation: "456 Oak Ave",
        customerId: "customer-456",
        customerEmail: "customer@example.com",
        customerPhone: "+1234567890",
      });
    });

    it("should handle customer without phone number", async () => {
      const eventData = createMockEventData({ customerPhone: null });
      const event = new BookingLegStartedEvent(eventData);

      await handler.handle(event);

      expect(notificationService.sendBookingStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          customerPhone: "",
        }),
      );
    });

    it("should not throw when notification fails", async () => {
      const eventData = createMockEventData();
      const event = new BookingLegStartedEvent(eventData);

      vi.mocked(notificationService.sendBookingStatusUpdate).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe("BookingLegEndedHandler", () => {
    let handler: BookingLegEndedHandler;

    beforeEach(() => {
      handler = module.get<BookingLegEndedHandler>(BookingLegEndedHandler);
    });

    it("should send booking status update with COMPLETED status when leg ends", async () => {
      const eventData = createMockEventData();
      const event = new BookingLegEndedEvent(eventData);

      await handler.handle(event);

      expect(notificationService.sendBookingStatusUpdate).toHaveBeenCalledWith({
        bookingId: "booking-123",
        bookingReference: "BK-2024-001",
        customerName: "John Doe",
        carName: "Mercedes S-Class",
        status: "COMPLETED",
        startDate: eventData.legStartDate.toISOString(),
        endDate: eventData.legEndDate.toISOString(),
        pickupLocation: "123 Main St",
        returnLocation: "456 Oak Ave",
        customerId: "customer-456",
        customerEmail: "customer@example.com",
        customerPhone: "+1234567890",
      });
    });

    it("should handle customer without phone number", async () => {
      const eventData = createMockEventData({ customerPhone: null });
      const event = new BookingLegEndedEvent(eventData);

      await handler.handle(event);

      expect(notificationService.sendBookingStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          customerPhone: "",
        }),
      );
    });

    it("should not throw when notification fails", async () => {
      const eventData = createMockEventData();
      const event = new BookingLegEndedEvent(eventData);

      vi.mocked(notificationService.sendBookingStatusUpdate).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });
});
