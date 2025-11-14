import { AddonType } from "@prisma/client";

export interface AddonRateRepository {
  /**
   * Find the current effective addon rate for a given addon type
   * @param addonType The type of addon to find the rate for
   * @param effectiveDate The date to check for rate effectiveness (defaults to now)
   * @returns The rate amount as a number, or null if no rate is found
   */
  findCurrentRate(addonType: AddonType, effectiveDate?: Date): Promise<number | null>;
}
