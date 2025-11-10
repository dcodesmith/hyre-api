import { Decimal } from "decimal.js";

/**
 * Value object representing platform fee rates
 * Used for calculating booking costs and platform fees
 */
export interface PlatformFeeRates {
  platformServiceFeeRate: Decimal;
  fleetOwnerCommissionRate: Decimal;
  vatRate: Decimal;
}