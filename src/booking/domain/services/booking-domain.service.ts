import { Injectable } from "@nestjs/common";
import { addDays, setHours } from "date-fns";
import { Booking } from "../entities/booking.entity";
import { BookingLeg } from "../entities/booking-leg.entity";
import {
  BookingCannotBeActivatedError,
  BookingCannotBeCancelledError,
  BookingCannotBeCompletedError,
} from "../errors/booking.errors";
import { BookingFinancials } from "../value-objects/booking-financials.vo";
import type { BookingPeriod } from "../value-objects/booking-period.vo";
import { BookingCostCalculation } from "./booking-cost-calculator.service";
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
 * Domain command for creating a booking with precalculated data - pure domain concept
 */
export interface CreateBookingCommand {
  customerId: string;
  carId: string;
  bookingPeriod: BookingPeriod;
  pickupAddress: string;
  dropOffAddress: string;
  includeSecurityDetail?: boolean;
  specialRequests?: string;
  precalculatedCosts: BookingCostCalculation;
  precalculatedBookingDates: Date[];
}

@Injectable()
export class BookingDomainService {
  private static readonly ERROR_MESSAGES = {
    ACTIVATION_NOT_ALLOWED: "Activation not allowed",
    COMPLETION_NOT_ALLOWED: "Completion not allowed",
  } as const;

  constructor(private readonly bookingEligibilityService: BookingEligibilityService) {}

  createBooking(command: CreateBookingCommand): Booking {
    const {
      customerId,
      carId,
      bookingPeriod,
      includeSecurityDetail,
      specialRequests,
      pickupAddress,
      dropOffAddress,
      precalculatedCosts,
      precalculatedBookingDates,
    } = command;

    // Create financials value object from precalculated costs
    const financials = BookingFinancials.create({
      totalAmount: precalculatedCosts.totalAmount,
      netTotal: precalculatedCosts.netTotal,
      securityDetailCost: precalculatedCosts.securityDetailCost,
      platformServiceFeeAmount: precalculatedCosts.platformCustomerServiceFeeAmount,
      vatAmount: precalculatedCosts.vatAmount,
      fleetOwnerPayoutAmountNet: precalculatedCosts.fleetOwnerPayoutAmountNet,
    });

    // Create booking entity with precalculated financials
    const booking = Booking.create({
      customerId,
      carId,
      bookingPeriod,
      pickupAddress,
      dropOffAddress,
      financials,
      includeSecurityDetail,
      specialRequests,
    });

    // Create leg pricing data from precalculated costs
    const legPricingData: LegPricingData = {
      legPrices: precalculatedCosts.legPrices,
      startHours: bookingPeriod.startDateTime.getHours(),
      endHours: bookingPeriod.endDateTime.getHours(),
    };

    // Create booking legs using precalculated dates and pricing data
    this.createBookingLegs(booking, precalculatedBookingDates, legPricingData, precalculatedCosts);

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
    // Sanity check: legPrices should match number of booking dates
    if (legPricingData.legPrices.length !== bookingDates.length) {
      throw new Error(
        `Leg price count (${legPricingData.legPrices.length}) does not match booking dates (${bookingDates.length})`,
      );
    }

    bookingDates.forEach((legDate, index) => {
      const itemsNetValueForLeg = costCalculation.netTotal.mul(1 / bookingDates.length).toNumber();

      // Calculate fleet owner earning for this leg
      const fleetOwnerEarningForLeg = costCalculation.fleetOwnerPayoutAmountNet
        .mul(1 / bookingDates.length)
        .toNumber();

      // Calculate leg start and end times using the provided hours
      const legStartTime = setHours(legDate, legPricingData.startHours);
      const legEndTime =
        legPricingData.endHours <= legPricingData.startHours
          ? setHours(addDays(legDate, 1), legPricingData.endHours) // If end time is less than or equal to start time, it's on the next day
          : setHours(legDate, legPricingData.endHours);

      // Create leg without any IDs - they will be set during persistence
      const leg = BookingLeg.create({
        legDate,
        legStartTime,
        legEndTime,
        totalDailyPrice: legPricingData.legPrices[index],
        itemsNetValueForLeg,
        fleetOwnerEarningForLeg,
      });

      booking.addLeg(leg);
    });
  }
}
