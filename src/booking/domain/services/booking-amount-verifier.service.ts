import { Injectable } from "@nestjs/common";

export class AmountMismatchError extends Error {
  constructor(clientAmount: number, serverAmount: number) {
    super(
      `Amount verification failed. Client sent ₦${clientAmount.toFixed(2)}, ` +
        `but server calculated ₦${serverAmount.toFixed(2)}. ` +
        `Please refresh the page and try again.`,
    );
  }
}

@Injectable()
export class BookingAmountVerifierService {
  /**
   * Verifies that the client-calculated amount matches server-calculated amount
   * This prevents price tampering on the frontend
   */
  verifyAmount(clientAmount: number, serverCalculatedAmount: number): void {
    const tolerance = 0.01; // Allow 1 cent difference for floating point precision

    const difference = Math.abs(clientAmount - serverCalculatedAmount);

    if (difference > tolerance) {
      throw new AmountMismatchError(clientAmount, serverCalculatedAmount);
    }
  }

  /**
   * Formats amount for logging and error messages
   */
  formatAmount(amount: number): string {
    return `₦${amount.toFixed(2)}`;
  }
}
