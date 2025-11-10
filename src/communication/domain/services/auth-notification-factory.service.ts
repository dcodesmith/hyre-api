import { Injectable } from "@nestjs/common";
import { DeliveryChannel, Notification } from "../entities/notification.entity";
import { NotificationContent } from "../value-objects/notification-content.vo";
import { NotificationType } from "../value-objects/notification-type.vo";
import { Recipient, RecipientRole } from "../value-objects/recipient.vo";
import { NotificationTemplateService } from "./notification-template.service";

export interface OtpNotificationData {
  userId?: string;
  email: string;
  otpCode: string;
  otpType: "registration" | "login";
  expiresAt: number;
}

export interface WelcomeNotificationData {
  userId: string;
  email: string;
  name?: string;
  role: string;
}

export interface LoginConfirmationData {
  userId: string;
  email: string;
  name?: string;
  loginTime: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthNotificationFactoryService {
  constructor(private readonly templateService: NotificationTemplateService) {}

  createOtpNotification(data: OtpNotificationData): Notification {
    const recipient = Recipient.create(
      data.userId || "anonymous",
      data.email,
      RecipientRole.CUSTOMER,
      data.email,
    );

    const subject =
      data.otpType === "registration"
        ? "Welcome to Hyre! Complete your registration"
        : "Login to Hyre - Verification Code";

    const content = NotificationContent.create(
      subject,
      this.templateService.getOtpEmailTemplate(data.otpType),
      {
        email: data.email,
        otpCode: data.otpCode,
        otpType: data.otpType,
        expiresAt: new Date(data.expiresAt).toLocaleString(),
      },
    );

    return Notification.create(
      data.otpType === "registration"
        ? NotificationType.userRegistered()
        : NotificationType.otpLogin(),
      recipient,
      content,
      DeliveryChannel.EMAIL,
      data.userId || "anonymous",
    );
  }

  createWelcomeNotification(data: WelcomeNotificationData): Notification {
    const recipient = Recipient.create(
      data.userId,
      data.name || data.email,
      this.mapRoleToRecipientRole(data.role),
      data.email,
    );

    const content = NotificationContent.create(
      "Welcome to Hyre! Your account is ready",
      this.templateService.getWelcomeTemplate(data.role),
      {
        name: data.name || data.email,
        email: data.email,
        role: data.role,
      },
    );

    return Notification.create(
      NotificationType.userRegistered(),
      recipient,
      content,
      DeliveryChannel.EMAIL,
      data.userId,
    );
  }

  createLoginConfirmationNotification(data: LoginConfirmationData): Notification {
    const recipient = Recipient.create(
      data.userId,
      data.name || data.email,
      RecipientRole.CUSTOMER,
      data.email,
    );

    const content = NotificationContent.create(
      "Login confirmation - Hyre",
      this.templateService.getLoginConfirmationTemplate(),
      {
        name: data.name || data.email,
        email: data.email,
        loginTime: data.loginTime.toLocaleString(),
        ipAddress: data.ipAddress || "Unknown",
        userAgent: data.userAgent || "Unknown",
      },
    );

    return Notification.create(
      NotificationType.otpLogin(),
      recipient,
      content,
      DeliveryChannel.EMAIL,
      data.userId,
    );
  }

  private mapRoleToRecipientRole(role: string): RecipientRole {
    switch (role.toLowerCase()) {
      case "fleetowner":
      case "fleet_owner":
        return RecipientRole.FLEET_OWNER;
      case "chauffeur":
        return RecipientRole.CHAUFFEUR;
      case "admin":
      case "staff":
        // Admin/staff users are treated as customers for notification purposes
        return RecipientRole.CUSTOMER;
      default:
        return RecipientRole.CUSTOMER;
    }
  }
}
