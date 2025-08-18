import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import {
  isZeroAmount,
  validateAmount,
} from "../../../shared/domain/value-objects/validation-utils";
import { generateSecureRandomId } from "../../../shared/utils/secure-random";
import { BookingActivatedEvent } from "../events/booking-activated.event";
import { BookingCancelledEvent } from "../events/booking-cancelled.event";
import { BookingChauffeurAssignedEvent } from "../events/booking-chauffeur-assigned.event";
import { BookingChauffeurUnassignedEvent } from "../events/booking-chauffeur-unassigned.event";
import { BookingCompletedEvent } from "../events/booking-completed.event";
import { BookingConfirmedEvent } from "../events/booking-confirmed.event";
import { BookingCreatedEvent } from "../events/booking-created.event";
import { BookingFinancials } from "../value-objects/booking-financials.vo";
import { BookingStatus } from "../value-objects/booking-status.vo";
import { BookingType } from "../value-objects/booking-type.vo";
import { DateRange } from "../value-objects/date-range.vo";
import { PaymentStatus } from "../value-objects/payment-status.vo";
import { BookingLeg } from "./booking-leg.entity";

export interface BookingCreateParams {
  customerId: string;
  carId: string;
  dateRange: DateRange;
  pickupAddress: string;
  dropOffAddress: string;
  bookingType: BookingType;
  financials: BookingFinancials;
  includeSecurityDetail?: boolean;
  specialRequests?: string;
  paymentIntent?: string;
}

export interface BookingProps {
  id?: string;
  bookingReference: string;
  status: BookingStatus;
  dateRange: DateRange;
  pickupAddress: string;
  dropOffAddress: string;
  customerId: string;
  carId: string;
  chauffeurId?: string;
  specialRequests?: string;
  legs: BookingLeg[];
  bookingType: BookingType;
  paymentStatus: PaymentStatus;
  paymentIntent?: string;
  paymentId?: string;
  financials: BookingFinancials;
  includeSecurityDetail: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Booking extends AggregateRoot {
  private constructor(private readonly props: BookingProps) {
    super();
  }

  public static create(params: BookingCreateParams): Booking {
    const bookingReference = Booking.generateBookingReference();

    const booking = new Booking({
      bookingReference,
      status: BookingStatus.pending(),
      dateRange: params.dateRange,
      pickupAddress: params.pickupAddress,
      dropOffAddress: params.dropOffAddress,
      customerId: params.customerId,
      carId: params.carId,
      specialRequests: params.specialRequests,
      legs: [],
      bookingType: params.bookingType,
      paymentStatus: PaymentStatus.UNPAID,
      paymentIntent: params.paymentIntent,
      financials: params.financials,
      includeSecurityDetail: params.includeSecurityDetail ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return booking;
  }

  public static reconstitute(props: BookingProps): Booking {
    return new Booking(props);
  }

  /**
   * Adds the booking created domain event after the booking has been persisted and has an ID
   * This should be called after the booking is saved to the database
   */
  public markAsCreated(): void {
    if (!this.props.id) {
      throw new Error(
        "Cannot mark booking as created without an ID. Ensure booking is saved first.",
      );
    }

    this.addDomainEvent(
      new BookingCreatedEvent(this.props.id, this.props.bookingReference, this.props.customerId),
    );
  }

  private static generateBookingReference(): string {
    // Generate a unique booking reference
    const timestamp = Date.now().toString(36);
    const random = generateSecureRandomId();
    return `BK-${timestamp}-${random}`.toUpperCase();
  }

  public confirm(): void {
    if (!this.props.status.canTransitionTo(BookingStatus.confirmed())) {
      throw new Error(`Cannot confirm booking in ${this.props.status.value} status`);
    }

    this.props.status = BookingStatus.confirmed();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new BookingConfirmedEvent(
        this.getId(),
        this.props.bookingReference,
        this.props.customerId,
        this.props.chauffeurId,
      ),
    );
  }

  public confirmWithPayment(paymentId: string): void {
    if (!this.props.status.canTransitionTo(BookingStatus.confirmed())) {
      throw new Error(`Cannot confirm booking in ${this.props.status.value} status`);
    }

    this.props.status = BookingStatus.confirmed();
    this.props.paymentId = paymentId;
    this.props.paymentStatus = PaymentStatus.PAID;
    this.props.updatedAt = new Date();

    // Note: BookingPaymentConfirmedEvent removed - PaymentConfirmedEvent handles notifications directly
  }

  public activate(): void {
    if (!this.props.status.canTransitionTo(BookingStatus.active())) {
      throw new Error(`Cannot activate booking in ${this.props.status.value} status`);
    }

    this.props.status = BookingStatus.active();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new BookingActivatedEvent(
        this.getId(),
        this.props.bookingReference,
        this.props.customerId,
        this.props.chauffeurId,
        this.getId(),
      ),
    );
  }

  public complete(): void {
    if (!this.props.status.canTransitionTo(BookingStatus.completed())) {
      throw new Error(`Cannot complete booking in ${this.props.status.value} status`);
    }

    this.props.status = BookingStatus.completed();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new BookingCompletedEvent(
        this.getId(),
        this.props.bookingReference,
        this.props.customerId,
        this.props.chauffeurId,
      ),
    );
  }

  public cancel(reason?: string): void {
    if (!this.props.status.canTransitionTo(BookingStatus.cancelled())) {
      throw new Error(`Cannot cancel booking in ${this.props.status.value} status`);
    }

    this.props.status = BookingStatus.cancelled();
    this.props.paymentStatus = PaymentStatus.REFUNDED;
    this.props.cancelledAt = new Date();
    this.props.cancellationReason = reason ?? "Booking cancelled by customer";
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new BookingCancelledEvent(
        this.getId(),
        this.props.bookingReference,
        this.props.customerId,
        reason,
      ),
    );
  }

  public assignChauffeur(chauffeurId: string, fleetOwnerId: string, assignedBy: string): void {
    if (this.props.status.isCompleted() || this.props.status.isCancelled()) {
      throw new Error("Cannot assign chauffeur to completed or cancelled booking");
    }

    if (this.props.chauffeurId === chauffeurId) {
      return; // Already assigned to this chauffeur
    }

    if (!chauffeurId || chauffeurId.trim().length === 0) {
      throw new Error("Chauffeur ID is required");
    }

    const previousChauffeurId = this.props.chauffeurId;
    this.props.chauffeurId = chauffeurId;
    this.props.updatedAt = new Date();

    // Emit assignment event
    this.addDomainEvent(
      new BookingChauffeurAssignedEvent(
        this.getId(),
        this.props.bookingReference,
        chauffeurId,
        fleetOwnerId,
        assignedBy,
        this.props.customerId,
      ),
    );

    // If there was a previous chauffeur, emit unassignment event
    if (previousChauffeurId) {
      this.addDomainEvent(
        new BookingChauffeurUnassignedEvent(
          this.getId(),
          this.props.bookingReference,
          previousChauffeurId,
          fleetOwnerId,
          assignedBy,
          "Reassigned to different chauffeur",
        ),
      );
    }
  }

  public unassignChauffeur(fleetOwnerId: string, unassignedBy: string, reason?: string): void {
    if (!this.props.chauffeurId) {
      throw new Error("No chauffeur assigned to this booking");
    }

    if (this.props.status.isCompleted()) {
      throw new Error("Cannot unassign chauffeur from completed booking");
    }

    if (this.props.status.isActive()) {
      throw new Error("Cannot unassign chauffeur from active booking");
    }

    const chauffeurId = this.props.chauffeurId;
    this.props.chauffeurId = undefined;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new BookingChauffeurUnassignedEvent(
        this.getId(),
        this.props.bookingReference,
        chauffeurId,
        fleetOwnerId,
        unassignedBy,
        reason || "Chauffeur unassigned",
      ),
    );
  }

  public hasChauffeurAssigned(): boolean {
    return !!this.props.chauffeurId;
  }

  public canAssignChauffeur(): boolean {
    return !this.props.status.isCompleted() && !this.props.status.isCancelled();
  }

  public addLeg(leg: BookingLeg): void {
    if (!this.props.dateRange.contains(leg.getLegDate())) {
      throw new Error("Booking leg date must be within booking date range");
    }

    this.props.legs.push(leg);
    this.props.updatedAt = new Date();
  }

  public setPaymentId(paymentId: string): void {
    this.props.paymentId = paymentId;
    this.props.paymentStatus = PaymentStatus.PAID;
    this.props.updatedAt = new Date();
  }

  public setPaymentIntent(paymentIntent: string): void {
    this.props.paymentIntent = paymentIntent;
    this.props.updatedAt = new Date();
  }

  public isEligibleForActivation(): boolean {
    const now = new Date();
    return (
      this.props.status.isConfirmed() &&
      this.props.dateRange.startDate <= now &&
      !!this.props.chauffeurId
    );
  }

  public isEligibleForCompletion(): boolean {
    const now = new Date();
    return this.props.status.isActive() && this.props.dateRange.endDate <= now;
  }

  public isEligibleForStartReminder(): boolean {
    const now = new Date();
    const oneHourBeforeStart = new Date(this.props.dateRange.startDate.getTime() - 60 * 60 * 1000);
    return (
      this.props.status.isConfirmed() &&
      now >= oneHourBeforeStart &&
      now < this.props.dateRange.startDate
    );
  }

  public isEligibleForEndReminder(): boolean {
    const now = new Date();
    const oneHourBeforeEnd = new Date(this.props.dateRange.endDate.getTime() - 60 * 60 * 1000);
    return (
      this.props.status.isActive() && now >= oneHourBeforeEnd && now < this.props.dateRange.endDate
    );
  }

  public isEligibleForCancellation(): boolean {
    // Only CONFIRMED bookings can be cancelled (payment made, service not started)
    if (!this.props.status.isConfirmed()) {
      return false;
    }

    // Must be at least 12 hours before booking start time
    const now = new Date();
    const bookingStartTime = this.props.dateRange.startDate;
    const twelveHoursInMs = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
    const cancellationDeadline = new Date(bookingStartTime.getTime() - twelveHoursInMs);

    // Can only cancel if current time is before the 12-hour deadline
    return now <= cancellationDeadline;
  }

  public isPending(): boolean {
    return this.props.status.isPending();
  }

  public isConfirmed(): boolean {
    return this.props.status.isConfirmed();
  }
  // Getters
  public getId(): string | undefined {
    return this.props.id;
  }

  public getBookingReference(): string {
    return this.props.bookingReference;
  }

  public getStatus(): BookingStatus {
    return this.props.status;
  }

  public getDateRange(): DateRange {
    return this.props.dateRange;
  }

  public getPickupAddress(): string {
    return this.props.pickupAddress;
  }

  public getDropOffAddress(): string {
    return this.props.dropOffAddress;
  }

  public getCustomerId(): string {
    return this.props.customerId;
  }

  public getCarId(): string {
    return this.props.carId;
  }

  public getChauffeurId(): string | undefined {
    return this.props.chauffeurId;
  }

  public getSpecialRequests(): string | undefined {
    return this.props.specialRequests;
  }

  public getLegs(): BookingLeg[] {
    return [...this.props.legs];
  }

  public getBookingType(): BookingType {
    return this.props.bookingType;
  }

  public getPaymentStatus(): PaymentStatus {
    return this.props.paymentStatus;
  }

  public getPaymentIntent(): string | undefined {
    return this.props.paymentIntent;
  }

  public getPaymentId(): string | undefined {
    return this.props.paymentId;
  }

  public getTotalAmount(): number {
    return this.props.financials.getTotalAmountAsNumber();
  }

  public getNetTotal(): number {
    return this.props.financials.getNetTotalAsNumber();
  }

  public getPlatformServiceFeeAmount(): number {
    return this.props.financials.getPlatformServiceFeeAmountAsNumber();
  }

  public getVatAmount(): number {
    return this.props.financials.getVatAmountAsNumber();
  }

  public getFleetOwnerPayoutAmountNet(): number {
    return this.props.financials.getFleetOwnerPayoutAmountNetAsNumber();
  }

  public getFinancials(): BookingFinancials {
    return this.props.financials;
  }

  public getIncludeSecurityDetail(): boolean {
    return this.props.includeSecurityDetail;
  }

  public getCancelledAt(): Date | undefined {
    return this.props.cancelledAt;
  }

  public getCancellationReason(): string | undefined {
    return this.props.cancellationReason;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Calculates the fleet owner payout amount net of platform commission
   * @param totalBookingAmount - The total amount paid by the customer
   * @param platformCommissionRate - Platform commission rate as percentage (e.g., 20 for 20%)
   * @returns The net amount to be paid to the fleet owner
   */
  public static calculateFleetOwnerPayoutAmountNet(
    totalBookingAmount: number,
    platformCommissionRate: number = 20, // Default 20% platform commission
  ): number {
    validateAmount(totalBookingAmount);

    if (platformCommissionRate < 0 || platformCommissionRate > 100) {
      throw new Error("Platform commission rate must be between 0 and 100");
    }

    if (isZeroAmount(totalBookingAmount)) {
      return 0;
    }

    const commissionAmount = (totalBookingAmount * platformCommissionRate) / 100;
    const payoutAmount = totalBookingAmount - commissionAmount;

    validateAmount(payoutAmount);
    return payoutAmount;
  }
}
