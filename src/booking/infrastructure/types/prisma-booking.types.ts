import type { Booking, BookingLeg } from "@prisma/client";
import { Decimal } from "decimal.js";

// Type for Prisma booking with all relations loaded
export interface PrismaBookingWithRelations extends Booking {
  legs: (BookingLeg & {
    extensions?: any[];
  })[];
}

// Type for the essential financial fields from Prisma
export interface PrismaBookingFinancials {
  id: string;
  totalAmount: Decimal | null;
  netTotal: Decimal | null;
  platformCustomerServiceFeeAmount: Decimal | null;
  vatAmount: Decimal | null;
  fleetOwnerPayoutAmountNet: Decimal | null;
}

// Type for validated booking with complete financial data
export type PrismaBookingWithCompleteFinancials = PrismaBookingFinancials & {
  totalAmount: Decimal;
  netTotal: Decimal;
  platformCustomerServiceFeeAmount: Decimal;
  vatAmount: Decimal;
  fleetOwnerPayoutAmountNet: Decimal;
};

// Type guard to check if booking has complete financial data
export function hasCompleteFinancialData(
  booking: PrismaBookingFinancials,
): booking is PrismaBookingWithCompleteFinancials {
  return !!(
    booking.totalAmount &&
    booking.netTotal &&
    booking.platformCustomerServiceFeeAmount &&
    booking.vatAmount &&
    booking.fleetOwnerPayoutAmountNet
  );
}

// Helper to get missing financial field names
export function getMissingFinancialFields(booking: PrismaBookingFinancials): string[] {
  const fields = [
    { name: "totalAmount", value: booking.totalAmount },
    { name: "netTotal", value: booking.netTotal },
    { name: "platformServiceFeeAmount", value: booking.platformCustomerServiceFeeAmount },
    { name: "vatAmount", value: booking.vatAmount },
    { name: "fleetOwnerPayoutAmountNet", value: booking.fleetOwnerPayoutAmountNet },
  ];

  return fields.filter((field) => !field.value).map((field) => field.name);
}
