import { HttpStatus } from "@nestjs/common";

// Map domain error codes to HTTP status codes
export const statusCodeMap: Record<string, number> = {
  // ================================
  // Booking Domain Errors
  // ================================
  BOOKING_NOT_FOUND: HttpStatus.NOT_FOUND,
  BOOKING_ALREADY_CANCELLED: HttpStatus.BAD_REQUEST,
  BOOKING_CANNOT_BE_CANCELLED: HttpStatus.BAD_REQUEST,
  BOOKING_CANNOT_BE_CONFIRMED: HttpStatus.BAD_REQUEST,
  INVALID_BOOKING_TIME: HttpStatus.BAD_REQUEST,
  BOOKING_TIME_CONFLICT: HttpStatus.CONFLICT,
  DRIVER_NOT_AVAILABLE: HttpStatus.CONFLICT,

  // ================================
  // Fleet Domain Errors
  // ================================

  // Fleet Entity Errors
  FLEET_NOT_FOUND: HttpStatus.NOT_FOUND,
  FLEET_OWNER_ALREADY_HAS_FLEET: HttpStatus.CONFLICT,
  FLEET_DEACTIVATION_ERROR: HttpStatus.BAD_REQUEST,

  // Car Entity Errors
  CAR_NOT_FOUND: HttpStatus.NOT_FOUND,
  CAR_ALREADY_EXISTS_IN_FLEET: HttpStatus.CONFLICT,
  CAR_NOT_FOUND_IN_FLEET: HttpStatus.NOT_FOUND,
  CAR_OWNERSHIP_MISMATCH: HttpStatus.FORBIDDEN,
  CAR_REMOVAL_ERROR: HttpStatus.BAD_REQUEST,
  CAR_DUPLICATE_REGISTRATION: HttpStatus.CONFLICT,

  // Car Approval Errors
  CAR_APPROVAL_ERROR: HttpStatus.BAD_REQUEST,
  CAR_APPROVAL_STATUS_ERROR: HttpStatus.BAD_REQUEST,

  // Car Status Transition Errors
  CAR_STATUS_TRANSITION_ERROR: HttpStatus.BAD_REQUEST,

  // Chauffeur Assignment Errors
  CHAUFFEUR_ALREADY_ASSIGNED: HttpStatus.CONFLICT,
  CHAUFFEUR_NOT_FOUND_IN_FLEET: HttpStatus.NOT_FOUND,

  // Value Object Validation Errors
  INVALID_FLEET_ID: HttpStatus.BAD_REQUEST,
  INVALID_CAR_STATUS: HttpStatus.BAD_REQUEST,
  INVALID_CAR_APPROVAL_STATUS: HttpStatus.BAD_REQUEST,

  // ================================
  // IAM Domain Errors
  // ================================
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  UNAUTHORIZED_ACTION: HttpStatus.FORBIDDEN,
  INVALID_REGISTRATION: HttpStatus.BAD_REQUEST,
  APPROVAL_STATUS_ERROR: HttpStatus.BAD_REQUEST,
  FLEET_OWNER_RELATIONSHIP_ERROR: HttpStatus.BAD_REQUEST,
  OTP_VERIFICATION_ERROR: HttpStatus.BAD_REQUEST,
  DUPLICATE_USER: HttpStatus.CONFLICT,
  INVALID_USER_STATE: HttpStatus.BAD_REQUEST,
  TOKEN_VALIDATION_ERROR: HttpStatus.UNAUTHORIZED,

  // ================================
  // Legacy/Generic Errors (for backwards compatibility)
  // ================================
  PAYMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  INSUFFICIENT_FUNDS: HttpStatus.PAYMENT_REQUIRED,
  PAYMENT_ALREADY_PROCESSED: HttpStatus.CONFLICT,
  PAYMENT_METHOD_INVALID: HttpStatus.BAD_REQUEST,
  PAYMENT_DECLINED: HttpStatus.PAYMENT_REQUIRED,
  BOOKING_OUTSIDE_SERVICE_AREA: HttpStatus.BAD_REQUEST,
  CUSTOMER_NOT_FOUND: HttpStatus.NOT_FOUND,
  CUSTOMER_NOT_VERIFIED: HttpStatus.FORBIDDEN,
  CUSTOMER_SUSPENDED: HttpStatus.FORBIDDEN,
  UNAUTHORIZED_ACCESS: HttpStatus.UNAUTHORIZED,
  INSUFFICIENT_PERMISSIONS: HttpStatus.FORBIDDEN,
};
