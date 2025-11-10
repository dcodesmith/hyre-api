import { Booking } from "../../domain/entities/booking.entity";

/**
 * Application-layer DTO for event handlers that need enriched booking data
 * This complex projection belongs in the application layer, not domain
 */
export interface BookingWithRelatedDataDto {
  booking: Booking;
  user: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string;
  } | null;
  car: {
    id: string;
    make: string;
    model: string;
    ownerId: string;
  };
  owner: {
    id: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    bankDetails: {
      bankCode: string;
      accountNumber: string;
      bankName: string;
      accountName: string;
      isVerified: boolean;
    } | null;
  };
}
