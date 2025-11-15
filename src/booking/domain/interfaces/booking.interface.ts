import { Booking } from "../entities/booking.entity";

export interface CreateBookingRequest {
  customerId: string;
  carId: string;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  returnLocation: string;
  bookingType: string;
  includeSecurityDetail?: boolean;
  specialRequests?: string;
  paymentIntentId?: string;
}

export interface CreateBookingResponse {
  booking: Booking;
  totalAmount: number;
  netTotal: number;
  fleetOwnerPayoutAmountNet: number;
  // Payment information
  checkoutUrl?: string;
  paymentIntentId?: string;
  // Cost breakdown
  breakdown?: {
    netTotal: number;
    platformServiceFee: number;
    vat: number;
    totalAmount: number;
  };
}

export type BookingType = "DAY" | "NIGHT" | "FULL_DAY";
