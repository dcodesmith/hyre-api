import { Notification, NotificationStatus } from "../entities/notification.entity";
import { NotificationType } from "../value-objects/notification-type.vo";

export abstract class NotificationRepository {
  abstract save(notification: Notification): Promise<void>;
  abstract findById(id: string): Promise<Notification | null>;
  abstract findByBookingId(bookingId: string): Promise<Notification[]>;
  abstract findByBookingLegId(bookingLegId: string): Promise<Notification[]>;
  abstract findByStatus(status: NotificationStatus): Promise<Notification[]>;
  abstract findByType(type: NotificationType): Promise<Notification[]>;
  abstract findPendingNotifications(): Promise<Notification[]>;
  abstract findFailedNotifications(): Promise<Notification[]>;
  abstract findNotificationsToRetry(): Promise<Notification[]>;
}
