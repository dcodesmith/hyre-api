import { randomUUID } from "node:crypto";
import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import { CarApprovalStatusError, CarStatusTransitionError } from "../errors/fleet.errors";
import { CarApprovalStatusChangedEvent } from "../events/car-approval-status-changed.event";
import { CarCreatedEvent } from "../events/car-created.event";
import { CarStatusChangedEvent } from "../events/car-status-changed.event";
import { CarApprovalStatus } from "../value-objects/car-approval-status.vo";
import { CarStatus } from "../value-objects/car-status.vo";

export interface CarCreationParams {
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  ownerId: string;
  dayRate: number;
  nightRate: number;
  fullDayRate: number;
  hourlyRate: number;
  imageUrls: string[];
  motCertificateUrl: string;
  insuranceCertificateUrl: string;
}

export interface CarProps {
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  ownerId: string;
  dayRate: number;
  nightRate: number;
  hourlyRate: number;
  fullDayRate: number;
  status: CarStatus;
  approvalStatus: CarApprovalStatus;
  imageUrls: string[];
  motCertificateUrl: string;
  insuranceCertificateUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Car extends AggregateRoot {
  private readonly props: CarProps;
  private readonly _id: string;

  private constructor(id: string, props: CarProps) {
    super();
    this._id = id;
    this.props = props;
  }

  public static create(params: CarCreationParams): Car {
    const carId = randomUUID();
    const now = new Date();

    const car = new Car(carId, {
      ...params,
      status: CarStatus.AVAILABLE,
      approvalStatus: CarApprovalStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    });

    car.addDomainEvent(
      new CarCreatedEvent(
        carId,
        params.ownerId,
        params.make,
        params.model,
        params.registrationNumber,
      ),
    );

    return car;
  }

  public static reconstitute(id: string, props: CarProps): Car {
    return new Car(id, props);
  }

  public updateStatus(newStatus: CarStatus): void {
    const oldStatus = this.props.status;

    if (oldStatus.equals(newStatus)) {
      return;
    }

    this.validateStatusTransition(oldStatus, newStatus);

    this.props.status = newStatus;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new CarStatusChangedEvent(
        this.getId(),
        this.props.ownerId,
        oldStatus.toString(),
        newStatus.toString(),
      ),
    );
  }

  public approve(): void {
    if (!this.props.approvalStatus.isPending()) {
      throw new CarApprovalStatusError(this.getId(), "approved");
    }

    this.props.approvalStatus = CarApprovalStatus.APPROVED;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new CarApprovalStatusChangedEvent(this.getId(), this.props.ownerId, "PENDING", "APPROVED"),
    );
  }

  public reject(): void {
    if (!this.props.approvalStatus.isPending()) {
      throw new CarApprovalStatusError(this.getId(), "rejected");
    }

    this.props.approvalStatus = CarApprovalStatus.REJECTED;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new CarApprovalStatusChangedEvent(this.getId(), this.props.ownerId, "PENDING", "REJECTED"),
    );
  }

  public updateRates(
    dayRate: number,
    nightRate: number,
    hourlyRate: number,
    fullDayRate: number,
  ): void {
    this.props.dayRate = dayRate;
    this.props.nightRate = nightRate;
    this.props.hourlyRate = hourlyRate;
    this.props.fullDayRate = fullDayRate;
    this.props.updatedAt = new Date();
  }

  public isAvailable(): boolean {
    return this.props.status.isAvailable() && this.props.approvalStatus.isApproved();
  }

  public isBooked(): boolean {
    return this.props.status.isBooked();
  }

  public isApproved(): boolean {
    return this.props.approvalStatus.isApproved();
  }

  public isPendingApproval(): boolean {
    return this.props.approvalStatus.isPending();
  }

  private validateStatusTransition(from: CarStatus, to: CarStatus): void {
    const validTransitions: Record<string, string[]> = {
      AVAILABLE: ["BOOKED", "HOLD", "IN_SERVICE"],
      BOOKED: ["AVAILABLE", "IN_SERVICE"],
      HOLD: ["AVAILABLE", "IN_SERVICE"],
      IN_SERVICE: ["AVAILABLE"],
    };

    const allowedTransitions = validTransitions[from.toString()] || [];

    if (!allowedTransitions.includes(to.toString())) {
      throw new CarStatusTransitionError(this.getId(), from.toString(), to.toString());
    }
  }

  public getId(): string {
    return this._id;
  }

  // Getters
  public getMake(): string {
    return this.props.make;
  }

  public getModel(): string {
    return this.props.model;
  }

  public getYear(): number {
    return this.props.year;
  }

  public getColor(): string {
    return this.props.color;
  }

  public getRegistrationNumber(): string {
    return this.props.registrationNumber;
  }

  public getOwnerId(): string {
    return this.props.ownerId;
  }

  public getDayRate(): number {
    return this.props.dayRate;
  }

  public getNightRate(): number {
    return this.props.nightRate;
  }

  public getHourlyRate(): number {
    return this.props.hourlyRate;
  }

  public getFullDayRate(): number {
    return this.props.fullDayRate;
  }

  public getStatus(): CarStatus {
    return this.props.status;
  }

  public getApprovalStatus(): CarApprovalStatus {
    return this.props.approvalStatus;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  public getDisplayName(): string {
    return `${this.props.year} ${this.props.make} ${this.props.model}`;
  }

  public getImageUrls(): string[] {
    return this.props.imageUrls;
  }

  public getMotCertificateUrl(): string {
    return this.props.motCertificateUrl;
  }

  public getInsuranceCertificateUrl(): string {
    return this.props.insuranceCertificateUrl;
  }

  /**
   * Helper method to extract rates for booking calculations
   * This replaces the need for a separate CarRates interface
   */
  public getRates(): {
    id: string;
    dayRate: number;
    nightRate: number;
    hourlyRate: number;
    fullDayRate: number;
  } {
    return {
      id: this.getId(),
      dayRate: this.getDayRate(),
      nightRate: this.getNightRate(),
      hourlyRate: this.getHourlyRate(),
      fullDayRate: this.getFullDayRate(),
    };
  }
}
