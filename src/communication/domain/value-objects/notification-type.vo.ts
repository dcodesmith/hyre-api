import { ValueObject } from "../../../shared/domain/value-object";

export enum NotificationTypeEnum {
  BOOKING_START_REMINDER = "BOOKING_START_REMINDER",
  BOOKING_END_REMINDER = "BOOKING_END_REMINDER",
  BOOKING_STATUS_UPDATE = "BOOKING_STATUS_UPDATE",
  BOOKING_LEG_START_REMINDER = "BOOKING_LEG_START_REMINDER",
  BOOKING_LEG_END_REMINDER = "BOOKING_LEG_END_REMINDER",
  FLEET_OWNER_BOOKING_ALERT = "FLEET_OWNER_BOOKING_ALERT",
  PAYOUT_COMPLETED = "PAYOUT_COMPLETED",
  PAYOUT_FAILED = "PAYOUT_FAILED",
  USER_REGISTERED = "USER_REGISTERED",
  OTP_LOGIN = "OTP_LOGIN",
}

interface NotificationTypeProps {
  value: NotificationTypeEnum;
}

export class NotificationType extends ValueObject<NotificationTypeProps> {
  get value(): NotificationTypeEnum {
    return this.props.value;
  }

  private constructor(props: NotificationTypeProps) {
    super(props);
  }

  public static create(value: NotificationTypeEnum): NotificationType {
    return new NotificationType({ value });
  }

  public static bookingStartReminder(): NotificationType {
    return new NotificationType({ value: NotificationTypeEnum.BOOKING_START_REMINDER });
  }

  public static bookingEndReminder(): NotificationType {
    return new NotificationType({ value: NotificationTypeEnum.BOOKING_END_REMINDER });
  }

  public static bookingStatusUpdate(): NotificationType {
    return new NotificationType({ value: NotificationTypeEnum.BOOKING_STATUS_UPDATE });
  }

  public static bookingLegStartReminder(): NotificationType {
    return new NotificationType({ value: NotificationTypeEnum.BOOKING_LEG_START_REMINDER });
  }

  public static bookingLegEndReminder(): NotificationType {
    return new NotificationType({ value: NotificationTypeEnum.BOOKING_LEG_END_REMINDER });
  }

  public static userRegistered(): NotificationType {
    return new NotificationType({ value: NotificationTypeEnum.USER_REGISTERED });
  }

  public static otpLogin(): NotificationType {
    return new NotificationType({ value: NotificationTypeEnum.OTP_LOGIN });
  }

  public static fleetOwnerBookingAlert(): NotificationType {
    return new NotificationType({ value: NotificationTypeEnum.FLEET_OWNER_BOOKING_ALERT });
  }

  public isReminder(): boolean {
    return [
      NotificationTypeEnum.BOOKING_START_REMINDER,
      NotificationTypeEnum.BOOKING_END_REMINDER,
      NotificationTypeEnum.BOOKING_LEG_START_REMINDER,
      NotificationTypeEnum.BOOKING_LEG_END_REMINDER,
    ].includes(this.props.value);
  }

  public isStatusUpdate(): boolean {
    return this.props.value === NotificationTypeEnum.BOOKING_STATUS_UPDATE;
  }

  public isPaymentRelated(): boolean {
    return [NotificationTypeEnum.PAYOUT_COMPLETED, NotificationTypeEnum.PAYOUT_FAILED].includes(
      this.props.value,
    );
  }

  public isAuthenticationRelated(): boolean {
    return [NotificationTypeEnum.USER_REGISTERED, NotificationTypeEnum.OTP_LOGIN].includes(
      this.props.value,
    );
  }

  toString(): string {
    return this.props.value;
  }
}
