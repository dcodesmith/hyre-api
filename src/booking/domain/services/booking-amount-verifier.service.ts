import { Injectable } from "@nestjs/common";
import { BookingAmountMismatchError } from "../errors/booking.errors";

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
      throw new BookingAmountMismatchError(clientAmount, serverCalculatedAmount);
    }
  }
}
