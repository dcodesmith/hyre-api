import { PlatformFeeRates } from "../services/booking-cost-calculator.service";

export interface PlatformFeeRepository {
  getCurrentRates(): Promise<PlatformFeeRates>;
}
