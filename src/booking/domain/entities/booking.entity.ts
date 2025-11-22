import { isToday } from "date-fns";
import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import {
  isZeroAmount,
  validateAmount,
} from "../../../shared/domain/value-objects/validation-utils";
import { generateSecureRandomId } from "../../../shared/utils/secure-random";
import { InvalidBookingStatusTransitionError } from "../errors/booking.errors";
import { BookingCancelledEvent } from "../events/booking-cancelled.event";
import { BookingChauffeurAssignedEvent } from "../events/booking-chauffeur-assigned.event";
import { BookingChauffeurUnassignedEvent } from "../events/booking-chauffeur-unassigned.event";
import { BookingConfirmedEvent } from "../events/booking-confirmed.event";
import { BookingCreatedEvent } from "../events/booking-created.event";
import { BookingType } from "../interfaces/booking.interface";
import { BookingFinancials } from "../value-objects/booking-financials.vo";
import type { BookingPeriod } from "../value-objects/booking-period.vo";
import { BookingStatus, BookingStatusEnum } from "../value-objects/booking-status.vo";
import { PaymentStatus } from "../value-objects/payment-status.vo";
import { BookingLeg } from "./booking-leg.entity";

export interface BookingCreateParams {
  customerId: string;
  carId: string;
  bookingPeriod: BookingPeriod;
  pickupAddress: string;
  dropOffAddress: string;
  financials: BookingFinancials;
  includeSecurityDetail?: boolean;
  specialRequests?: string;
  paymentIntent?: string;
}

export interface BookingProps {
  id?: string;
  bookingReference: string;
  status: BookingStatus;
  bookingPeriod: BookingPeriod;
  pickupAddress: string;
  dropOffAddress: string;
  customerId: string;
  carId: string;
  chauffeurId?: string;
  specialRequests?: string;
  legs: BookingLeg[];
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
      bookingPeriod: params.bookingPeriod,
      pickupAddress: params.pickupAddress,
      dropOffAddress: params.dropOffAddress,
      customerId: params.customerId,
      carId: params.carId,
      specialRequests: params.specialRequests,
      legs: [],
      paymentStatus: PaymentStatus.unpaid(),
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

  // Enforce presence of ID before emitting any domain event
  private requireId(): string {
    const id = this.props.id;
    if (!id) {
      throw new Error(
        "Aggregate ID is required for emitting domain events. Persist the Booking first.",
      );
    }
    return id;
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
      throw new InvalidBookingStatusTransitionError(
        this.props.id ?? "unknown",
        this.props.status.value,
        "CONFIRMED",
      );
    }

    this.props.status = BookingStatus.confirmed();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new BookingConfirmedEvent(
        this.requireId(),
        this.props.bookingReference,
        this.props.customerId,
        this.props.chauffeurId,
      ),
    );
  }

  public confirmWithPayment(paymentId: string): void {
    if (!this.props.status.canTransitionTo(BookingStatus.confirmed())) {
      throw new InvalidBookingStatusTransitionError(
        this.props.id ?? "unknown",
        this.props.status.value,
        "CONFIRMED",
      );
    }

    this.props.status = BookingStatus.confirmed();
    this.props.paymentId = paymentId;
    this.props.paymentStatus = PaymentStatus.paid();
    this.props.updatedAt = new Date();

    // Note: BookingPaymentConfirmedEvent removed - PaymentConfirmedEvent handles notifications directly
  }

  /**
   * Activate booking (CONFIRMED → ACTIVE)
   *
   * IMPORTANT: This method ONLY changes status - it does NOT publish events
   * - BookingLifecycleService is responsible for publishing BookingLegActivatedEvent
   * - Service has all the data needed for rich event (avoids N+1 queries)
   * - Idempotent: safe to call multiple times if already ACTIVE
   */
  public activate(): void {
    if (!this.props.status.canTransitionTo(BookingStatus.active())) {
      throw new InvalidBookingStatusTransitionError(
        this.props.id ?? "unknown",
        this.props.status.value,
        "ACTIVE",
      );
    }

    this.props.status = BookingStatus.active();
    this.props.updatedAt = new Date();

    // Event publishing moved to BookingLifecycleService for consistency with leg-based architecture
  }

  /**
   * Complete booking (ACTIVE → COMPLETED)
   *
   * IMPORTANT: This method ONLY changes status - it does NOT publish events
   * - BookingLifecycleService is responsible for publishing BookingLegCompletedEvent
   * - Service has all the data needed for rich event (avoids N+1 queries)
   * - Idempotent: safe to call multiple times if already COMPLETED
   */
  public complete(): void {
    if (!this.props.status.canTransitionTo(BookingStatus.completed())) {
      throw new InvalidBookingStatusTransitionError(
        this.props.id ?? "unknown",
        this.props.status.value,
        "COMPLETED",
      );
    }

    this.props.status = BookingStatus.completed();
    this.props.updatedAt = new Date();

    // Event publishing moved to BookingLifecycleService for consistency with leg-based architecture
  }

  public cancel(reason?: string): void {
    if (!this.props.status.canTransitionTo(BookingStatus.cancelled())) {
      throw new InvalidBookingStatusTransitionError(
        this.props.id ?? "unknown",
        this.props.status.value,
        "CANCELLED",
      );
    }

    this.props.status = BookingStatus.cancelled();
    this.props.paymentStatus = PaymentStatus.refunded();
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
    if (
      this.props.status.isCompleted() ||
      this.props.status.isCancelled() ||
      this.props.status.isPending()
    ) {
      throw new Error("Cannot assign chauffeur to completed, cancelled or pending booking");
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
    return this.props.status.isConfirmed();
  }

  public addLeg(leg: BookingLeg): void {
    const legDate = leg.getLegDate();
    const startDate = this.props.bookingPeriod.startDateTime;
    const endDate = this.props.bookingPeriod.endDateTime;

    // Normalize to date-only comparison (ignore time component)
    const legDateOnly = new Date(legDate.getFullYear(), legDate.getMonth(), legDate.getDate());
    const startDateOnly = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    if (legDateOnly < startDateOnly || legDateOnly > endDateOnly) {
      throw new Error(
        `Leg date ${legDate.toISOString()} is outside booking period ` +
          `(${startDate.toISOString()} to ${endDate.toISOString()})`,
      );
    }

    this.props.legs.push(leg);
    this.props.updatedAt = new Date();
  }

  /**
   * Activate a leg and potentially the booking itself.
   * Called when a leg's start time arrives.
   *
   * IMPORTANT: This method handles domain logic only - no events are published here.
   * The calling service (BookingLifecycleService) is responsible for publishing events
   * with all the notification data needed (avoids N+1 queries).
   *
   * @param legId - The ID of the leg to activate
   * @throws Error if leg is not found or cannot be activated
   */
  public activateLeg(legId: string): void {
    const leg = this.props.legs.find((l) => l.getId() === legId);
    if (!leg) {
      throw new Error(`Leg ${legId} not found in booking ${this.props.id}`);
    }

    // Domain validation - this throws if transition is invalid
    leg.activate();

    // Activate booking if it's confirmed and today is the booking start date
    if (this.props.status.isConfirmed() && isToday(this.props.bookingPeriod.startDateTime)) {
      this.activate();
    }

    this.props.updatedAt = new Date();
  }

  /**
   * Complete a leg and potentially the booking itself.
   * Called when a leg's end time arrives.
   *
   * IMPORTANT: This method handles domain logic only - no events are published here.
   * The calling service (BookingLifecycleService) is responsible for publishing events
   * with all the notification data needed (avoids N+1 queries).
   *
   * @param legId - The ID of the leg to complete
   * @throws Error if leg is not found or cannot be completed
   */
  public completeLeg(legId: string): void {
    const leg = this.props.legs.find((l) => l.getId() === legId);
    if (!leg) {
      throw new Error(`Leg ${legId} not found in booking ${this.props.id}`);
    }

    // Domain validation - this throws if transition is invalid
    leg.complete();

    // Complete booking if it's active and today is the booking end date
    if (this.props.status.isActive() && isToday(this.props.bookingPeriod.endDateTime)) {
      this.complete();
    }

    this.props.updatedAt = new Date();
  }

  /**
   * Confirm all legs when the booking is confirmed.
   * Called after payment is confirmed.
   */
  public confirmAllLegs(): void {
    for (const leg of this.props.legs) {
      if (leg.isPending()) {
        leg.confirm();
      }
    }
    this.props.updatedAt = new Date();
  }

  public setPaymentId(paymentId: string): void {
    this.props.paymentId = paymentId;
    this.props.paymentStatus = PaymentStatus.paid();
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
      this.props.bookingPeriod.startDateTime <= now &&
      !!this.props.chauffeurId
    );
  }

  public isEligibleForCompletion(): boolean {
    const now = new Date();
    return this.props.status.isActive() && this.props.bookingPeriod.endDateTime <= now;
  }

  public isEligibleForStartReminder(): boolean {
    const now = new Date();
    const oneHourBeforeStart = new Date(
      this.props.bookingPeriod.startDateTime.getTime() - 60 * 60 * 1000,
    );
    return (
      this.props.status.isConfirmed() &&
      now >= oneHourBeforeStart &&
      now < this.props.bookingPeriod.startDateTime
    );
  }

  public isEligibleForEndReminder(): boolean {
    const now = new Date();
    const oneHourBeforeEnd = new Date(
      this.props.bookingPeriod.endDateTime.getTime() - 60 * 60 * 1000,
    );
    return (
      this.props.status.isActive() &&
      now >= oneHourBeforeEnd &&
      now < this.props.bookingPeriod.endDateTime
    );
  }

  public isEligibleForCancellation(): boolean {
    // Only CONFIRMED bookings can be cancelled (payment made, service not started)
    if (!this.props.status.isConfirmed()) {
      return false;
    }

    // Must be at least 12 hours before booking start time
    const now = new Date();
    const bookingStartTime = this.props.bookingPeriod.startDateTime;
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

  public isActive(): boolean {
    return this.props.status.isActive();
  }

  public isCompleted(): boolean {
    return this.props.status.isCompleted();
  }

  public isCancelled(): boolean {
    return this.props.status.isCancelled();
  }

  // Getters
  public getId(): string | undefined {
    return this.props.id;
  }

  public getBookingReference(): string {
    return this.props.bookingReference;
  }

  public getStatus(): BookingStatusEnum {
    return this.props.status.value;
  }

  public getStatusObject(): BookingStatus {
    return this.props.status;
  }

  public getBookingPeriod(): BookingPeriod {
    return this.props.bookingPeriod;
  }

  public getStartDateTime(): Date {
    return this.props.bookingPeriod.startDateTime;
  }

  public getEndDateTime(): Date {
    return this.props.bookingPeriod.endDateTime;
  }

  public getBookingType(): BookingType {
    return this.props.bookingPeriod.getBookingType();
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

  public getChauffeurId(): string | null {
    return this.props.chauffeurId ?? null;
  }

  public getSpecialRequests(): string | undefined {
    return this.props.specialRequests;
  }

  public getLegs(): BookingLeg[] {
    return [...this.props.legs];
  }

  public getPaymentStatus(): string {
    return this.props.paymentStatus.toString();
  }

  public getPaymentStatusObject(): PaymentStatus {
    return this.props.paymentStatus;
  }

  public isPaymentPaid(): boolean {
    return this.props.paymentStatus.isPaid();
  }

  public isPaymentUnpaid(): boolean {
    return this.props.paymentStatus.isUnpaid();
  }

  public isPaymentRefunded(): boolean {
    return this.props.paymentStatus.isRefunded();
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

  public getSecurityDetailCost(): number {
    return this.props.financials.getSecurityDetailCostAsNumber();
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
