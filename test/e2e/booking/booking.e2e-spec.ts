import { AllExceptionsFilter } from "@/shared/filters/all-exceptions.filter";
import { LoggerService } from "@/shared/logging/logger.service";
import { HttpStatus, INestApplication } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { SynchronousEventBus } from "test/mocks/mock-synchronous-bus";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../../src/app.module";
import { NotificationService } from "../../../src/communication/application/services/notification.service";
import { WebhookService } from "../../../src/payment/application/services/webhook.service";
import { PrismaService } from "../../../src/shared/database/prisma.service";
import { RedisService } from "../../../src/shared/redis/redis.service";
import { MockFileStorageService } from "../../mocks/mock-file-storage.service";
import { MockNotificationService } from "../../mocks/mock-notification.service";
import { MockPaymentIntentService } from "../../mocks/mock-payment-intent.service";
import { MockWebhookService } from "../../mocks/mock-webhook.service";
import {
  createAssertEmailSent,
  createAssertOtpEmailSent,
  fn,
  uniqueEmail,
} from "../helpers/authentication.helpers";

describe("Booking E2E", () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let redis: RedisService;
  let mockNotificationService: MockNotificationService;
  let assertOtpEmailSent: ReturnType<typeof createAssertOtpEmailSent>;
  let assertEmailSent: ReturnType<typeof createAssertEmailSent>;
  let customerToken: string;
  let carId: string;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EventBus)
      .useClass(SynchronousEventBus)
      .overrideProvider(NotificationService)
      .useClass(MockNotificationService)
      .overrideProvider("FileStorageService")
      .useClass(MockFileStorageService)
      .overrideProvider("PaymentIntentService")
      .useClass(MockPaymentIntentService)
      .overrideProvider(WebhookService)
      .useClass(MockWebhookService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply global filters like in main.ts
    // const { AllExceptionsFilter } = await import(
    //   "../../../src/shared/filters/all-exceptions.filter"
    // );
    // const { LoggerService } = await import("../../../src/shared/logging/logger.service");
    const loggerService = app.get(LoggerService);
    app.useGlobalFilters(new AllExceptionsFilter(loggerService));

    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    mockNotificationService = app.get(NotificationService);

    assertOtpEmailSent = createAssertOtpEmailSent(mockNotificationService);
    assertEmailSent = createAssertEmailSent(mockNotificationService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    mockNotificationService.clearHistory();

    await redis.getClient().flushdb();
    await prisma.bookingLeg.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.car.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();
    await prisma.platformFeeRate.deleteMany();
    await prisma.taxRate.deleteMany();

    const now = new Date();
    await prisma.platformFeeRate.createMany({
      data: [
        {
          feeType: "PLATFORM_SERVICE_FEE",
          ratePercent: 15.0,
          effectiveSince: now,
          description: "Platform service fee for test",
        },
        {
          feeType: "FLEET_OWNER_COMMISSION",
          ratePercent: 85.0,
          effectiveSince: now,
          description: "Fleet owner commission for test",
        },
      ],
    });

    await prisma.taxRate.create({
      data: {
        ratePercent: 7.5,
        effectiveSince: now,
        description: "Nigerian VAT for test",
      },
    });
  });

  describe("Complete Booking Flow", () => {
    it("should complete full booking flow: register → create car → approve car → create booking → verify booking", async () => {
      const { completeRegistrationFlow, createAdminUser, carCreationFlow, carApprovalFlow } = fn(
        app,
        assertOtpEmailSent,
      );

      const customer = await completeRegistrationFlow("customer", "booking-customer");
      const fleetOwner = await completeRegistrationFlow("fleetOwner", "booking-fleet-owner");
      const admin = await createAdminUser();
      const carId = await carCreationFlow(fleetOwner.token);
      await carApprovalFlow(carId, admin.token);

      mockNotificationService.clearHistory();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const bookingData = {
        from: tomorrow.toISOString(),
        to: tomorrow.toISOString(),
        pickupTime: "9:00 AM",
        pickupAddress: "123 Main St, Lagos",
        dropOffAddress: "456 Park Ave, Lagos",
        sameLocation: false,
        carId,
        bookingType: "DAY" as const,
        includeSecurityDetail: false,
        specialRequests: "Please call when you arrive",
        totalAmount: 61812.5, // dayRate(50000) + 15% platform fee (7500) + 7.5% VAT (4312.5)
      };

      const bookingResponse = await request(app.getHttpServer())
        .post("/bookings")
        .set("Authorization", `Bearer ${customer.token}`)
        .send(bookingData)
        .expect(HttpStatus.CREATED);

      expect(bookingResponse.body).toMatchObject({
        success: true,
        data: {
          bookingId: expect.any(String),
          bookingReference: expect.stringMatching(/^BK-/),
          checkoutUrl: expect.any(String),
          paymentIntentId: expect.any(String),
          totalAmount: expect.any(Number),
          breakdown: {
            netTotal: expect.any(Number),
            platformServiceFee: expect.any(Number),
            vat: expect.any(Number),
            totalAmount: expect.any(Number),
          },
          booking: {
            startDate: expect.any(String),
            endDate: expect.any(String),
            type: "DAY",
            pickupAddress: "123 Main St, Lagos",
            dropOffAddress: "456 Park Ave, Lagos",
          },
        },
        message: expect.stringContaining("Booking created successfully"),
      });

      const bookingId = bookingResponse.body.data.bookingId;
      const bookingReference = bookingResponse.body.data.bookingReference;
      const paymentIntentId = bookingResponse.body.data.paymentIntentId;

      await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set("Authorization", `Bearer ${customer.token}`)
        .expect(HttpStatus.OK);

      const totalAmount = bookingResponse.body.data.totalAmount;
      const webhookPayload = {
        event: "charge.completed",
        "event.type": "CARD_TRANSACTION",
        data: {
          id: 12345678,
          tx_ref: paymentIntentId,
          flw_ref: `FLW-MOCK-${Date.now()}`,
          amount: totalAmount,
          charged_amount: totalAmount,
          app_fee: totalAmount * 0.014, // 1.4% Flutterwave fee
          merchant_fee: 0,
          currency: "NGN",
          status: "successful",
          payment_type: "card",
          processor_response: "Approved",
          auth_model: "PIN",
          narration: `Payment for booking ${bookingReference}`,
          created_at: new Date().toISOString(),
          account_id: 123456,
          customer: {
            id: 789012,
            name: customer.email.split("@")[0],
            phone_number: "+2348012345678",
            email: customer.email,
            created_at: new Date().toISOString(),
          },
        },
        meta_data: {
          bookingId: bookingId,
          transactionType: "booking_creation",
        },
      };

      await request(app.getHttpServer())
        .post("/api/payments/webhook/flutterwave")
        .set("verif-hash", "mock-signature")
        .send(webhookPayload)
        .expect(HttpStatus.OK);

      assertEmailSent(customer.email, "Your booking has been confirmed");
      assertEmailSent(fleetOwner.email, "New Booking Alert");
    });
  });

  describe("Guest Booking Flow", () => {
    it("should allow guest user to create booking without authentication", async () => {
      const { completeRegistrationFlow, createAdminUser, carCreationFlow, carApprovalFlow } = fn(
        app,
        assertOtpEmailSent,
      );

      const fleetOwner = await completeRegistrationFlow("fleetOwner", "guest-fleet-owner");
      const admin = await createAdminUser();
      const carId = await carCreationFlow(fleetOwner.token);
      await carApprovalFlow(carId, admin.token);

      mockNotificationService.clearHistory();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const bookingData = {
        from: tomorrow.toISOString(),
        to: tomorrow.toISOString(),
        pickupTime: "9:00 AM",
        pickupAddress: "789 Guest St, Abuja",
        dropOffAddress: "",
        sameLocation: true,
        carId,
        bookingType: "DAY" as const,
        includeSecurityDetail: false,
        totalAmount: 61812.5, // dayRate(50000) + 15% platform fee (7500) + 7.5% VAT (4312.5)
        email: uniqueEmail("guest"),
        name: "Guest User",
        phoneNumber: "+2349012345678",
      };

      const bookingResponse = await request(app.getHttpServer())
        .post("/bookings")
        .send(bookingData)
        .expect(HttpStatus.CREATED);

      expect(bookingResponse.body).toMatchObject({
        success: true,
        data: {
          bookingId: expect.any(String),
          bookingReference: expect.stringMatching(/^BK-/),
          checkoutUrl: expect.any(String),
          paymentIntentId: expect.any(String),
          totalAmount: expect.any(Number),
          breakdown: {
            netTotal: expect.any(Number),
            platformServiceFee: expect.any(Number),
            vat: expect.any(Number),
            totalAmount: bookingData.totalAmount,
          },
          booking: {
            startDate: expect.any(String),
            endDate: expect.any(String),
            type: "DAY",
            pickupAddress: bookingData.pickupAddress,
            dropOffAddress: bookingData.pickupAddress,
          },
        },
        message: expect.stringContaining("Booking created successfully"),
      });

      const bookingId = bookingResponse.body.data.bookingId;
      const bookingReference = bookingResponse.body.data.bookingReference;
      const paymentIntentId = bookingResponse.body.data.paymentIntentId;

      const totalAmount = bookingResponse.body.data.totalAmount;
      const webhookPayload = {
        event: "charge.completed",
        "event.type": "CARD_TRANSACTION",
        data: {
          id: 12345678,
          tx_ref: paymentIntentId,
          flw_ref: `FLW-MOCK-${Date.now()}`,
          amount: totalAmount,
          charged_amount: totalAmount,
          app_fee: totalAmount * 0.014, // 1.4% Flutterwave fee
          merchant_fee: 0,
          currency: "NGN",
          status: "successful",
          payment_type: "card",
          processor_response: "Approved",
          auth_model: "PIN",
          narration: `Payment for booking ${bookingReference}`,
          created_at: new Date().toISOString(),
          account_id: 123456,
          customer: {
            id: 789012,
            name: bookingData.email.split("@")[0],
            phone_number: "+2348012345678",
            email: bookingData.email,
            created_at: new Date().toISOString(),
          },
        },
        meta_data: {
          bookingId: bookingId,
          transactionType: "booking_creation",
        },
      };

      await request(app.getHttpServer())
        .post("/api/payments/webhook/flutterwave")
        .set("verif-hash", "mock-signature")
        .send(webhookPayload)
        .expect(HttpStatus.OK);

      assertEmailSent(bookingData.email, "Your booking has been confirmed");
      assertEmailSent(fleetOwner.email, "New Booking Alert");
    });
  });

  describe("Booking Validation", () => {
    beforeEach(async () => {
      const { completeRegistrationFlow, createAdminUser, carCreationFlow, carApprovalFlow } = fn(
        app,
        assertOtpEmailSent,
      );

      const customer = await completeRegistrationFlow("customer", "validation-customer");
      customerToken = customer.token;

      const fleetOwner = await completeRegistrationFlow("fleetOwner", "validation-fleet-owner");
      const admin = await createAdminUser();

      carId = await carCreationFlow(fleetOwner.token);
      await carApprovalFlow(carId, admin.token);
    });

    it("should reject booking with past date ", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const bookingData = {
        from: yesterday.toISOString(),
        to: yesterday.toISOString(),
        pickupTime: "9:00 AM",
        pickupAddress: "123 Main St, Lagos",
        dropOffAddress: "124 Main St, Lagos",
        sameLocation: false,
        carId,
        bookingType: "DAY" as const,
        totalAmount: 50000,
      };

      const response = await request(app.getHttpServer())
        .post("/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send(bookingData)
        .expect(HttpStatus.BAD_REQUEST);

      expect(
        response.body.details.fields.find(({ field }: { field: string }) => field === "from")
          .message,
      ).toEqual("Start date must be in the future");
    });

    it("should reject booking with invalid car ID", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const bookingData = {
        from: tomorrow.toISOString(),
        to: tomorrow.toISOString(),
        pickupTime: "9:00 AM",
        pickupAddress: "123 Main St, Lagos",
        sameLocation: true,
        carId: "00000000-0000-0000-0000-000000000000",
        bookingType: "DAY" as const,
        totalAmount: 50000,
      };

      const response = await request(app.getHttpServer())
        .post("/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send(bookingData)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toEqual(
        "Car with ID 00000000-0000-0000-0000-000000000000 was not found",
      );
    });

    it("should reject booking with end date before start date", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const today = new Date();

      const bookingData = {
        from: tomorrow.toISOString(),
        to: today.toISOString(),
        pickupTime: "9:00 AM",
        pickupAddress: "123 Main St, Lagos",
        dropOffAddress: "123 Main St, Lagos",
        sameLocation: false,
        carId,
        bookingType: "DAY" as const,
        totalAmount: 50000,
      };

      const response = await request(app.getHttpServer())
        .post("/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send(bookingData)
        .expect(HttpStatus.BAD_REQUEST);

      expect(
        response.body.details.fields.find(({ field }: { field: string }) => field === "to").message,
      ).toEqual("End date must be after or equal to start date");
    });

    it("should reject booking when sameLocation is true but dropOffAddress is provided", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const bookingData = {
        from: tomorrow.toISOString(),
        to: tomorrow.toISOString(),
        pickupTime: "9:00 AM",
        pickupAddress: "123 Main St, Lagos",
        dropOffAddress: "456 Different St, Lagos",
        sameLocation: true,
        carId,
        bookingType: "DAY" as const,
        totalAmount: 50000,
      };

      const response = await request(app.getHttpServer())
        .post("/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send(bookingData)
        .expect(HttpStatus.BAD_REQUEST);

      expect(
        response.body.details.fields.find(
          ({ field }: { field: string }) => field === "dropOffAddress",
        ).message,
      ).toEqual("Cannot specify dropOffAddress when sameLocation is true");
    });

    it("should reject invalid pickup time format", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const bookingData = {
        from: tomorrow.toISOString(),
        to: tomorrow.toISOString(),
        pickupTime: "25:99 XM",
        pickupAddress: "123 Main St, Lagos",
        sameLocation: true,
        carId,
        bookingType: "DAY" as const,
        totalAmount: 50000,
      };

      const response = await request(app.getHttpServer())
        .post("/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send(bookingData)
        .expect(HttpStatus.BAD_REQUEST);

      expect(
        response.body.details.fields.find(({ field }: { field: string }) => field === "pickupTime")
          .message,
      ).toEqual("Pickup time must be in format like '8:00 AM' or '11:00 AM'");
    });
  });

  describe("Multi-Day Booking", () => {
    it("should create booking with multiple legs for multi-day booking", async () => {
      const { completeRegistrationFlow, createAdminUser, carCreationFlow, carApprovalFlow } = fn(
        app,
        assertOtpEmailSent,
      );
      const customer = await completeRegistrationFlow("customer", "multiday-customer");
      const fleetOwner = await completeRegistrationFlow("fleetOwner", "multiday-fleet-owner");
      const admin = await createAdminUser();
      const carId = await carCreationFlow(fleetOwner.token);
      await carApprovalFlow(carId, admin.token);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      dayAfterTomorrow.setHours(0, 0, 0, 0);

      console.log(tomorrow.toISOString(), dayAfterTomorrow.toISOString());

      const bookingData = {
        from: tomorrow.toISOString(),
        to: dayAfterTomorrow.toISOString(),
        pickupTime: "9:00 AM",
        pickupAddress: "Start Location, Lagos",
        dropOffAddress: "End Location, Abuja",
        sameLocation: false,
        carId,
        bookingType: "DAY" as const,
        includeSecurityDetail: false,
        totalAmount: 185437.5, // 3 days: dayRate(50000 × 3) + 15% platform fee (22500) + 7.5% VAT (12937.5)
      };

      const bookingResponse = await request(app.getHttpServer())
        .post("/bookings")
        .set("Authorization", `Bearer ${customer.token}`)
        .send(bookingData)
        .expect(HttpStatus.CREATED);

      const bookingId = bookingResponse.body.data.bookingId;
      const paymentIntentId = bookingResponse.body.data.paymentIntentId;
      const totalAmount = bookingResponse.body.data.totalAmount;
      const bookingReference = bookingResponse.body.data.bookingReference;

      const webhookPayload = {
        event: "charge.completed",
        "event.type": "CARD_TRANSACTION",
        data: {
          id: 12345678,
          tx_ref: paymentIntentId,
          flw_ref: `FLW-MOCK-${Date.now()}`,
          amount: totalAmount,
          charged_amount: totalAmount,
          app_fee: totalAmount * 0.014, // 1.4% Flutterwave fee
          merchant_fee: 0,
          currency: "NGN",
          status: "successful",
          payment_type: "card",
          processor_response: "Approved",
          auth_model: "PIN",
          narration: `Payment for booking ${bookingReference}`,
          created_at: new Date().toISOString(),
          account_id: 123456,
          customer: {
            id: 789012,
            name: customer.email.split("@")[0],
            phone_number: "+2348012345678",
            email: customer.email,
            created_at: new Date().toISOString(),
          },
        },
        meta_data: {
          bookingId: bookingId,
          transactionType: "booking_creation",
        },
      };

      await request(app.getHttpServer())
        .post("/api/payments/webhook/flutterwave")
        .set("verif-hash", "mock-signature")
        .send(webhookPayload)
        .expect(HttpStatus.OK);

      const confirmationBookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set("Authorization", `Bearer ${customer.token}`)
        .expect(HttpStatus.OK);

      const booking = confirmationBookingResponse.body;

      expect(booking).toMatchObject({
        id: bookingId,
        bookingReference: bookingReference,
        status: "CONFIRMED",
        bookingType: "DAY",
        paymentStatus: "PAID",
        pickupAddress: "Start Location, Lagos",
        dropOffAddress: "End Location, Abuja",
        totalAmount: 185437.5,
        netTotal: 150000,
      });

      expect(booking.legs).toHaveLength(3);

      booking.legs.forEach((leg, index: number) => {
        const expectedLegDate = new Date(tomorrow);
        const legDate = new Date(leg.legDate);
        const legStartTime = new Date(leg.legStartTime);
        const legEndTime = new Date(leg.legEndTime);

        expectedLegDate.setDate(expectedLegDate.getDate() + index);
        expect(legDate.toDateString()).toBe(expectedLegDate.toDateString());

        expect(legStartTime.toDateString()).toBe(expectedLegDate.toDateString());
        expect(legEndTime.toDateString()).toBe(expectedLegDate.toDateString());
        expect(leg.status).toBe("CONFIRMED");
        expect(leg.durationInHours).toBe(12);
        expect(leg.totalDailyPrice).toBe(50000);
      });
    });
  });

  describe.skip("Security Detail Booking", () => {
    it("should create booking with security detail included", async () => {
      const { completeRegistrationFlow, createAdminUser, carCreationFlow, carApprovalFlow } = fn(
        app,
        assertOtpEmailSent,
      );
      const customer = await completeRegistrationFlow("customer", "security-customer");
      const fleetOwner = await completeRegistrationFlow("fleetOwner", "security-fleet-owner");
      const admin = await createAdminUser();

      const carId = await carCreationFlow(fleetOwner.token);
      await carApprovalFlow(carId, admin.token);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const bookingData = {
        from: tomorrow.toISOString(),
        to: tomorrow.toISOString(),
        pickupTime: "9:00 AM", // DAY bookings: 7am-11am window
        pickupAddress: "VIP Location, Lagos",
        dropOffAddress: "VIP Destination, Lagos",
        sameLocation: false,
        carId,
        bookingType: "DAY" as const,
        includeSecurityDetail: true, // Security detail
        totalAmount: 65000, // Base (50,000) + Security detail cost (5,000)
      };

      const bookingResponse = await request(app.getHttpServer())
        .post("/bookings")
        .set("Authorization", `Bearer ${customer.token}`)
        .send(bookingData)
        .expect(HttpStatus.CREATED);

      expect(bookingResponse.body.success).toBe(true);

      const bookingId = bookingResponse.body.data.bookingId;

      const fetchResponse = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set("Authorization", `Bearer ${customer.token}`)
        .expect(HttpStatus.OK);

      expect(fetchResponse.body.data.includeSecurityDetail).toBe(true);
      expect(fetchResponse.body.data.securityDetailCost).toBeDefined();
      expect(Number(fetchResponse.body.data.securityDetailCost)).toBeGreaterThan(0);
    });
  });
});
