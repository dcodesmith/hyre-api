import { ValueObject } from "../../../shared/domain/value-object";

export enum JobTypeEnum {
  BOOKING_START_REMINDER = "BOOKING_START_REMINDER",
  BOOKING_END_REMINDER = "BOOKING_END_REMINDER",
  BOOKING_LEG_START_REMINDER = "BOOKING_LEG_START_REMINDER",
  BOOKING_LEG_END_REMINDER = "BOOKING_LEG_END_REMINDER",
  STATUS_UPDATE_CONFIRMED_TO_ACTIVE = "STATUS_UPDATE_CONFIRMED_TO_ACTIVE",
  STATUS_UPDATE_ACTIVE_TO_COMPLETED = "STATUS_UPDATE_ACTIVE_TO_COMPLETED",
  PROCESS_PENDING_PAYOUTS = "PROCESS_PENDING_PAYOUTS",
  PROCESS_PENDING_NOTIFICATIONS = "PROCESS_PENDING_NOTIFICATIONS",
}

interface JobTypeProps {
  value: JobTypeEnum;
}

export class JobType extends ValueObject<JobTypeProps> {
  get value(): JobTypeEnum {
    return this.props.value;
  }

  private constructor(props: JobTypeProps) {
    super(props);
  }

  public static create(value: JobTypeEnum): JobType {
    return new JobType({ value });
  }

  public static bookingStartReminder(): JobType {
    return new JobType({ value: JobTypeEnum.BOOKING_START_REMINDER });
  }

  public static bookingEndReminder(): JobType {
    return new JobType({ value: JobTypeEnum.BOOKING_END_REMINDER });
  }

  public static bookingLegStartReminder(): JobType {
    return new JobType({ value: JobTypeEnum.BOOKING_LEG_START_REMINDER });
  }

  public static bookingLegEndReminder(): JobType {
    return new JobType({ value: JobTypeEnum.BOOKING_LEG_END_REMINDER });
  }

  public static statusUpdateConfirmedToActive(): JobType {
    return new JobType({ value: JobTypeEnum.STATUS_UPDATE_CONFIRMED_TO_ACTIVE });
  }

  public static statusUpdateActiveToCompleted(): JobType {
    return new JobType({ value: JobTypeEnum.STATUS_UPDATE_ACTIVE_TO_COMPLETED });
  }

  public static processPendingPayouts(): JobType {
    return new JobType({ value: JobTypeEnum.PROCESS_PENDING_PAYOUTS });
  }

  public static processPendingNotifications(): JobType {
    return new JobType({ value: JobTypeEnum.PROCESS_PENDING_NOTIFICATIONS });
  }

  public isReminderType(): boolean {
    return [
      JobTypeEnum.BOOKING_START_REMINDER,
      JobTypeEnum.BOOKING_END_REMINDER,
      JobTypeEnum.BOOKING_LEG_START_REMINDER,
      JobTypeEnum.BOOKING_LEG_END_REMINDER,
    ].includes(this.props.value);
  }

  public isStatusUpdateType(): boolean {
    return [
      JobTypeEnum.STATUS_UPDATE_CONFIRMED_TO_ACTIVE,
      JobTypeEnum.STATUS_UPDATE_ACTIVE_TO_COMPLETED,
    ].includes(this.props.value);
  }

  public isProcessingType(): boolean {
    return [
      JobTypeEnum.PROCESS_PENDING_PAYOUTS,
      JobTypeEnum.PROCESS_PENDING_NOTIFICATIONS,
    ].includes(this.props.value);
  }

  toString(): string {
    return this.props.value;
  }
}
