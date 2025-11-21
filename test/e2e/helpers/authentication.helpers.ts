import { HttpStatus, INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { expect } from "vitest";
import { MockNotificationService } from "../../mocks/mock-notification.service";
import { CarFactory } from "../factories/user.factory";

export const uniqueEmail = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
};

export const createAssertOtpEmailSent = (mockNotificationService: MockNotificationService) => {
  return (email: string, expectedType: "registration" | "login" = "registration"): string => {
    const emailNotifications = mockNotificationService.getEmailHistory();
    // Use reverse to get the most recent email (handles multiple emails per user)
    const otpEmail = [...emailNotifications].reverse().find((e) => e.to === email);

    expect(otpEmail, `No email sent to ${email}`).toBeDefined();

    if (expectedType === "registration") {
      expect(otpEmail?.subject).toContain("Welcome to Hyre");
    } else {
      expect(otpEmail?.subject).toContain("Login to Hyre");
    }

    const otpCode = mockNotificationService.getLastOtpCode(email);
    expect(otpCode, `No OTP code found for ${email}`).toBeDefined();
    expect(otpCode).toMatch(/^\d{6}$/);

    expect(otpEmail?.body, `OTP code not found in email body for ${email}`).toContain(otpCode);

    return otpCode;
  };
};

export const createAssertEmailSent = (mockNotificationService: MockNotificationService) => {
  return (email: string, expectedSubject: string) => {
    const emailNotifications = mockNotificationService.getEmailHistory();
    // Use reverse to get the most recent email (handles multiple emails per user)
    const emailNotification = [...emailNotifications].reverse().find((e) => e.to === email);
    expect(emailNotification?.subject).toContain(expectedSubject);
  };
};

export const fn = (
  app: INestApplication,
  assertOtpEmailSent: ReturnType<typeof createAssertOtpEmailSent>,
  prisma: PrismaClient,
) => {
  return {
    completeRegistrationFlow: async (
      role: "customer" | "fleetOwner" | "admin",
      emailPrefix: string,
    ): Promise<{ token: string; userId: string; email: string }> => {
      const email = uniqueEmail(emailPrefix);

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email })
        .expect(HttpStatus.CREATED);

      const otpCode = assertOtpEmailSent(email, "registration");

      const verifyResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({ email, otpCode, role })
        .expect(HttpStatus.CREATED);

      return {
        token: verifyResponse.body.tokens.accessToken,
        userId: verifyResponse.body.user.id,
        email,
      };
    },

    createAdminUser: async (): Promise<{ token: string; userId: string; email: string }> => {
      const email = uniqueEmail("admin");

      // Use upsert to make admin role creation idempotent across tests
      const adminRole = await prisma.role.upsert({
        where: { name: "admin" },
        update: {},
        create: {
          name: "admin",
          description: "System administrator",
        },
      });

      const admin = await prisma.user.create({
        data: {
          email,
          name: "Admin User",
          phoneNumber: "+2348012345678",
          hasOnboarded: true,
          roles: {
            connect: { id: adminRole.id },
          },
        },
      });

      await request(app.getHttpServer())
        .post("/auth/otp")
        .send({ email })
        .expect(HttpStatus.CREATED);

      const otpCode = assertOtpEmailSent(email, "login");

      const loginResponse = await request(app.getHttpServer())
        .post("/auth/verify")
        .send({ email, otpCode, role: "admin" })
        .expect(HttpStatus.CREATED);

      return {
        token: loginResponse.body.tokens.accessToken,
        userId: admin.id,
        email,
      };
    },

    carCreationFlow: async (
      ownerToken: string,
      overrides: Partial<{
        dayRate: number;
        nightRate: number;
        hourlyRate: number;
        registrationNumber: string;
      }> = {},
    ): Promise<string> => {
      const carData = CarFactory.build({
        registrationNumber: `LAG${Date.now().toString().slice(-3)}AB`,
        dayRate: 50000,
        nightRate: 70000,
        hourlyRate: 10000,
        fullDayRate: 200000,
        ...overrides,
      });

      const mockImageBuffer = Buffer.from("fake-image-data");
      const mockPdfBuffer = Buffer.from("fake-pdf-data");

      const carResponse = await request(app.getHttpServer())
        .post("/fleet/cars")
        .set("Authorization", `Bearer ${ownerToken}`)
        .field("make", carData.make)
        .field("model", carData.model)
        .field("year", carData.year.toString())
        .field("color", carData.color)
        .field("registrationNumber", carData.registrationNumber)
        .field("dayRate", carData.dayRate.toString())
        .field("nightRate", carData.nightRate.toString())
        .field("hourlyRate", carData.hourlyRate.toString())
        .field("fullDayRate", carData.fullDayRate.toString())
        .attach("images", mockImageBuffer, "car-image.jpg")
        .attach("motCertificate", mockPdfBuffer, "mot-cert.pdf")
        .attach("insuranceCertificate", mockPdfBuffer, "insurance-cert.pdf");

      if (carResponse.status !== HttpStatus.CREATED) {
        console.error("Car creation failed:", carResponse);
        throw new Error(`Car creation failed: ${JSON.stringify(carResponse.body, null, 2)}`);
      }

      return carResponse.body.data.carId;
    },

    carApprovalFlow: async (carId: string, adminToken: string): Promise<void> => {
      await request(app.getHttpServer())
        .put(`/fleet/cars/${carId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    },
  };
};
