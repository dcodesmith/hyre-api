import { Injectable } from "@nestjs/common";
import { addDays, setHours } from "date-fns";
import { BookingCarDto } from "../dtos/car.dto";
import { Booking } from "../entities/booking.entity";
import { BookingLeg } from "../entities/booking-leg.entity";
import {
  BookingCannotBeActivatedError,
  BookingCannotBeCancelledError,
  BookingCannotBeCompletedError,
} from "../errors/booking.errors";
import { BookingFinancials } from "../value-objects/booking-financials.vo";
import { BookingType } from "../value-objects/booking-type.vo";
import { DateRange } from "../value-objects/date-range.vo";
import {
  BookingCostCalculation,
  BookingCostCalculatorService,
} from "./booking-cost-calculator.service";
import { BookingDateService } from "./booking-date.service";
import { BookingEligibilityService } from "./booking-eligibility.service";

/**
 * Leg pricing information used for creating booking legs
 */
export interface LegPricingData {
  legPrices: number[];
  startHours: number;
  endHours: number;
}

/**
 * Domain command for creating a booking - pure domain concept
 */
export interface CreateBookingCommand {
  customerId: string;
  carId: string;
  car: BookingCarDto; // Uses DTO instead of Fleet domain entity
  dateRange: DateRange;
  bookingType: BookingType;
  pickupAddress: string;
  dropOffAddress: string;
  sameLocation?: boolean;
  includeSecurityDetail?: boolean;
  specialRequests?: string;
  totalAmount: number;
  pickupTime: string;
}

@Injectable()
export class BookingDomainService {
  private static readonly ERROR_MESSAGES = {
    ACTIVATION_NOT_ALLOWED: "Activation not allowed",
    COMPLETION_NOT_ALLOWED: "Completion not allowed",
  } as const;

  constructor(
    private readonly bookingCostCalculator: BookingCostCalculatorService,
    private readonly bookingDateService: BookingDateService,
    private readonly bookingEligibilityService: BookingEligibilityService,
  ) {}

  async createBooking(command: CreateBookingCommand): Promise<Booking> {
    const {
      car,
      dateRange,
      bookingType,
      includeSecurityDetail,
      specialRequests,
      pickupAddress,
      dropOffAddress,
      customerId,
    } = command;

    // Generate booking dates first - single source of truth
    const bookingDates = this.bookingDateService.generateBookingDates(
      dateRange.startDate,
      dateRange.endDate,
      bookingType,
    );

    // Calculate costs using the generated dates
    const costCalculation = await this.bookingCostCalculator.calculateBookingCostFromCar(
      car,
      bookingDates,
      dateRange,
      bookingType,
      includeSecurityDetail,
    );

    // Create financials value object
    const financials = BookingFinancials.create({
      totalAmount: costCalculation.totalAmount,
      netTotal: costCalculation.netTotal,
      platformServiceFeeAmount: costCalculation.platformCustomerServiceFeeAmount,
      vatAmount: costCalculation.vatAmount,
      fleetOwnerPayoutAmountNet: costCalculation.fleetOwnerPayoutAmountNet,
    });

    // Create booking entity with calculated financials
    const booking = Booking.create(
      customerId,
      car.id,
      dateRange,
      pickupAddress,
      dropOffAddress,
      bookingType,
      financials,
      includeSecurityDetail,
      specialRequests,
    );

    // Create leg pricing data from cost calculation
    const legPricingData: LegPricingData = {
      legPrices: costCalculation.legPrices,
      startHours: dateRange.startDate.getHours(),
      endHours: dateRange.endDate.getHours(),
    };

    // Create booking legs using the same dates and pricing data
    this.createBookingLegs(booking, bookingDates, legPricingData, costCalculation);

    return booking;
  }

  /**
   * Cancels a booking with optional reason
   */
  cancelBooking(booking: Booking, reason?: string): void {
    const eligibility = this.bookingEligibilityService.canCancelBooking(booking);
    if (!eligibility.isEligible) {
      throw new BookingCannotBeCancelledError(
        booking.getId(),
        eligibility.reason || "Cancellation not allowed",
      );
    }

    booking.cancel(reason);
  }

  /**
   * Activates a booking using domain eligibility rules - used for automated activation
   */
  activateBooking(booking: Booking): void {
    const eligibility = this.bookingEligibilityService.canActivateBooking(booking);
    if (!eligibility.isEligible) {
      throw new BookingCannotBeActivatedError(
        booking.getId(),
        eligibility.reason || BookingDomainService.ERROR_MESSAGES.ACTIVATION_NOT_ALLOWED,
      );
    }

    booking.activate();
  }

  /**
   * Completes a booking using domain eligibility rules - used for automated completion
   */
  completeBooking(booking: Booking): void {
    const eligibility = this.bookingEligibilityService.canCompleteBooking(booking);
    if (!eligibility.isEligible) {
      throw new BookingCannotBeCompletedError(
        booking.getId(),
        eligibility.reason || BookingDomainService.ERROR_MESSAGES.COMPLETION_NOT_ALLOWED,
      );
    }

    booking.complete();
  }

  private createBookingLegs(
    booking: Booking,
    bookingDates: Date[],
    legPricingData: LegPricingData,
    costCalculation: BookingCostCalculation,
  ): void {
    bookingDates.forEach((legDate, index) => {
      const itemsNetValueForLeg = costCalculation.fleetOwnerPayoutAmountNet
        .mul(1 / bookingDates.length)
        .toNumber();

      // Calculate fleet owner earning for this leg
      const fleetOwnerEarningForLeg = costCalculation.fleetOwnerPayoutAmountNet
        .mul(1 / bookingDates.length)
        .toNumber();

      // Calculate leg start and end times using the provided hours
      const legStartTime = setHours(legDate, legPricingData.startHours);
      const legEndTime =
        legPricingData.endHours < legPricingData.startHours
          ? setHours(addDays(legDate, 1), legPricingData.endHours) // If end time is less than start time, it's on the next day
          : setHours(legDate, legPricingData.endHours);

      const leg = BookingLeg.create(
        booking.getId(),
        legDate,
        legStartTime,
        legEndTime,
        legPricingData.legPrices[index],
        itemsNetValueForLeg,
        fleetOwnerEarningForLeg,
      );

      booking.addLeg(leg);
    });
  }
}
