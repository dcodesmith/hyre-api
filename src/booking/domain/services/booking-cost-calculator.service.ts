import { Inject, Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCarDto } from "../dtos/car.dto";
import { BookingType } from "../interfaces/booking.interface";
import { AddonRateRepository } from "../repositories/addon-rate.repository";
import { PlatformFeeRepository } from "../repositories/platform-fee.repository";
import type { BookingPeriod } from "../value-objects/booking-period.vo";
import { BookingDateService } from "./booking-date.service";

// Helper type for rate extraction - keeps existing interface compatibility
export interface CarRates {
  dayRate: number;
  nightRate: number;
  hourlyRate: number;
  fullDayRate: number;
  id: string;
}

export interface BookingCostCalculation {
  totalAmount: Decimal;
  netTotal: Decimal;
  securityDetailCost: Decimal;
  platformCustomerServiceFeeRatePercent: Decimal;
  platformCustomerServiceFeeAmount: Decimal;
  subtotalBeforeVat: Decimal;
  vatRatePercent: Decimal;
  vatAmount: Decimal;
  platformFleetOwnerCommissionRatePercent: Decimal;
  platformFleetOwnerCommissionAmount: Decimal;
  fleetOwnerPayoutAmountNet: Decimal;
  legPrices: number[];
}

export interface PlatformFeeRates {
  platformServiceFeeRate: Decimal;
  fleetOwnerCommissionRate: Decimal;
  vatRate: Decimal;
}

@Injectable()
export class BookingCostCalculatorService {
  constructor(
    private readonly bookingDateService: BookingDateService,
    @Inject("PlatformFeeRepository") private readonly platformFeeRepository: PlatformFeeRepository,
    @Inject("AddonRateRepository") private readonly addonRateRepository: AddonRateRepository,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Calculate booking cost using car DTO (preferred method)
   */
  async calculateBookingCostFromCar(
    car: BookingCarDto,
    bookingDates: Date[],
    bookingPeriod: BookingPeriod,
    includeSecurityDetail: boolean = false,
  ): Promise<BookingCostCalculation> {
    // Convert DTO to expected CarRates interface
    const carRates: CarRates = {
      dayRate: car.rates.dayRate,
      nightRate: car.rates.nightRate,
      hourlyRate: car.rates.hourlyRate,
      fullDayRate: car.rates.fullDayRate,
      id: car.id,
    };

    // Delegate to existing method
    return this.calculateBookingCost(carRates, bookingDates, bookingPeriod, includeSecurityDetail);
  }

  async calculateBookingCost(
    car: CarRates,
    bookingDates: Date[],
    bookingPeriod: BookingPeriod,
    includeSecurityDetail: boolean = false,
  ): Promise<BookingCostCalculation> {
    // Fetch platform fee rates when needed - following Single Responsibility Principle
    const platformFeeRates = await this.platformFeeRepository.getCurrentRates();
    const startDate = bookingPeriod.startDateTime;
    const endDate = bookingPeriod.endDateTime;
    const bookingType = bookingPeriod.getBookingType();

    const legPrices: number[] = [];

    for (const legDate of bookingDates) {
      const dailyPrice = this.calculateBookingLegPrice(
        car,
        { startDate, endDate, type: bookingType },
        legDate,
      );
      legPrices.push(dailyPrice);
    }

    // Calculate net total (sum of all leg prices)
    const netTotal = legPrices
      .map((legPrice) => new Decimal(legPrice))
      .reduce((sum, legPrice) => sum.plus(legPrice), new Decimal(0));

    // Calculate security detail cost from database rate
    // Security detail is charged per leg with a multiplier based on booking type:
    // - DAY bookings: 1 day per leg (multiplier = 1, 12-hour coverage)
    // - NIGHT bookings: 1 day per leg (multiplier = 1, 6-hour unsociable hours)
    // - FULL_DAY bookings: 2 days per leg (multiplier = 2, 24-hour coverage)
    let securityDetailCost = new Decimal(0);
    if (includeSecurityDetail) {
      const securityDetailRate = await this.addonRateRepository.findCurrentRate("SECURITY_DETAIL");
      if (securityDetailRate) {
        const legCount = legPrices.length; // Number of legs that will be created
        const multiplier = bookingPeriod.getSecurityDetailMultiplier();
        const securityDetailDays = legCount * multiplier;
        securityDetailCost = new Decimal(securityDetailRate).mul(securityDetailDays);
      } else {
        this.logger.warn("SECURITY_DETAIL rate not found, defaulting cost to 0");
      }
    }

    const netTotalWithSecurity = netTotal.plus(securityDetailCost);

    // Calculate platform service fee
    const platformCustomerServiceFeeAmount = netTotalWithSecurity
      .mul(platformFeeRates.platformServiceFeeRate)
      .div(100);

    // Calculate subtotal before VAT
    const subtotalBeforeVat = netTotalWithSecurity.plus(platformCustomerServiceFeeAmount);

    // Calculate VAT
    const vatAmount = subtotalBeforeVat.mul(platformFeeRates.vatRate).div(100);

    // Calculate total amount (gross)
    const totalAmount = subtotalBeforeVat.plus(vatAmount);

    // Calculate fleet owner commission and payout
    const platformFleetOwnerCommissionAmount = netTotal
      .mul(platformFeeRates.fleetOwnerCommissionRate)
      .div(100);

    const fleetOwnerPayoutAmountNet = netTotal.minus(platformFleetOwnerCommissionAmount);

    // Validate all amounts
    // validateAmount(totalAmountNumber);
    // validateAmount(netTotalNumber);
    // validateAmount(platformCustomerServiceFeeAmountNumber);
    // validateAmount(subtotalBeforeVatNumber);
    // validateAmount(vatAmountNumber);
    // validateAmount(platformFleetOwnerCommissionAmountNumber);
    // validateAmount(fleetOwnerPayoutAmountNetNumber);

    return {
      totalAmount,
      netTotal,
      securityDetailCost,
      platformCustomerServiceFeeRatePercent: platformFeeRates.platformServiceFeeRate,
      platformCustomerServiceFeeAmount,
      subtotalBeforeVat,
      vatRatePercent: platformFeeRates.vatRate,
      vatAmount,
      platformFleetOwnerCommissionRatePercent: platformFeeRates.fleetOwnerCommissionRate,
      platformFleetOwnerCommissionAmount,
      fleetOwnerPayoutAmountNet,
      legPrices,
    };
  }

  private calculateBookingLegPrice(
    car: CarRates,
    booking: { startDate: Date; endDate: Date; type: BookingType },
    _legDate: Date,
  ): number {
    const { dayRate, nightRate, fullDayRate } = car;
    const { type } = booking;

    // Ensure rates are positive, default to 0 if not
    const validDayRate = Math.max(0, dayRate);
    const validNightRate = Math.max(0, nightRate);
    const validFullDayRate = Math.max(0, fullDayRate);

    if (type === "NIGHT") {
      return validNightRate;
    }

    // FULL_DAY: flat rate per 24-hour period
    // Each FULL_DAY leg is exactly 24 hours, so we charge the fullDayRate
    if (type === "FULL_DAY") {
      return validFullDayRate;
    }

    // BookingType.DAY calculations
    // Each DAY leg is exactly 12 hours at the same pickup time
    // Therefore, each leg is charged the full dayRate
    return validDayRate;
  }
}
