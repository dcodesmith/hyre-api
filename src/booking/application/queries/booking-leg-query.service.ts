import { Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import { PrismaService } from "../../../shared/database/prisma.service";
import { BookingLeg } from "../../domain/entities/booking-leg.entity";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingType } from "../../domain/interfaces/booking.interface";
import { BookingFinancials } from "../../domain/value-objects/booking-financials.vo";
import { BookingPeriodFactory } from "../../domain/value-objects/booking-period.factory";
import {
  BookingLegStatus,
  BookingLegStatusEnum,
} from "../../domain/value-objects/booking-leg-status.vo";
import { BookingStatus, BookingStatusEnum } from "../../domain/value-objects/booking-status.vo";
import { PaymentStatus } from "../../domain/value-objects/payment-status.vo";
import { BookingLegNotificationReadModel } from "../dtos/booking-leg-notification-read-model.dto";
import { BookingReminderReadModel } from "../dtos/booking-reminder-read-model.dto";

/**
 * Booking Leg Query Service
 *
 * WHY THIS EXISTS AS A SEPARATE SERVICE:
 *
 * 1. SINGLE RESPONSIBILITY PRINCIPLE:
 *    - BookingQueryService handles user-facing queries with authorization
 *    - This service handles system-facing LEG-BASED queries for background jobs
 *    - Different consumers, different concerns, different services
 *
 * 2. CLEAR SEPARATION OF CONCERNS:
 *    - User queries (BookingQueryService): Return domain entities, require authorization
 *    - System queries (This service): Return read models/DTOs or booking IDs, no authorization needed
 *    - Mixing these in one service violates SRP and creates confusion
 *
 * 3. DEPENDENCY MANAGEMENT:
 *    - BookingQueryService needs: BookingRepository, CarRepository, BookingAuthorizationService
 *    - This service needs: PrismaService only
 *    - Each service has minimal, focused dependencies
 *
 * 4. CQRS PATTERN:
 *    - Domain repositories (BookingRepository) work with domain entities for write operations
 *    - Query services (this) work with read models (DTOs) optimized for specific views
 *    - Separates command models from query models at the service level
 *
 * 5. PERFORMANCE OPTIMIZATION:
 *    - These queries are optimized for leg-based operations (reminders + status changes)
 *    - Single query with all relations included (no N+1 problem)
 *    - Returns denormalized data (DTOs) or booking IDs ready for use
 *
 * 6. TESTABILITY:
 *    - Can test leg-based queries independently from user queries
 *    - Can mock this service in application service tests
 *    - Clear, focused unit of testing
 *
 * SCOPE: This service handles ALL leg-based queries for background jobs:
 * - Reminder notifications (1 hour before leg start/end)
 * - Status changes (minute-precision at leg start/end)
 */
@Injectable()
export class BookingLegQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find booking legs eligible for start reminders with all notification data
   *
   * IMPORTANT: Reminders are LEG-BASED, not booking-based
   * - Each booking can have multiple legs (multi-day bookings)
   * - Reminders are sent 1 HOUR before each leg starts
   * - This ensures customers/chauffeurs are reminded for each day's journey
   *
   * Note: BookingLeg doesn't have its own location/status fields,
   * so we use the parent booking's data combined with leg timing.
   *
   * Performance: 1 query with nested includes instead of N+1 queries
   */
  async findEligibleLegsForStartRemindersWithData(): Promise<BookingReminderReadModel[]> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const legs = await this.prisma.bookingLeg.findMany({
      where: {
        legStartTime: {
          gte: now,
          lte: oneHourFromNow,
        },
        booking: {
          status: "CONFIRMED",
        },
      },
      include: {
        booking: {
          include: {
            user: true,
            chauffeur: true,
            car: true,
          },
        },
      },
    });

    return legs.map((leg) => ({
      // Booking core data
      bookingId: leg.booking.id,
      bookingReference: leg.booking.bookingReference,
      startDate: leg.booking.startDate,
      endDate: leg.booking.endDate,
      pickupLocation: leg.booking.pickupLocation,
      returnLocation: leg.booking.returnLocation,

      // Customer data
      customerId: leg.booking.user?.id ?? leg.booking.userId ?? "",
      customerEmail: leg.booking.user?.email ?? "",
      customerName: leg.booking.user?.name ?? "Customer",
      customerPhone: leg.booking.user?.phoneNumber ?? null,

      // Chauffeur data
      chauffeurId: leg.booking.chauffeur?.id ?? null,
      chauffeurEmail: leg.booking.chauffeur?.email ?? null,
      chauffeurName: leg.booking.chauffeur?.name ?? null,
      chauffeurPhone: leg.booking.chauffeur?.phoneNumber ?? null,

      // Car data
      carId: leg.booking.car.id,
      carName: `${leg.booking.car.make} ${leg.booking.car.model}`,

      // Leg-specific data (timing from leg, location from booking)
      legId: leg.id,
      legStartDate: leg.legStartTime,
      legEndDate: leg.legEndTime,
      legPickupLocation: leg.booking.pickupLocation,
      legReturnLocation: leg.booking.returnLocation,
    }));
  }

  /**
   * Find booking legs eligible for end reminders with all notification data
   *
   * IMPORTANT: Reminders are LEG-BASED, not booking-based
   * - Reminders are sent 1 HOUR before each leg ends
   * - This allows customers/chauffeurs to prepare for leg completion
   *
   * Performance: 1 query with nested includes instead of N+1 queries
   */
  async findEligibleLegsForEndRemindersWithData(): Promise<BookingReminderReadModel[]> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const legs = await this.prisma.bookingLeg.findMany({
      where: {
        legEndTime: {
          gte: now,
          lte: oneHourFromNow,
        },
        booking: {
          status: "ACTIVE",
        },
      },
      include: {
        booking: {
          include: {
            user: true,
            chauffeur: true,
            car: true,
          },
        },
      },
    });

    return legs.map((leg) => ({
      // Booking core data
      bookingId: leg.booking.id,
      bookingReference: leg.booking.bookingReference,
      startDate: leg.booking.startDate,
      endDate: leg.booking.endDate,
      pickupLocation: leg.booking.pickupLocation,
      returnLocation: leg.booking.returnLocation,

      // Customer data
      customerId: leg.booking.user?.id ?? leg.booking.userId ?? "",
      customerEmail: leg.booking.user?.email ?? "",
      customerName: leg.booking.user?.name ?? "Customer",
      customerPhone: leg.booking.user?.phoneNumber ?? null,

      // Chauffeur data
      chauffeurId: leg.booking.chauffeur?.id ?? null,
      chauffeurEmail: leg.booking.chauffeur?.email ?? null,
      chauffeurName: leg.booking.chauffeur?.name ?? null,
      chauffeurPhone: leg.booking.chauffeur?.phoneNumber ?? null,

      // Car data
      carId: leg.booking.car.id,
      carName: `${leg.booking.car.make} ${leg.booking.car.model}`,

      // Leg-specific data (timing from leg, location from booking)
      legId: leg.id,
      legStartDate: leg.legStartTime,
      legEndDate: leg.legEndTime,
      legPickupLocation: leg.booking.pickupLocation,
      legReturnLocation: leg.booking.returnLocation,
    }));
  }

  /**
   * Convert Prisma booking data to domain Booking entity
   * Shared helper method used by status change queries and lifecycle service
   * PUBLIC: Used by BookingLifecycleService to reconstitute entities from embedded data
   */
  public toDomain(prismaBooking: {
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
    legs: Array<{
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
    }>;
  }): Booking {
    const bookingPeriod = BookingPeriodFactory.reconstitute(
      prismaBooking.type as BookingType,
      prismaBooking.startDate,
      prismaBooking.endDate,
    );

    const legs = prismaBooking.legs.map((leg) =>
      BookingLeg.reconstitute({
        id: leg.id,
        bookingId: leg.bookingId,
        legDate: leg.legDate,
        legStartTime: leg.legStartTime,
        legEndTime: leg.legEndTime,
        totalDailyPrice: leg.totalDailyPrice.toNumber(),
        itemsNetValueForLeg: leg.itemsNetValueForLeg.toNumber(),
        fleetOwnerEarningForLeg: leg.fleetOwnerEarningForLeg.toNumber(),
        status: BookingLegStatus.create(leg.status as BookingLegStatusEnum),
        notes: leg.notes,
      }),
    );

    return Booking.reconstitute({
      id: prismaBooking.id,
      bookingReference: prismaBooking.bookingReference,
      status: BookingStatus.create(prismaBooking.status as BookingStatusEnum),
      bookingPeriod,
      pickupAddress: prismaBooking.pickupLocation,
      dropOffAddress: prismaBooking.returnLocation,
      customerId: prismaBooking.userId,
      carId: prismaBooking.carId,
      chauffeurId: prismaBooking.chauffeurId || undefined,
      specialRequests: prismaBooking.specialRequests,
      legs,
      paymentStatus: PaymentStatus.create(prismaBooking.paymentStatus),
      paymentIntent: prismaBooking.paymentIntent,
      paymentId: prismaBooking.paymentId,
      financials: this.createFinancialsFromPrisma(prismaBooking),
      includeSecurityDetail: (prismaBooking.securityDetailCost?.toNumber() ?? 0) > 0,
      cancelledAt: prismaBooking.cancelledAt,
      cancellationReason: prismaBooking.cancellationReason,
      createdAt: prismaBooking.createdAt,
      updatedAt: prismaBooking.updatedAt,
    });
  }

  /**
   * Create BookingFinancials value object from Prisma data
   */
  private createFinancialsFromPrisma(prismaBooking: {
    id: string;
    totalAmount: Decimal;
    netTotal: Decimal;
    platformCustomerServiceFeeAmount: Decimal;
    vatAmount: Decimal;
    fleetOwnerPayoutAmountNet: Decimal;
    securityDetailCost: Decimal | null;
  }): BookingFinancials {
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
   * Find booking legs that are starting (for sending notifications)
   *
   * IMPORTANT: Returns ALL legs that start, not just unique bookings
   * - Each leg start sends a notification (multi-day bookings get multiple notifications)
   * - Queries legs where legStartTime falls within current minute
   * - Includes user, chauffeur, and car data in single query (no N+1)
   * - Returns one DTO per leg (NOT deduplicated)
   * - DTO contains ALL data needed for leg start notifications
   */
  async findStartingLegsForNotification(): Promise<BookingLegNotificationReadModel[]> {
    const now = new Date();
    // Create minute-precision window: 09:00:00.000 to 09:00:59.999
    const minuteStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      0,
      0,
    );
    const minuteEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      59,
      999,
    );

    const legs = await this.prisma.bookingLeg.findMany({
      where: {
        status: "PENDING", // Only pending legs that need activation
        legStartTime: {
          gte: minuteStart,
          lte: minuteEnd,
        },
        booking: {
          status: { in: ["CONFIRMED", "ACTIVE"] }, // Allow both - subsequent legs are ACTIVE
          paymentStatus: "PAID",
          chauffeurId: { not: null },
          car: { status: "BOOKED" },
        },
      },
      include: {
        booking: {
          include: {
            user: true,
            chauffeur: true,
            car: true,
            legs: true, // Include all legs for domain entity reconstitution
          },
        },
      },
    });

    // Map ALL legs to DTOs (no deduplication - one notification per leg)
    return legs.map((leg: any) => ({
      // Booking identifiers
      bookingId: leg.booking.id,
      bookingReference: leg.booking.bookingReference,

      // Customer data
      customerId: leg.booking.user?.id ?? leg.booking.userId,
      customerEmail: leg.booking.user?.email ?? "",
      customerName: leg.booking.user?.name ?? "Customer",
      customerPhone: leg.booking.user?.phoneNumber ?? null,

      // Chauffeur data
      chauffeurId: leg.booking.chauffeur?.id ?? null,
      chauffeurEmail: leg.booking.chauffeur?.email ?? null,
      chauffeurName: leg.booking.chauffeur?.name ?? null,
      chauffeurPhone: leg.booking.chauffeur?.phoneNumber ?? null,

      // Car data
      carId: leg.booking.car.id,
      carName: `${leg.booking.car.make} ${leg.booking.car.model}`,

      // Booking details
      startDate: leg.booking.startDate,
      endDate: leg.booking.endDate,
      pickupLocation: leg.booking.pickupLocation ?? "",
      returnLocation: leg.booking.returnLocation,

      // Leg-specific details (the specific leg that started)
      legId: leg.id,
      legStartDate: leg.legStartTime,
      legEndDate: leg.legEndTime,
      legPickupLocation: leg.booking.pickupLocation ?? "",
      legReturnLocation: leg.booking.returnLocation,

      // Full booking data for reconstitution (avoid second DB call)
      bookingData: leg.booking,
    }));
  }

  /**
   * Find booking legs that are ending (for sending notifications)
   *
   * IMPORTANT: Returns ALL legs that end, not just unique bookings
   * - Each leg end sends a notification (multi-day bookings get multiple notifications)
   * - Queries legs where legEndTime falls within current minute
   * - Includes user, chauffeur, and car data in single query (no N+1)
   * - Returns one DTO per leg (NOT deduplicated)
   * - DTO contains ALL data needed for leg end notifications
   */
  async findEndingLegsForNotification(): Promise<BookingLegNotificationReadModel[]> {
    const now = new Date();
    // Create minute-precision window: 18:00:00.000 to 18:00:59.999
    const minuteStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      0,
      0,
    );
    const minuteEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      59,
      999,
    );

    const legs = await this.prisma.bookingLeg.findMany({
      where: {
        status: "ACTIVE", // Only active legs that need completion
        legEndTime: {
          gte: minuteStart,
          lte: minuteEnd,
        },
        booking: {
          status: { in: ["ACTIVE", "COMPLETED"] }, // Allow both - booking may complete before all leg notifications sent
          paymentStatus: "PAID",
          car: { status: "BOOKED" },
        },
      },
      include: {
        booking: {
          include: {
            user: true,
            chauffeur: true,
            car: true,
            legs: true, // Include all legs for domain entity reconstitution
          },
        },
      },
    });

    // Map ALL legs to DTOs (no deduplication - one notification per leg)
    return legs.map((leg: any) => ({
      // Booking identifiers
      bookingId: leg.booking.id,
      bookingReference: leg.booking.bookingReference,

      // Customer data
      customerId: leg.booking.user?.id ?? leg.booking.userId,
      customerEmail: leg.booking.user?.email ?? "",
      customerName: leg.booking.user?.name ?? "Customer",
      customerPhone: leg.booking.user?.phoneNumber ?? null,

      // Chauffeur data
      chauffeurId: leg.booking.chauffeur?.id ?? null,
      chauffeurEmail: leg.booking.chauffeur?.email ?? null,
      chauffeurName: leg.booking.chauffeur?.name ?? null,
      chauffeurPhone: leg.booking.chauffeur?.phoneNumber ?? null,

      // Car data
      carId: leg.booking.car.id,
      carName: `${leg.booking.car.make} ${leg.booking.car.model}`,

      // Booking details
      startDate: leg.booking.startDate,
      endDate: leg.booking.endDate,
      pickupLocation: leg.booking.pickupLocation ?? "",
      returnLocation: leg.booking.returnLocation,

      // Leg-specific details (the specific leg that ended)
      legId: leg.id,
      legStartDate: leg.legStartTime,
      legEndDate: leg.legEndTime,
      legPickupLocation: leg.booking.pickupLocation ?? "",
      legReturnLocation: leg.booking.returnLocation,

      // Full booking data for reconstitution (avoid second DB call)
      bookingData: leg.booking,
    }));
  }
}
