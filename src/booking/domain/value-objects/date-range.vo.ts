import { ValueObject } from "../../../shared/domain/value-object";

interface DateRangeProps {
  startDate: Date;
  endDate: Date;
}

export class DateRange extends ValueObject<DateRangeProps> {
  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date {
    return this.props.endDate;
  }

  private constructor(props: DateRangeProps) {
    super(props);
  }

  public static create(startDate: Date, endDate: Date): DateRange {
    if (startDate >= endDate) {
      throw new Error("Start date must be before end date");
    }

    if (startDate < new Date()) {
      throw new Error("Start date cannot be in the past");
    }

    return new DateRange({ startDate, endDate });
  }

  public getDurationInDays(): number {
    const timeDiff = this.props.endDate.getTime() - this.props.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  public getDurationInHours(): number {
    const timeDiff = this.props.endDate.getTime() - this.props.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600));
  }

  public contains(date: Date): boolean {
    return date >= this.props.startDate && date <= this.props.endDate;
  }

  public overlaps(other: DateRange): boolean {
    return this.props.startDate < other.endDate && this.props.endDate > other.startDate;
  }

  public isUpcoming(): boolean {
    return this.props.startDate > new Date();
  }

  public isActive(): boolean {
    const now = new Date();
    return now >= this.props.startDate && now <= this.props.endDate;
  }

  public isCompleted(): boolean {
    return this.props.endDate < new Date();
  }
}
