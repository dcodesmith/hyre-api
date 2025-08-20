import { Entity } from "../../../shared/domain/entity";
import { generateSecureRandomId } from "../../../shared/utils/secure-random";
import { NotificationContent } from "../value-objects/notification-content.vo";
import { NotificationType } from "../value-objects/notification-type.vo";
import { Recipient } from "../value-objects/recipient.vo";

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  DELIVERED = "DELIVERED",
}

export enum DeliveryChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  BOTH = "BOTH",
}

export interface NotificationProps {
  id: string;
  type: NotificationType;
  recipient: Recipient;
  content: NotificationContent;
  channel: DeliveryChannel;
  status: NotificationStatus;
  bookingId?: string;
  bookingLegId?: string;
  attemptCount: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Notification extends Entity<string> {
  private constructor(private readonly props: NotificationProps) {
    super(props.id);
  }

  public static create(
    type: NotificationType,
    recipient: Recipient,
    content: NotificationContent,
    channel: DeliveryChannel,
    bookingId?: string,
    bookingLegId?: string,
  ): Notification {
    // Validate that recipient supports the requested channel
    if (channel === DeliveryChannel.EMAIL && !recipient.hasEmail()) {
      throw new Error("Recipient does not have email for email notification");
    }

    if (channel === DeliveryChannel.SMS && !recipient.hasPhoneNumber()) {
      throw new Error("Recipient does not have phone number for SMS notification");
    }

    if (
      channel === DeliveryChannel.BOTH &&
      (!recipient.hasEmail() || !recipient.hasPhoneNumber())
    ) {
      throw new Error(
        "Recipient must have both email and phone number for multi-channel notification",
      );
    }

    const id = generateSecureRandomId();
    const now = new Date();

    return new Notification({
      id,
      type,
      recipient,
      content,
      channel,
      status: NotificationStatus.PENDING,
      bookingId,
      bookingLegId,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: NotificationProps): Notification {
    return new Notification(props);
  }

  public markAsSent(): void {
    if (this.props.status !== NotificationStatus.PENDING) {
      throw new Error(`Cannot mark notification as sent from ${this.props.status} status`);
    }

    this.props.status = NotificationStatus.SENT;
    this.props.sentAt = new Date();
    this.props.updatedAt = new Date();
  }

  public markAsDelivered(): void {
    if (this.props.status !== NotificationStatus.SENT) {
      throw new Error(`Cannot mark notification as delivered from ${this.props.status} status`);
    }

    this.props.status = NotificationStatus.DELIVERED;
    this.props.deliveredAt = new Date();
    this.props.updatedAt = new Date();
  }

  public markAsFailed(reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Failure reason cannot be empty");
    }

    this.props.status = NotificationStatus.FAILED;
    this.props.failureReason = reason.trim();
    this.props.lastAttemptAt = new Date();
    this.props.updatedAt = new Date();
  }

  public recordAttempt(): void {
    this.props.attemptCount++;
    this.props.lastAttemptAt = new Date();
    this.props.updatedAt = new Date();
  }

  public canRetry(): boolean {
    return this.props.status === NotificationStatus.FAILED && this.props.attemptCount < 3;
  }

  public retry(): void {
    if (!this.canRetry()) {
      throw new Error("Notification cannot be retried");
    }

    this.props.status = NotificationStatus.PENDING;
    this.props.failureReason = undefined;
    this.props.updatedAt = new Date();
  }

  public needsEmailDelivery(): boolean {
    return (
      this.props.channel === DeliveryChannel.EMAIL || this.props.channel === DeliveryChannel.BOTH
    );
  }

  public needsSmsDelivery(): boolean {
    return (
      this.props.channel === DeliveryChannel.SMS || this.props.channel === DeliveryChannel.BOTH
    );
  }

  public isPending(): boolean {
    return this.props.status === NotificationStatus.PENDING;
  }

  public isSent(): boolean {
    return this.props.status === NotificationStatus.SENT;
  }

  public isDelivered(): boolean {
    return this.props.status === NotificationStatus.DELIVERED;
  }

  public isFailed(): boolean {
    return this.props.status === NotificationStatus.FAILED;
  }

  // Getters
  public getType(): NotificationType {
    return this.props.type;
  }

  public getRecipient(): Recipient {
    return this.props.recipient;
  }

  public getContent(): NotificationContent {
    return this.props.content;
  }

  public getChannel(): DeliveryChannel {
    return this.props.channel;
  }

  public getStatus(): NotificationStatus {
    return this.props.status;
  }

  public getBookingId(): string | undefined {
    return this.props.bookingId;
  }

  public getBookingLegId(): string | undefined {
    return this.props.bookingLegId;
  }

  public getAttemptCount(): number {
    return this.props.attemptCount;
  }

  public getLastAttemptAt(): Date | undefined {
    return this.props.lastAttemptAt;
  }

  public getSentAt(): Date | undefined {
    return this.props.sentAt;
  }

  public getDeliveredAt(): Date | undefined {
    return this.props.deliveredAt;
  }

  public getFailureReason(): string | undefined {
    return this.props.failureReason;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.props.updatedAt;
  }
}
