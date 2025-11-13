import { ApprovalStatusEnum } from "@/iam/domain/value-objects/approval-status.vo";
import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../../src/app.module";
import { NotificationService } from "../../../src/communication/application/services/notification.service";
import { PrismaService } from "../../../src/shared/database/prisma.service";
import { RedisService } from "../../../src/shared/redis/redis.service";
import { MockNotificationService } from "../../mocks/mock-notification.service";
import { createAssertOtpEmailSent, uniqueEmail } from "./helpers/authentication.helpers";

describe("Authentication E2E", () => {
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

  describe("Customer Registration Flow", () => {
    it("should complete full registration flow: OTP generation → verification → login", async () => {
      const role = "customer";
      const customerEmail = uniqueEmail("customer");

      const otpResponse = await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: customerEmail })
        .expect(HttpStatus.CREATED);

      expect(otpResponse.body).toMatchObject({
        success: true,
        message: expect.stringContaining(customerEmail),
        expiresAt: expect.any(Number),
      });

      // Assert OTP email was sent with valid OTP
      const otpCode = assertOtpEmailSent(customerEmail, "registration");

      const verifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: customerEmail,
          otpCode,
          role,
        })
        .expect(HttpStatus.CREATED);

      expect(verifyResponse.body).toMatchObject({
        success: true,
        message: `Welcome to Hyre! Registration successful`,
        user: {
          id: expect.any(String),
          email: customerEmail,
          phoneNumber: expect.any(String),
          roles: [role],
          approvalStatus: ApprovalStatusEnum.APPROVED,
          hasOnboarded: false,
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresAt: expect.any(Number),
        },
      });

      const meResponse = await request(app.getHttpServer())
        .get("/users/me")
        .set("Authorization", `Bearer ${verifyResponse.body.tokens.accessToken}`)
        .expect(HttpStatus.OK);

      expect(meResponse.body).toMatchObject({
        success: true,
        data: {
          email: customerEmail,
          roles: [role],
          isOnboarded: false,
        },
      });
    });

    it("should reject registration with invalid OTP", async () => {
      const customerEmail = uniqueEmail("invalid-otp");

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: customerEmail })
        .expect(HttpStatus.CREATED);

      // Assert OTP email was sent with valid OTP
      const otpCode = assertOtpEmailSent(customerEmail, "registration");

      const invalidOtpVerifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: customerEmail,
          otpCode: "999999",
          role: "customer",
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(invalidOtpVerifyResponse.body.message).toContain("Invalid OTP code");

      const newOtpVerifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: customerEmail,
          otpCode,
          role: "customer",
        })
        .expect(HttpStatus.CREATED);

      expect(newOtpVerifyResponse.body.message).toContain(
        "Welcome to Hyre! Registration successful",
      );
    });
  });

  describe("Fleet Owner Registration Flow", () => {
    it("should register fleet owner successfully", async () => {
      const fleetOwnerEmail = uniqueEmail("fleetowner");

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: fleetOwnerEmail })
        .expect(HttpStatus.CREATED);

      // Assert OTP email was sent with valid OTP
      const otpCode = assertOtpEmailSent(fleetOwnerEmail, "registration");

      const verifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: fleetOwnerEmail,
          otpCode,
          role: "fleetOwner",
        })
        .expect(HttpStatus.CREATED);

      expect(verifyResponse.body).toMatchObject({
        success: true,
        user: {
          email: fleetOwnerEmail,
          roles: expect.arrayContaining(["fleetOwner"]),
          hasOnboarded: false,
        },
        tokens: {
          accessToken: expect.any(String),
        },
      });

      const meResponse = await request(app.getHttpServer())
        .get("/users/me")
        .set("Authorization", `Bearer ${verifyResponse.body.tokens.accessToken}`)
        .expect(HttpStatus.OK);

      expect(meResponse.body.data.roles).toContain("fleetOwner");
    });
  });

  describe("Existing User Login Flow", () => {
    it("should login existing user with new OTP", async () => {
      const existingEmail = uniqueEmail("existing-user");

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: existingEmail })
        .expect(HttpStatus.CREATED);

      const firstOtpCode = assertOtpEmailSent(existingEmail, "registration");

      const registerResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: existingEmail,
          otpCode: firstOtpCode,
          role: "customer",
        })
        .expect(HttpStatus.CREATED);

      const existingUserId = registerResponse.body.user.id;
      mockNotificationService.clearHistory();

      const otpResponse = await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: existingEmail })
        .expect(HttpStatus.CREATED);

      expect(otpResponse.body.message).toContain(existingEmail);

      const otpCode = assertOtpEmailSent(existingEmail, "login");

      const loginResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: existingEmail,
          otpCode,
          role: "customer",
        })
        .expect(HttpStatus.CREATED);

      expect(loginResponse.body).toMatchObject({
        success: true,
        user: {
          id: existingUserId, // Same ID proves it's the same user, not a duplicate
          email: existingEmail,
          roles: expect.arrayContaining(["customer"]),
        },
        tokens: {
          accessToken: expect.any(String),
        },
      });
    });

    it("should reject login with mismatched role", async () => {
      const existingEmail = uniqueEmail("existing");

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: existingEmail })
        .expect(HttpStatus.CREATED);

      const registrationOtp = assertOtpEmailSent(existingEmail, "registration");

      await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: existingEmail,
          otpCode: registrationOtp,
          role: "customer",
        })
        .expect(HttpStatus.CREATED);

      mockNotificationService.clearHistory();

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: existingEmail })
        .expect(HttpStatus.CREATED);

      const loginOtp = assertOtpEmailSent(existingEmail, "login");

      const verifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: existingEmail,
          otpCode: loginOtp,
          role: "fleetOwner",
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(verifyResponse.body.message).toMatch(/role|mismatch|invalid/i);
    });
  });

  describe("Restricted Role Registration", () => {
    it("should reject staff registration via public endpoint", async () => {
      const staffEmail = uniqueEmail("staff-test");

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: staffEmail })
        .expect(HttpStatus.CREATED);

      const otpCode = assertOtpEmailSent(staffEmail, "registration");

      const verifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: staffEmail,
          otpCode,
          role: "staff",
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(verifyResponse.body.message).toMatch(/staff.*authorized|created by/i);
    });

    it("should reject chauffeur registration via public endpoint", async () => {
      const chauffeurEmail = uniqueEmail("chauffeur-test");

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: chauffeurEmail })
        .expect(HttpStatus.CREATED);

      const otpCode = assertOtpEmailSent(chauffeurEmail, "registration");

      const verifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: chauffeurEmail,
          otpCode,
          role: "chauffeur",
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(verifyResponse.body.message).toMatch(/chauffeur.*authorized|created by/i);
    });

    it("should reject admin registration via public endpoint", async () => {
      const adminEmail = uniqueEmail("admin-test");

      await request(app.getHttpServer()).post("/auth/otp").send({ email: adminEmail }).expect(201);

      const otpCode = assertOtpEmailSent(adminEmail, "registration");

      const verifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: adminEmail,
          otpCode,
          role: "admin",
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(verifyResponse.body.message).toContain(
        "admin accounts must be created by authorized users",
      );
    });
  });

  describe("Token Management", () => {
    it("should access protected routes with valid token", async () => {
      const tokenEmail = uniqueEmail("token");

      await request(app.getHttpServer()).post("/auth/otp").send({ email: tokenEmail }).expect(201);

      const otpCode = assertOtpEmailSent(tokenEmail, "registration");

      const authResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: tokenEmail,
          otpCode,
          role: "customer",
        })
        .expect(HttpStatus.CREATED);

      const accessToken = authResponse.body.tokens.accessToken;

      const response = await request(app.getHttpServer())
        .get("/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.email).toBe(tokenEmail);
    });

    it("should reject requests without token", async () => {
      await request(app.getHttpServer()).get("/users/me").expect(401);
    });

    it("should reject requests with invalid token", async () => {
      await request(app.getHttpServer())
        .get("/users/me")
        .set("Authorization", "Bearer invalid-token-here")
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it("should refresh access token with refresh token", async () => {
      const tokenEmail = uniqueEmail("token-refresh");

      await request(app.getHttpServer()).post("/auth/otp").send({ email: tokenEmail }).expect(201);

      const otpCode = assertOtpEmailSent(tokenEmail, "registration");

      const authResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: tokenEmail,
          otpCode,
          role: "customer",
        })
        .expect(HttpStatus.CREATED);

      const refreshToken = authResponse.body.tokens.refreshToken;

      const refreshResponse = await request(app.getHttpServer())
        .post("/auth/refresh-token")
        .send({ refreshToken })
        .expect(HttpStatus.CREATED);

      expect(refreshResponse.body).toMatchObject({
        success: true,
        tokens: {
          accessToken: expect.any(String),
          expiresAt: expect.any(Number),
        },
      });

      await request(app.getHttpServer())
        .get("/users/me")
        .set("Authorization", `Bearer ${refreshResponse.body.tokens.accessToken}`)
        .expect(HttpStatus.OK);
    });

    it("should logout and invalidate token", async () => {
      const tokenEmail = uniqueEmail("token-logout");

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: tokenEmail })
        .expect(HttpStatus.CREATED);

      const otpCode = assertOtpEmailSent(tokenEmail, "registration");

      const authResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: tokenEmail,
          otpCode,
          role: "customer",
        })
        .expect(HttpStatus.CREATED);

      const accessToken = authResponse.body.tokens.accessToken;

      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .get("/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe("Email Validation", () => {
    it("should reject invalid email format", async () => {
      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: "not-an-email" })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it("should accept valid email formats", async () => {
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.co.uk",
        "123@test.com",
      ];

      for (const email of validEmails) {
        const response = await request(app.getHttpServer())
          .post("/auth/otp")
          .send({ email })
          .expect(HttpStatus.CREATED);

        expect(response.body.success).toBe(true);
      }
    });
  });

  describe("Multiple OTP Requests", () => {
    it("should invalidate previous OTP when new one is requested", async () => {
      const multiOtpEmail = uniqueEmail("multi-otp");

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: multiOtpEmail })
        .expect(HttpStatus.CREATED);

      const firstOtp = assertOtpEmailSent(multiOtpEmail, "registration");

      mockNotificationService.clearHistory();

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email: multiOtpEmail })
        .expect(HttpStatus.CREATED);

      const secondOtp = assertOtpEmailSent(multiOtpEmail, "registration");

      expect(firstOtp).not.toBe(secondOtp);

      const firstVerifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: multiOtpEmail,
          otpCode: firstOtp,
          role: "customer",
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(firstVerifyResponse.body.message).toContain("Invalid OTP code");

      const secondVerifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({
          email: multiOtpEmail,
          otpCode: secondOtp,
          role: "customer",
        })
        .expect(HttpStatus.CREATED);

      expect(secondVerifyResponse.body.success).toBe(true);
    });
  });
});
