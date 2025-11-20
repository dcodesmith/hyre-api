import { BaseDomainError } from "../../../shared/domain/errors/base-domain.error";

export abstract class CarDomainError extends BaseDomainError {
  readonly context = "Car";
  abstract readonly code: string;
}

export class CarNotFoundError extends CarDomainError {
  readonly code = "CAR_NOT_FOUND";
  constructor(carId: string) {
    super(`Car with ID ${carId} was not found`, { carId });
  }
}

export class CarNotAvailableError extends CarDomainError {
  readonly code = "CAR_NOT_AVAILABLE";
  constructor(carId: string, status: string) {
    super(`Car ${carId} is not available. Current status: ${status}`, {
      carId,
      status,
    });
  }
}

export class CarNotApprovedError extends CarDomainError {
  readonly code = "CAR_NOT_APPROVED";
  constructor(carId: string, approvalStatus: string) {
    super(`Car ${carId} is not approved for bookings. Approval status: ${approvalStatus}`, {
      carId,
      approvalStatus,
    });
  }
}

export class InvalidCarRatesError extends CarDomainError {
  readonly code = "INVALID_CAR_RATES";
  constructor(carId: string, rateType: string) {
    super(`Car ${carId} has invalid or missing ${rateType} rate`, {
      carId,
      rateType,
    });
  }
}

export class CarInServiceError extends CarDomainError {
  readonly code = "CAR_IN_SERVICE";
  constructor(carId: string) {
    super(`Car ${carId} is currently in service and cannot be booked`, { carId });
  }
}

export class CarOwnerNotFoundError extends CarDomainError {
  readonly code = "CAR_OWNER_NOT_FOUND";
  constructor(carId: string, ownerId: string) {
    super(`Owner ${ownerId} for car ${carId} was not found`, {
      carId,
      ownerId,
    });
  }
}
