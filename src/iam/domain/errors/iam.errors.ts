import { BaseDomainError } from "../../../shared/domain/errors/base-domain.error";

export class UserNotFoundError extends BaseDomainError {
  readonly code = "USER_NOT_FOUND";
  readonly context = "IAM";

  constructor(userId: string) {
    super(`User not found: ${userId}`);
  }
}

export class UnauthorizedActionError extends BaseDomainError {
  readonly code = "UNAUTHORIZED_ACTION";
  readonly context = "IAM";

  constructor(action: string, reason?: string) {
    const message = reason ? `Unauthorized action: ${action} - ${reason}` : `Unauthorized action: ${action}`;
    super(message);
  }
}

export class InvalidRegistrationError extends BaseDomainError {
  readonly code = "INVALID_REGISTRATION";
  readonly context = "IAM";

  constructor(reason: string) {
    super(`Invalid registration: ${reason}`);
  }
}

export class ApprovalStatusError extends BaseDomainError {
  readonly code = "APPROVAL_STATUS_ERROR";
  readonly context = "IAM";

  constructor(currentStatus: string, attemptedAction: string) {
    super(`Cannot ${attemptedAction} user with status: ${currentStatus}`);
  }
}

export class FleetOwnerRelationshipError extends BaseDomainError {
  readonly code = "FLEET_OWNER_RELATIONSHIP_ERROR";
  readonly context = "IAM";

  constructor(reason: string) {
    super(`Fleet owner relationship error: ${reason}`);
  }
}

export class OtpVerificationError extends BaseDomainError {
  readonly code = "OTP_VERIFICATION_ERROR";
  readonly context = "IAM";

  constructor(reason: string) {
    super(`OTP verification failed: ${reason}`);
  }
}

export class DuplicateUserError extends BaseDomainError {
  readonly code = "DUPLICATE_USER";
  readonly context = "IAM";

  constructor(field: string, value: string) {
    super(`User with ${field} '${value}' already exists`);
  }
}

export class InvalidUserStateError extends BaseDomainError {
  readonly code = "INVALID_USER_STATE";
  readonly context = "IAM";

  constructor(reason: string) {
    super(`Invalid user state: ${reason}`);
  }
}

export class BankDetailsValidationError extends BaseDomainError {
  readonly code = "BANK_DETAILS_VALIDATION_ERROR";
  readonly context = "IAM";

  constructor(reason: string, details?: Record<string, any>) {
    super(`Bank details validation error: ${reason}`, details);
  }
}

export class BankVerificationError extends BaseDomainError {
  readonly code = "BANK_VERIFICATION_ERROR";
  readonly context = "IAM";

  constructor(reason: string, details?: Record<string, any>) {
    super(`Bank verification failed: ${reason}`, details);
  }
}

export class OnboardingError extends BaseDomainError {
  readonly code = "ONBOARDING_ERROR";
  readonly context = "IAM";

  constructor(reason: string, details?: Record<string, any>) {
    super(`Onboarding error: ${reason}`, details);
  }
}

export class TokenValidationError extends BaseDomainError {
  readonly code = "TOKEN_VALIDATION_ERROR";
  readonly context = "IAM";
}
