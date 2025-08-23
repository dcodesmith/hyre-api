import { Inject, Injectable } from "@nestjs/common";
import { Decimal } from "decimal.js";
import { BookingCarDto } from "../dtos/car.dto";
import { PlatformFeeRepository } from "../repositories/platform-fee.repository";
import { BookingType } from "../value-objects/booking-type.vo";
import { DateRange } from "../value-objects/date-range.vo";
import { BookingDateService } from "./booking-date.service";

// Helper type for rate extraction - keeps existing interface compatibility
export interface CarRates {
  dayRate: number;
  nightRate: number;
  hourlyRate: number;
  id: string;
}

export interface BookingCostCalculation {
  totalAmount: Decimal;
  netTotal: Decimal;
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
  private readonly SECURITY_DETAIL_COST = 30000;

  constructor(
    private readonly bookingDateService: BookingDateService,
    @Inject("PlatformFeeRepository") private readonly platformFeeRepository: PlatformFeeRepository,
  ) {}

  /**
   * Calculate booking cost using car DTO (preferred method)
   */
  async calculateBookingCostFromCar(
    car: BookingCarDto,
    bookingDates: Date[],
    dateRange: DateRange,
    type: BookingType,
    includeSecurityDetail: boolean = false,
  ): Promise<BookingCostCalculation> {
    // Convert DTO to expected CarRates interface
    const carRates: CarRates = {
      dayRate: car.rates.dayRate,
      nightRate: car.rates.nightRate,
      hourlyRate: car.rates.hourlyRate,
      id: car.id,
    };

    // Delegate to existing method
    return this.calculateBookingCost(
      carRates,
      bookingDates,
      dateRange,
      type,
      includeSecurityDetail,
    );
  }

  async calculateBookingCost(
    car: CarRates,
    bookingDates: Date[],
    dateRange: DateRange,
    type: BookingType,
    includeSecurityDetail: boolean = false,
  ): Promise<BookingCostCalculation> {
    // Fetch platform fee rates when needed - following Single Responsibility Principle
    const platformFeeRates = await this.platformFeeRepository.getCurrentRates();
    const { startDate, endDate } = dateRange;

    const legPrices: number[] = [];

    for (const legDate of bookingDates) {
      const dailyPrice = this.calculateBookingLegPrice(car, { startDate, endDate, type }, legDate);
      legPrices.push(dailyPrice);
    }

    // Calculate net total (sum of all leg prices)
    const netTotal = legPrices
      .map((legPrice) => new Decimal(legPrice))
      .reduce((sum, legPrice) => sum.plus(legPrice), new Decimal(0));

    // Calculate security detail cost
    const securityDetailCost = includeSecurityDetail
      ? new Decimal(this.SECURITY_DETAIL_COST).mul(bookingDates.length)
      : new Decimal(0);

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
    legDate: Date,
  ): number {
    const { dayRate, nightRate, hourlyRate } = car;
    const { startDate, endDate, type } = booking;

    // Ensure rates are positive, default to 0 if not
    const validDayRate = Math.max(0, dayRate);
    const validNightRate = Math.max(0, nightRate);
    const validHourlyRate = Math.max(0, hourlyRate);

    const MINIMUM_CHARGEABLE_HOURS = 1;

    if (type.value === "NIGHT") {
      return validNightRate;
    }

    // BookingType.DAY calculations
    const isFirstLeg = this.bookingDateService.isFirstLeg(legDate, startDate);
    const isLastLeg = this.bookingDateService.isLastLeg(legDate, endDate);

    // Determine the actual service start and end times for this specific leg
    const actualServiceStartTimeOnLeg = this.bookingDateService.getActualServiceStartTimeOnLeg(
      legDate,
      startDate,
      isFirstLeg,
    );
    const actualServiceEndTimeOnLeg = this.bookingDateService.getActualServiceEndTimeOnLeg(
      legDate,
      endDate,
      isLastLeg,
    );

    // Calculate duration of service on this leg in hours
    let durationHours = this.bookingDateService.calculateDurationInHours(
      actualServiceEndTimeOnLeg,
      actualServiceStartTimeOnLeg,
    );

    // Ensure a minimum duration for calculation if there's any overlap
    if (durationHours <= 0 && actualServiceEndTimeOnLeg > actualServiceStartTimeOnLeg) {
      durationHours = MINIMUM_CHARGEABLE_HOURS;
    } else if (durationHours < 0) {
      durationHours = 0;
    }

    // Ensure duration does not exceed 24 hours for a single leg calculation
    durationHours = Math.min(durationHours, 24);

    // Handle cases based on leg position and booking duration
    if (isFirstLeg && isLastLeg) {
      // Single-day DAY booking
      if (validHourlyRate > 0) {
        const hourlyCost = Math.max(durationHours, MINIMUM_CHARGEABLE_HOURS) * validHourlyRate;
        return Math.min(hourlyCost, validDayRate);
      }
      return validDayRate;
    }

    if (isFirstLeg) {
      // Multi-day DAY booking - First leg (partial day)
      if (validHourlyRate > 0) {
        const hourlyCost = Math.max(durationHours, MINIMUM_CHARGEABLE_HOURS) * validHourlyRate;
        return Math.min(hourlyCost, validDayRate);
      }
      return validDayRate;
    }

    if (isLastLeg) {
      // Multi-day DAY booking - Last leg (partial day)
      if (validHourlyRate > 0) {
        const hourlyCost = Math.max(durationHours, MINIMUM_CHARGEABLE_HOURS) * validHourlyRate;
        return Math.min(hourlyCost, validDayRate);
      }
      return validDayRate;
    }

    // Full intermediate day in a multi-day DAY booking
    return validDayRate;
  }
}
