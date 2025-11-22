import type { Extension } from "@prisma/client";
import Decimal from "decimal.js";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingLeg } from "../../domain/entities/booking-leg.entity";
import { BookingType } from "../../domain/interfaces/booking.interface";
import { BookingFinancials } from "../../domain/value-objects/booking-financials.vo";
import {
  BookingLegStatus,
  BookingLegStatusEnum,
} from "../../domain/value-objects/booking-leg-status.vo";
import { BookingPeriodFactory } from "../../domain/value-objects/booking-period.factory";
import { BookingStatus, BookingStatusEnum } from "../../domain/value-objects/booking-status.vo";
import { PaymentStatus } from "../../domain/value-objects/payment-status.vo";

/**
 * Prisma leg data structure for domain reconstitution
 */
export interface PrismaLegData {
  id: string;
  bookingId: string;
  legDate: Date;
  legStartTime: Date;
  legEndTime: Date;
  totalDailyPrice: Decimal;
  itemsNetValueForLeg: Decimal;
  fleetOwnerEarningForLeg: Decimal;
  status: string;
  notes: string | null;
  extensions?: Extension[];
}

/**
 * Prisma booking data structure for domain reconstitution
 * Supports both full Prisma.BookingGetPayload and explicit interface shapes
 */
export interface PrismaBookingData {
  id: string;
  bookingReference: string;
  status: string;
  type: string;
  startDate: Date;
  endDate: Date;
  pickupLocation: string | null;
  returnLocation: string;
  userId: string;
  carId: string;
  chauffeurId: string | null;
  specialRequests: string | null;
  paymentStatus: string;
  paymentIntent: string | null;
  paymentId: string | null;
  totalAmount: Decimal;
  netTotal: Decimal;
  platformCustomerServiceFeeAmount: Decimal;
  vatAmount: Decimal;
  fleetOwnerPayoutAmountNet: Decimal;
  securityDetailCost: Decimal | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  legs: PrismaLegData[];
}

/**
 * Prisma financial fields for booking
 */
export interface PrismaBookingFinancialsData {
  id: string;
  totalAmount: Decimal;
  netTotal: Decimal | null;
  platformCustomerServiceFeeAmount: Decimal | null;
  vatAmount: Decimal | null;
  fleetOwnerPayoutAmountNet: Decimal | null;
  securityDetailCost: Decimal | null;
}

/**
 * Centralized mapper for converting Prisma booking data to domain entities.
 * This ensures consistent reconstitution logic across repository and query services.
 */
export const BookingPrismaMapper = {
  toDomain,
  mapLegToDomain,
  createFinancialsFromPrisma,
};

function toDomain(prismaBooking: PrismaBookingData): Booking {
  const bookingPeriod = BookingPeriodFactory.reconstitute(
    prismaBooking.type as BookingType,
    prismaBooking.startDate,
    prismaBooking.endDate,
  );

  const legs = prismaBooking.legs.map((leg) => mapLegToDomain(leg));
  const pickupAddress = toOptional(prismaBooking.pickupLocation);
  const chauffeurId = toOptional(prismaBooking.chauffeurId);
  const specialRequests = toOptional(prismaBooking.specialRequests);
  const paymentIntent = toOptional(prismaBooking.paymentIntent);
  const paymentId = toOptional(prismaBooking.paymentId);
  const cancelledAt = toOptional(prismaBooking.cancelledAt);
  const cancellationReason = toOptional(prismaBooking.cancellationReason);

  return Booking.reconstitute({
    id: prismaBooking.id,
    bookingReference: prismaBooking.bookingReference,
    status: BookingStatus.create(prismaBooking.status as BookingStatusEnum),
    bookingPeriod,
    pickupAddress,
    dropOffAddress: prismaBooking.returnLocation,
    customerId: prismaBooking.userId,
    carId: prismaBooking.carId,
    chauffeurId,
    specialRequests,
    legs,
    paymentStatus: PaymentStatus.create(prismaBooking.paymentStatus),
    paymentIntent,
    paymentId,
    financials: createFinancialsFromPrisma(prismaBooking),
    includeSecurityDetail: (prismaBooking.securityDetailCost?.toNumber() ?? 0) > 0,
    cancelledAt,
    cancellationReason,
    createdAt: prismaBooking.createdAt,
    updatedAt: prismaBooking.updatedAt,
  });
}

/**
 * Convert Prisma leg data to domain BookingLeg entity
 */
function mapLegToDomain(leg: PrismaLegData): BookingLeg {
  return BookingLeg.reconstitute({
    id: leg.id,
    bookingId: leg.bookingId,
    legDate: leg.legDate,
    legStartTime: leg.legStartTime,
    legEndTime: leg.legEndTime,
    totalDailyPrice: leg.totalDailyPrice.toNumber(),
    itemsNetValueForLeg: leg.itemsNetValueForLeg.toNumber(),
    fleetOwnerEarningForLeg: leg.fleetOwnerEarningForLeg.toNumber(),
    status: BookingLegStatus.create(leg.status as BookingLegStatusEnum),
    notes: toOptional(leg.notes),
  });
}

/**
 * Create BookingFinancials value object from Prisma data
 * @throws Error if required financial fields are missing
 */
function createFinancialsFromPrisma(prismaBooking: PrismaBookingFinancialsData): BookingFinancials {
  if (
    prismaBooking.totalAmount === null ||
    prismaBooking.netTotal === null ||
    prismaBooking.platformCustomerServiceFeeAmount === null ||
    prismaBooking.vatAmount === null ||
    prismaBooking.fleetOwnerPayoutAmountNet === null
  ) {
    throw new Error(
      `Booking ${prismaBooking.id} has incomplete financial data. All financial fields must be present.`,
    );
  }

  return BookingFinancials.create({
    totalAmount: prismaBooking.totalAmount,
    netTotal: prismaBooking.netTotal,
    securityDetailCost: prismaBooking.securityDetailCost ?? new Decimal(0),
    platformServiceFeeAmount: prismaBooking.platformCustomerServiceFeeAmount,
    vatAmount: prismaBooking.vatAmount,
    fleetOwnerPayoutAmountNet: prismaBooking.fleetOwnerPayoutAmountNet,
  });
}

/**
 * Normalize nullable database values to undefined for domain props
 */
function toOptional<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}
