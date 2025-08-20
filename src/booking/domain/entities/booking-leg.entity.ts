import { Entity } from "../../../shared/domain/entity";
import { validateAmount } from "../../../shared/domain/value-objects/validation-utils";
import { generateSecureRandomId } from "../../../shared/utils/secure-random";

export interface BookingLegProps {
  id?: string; // Optional - DB will assign
  bookingId?: string; // Optional - will be set during persistence
  legDate: Date;
  legStartTime: Date;
  legEndTime: Date;
  totalDailyPrice: number;
  itemsNetValueForLeg: number;
  fleetOwnerEarningForLeg: number;
  notes?: string;
}

export interface CreateBookingLegParams {
  legDate: Date;
  legStartTime: Date;
  legEndTime: Date;
  totalDailyPrice: number;
  itemsNetValueForLeg: number;
  fleetOwnerEarningForLeg: number;
  notes?: string;
}

export class BookingLeg extends Entity<string> {
  private constructor(private readonly props: BookingLegProps) {
    // Use temporary ID for Entity base class, will be replaced by DB
    super(props.id || generateSecureRandomId());
  }

  public static create(params: CreateBookingLegParams): BookingLeg {
    if (params.legStartTime >= params.legEndTime) {
      throw new Error("Leg start time must be before end time");
    }

    // Validate amounts
    validateAmount(params.totalDailyPrice);
    validateAmount(params.itemsNetValueForLeg);
    validateAmount(params.fleetOwnerEarningForLeg);

    return new BookingLeg({ ...params });
  }

  public static reconstitute(props: BookingLegProps): BookingLeg {
    // For reconstitution, both id and bookingId must be present
    if (!props.id || !props.bookingId) {
      throw new Error("ID and bookingId are required for reconstitution");
    }
    return new BookingLeg(props);
  }

  public getDurationInHours(): number {
    const timeDiff = this.props.legEndTime.getTime() - this.props.legStartTime.getTime();
    return timeDiff / (1000 * 3600);
  }

  public isUpcoming(): boolean {
    return this.props.legStartTime > new Date();
  }

  public isActive(): boolean {
    const now = new Date();
    return now >= this.props.legStartTime && now <= this.props.legEndTime;
  }

  public isCompleted(): boolean {
    return this.props.legEndTime < new Date();
  }

  public isEligibleForStartReminder(): boolean {
    const now = new Date();
    const oneHourBefore = new Date(this.props.legStartTime.getTime() - 60 * 60 * 1000);
    return now >= oneHourBefore && now < this.props.legStartTime;
  }

  public isEligibleForEndReminder(): boolean {
    const now = new Date();
    const oneHourBefore = new Date(this.props.legEndTime.getTime() - 60 * 60 * 1000);
    return now >= oneHourBefore && now < this.props.legEndTime;
  }

  // Getters
  public getBookingId(): string | undefined {
    return this.props.bookingId;
  }

  public getLegDate(): Date {
    return this.props.legDate;
  }

  public getLegStartTime(): Date {
    return this.props.legStartTime;
  }

  public getLegEndTime(): Date {
    return this.props.legEndTime;
  }

  public getTotalDailyPrice(): number {
    return this.props.totalDailyPrice;
  }

  public getItemsNetValueForLeg(): number {
    return this.props.itemsNetValueForLeg;
  }

  public getFleetOwnerEarningForLeg(): number {
    return this.props.fleetOwnerEarningForLeg;
  }

  public getNotes(): string | undefined {
    return this.props.notes;
  }
}
