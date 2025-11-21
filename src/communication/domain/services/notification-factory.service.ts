import { Injectable } from "@nestjs/common";
import { Notification } from "../entities/notification.entity";
import {
  AuthNotificationFactoryService,
  type LoginConfirmationData,
  type OtpNotificationData,
  type WelcomeNotificationData,
} from "./auth-notification-factory.service";
import {
  type BookingLegReminderData,
  BookingNotificationFactoryService,
  type BookingStatusUpdateData,
  type FleetOwnerBookingAlertData,
} from "./booking-notification-factory.service";

// Re-export types for backward compatibility
export type {
  BookingLegReminderData,
  BookingStatusUpdateData,
  FleetOwnerBookingAlertData,
  OtpNotificationData,
  WelcomeNotificationData,
  LoginConfirmationData,
};

@Injectable()
export class NotificationFactoryService {
  constructor(
    private readonly bookingNotificationFactory: BookingNotificationFactoryService,
    private readonly authNotificationFactory: AuthNotificationFactoryService,
  ) {}

  createBookingLegStartReminders(data: BookingLegReminderData): Notification[] {
    return this.bookingNotificationFactory.createBookingLegStartReminders(data);
  }

  createBookingLegEndReminders(data: BookingLegReminderData): Notification[] {
    return this.bookingNotificationFactory.createBookingLegEndReminders(data);
  }

  createBookingStatusUpdateNotification(data: BookingStatusUpdateData): Notification | null {
    return this.bookingNotificationFactory.createBookingStatusUpdateNotification(data);
  }

  createFleetOwnerBookingAlert(data: FleetOwnerBookingAlertData): Notification | null {
    return this.bookingNotificationFactory.createFleetOwnerBookingAlert(data);
  }

  // Authentication-related notifications - delegate to AuthNotificationFactoryService
  createOtpNotification(data: OtpNotificationData): Notification {
    return this.authNotificationFactory.createOtpNotification(data);
  }

  createWelcomeNotification(data: WelcomeNotificationData): Notification {
    return this.authNotificationFactory.createWelcomeNotification(data);
  }

  createLoginConfirmationNotification(data: LoginConfirmationData): Notification {
    return this.authNotificationFactory.createLoginConfirmationNotification(data);
  }
}
