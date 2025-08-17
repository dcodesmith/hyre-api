import { Injectable } from "@nestjs/common";
import { Notification, NotificationStatus } from "../../domain/entities/notification.entity";
import { NotificationRepository } from "../../domain/repositories/notification.repository";
import { NotificationType } from "../../domain/value-objects/notification-type.vo";

// Since we don't have a notifications table in Prisma schema,
// we'll create a simplified implementation that could store in a separate table
// or use existing tables. For now, we'll use in-memory storage as an example.

@Injectable()
export class PrismaNotificationRepository extends NotificationRepository {
  private notifications: Map<string, Notification> = new Map();

  async save(notification: Notification): Promise<void> {
    // In a real implementation, you would save to a notifications table
    // For now, we'll store in memory
    this.notifications.set(notification.id, notification);

    // You could also create a notifications table in Prisma schema and use:
    // await this.prisma.notification.upsert({
    //   where: { id: notification.id },
    //   create: { ... },
    //   update: { ... },
    // });
  }

  async findById(id: string): Promise<Notification | null> {
    return this.notifications.get(id) || null;
  }

  async findByBookingId(bookingId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.getBookingId() === bookingId,
    );
  }

  async findByBookingLegId(bookingLegId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.getBookingLegId() === bookingLegId,
    );
  }

  async findByStatus(status: NotificationStatus): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.getStatus() === status,
    );
  }

  async findByType(type: NotificationType): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter((notification) =>
      notification.getType().equals(type),
    );
  }

  async findPendingNotifications(): Promise<Notification[]> {
    return this.findByStatus(NotificationStatus.PENDING);
  }

  async findFailedNotifications(): Promise<Notification[]> {
    return this.findByStatus(NotificationStatus.FAILED);
  }

  async findNotificationsToRetry(): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter((notification) =>
      notification.canRetry(),
    );
  }
}
