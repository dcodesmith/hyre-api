/**
 * Validation utilities to replace value object validations
 */

export const SYSTEM_CURRENCY = "NGN";

/**
 * Validates that a user ID is not empty or null
 */
export function validateUserId(id: string): void {
  if (!id || id.trim().length === 0) {
    throw new Error("User ID cannot be empty");
  }
}

/**
 * Generates a unique user ID with custom format
 */
export function generateUserId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `usr_${timestamp}_${random}`;
}

export function validateAmount(amount: number): void {
  if (amount < 0) {
    throw new Error("Amount cannot be negative");
  }

  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }
}

export function validatePositiveAmount(amount: number): void {
  validateAmount(amount);

  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }
}

export function isZeroAmount(amount: number): boolean {
  return amount === 0;
}

export function isPositiveAmount(amount: number): boolean {
  return amount > 0;
}
