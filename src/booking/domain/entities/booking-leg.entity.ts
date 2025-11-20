import { Entity } from "../../../shared/domain/entity";
import { validateAmount } from "../../../shared/domain/value-objects/validation-utils";
import { generateSecureRandomId } from "../../../shared/utils/secure-random";
import { BookingLegStatus } from "../value-objects/booking-leg-status.vo";

export interface BookingLegProps {
  id?: string; // Optional - DB will assign
  bookingId?: string; // Optional - will be set during persistence
  legDate: Date;
  legStartTime: Date;
  legEndTime: Date;
  totalDailyPrice: number;
  itemsNetValueForLeg: number;
  fleetOwnerEarningForLeg: number;
  status: BookingLegStatus;
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
  private constructor(private props: BookingLegProps) {
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

    // All new legs start as PENDING
    return new BookingLeg({ ...params, status: BookingLegStatus.pending() });
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

  public confirm(): void {
    if (!this.props.status.canTransitionTo(BookingLegStatus.confirmed())) {
      throw new Error(`Cannot confirm leg in ${this.props.status.value} status`);
    }

    this.props.status = BookingLegStatus.confirmed();
  }

  public activate(): void {
    if (!this.props.status.canTransitionTo(BookingLegStatus.active())) {
      throw new Error(`Cannot activate leg in ${this.props.status.value} status`);
    }

    this.props.status = BookingLegStatus.active();
  }

  public complete(): void {
    if (!this.props.status.canTransitionTo(BookingLegStatus.completed())) {
      throw new Error(`Cannot complete leg in ${this.props.status.value} status`);
    }

    this.props.status = BookingLegStatus.completed();
  }

  public isActive(): boolean {
    return this.props.status.isActive();
  }

  public isCompleted(): boolean {
    return this.props.status.isCompleted();
  }

  public isPending(): boolean {
    return this.props.status.isPending();
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
  public getId(): string {
    return this.id;
  }

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

  public getStatus(): BookingLegStatus {
    return this.props.status;
  }
}
