import { Injectable } from "@nestjs/common";
import { DeliveryChannel, Notification } from "../entities/notification.entity";
import { NotificationContent } from "../value-objects/notification-content.vo";
import { NotificationType } from "../value-objects/notification-type.vo";
import { Recipient, RecipientRole } from "../value-objects/recipient.vo";
import { NotificationTemplateService } from "./notification-template.service";

export interface BookingLegReminderData {
  bookingId: string;
  bookingLegId: string;
  customerName: string;
  chauffeurName: string;
  carName: string;
  legStartTime: string;
  legEndTime: string;
  pickupLocation: string;
  returnLocation: string;
  customerId: string;
  customerEmail?: string;
  customerPhone?: string;
  chauffeurId: string;
  chauffeurEmail?: string;
  chauffeurPhone?: string;
  bookingReference: string;
}

export interface BookingStatusUpdateData {
  bookingId: string;
  bookingReference: string;
  customerName: string;
  carName: string;
  status: string;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  returnLocation: string;
  customerId: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface FleetOwnerBookingAlertData {
  bookingId: string;
  bookingReference: string;
  customerName: string;
  carName: string;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  returnLocation: string;
  fleetOwnerId: string;
  fleetOwnerName: string;
  fleetOwnerEmail?: string;
  fleetOwnerPhone?: string;
}

@Injectable()
export class BookingNotificationFactoryService {
  constructor(private readonly templateService: NotificationTemplateService) {}

  createBookingLegEndReminders(data: BookingLegReminderData): Notification[] {
    const notifications: Notification[] = [];

    if (data.customerEmail || data.customerPhone) {
      const customerNotification = this.createCustomerBookingLegEndReminder(data);
      notifications.push(customerNotification);
    }

    if (data.chauffeurEmail || data.chauffeurPhone) {
      const chauffeurNotification = this.createChauffeurBookingLegEndReminder(data);
      notifications.push(chauffeurNotification);
    }

    return notifications;
  }

  createBookingLegStartReminders(data: BookingLegReminderData): Notification[] {
    const notifications: Notification[] = [];

    // Create customer notification
    if (data.customerEmail || data.customerPhone) {
      const customerNotification = this.createCustomerBookingLegStartReminder(data);
      notifications.push(customerNotification);
    }

    // Create chauffeur notification
    if (data.chauffeurEmail || data.chauffeurPhone) {
      const chauffeurNotification = this.createChauffeurBookingLegStartReminder(data);
      notifications.push(chauffeurNotification);
    }

    return notifications;
  }

  createBookingStatusUpdateNotification(data: BookingStatusUpdateData): Notification | null {
    if (!data.customerEmail && !data.customerPhone) {
      return null;
    }

    const customerRecipient = Recipient.create(
      data.customerId,
      data.customerName,
      RecipientRole.CUSTOMER,
      data.customerEmail,
      data.customerPhone,
    );

    const customerContent = NotificationContent.create(
      `Your booking has been ${data.status.toLowerCase()}`,
      this.templateService.getBookingStatusUpdateTemplate(),
      {
        customerName: data.customerName,
        carName: data.carName,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        pickupLocation: data.pickupLocation,
        returnLocation: data.returnLocation,
        bookingReference: data.bookingReference,
      },
    );

    return Notification.create(
      NotificationType.bookingStatusUpdate(),
      customerRecipient,
      customerContent,
      this.determineChannel(data.customerEmail, data.customerPhone),
      data.bookingId,
    );
  }

  createFleetOwnerBookingAlert(data: FleetOwnerBookingAlertData): Notification | null {
    if (!data.fleetOwnerEmail && !data.fleetOwnerPhone) {
      return null;
    }

    const fleetOwnerRecipient = Recipient.create(
      data.fleetOwnerId,
      data.fleetOwnerName,
      RecipientRole.FLEET_OWNER,
      data.fleetOwnerEmail,
      data.fleetOwnerPhone,
    );

    const fleetOwnerContent = NotificationContent.create(
      "New Booking Alert",
      this.templateService.getFleetOwnerBookingAlertTemplate(),
      {
        fleetOwnerName: data.fleetOwnerName,
        customerName: data.customerName,
        carName: data.carName,
        startDate: data.startDate,
        endDate: data.endDate,
        pickupLocation: data.pickupLocation,
        returnLocation: data.returnLocation,
        bookingReference: data.bookingReference,
      },
    );

    return Notification.create(
      NotificationType.fleetOwnerBookingAlert(),
      fleetOwnerRecipient,
      fleetOwnerContent,
      this.determineChannel(data.fleetOwnerEmail, data.fleetOwnerPhone),
      data.bookingId,
    );
  }

  private createCustomerBookingLegEndReminder(data: BookingLegReminderData): Notification {
    const customerRecipient = Recipient.create(
      data.customerId,
      data.customerName,
      RecipientRole.CUSTOMER,
      data.customerEmail,
      data.customerPhone,
    );

    const customerContent = NotificationContent.create(
      "Booking Reminder - Your service ends in approximately 1 hour",
      this.templateService.getBookingEndReminderTemplate("customer"),
      {
        customerName: data.customerName,
        carName: data.carName,
        legStartTime: data.legStartTime,
        legEndTime: data.legEndTime,
        pickupLocation: data.pickupLocation,
        returnLocation: data.returnLocation,
        chauffeurName: data.chauffeurName,
        bookingReference: data.bookingReference,
      },
    );

    return Notification.create(
      NotificationType.bookingEndReminder(),
      customerRecipient,
      customerContent,
      this.determineChannel(data.customerEmail, data.customerPhone),
      data.bookingId,
    );
  }

  private createChauffeurBookingLegEndReminder(data: BookingLegReminderData): Notification {
    const chauffeurRecipient = Recipient.create(
      data.chauffeurId,
      data.chauffeurName,
      RecipientRole.CHAUFFEUR,
      data.chauffeurEmail,
      data.chauffeurPhone,
    );

    const chauffeurContent = NotificationContent.create(
      "Booking Reminder - Your service ends in approximately 1 hour",
      this.templateService.getBookingEndReminderTemplate("chauffeur"),
      {
        chauffeurName: data.chauffeurName,
        carName: data.carName,
        legStartTime: data.legStartTime,
        legEndTime: data.legEndTime,
        pickupLocation: data.pickupLocation,
        returnLocation: data.returnLocation,
        customerName: data.customerName,
        bookingReference: data.bookingReference,
      },
    );

    return Notification.create(
      NotificationType.bookingEndReminder(),
      chauffeurRecipient,
      chauffeurContent,
      this.determineChannel(data.chauffeurEmail, data.chauffeurPhone),
      data.bookingId,
    );
  }

  private createCustomerBookingLegStartReminder(data: BookingLegReminderData): Notification {
    const customerRecipient = Recipient.create(
      data.customerId,
      data.customerName,
      RecipientRole.CUSTOMER,
      data.customerEmail,
      data.customerPhone,
    );

    const customerContent = NotificationContent.create(
      "Booking Leg Reminder - Your service leg starts in approximately 1 hour",
      this.templateService.getBookingLegStartReminderTemplate("customer"),
      {
        customerName: data.customerName,
        carName: data.carName,
        legStartTime: data.legStartTime,
        legEndTime: data.legEndTime,
        pickupLocation: data.pickupLocation,
        returnLocation: data.returnLocation,
        chauffeurName: data.chauffeurName,
      },
    );

    return Notification.create(
      NotificationType.bookingLegStartReminder(),
      customerRecipient,
      customerContent,
      this.determineChannel(data.customerEmail, data.customerPhone),
      data.bookingId,
      data.bookingLegId,
    );
  }

  private createChauffeurBookingLegStartReminder(data: BookingLegReminderData): Notification {
    const chauffeurRecipient = Recipient.create(
      data.chauffeurId,
      data.chauffeurName,
      RecipientRole.CHAUFFEUR,
      data.chauffeurEmail,
      data.chauffeurPhone,
    );

    const chauffeurContent = NotificationContent.create(
      "Booking Leg Reminder - You have a service leg starting in approximately 1 hour",
      this.templateService.getBookingLegStartReminderTemplate("chauffeur"),
      {
        chauffeurName: data.chauffeurName,
        carName: data.carName,
        legStartTime: data.legStartTime,
        legEndTime: data.legEndTime,
        pickupLocation: data.pickupLocation,
        returnLocation: data.returnLocation,
        customerName: data.customerName,
      },
    );

    return Notification.create(
      NotificationType.bookingLegStartReminder(),
      chauffeurRecipient,
      chauffeurContent,
      this.determineChannel(data.chauffeurEmail, data.chauffeurPhone),
      data.bookingId,
      data.bookingLegId,
    );
  }

  private determineChannel(email?: string, phoneNumber?: string): DeliveryChannel {
    if (email && phoneNumber) {
      return DeliveryChannel.BOTH;
    } else if (email) {
      return DeliveryChannel.EMAIL;
    } else if (phoneNumber) {
      return DeliveryChannel.SMS;
    } else {
      throw new Error("No delivery channel available");
    }
  }
}
