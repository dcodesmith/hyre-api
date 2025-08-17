/**
 * Validation utilities to replace value object validations
 */

import { randomUUID } from "node:crypto";

export const SYSTEM_CURRENCY = "NGN";

// ================================
// ID Validation Functions
// ================================

/**
 * Validates that a booking ID is not empty or null
 */
export function validateBookingId(id: string): string {
  if (!id || id.trim().length === 0) {
    throw new Error("Booking ID cannot be empty");
  }
  return id;
}

/**
 * Generates a unique booking ID
 */
export function generateBookingId(): string {
  return randomUUID();
}

/**
 * Validates that a fleet ID is not empty or null
 */
export function validateFleetId(id: string): string {
  if (!id || id.trim().length === 0) {
    throw new Error("Fleet ID cannot be empty");
  }
  return id;
}

/**
 * Generates a unique fleet ID
 */
export function generateFleetId(): string {
  return randomUUID();
}

/**
 * Validates that a user ID is not empty or null
 */
export function validateUserId(id: string): string {
  if (!id || id.trim().length === 0) {
    throw new Error("User ID cannot be empty");
  }
  return id;
}

/**
 * Generates a unique user ID with custom format
 */
export function generateUserId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `usr_${timestamp}_${random}`;
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
