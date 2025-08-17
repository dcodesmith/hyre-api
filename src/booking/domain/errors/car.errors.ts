export abstract class CarDomainError extends Error {
  abstract readonly code: string;
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
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

export class CarOnHoldError extends CarDomainError {
  readonly code = "CAR_ON_HOLD";
  constructor(carId: string, reason?: string) {
    super(`Car ${carId} is on hold and cannot be booked${reason ? `: ${reason}` : ""}`, {
      carId,
      reason,
    });
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
