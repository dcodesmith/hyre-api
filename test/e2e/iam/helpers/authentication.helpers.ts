import { expect } from "vitest";
import type { MockNotificationService } from "../../../mocks/mock-notification.service";

export const uniqueEmail = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
};

export const createAssertOtpEmailSent = (mockNotificationService: MockNotificationService) => {
  return (email: string, expectedType: "registration" | "login" = "registration"): string => {
    const emailNotifications = mockNotificationService.getEmailHistory();
    const otpEmail = emailNotifications.find((e) => e.to === email);

    expect(otpEmail, `No email sent to ${email}`).toBeDefined();
    expect(otpEmail, `Email to ${email} is undefined`).not.toBeUndefined();

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
