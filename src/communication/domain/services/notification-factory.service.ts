import { Injectable } from "@nestjs/common";
import { Notification } from "../entities/notification.entity";
import {
  AuthNotificationFactoryService,
  OtpNotificationData,
  WelcomeNotificationData,
  LoginConfirmationData,
} from "./auth-notification-factory.service";
import {
  BookingNotificationFactoryService,
  BookingReminderData,
  BookingLegReminderData,
  BookingStatusUpdateData,
} from "./booking-notification-factory.service";

// Re-export interfaces for backward compatibility
export {
  BookingReminderData,
  BookingLegReminderData,
  BookingStatusUpdateData,
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

  // Booking-related notifications - delegate to BookingNotificationFactoryService
  createBookingStartReminders(data: BookingReminderData): Notification[] {
    return this.bookingNotificationFactory.createBookingStartReminders(data);
  }

  createBookingEndReminders(data: BookingReminderData): Notification[] {
    return this.bookingNotificationFactory.createBookingEndReminders(data);
  }

  createBookingLegStartReminders(data: BookingLegReminderData): Notification[] {
    return this.bookingNotificationFactory.createBookingLegStartReminders(data);
  }

  createBookingStatusUpdateNotification(data: BookingStatusUpdateData): Notification | null {
    return this.bookingNotificationFactory.createBookingStatusUpdateNotification(data);
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
