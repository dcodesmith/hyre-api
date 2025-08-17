/**
 * Fleet Domain Errors
 *
 * All Fleet domain-specific errors with proper categorization and context
 */

import { BaseDomainError } from "../../../shared/domain/errors/base-domain.error";

export abstract class FleetDomainError extends BaseDomainError {
  readonly context = "Fleet";
}

// ================================
// Fleet Entity Errors
// ================================

export class FleetNotFoundError extends FleetDomainError {
  readonly code = "FLEET_NOT_FOUND";

  constructor(ownerId: string) {
    super(`Fleet not found: ${ownerId}`, { ownerId });
  }
}

export class FleetOwnerAlreadyHasFleetError extends FleetDomainError {
  readonly code = "FLEET_OWNER_ALREADY_HAS_FLEET";

  constructor(ownerId: string) {
    super(`Fleet owner already has a fleet: ${ownerId}`, { ownerId });
  }
}

export class FleetDeactivationError extends FleetDomainError {
  readonly code = "FLEET_DEACTIVATION_ERROR";

  constructor(reason: string) {
    super(`Cannot deactivate fleet: ${reason}`, { reason });
  }
}

// ================================
// Car Entity Errors
// ================================

export class CarNotFoundError extends FleetDomainError {
  readonly code = "CAR_NOT_FOUND";

  constructor(carId: string) {
    super(`Car not found: ${carId}`, { carId });
  }
}

export class CarAlreadyExistsInFleetError extends FleetDomainError {
  readonly code = "CAR_ALREADY_EXISTS_IN_FLEET";

  constructor(carId: string, fleetId: string) {
    super(`Car ${carId} already exists in fleet ${fleetId}`, { carId, fleetId });
  }
}

export class CarNotFoundInFleetError extends FleetDomainError {
  readonly code = "CAR_NOT_FOUND_IN_FLEET";

  constructor(carId: string, fleetId: string) {
    super(`Car ${carId} not found in fleet ${fleetId}`, { carId, fleetId });
  }
}

export class CarOwnershipMismatchError extends FleetDomainError {
  readonly code = "CAR_OWNERSHIP_MISMATCH";

  constructor(carId: string, expectedOwnerId: string) {
    super(`Car ${carId} owner must match fleet owner ${expectedOwnerId}`, {
      carId,
      expectedOwnerId,
    });
  }
}

export class CarRemovalError extends FleetDomainError {
  readonly code = "CAR_REMOVAL_ERROR";

  constructor(carId: string, reason: string) {
    super(`Cannot remove car ${carId}: ${reason}`, { carId, reason });
  }
}

export class CarDuplicateRegistrationError extends FleetDomainError {
  readonly code = "CAR_DUPLICATE_REGISTRATION";

  constructor(registrationNumber: string) {
    super(`Car with registration number ${registrationNumber} already exists`, {
      registrationNumber,
    });
  }
}

// ================================
// Car Approval Errors
// ================================

export class CarApprovalError extends FleetDomainError {
  readonly code = "CAR_APPROVAL_ERROR";

  constructor(carId: string, currentStatus: string, action: string) {
    super(`Cannot ${action} car ${carId}: car is ${currentStatus}, not pending approval`, {
      carId,
      currentStatus,
      action,
    });
  }
}

export class CarApprovalStatusError extends FleetDomainError {
  readonly code = "CAR_APPROVAL_STATUS_ERROR";

  constructor(carId: string, action: string) {
    super(`Car ${carId} can only be ${action} if pending approval`, { carId, action });
  }
}

// ================================
// Car Status Transition Errors
// ================================

export class CarStatusTransitionError extends FleetDomainError {
  readonly code = "CAR_STATUS_TRANSITION_ERROR";

  constructor(carId: string, fromStatus: string, toStatus: string) {
    super(`Invalid status transition for car ${carId}: from ${fromStatus} to ${toStatus}`, {
      carId,
      fromStatus,
      toStatus,
    });
  }
}

// ================================
// Chauffeur Assignment Errors
// ================================

export class ChauffeurAlreadyAssignedError extends FleetDomainError {
  readonly code = "CHAUFFEUR_ALREADY_ASSIGNED";

  constructor(chauffeurId: string, fleetId: string) {
    super(`Chauffeur ${chauffeurId} already assigned to fleet ${fleetId}`, {
      chauffeurId,
      fleetId,
    });
  }
}

export class ChauffeurNotFoundInFleetError extends FleetDomainError {
  readonly code = "CHAUFFEUR_NOT_FOUND_IN_FLEET";

  constructor(chauffeurId: string, fleetId: string) {
    super(`Chauffeur ${chauffeurId} not found in fleet ${fleetId}`, { chauffeurId, fleetId });
  }
}

// ================================
// Value Object Validation Errors
// ================================

export class InvalidCarStatusError extends FleetDomainError {
  readonly code = "INVALID_CAR_STATUS";

  constructor(status: string) {
    super(`Invalid car status: ${status}`, { status });
  }
}

export class InvalidCarApprovalStatusError extends FleetDomainError {
  readonly code = "INVALID_CAR_APPROVAL_STATUS";

  constructor(status: string) {
    super(`Invalid car approval status: ${status}`, { status });
  }
}

// ================================
// File Upload Errors
// ================================

export class CarFileUploadError extends FleetDomainError {
  readonly code = "CAR_FILE_UPLOAD_ERROR";

  constructor(fileName: string, reason: string) {
    super(`Failed to upload file ${fileName}: ${reason}`, { fileName, reason });
  }
}

export class CarFileUrlError extends FleetDomainError {
  readonly code = "CAR_FILE_URL_ERROR";

  constructor(fileName: string, fileType: string) {
    super(`Failed to get upload URL for ${fileType} file: ${fileName}`, { fileName, fileType });
  }
}

export class CarUploadServiceError extends FleetDomainError {
  readonly code = "CAR_UPLOAD_SERVICE_ERROR";

  constructor(reason: string, details?: Record<string, any>) {
    super(`Car upload failed: ${reason}`, details);
  }
}

// ================================
// Authorization Errors
// ================================

export class CarOwnershipDeniedError extends FleetDomainError {
  readonly code = "CAR_OWNERSHIP_DENIED";

  constructor(carId: string, ownerId: string, action: string) {
    super(`Access denied - cannot ${action} car ${carId}: only the owner can perform this action`, {
      carId,
      ownerId,
      action,
    });
  }
}

// ================================
// Value Object Validation Errors
// ================================

export class CarDocumentValidationError extends FleetDomainError {
  readonly code = "CAR_DOCUMENT_VALIDATION_ERROR";

  constructor(field: string, reason: string, details?: Record<string, any>) {
    super(`Invalid document ${field}: ${reason}`, { field, reason, ...details });
  }
}
