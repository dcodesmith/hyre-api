import { Booking } from "../../domain/entities/booking.entity";
import { BookingLeg } from "../../domain/entities/booking-leg.entity";

/**
 * DTO for booking leg serialization
 */
export interface BookingLegDto {
  id: string;
  bookingId: string | undefined;
  legDate: string; // ISO date string
  legStartTime: string; // ISO date string
  legEndTime: string; // ISO date string
  totalDailyPrice: number;
  itemsNetValueForLeg: number;
  fleetOwnerEarningForLeg: number;
  status: string; // "PENDING" | "ACTIVE" | "COMPLETED"
  notes?: string;
  durationInHours: number;
  isUpcoming: boolean;
}

/**
 * DTO for booking serialization
 */
export interface BookingDto {
  id: string;
  bookingReference: string;
  status: string; // "PENDING" | "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  bookingType: string; // "DAY" | "NIGHT" | "FULL_DAY"
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  pickupAddress: string;
  dropOffAddress: string;
  customerId: string;
  carId: string;
  chauffeurId?: string;
  specialRequests?: string;
  paymentStatus: string; // "UNPAID" | "PAID" | "REFUNDED"
  paymentIntent?: string;
  paymentId?: string;
  includeSecurityDetail: boolean;
  cancelledAt?: string; // ISO date string
  cancellationReason?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string

  // Financials
  totalAmount: number;
  netTotal: number;
  platformServiceFeeAmount: number;
  vatAmount: number;
  fleetOwnerPayoutAmountNet: number;
  securityDetailCost: number;

  // Legs
  legs: BookingLegDto[];
}

/**
 * Mapper to convert Booking entity to plain DTO for API responses
 */
export class BookingMapper {
  /**
   * Maps a Booking entity to a JSON-serializable DTO
   */
  static toDto(booking: Booking): BookingDto {
    const id = booking.getId();
    if (!id) {
      throw new Error("Cannot map booking without ID");
    }

    return {
      id,
      bookingReference: booking.getBookingReference(),
      status: booking.getStatus(), // Already returns string
      bookingType: booking.getBookingType(),
      startDate: booking.getStartDateTime().toISOString(),
      endDate: booking.getEndDateTime().toISOString(),
      pickupAddress: booking.getPickupAddress(),
      dropOffAddress: booking.getDropOffAddress(),
      customerId: booking.getCustomerId(),
      carId: booking.getCarId(),
      chauffeurId: booking.getChauffeurId(),
      specialRequests: booking.getSpecialRequests(),
      paymentStatus: booking.getPaymentStatus(), // Already returns string
      paymentIntent: booking.getPaymentIntent(),
      paymentId: booking.getPaymentId(),
      includeSecurityDetail: booking.getIncludeSecurityDetail(),
      cancelledAt: booking.getCancelledAt()?.toISOString(),
      cancellationReason: booking.getCancellationReason(),
      createdAt: booking.getCreatedAt().toISOString(),
      updatedAt: booking.getUpdatedAt().toISOString(),

      // Financials - already numbers from getters
      totalAmount: booking.getTotalAmount(),
      netTotal: booking.getNetTotal(),
      platformServiceFeeAmount: booking.getPlatformServiceFeeAmount(),
      vatAmount: booking.getVatAmount(),
      fleetOwnerPayoutAmountNet: booking.getFleetOwnerPayoutAmountNet(),
      securityDetailCost: booking.getSecurityDetailCost(),

      // Map legs
      legs: booking.getLegs().map((leg) => BookingMapper.toLegDto(leg)),
    };
  }

  /**
   * Maps a BookingLeg entity to a JSON-serializable DTO
   */
  static toLegDto(leg: BookingLeg): BookingLegDto {
    return {
      id: leg.getId(),
      bookingId: leg.getBookingId(),
      legDate: leg.getLegDate().toISOString(),
      legStartTime: leg.getLegStartTime().toISOString(),
      legEndTime: leg.getLegEndTime().toISOString(),
      totalDailyPrice: leg.getTotalDailyPrice(),
      itemsNetValueForLeg: leg.getItemsNetValueForLeg(),
      fleetOwnerEarningForLeg: leg.getFleetOwnerEarningForLeg(),
      status: leg.getStatus().value, // Extract string from value object
      notes: leg.getNotes(),
      durationInHours: leg.getDurationInHours(),
      isUpcoming: leg.isUpcoming(),
    };
  }

  /**
   * Maps a list of bookings to DTOs
   */
  static toDtoList(bookings: Booking[]): BookingDto[] {
    return bookings.map((booking) => BookingMapper.toDto(booking));
  }
}
