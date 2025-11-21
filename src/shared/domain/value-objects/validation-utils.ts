/**
 * Validation utilities to replace value object validations
 */

import { randomUUID } from "node:crypto";

export const SYSTEM_CURRENCY = "NGN";

/**
 * Generates a unique fleet ID
 */
export function generateFleetId(): string {
  return randomUUID();
}

// ================================
// Amount Validation Functions
// ================================

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
