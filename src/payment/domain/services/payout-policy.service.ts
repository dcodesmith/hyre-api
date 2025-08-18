import { Injectable } from "@nestjs/common";
import {
  isPositiveAmount,
  isZeroAmount,
  validateAmount,
} from "../../../shared/domain/value-objects/validation-utils";
import { generateSecureRandomId } from "../../../shared/utils/secure-random";
import { Payout } from "../entities/payout.entity";
import { BankAccount } from "../value-objects/bank-account.vo";

export class PayoutEligibilityResult {
  constructor(
    public readonly isEligible: boolean,
    public readonly reason?: string,
  ) {}

  static eligible(): PayoutEligibilityResult {
    return new PayoutEligibilityResult(true);
  }

  static ineligible(reason: string): PayoutEligibilityResult {
    return new PayoutEligibilityResult(false, reason);
  }
}

@Injectable()
export class PayoutPolicyService {
  public canInitiatePayout(
    amount: number,
    bankAccount: BankAccount,
    existingPayouts: Payout[],
  ): PayoutEligibilityResult {
    // Business rule: Amount must be positive
    if (isZeroAmount(amount)) {
      return PayoutEligibilityResult.ineligible("Payout amount cannot be zero");
    }

    if (!isPositiveAmount(amount)) {
      return PayoutEligibilityResult.ineligible("Payout amount must be positive");
    }

    // Business rule: Bank account must be verified
    if (!bankAccount.isVerified) {
      return PayoutEligibilityResult.ineligible("Bank account must be verified");
    }

    // Business rule: No duplicate payouts in progress for the same booking/extension
    const payoutsInProgress = existingPayouts.filter((payout) => payout.isInProgress());
    if (payoutsInProgress.length > 0) {
      return PayoutEligibilityResult.ineligible("Payout already in progress");
    }

    return PayoutEligibilityResult.eligible();
  }

  public calculatePayoutAmount(grossAmount: number, commissionRate: number): number {
    validateAmount(grossAmount);

    if (commissionRate < 0 || commissionRate > 100) {
      throw new Error("Commission rate must be between 0 and 100");
    }

    const commission = (grossAmount * commissionRate) / 100;
    const payoutAmount = grossAmount - commission;

    validateAmount(payoutAmount);
    return payoutAmount;
  }

  public generatePayoutReference(bookingId?: string, extensionId?: string): string {
    const timestamp = Date.now().toString(36);
    const random = generateSecureRandomId();

    if (bookingId) {
      return `payout_booking_${bookingId}_${timestamp}_${random}`;
    }

    if (extensionId) {
      return `payout_extension_${extensionId}_${timestamp}_${random}`;
    }

    return `payout_${timestamp}_${random}`;
  }
}
