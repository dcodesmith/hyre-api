import { Injectable } from "@nestjs/common";
import { NotificationService } from "../../src/communication/application/services/notification.service";
import { Notification } from "../../src/communication/domain/entities/notification.entity";

@Injectable()
export class MockNotificationService extends NotificationService {
  private sentNotifications: Notification[] = [];

  async sendNotification(notification: Notification): Promise<void> {
    // Interpolate template variables before storing (mirrors production behavior)
    const interpolatedContent = notification.getContent().interpolate();

    // Create a new notification with interpolated content for storage
    const interpolatedNotification = Notification.create(
      notification.getType(),
      notification.getRecipient(),
      interpolatedContent,
      notification.getChannel(),
      notification.getBookingId(),
      notification.getBookingLegId(),
    );

    // Copy status from original notification
    if (notification.isSent()) {
      interpolatedNotification.markAsSent();
    }

    // Store the interpolated version (this is what users would actually receive)
    this.sentNotifications.push(interpolatedNotification);

    // Uncomment for debugging:
    // console.log("📧 Mock Email Sent (Interpolated):", {
    //   to: interpolatedNotification.getRecipient().email,
    //   subject: interpolatedContent.subject,
    //   type: interpolatedNotification.getType().toString(),
    //   bodyPreview: interpolatedContent.body.substring(0, 100) + "...",
    // });

    // Simulate the original notification being processed successfully
    notification.markAsSent();
  }

  // Test helper methods
  getSentNotifications(): Notification[] {
    return this.sentNotifications;
  }

  getLastNotification(): Notification | null {
    return this.sentNotifications[this.sentNotifications.length - 1] || null;
  }

  getNotificationsByEmail(email: string): Notification[] {
    return this.sentNotifications.filter((n) => n.getRecipient().email === email);
  }

  getOtpNotifications(): Notification[] {
    return this.sentNotifications.filter((notification) => {
      const type = notification.getType().toString().toLowerCase();
      const subject = notification.getContent().subject.toLowerCase();

      return (
        type.includes("otp") ||
        type.includes("user_registered") ||
        subject.includes("verification") ||
        subject.includes("complete your registration") ||
        subject.includes("login to hyre")
      );
    });
  }

  clear(): void {
    this.sentNotifications = [];
  }

  getNotificationCount(): number {
    return this.sentNotifications.length;
  }

  hasNotificationFor(email: string, type?: string): boolean {
    return this.sentNotifications.some((n) => {
      const matchesEmail = n.getRecipient().email === email;
      if (!type) return matchesEmail;

      const notificationType = n.getType().toString().toLowerCase();
      const subject = n.getContent().subject.toLowerCase();
      const searchType = type.toLowerCase();

      const matchesType =
        notificationType.includes(searchType) ||
        subject.includes(searchType) ||
        (searchType === "verification" && subject.includes("complete your registration")) ||
        (searchType === "otp" && notificationType.includes("user_registered"));

      return matchesEmail && matchesType;
    });
  }

  // Enhanced test helper methods for interpolated content
  getInterpolatedContent(email: string): string | null {
    const notification = this.sentNotifications.find((n) => n.getRecipient().email === email);
    return notification ? notification.getContent().body : null;
  }

  getInterpolatedSubject(email: string): string | null {
    const notification = this.sentNotifications.find((n) => n.getRecipient().email === email);
    return notification ? notification.getContent().subject : null;
  }

  hasOtpCode(email: string, expectedOtp?: string): boolean {
    const content = this.getInterpolatedContent(email);
    if (!content) return false;

    if (expectedOtp) {
      return content.includes(`Verification Code: ${expectedOtp}`);
    }

    // Check for any 6-digit verification code pattern
    return /Verification Code: \d{6}/.test(content);
  }

  extractOtpFromEmail(email: string): string | null {
    const content = this.getInterpolatedContent(email);
    if (!content) return null;

    const match = content.match(/Verification Code: (\d{6})/);
    return match ? match[1] : null;
  }

  hasTemplateVariables(email: string): boolean {
    const content = this.getInterpolatedContent(email);
    const subject = this.getInterpolatedSubject(email);

    if (!content || !subject) return false;

    // Check if any template variables remain uninterpolated
    const templateVariablePattern = /\{\{[^}]+\}\}/;
    return templateVariablePattern.test(content) || templateVariablePattern.test(subject);
  }
}
