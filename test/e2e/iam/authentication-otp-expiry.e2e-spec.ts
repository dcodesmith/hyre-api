import { HttpStatus, INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../../src/app.module";
import { NotificationService } from "../../../src/communication/application/services/notification.service";
import { PrismaService } from "../../../src/shared/database/prisma.service";
import { RedisService } from "../../../src/shared/redis/redis.service";
import { MockNotificationService } from "../../mocks/mock-notification.service";
import { TestConfigService } from "../../utils/test-config.service";
import { createAssertOtpEmailSent, uniqueEmail } from "./helpers/authentication.helpers";

/**
 * OTP Expiry E2E Tests
 *
 * This test suite is isolated from the main authentication tests because it requires
 * a custom configuration override (short OTP expiry time) that would affect other tests.
 *
 * Configuration:
 * - AUTH_OTP_EXPIRY_MINUTES is set to 0.005 minutes (0.3 seconds) via TestConfigService
 * - This allows fast, reliable testing of OTP expiry logic without fake timers
 *
 * Isolation Strategy:
 * - Separate NestJS application instance with TestConfigService override
 * - ConfigService value is read in OtpAuthenticationService constructor during module init
 * - No side effects on main authentication test suite
 *
 * Why Not Fake Timers:
 * - OTP expiry uses Date.now() for real-time comparison
 * - Redis TTL uses actual system time
 * - E2E tests should test real behavior with real time
 * - 0.6s expiry is fast enough for practical testing (~2s per test)
 */
describe("Authentication OTP Expiry E2E", () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let redis: RedisService;
  let mockNotificationService: MockNotificationService;
  let assertOtpEmailSent: ReturnType<typeof createAssertOtpEmailSent>;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useClass(TestConfigService)
      .overrideProvider(NotificationService)
      .useClass(MockNotificationService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    mockNotificationService = moduleFixture.get(NotificationService);

    assertOtpEmailSent = createAssertOtpEmailSent(mockNotificationService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    mockNotificationService.clearHistory();

    await redis.getClient().flushdb();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();
  });

  it("should reject OTP after expiration (0.3s expiry)", async () => {
    const customerEmail = uniqueEmail("customer-expired");

    // Generate OTP (expires in 0.3 seconds due to TestConfigService)
    const otpResponse = await request(app.getHttpServer())
      .post("/auth/otp")
      .send({ email: customerEmail })
      .expect(HttpStatus.CREATED);

    expect(otpResponse.body).toMatchObject({
      success: true,
      message: expect.stringContaining(customerEmail),
      expiresAt: expect.any(Number),
    });

    const otpCode = assertOtpEmailSent(customerEmail, "registration");

    await new Promise((resolve) => setTimeout(resolve, 400));

    const expiredResponse = await request(app.getHttpServer())
      .post("/auth/verify")
      .send({
        email: customerEmail,
        otpCode,
        role: "customer",
      })
      .expect(HttpStatus.UNAUTHORIZED);

    expect(expiredResponse.body.message).toContain("OTP has expired");
  });

  it("should accept OTP before expiration (0.3s expiry)", async () => {
    const customerEmail = uniqueEmail("customer-valid");

    await request(app.getHttpServer())
      .post("/auth/otp")
      .send({ email: customerEmail })
      .expect(HttpStatus.CREATED);

    const otpCode = assertOtpEmailSent(customerEmail, "registration");

    const validResponse = await request(app.getHttpServer())
      .post("/auth/verify")
      .send({
        email: customerEmail,
        otpCode,
        role: "customer",
      })
      .expect(HttpStatus.CREATED);

    expect(validResponse.body).toMatchObject({
      success: true,
      message: "Welcome to Hyre! Registration successful",
      user: {
        email: customerEmail,
        roles: ["customer"],
      },
      tokens: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      },
    });
  });

  it("should generate new OTP after previous one expires", async () => {
    const customerEmail = uniqueEmail("customer-new-otp");

    await request(app.getHttpServer())
      .post("/auth/otp")
      .send({ email: customerEmail })
      .expect(HttpStatus.CREATED);

    const firstOtp = assertOtpEmailSent(customerEmail, "registration");

    await new Promise((resolve) => setTimeout(resolve, 400));

    await request(app.getHttpServer())
      .post("/auth/verify")
      .send({
        email: customerEmail,
        otpCode: firstOtp,
        role: "customer",
      })
      .expect(HttpStatus.UNAUTHORIZED);

    mockNotificationService.clearHistory();

    await request(app.getHttpServer())
      .post("/auth/otp")
      .send({ email: customerEmail })
      .expect(HttpStatus.CREATED);

    const secondOtp = assertOtpEmailSent(customerEmail, "registration");

    const successResponse = await request(app.getHttpServer())
      .post("/auth/verify")
      .send({
        email: customerEmail,
        otpCode: secondOtp,
        role: "customer",
      })
      .expect(HttpStatus.CREATED);

    expect(successResponse.body).toMatchObject({
      success: true,
      message: "Welcome to Hyre! Registration successful",
    });
  });
});
