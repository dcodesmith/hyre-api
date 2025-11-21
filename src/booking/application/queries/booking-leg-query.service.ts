import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { PrismaService } from "../../../shared/database/prisma.service";
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
import { BookingLegNotificationReadModel } from "../dtos/booking-leg-notification-read-model.dto";
import { BookingReminderReadModel } from "../dtos/booking-reminder-read-model.dto";

// Prisma payload type for leg queries with booking relations
type LegWithBookingRelations = Prisma.BookingLegGetPayload<{
  include: {
    booking: {
      include: {
        user: true;
        chauffeur: true;
        car: true;
      };
    };
  };
}>;

@Injectable()
export class BookingLegQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Map leg with booking relations to read model
   * Shared mapper for both reminder and notification DTOs
   */
  private mapLegToReadModel(leg: LegWithBookingRelations) {
    return {
      bookingId: leg.booking.id,
      bookingReference: leg.booking.bookingReference,
      startDate: leg.booking.startDate,
      endDate: leg.booking.endDate,
      pickupLocation: leg.booking.pickupLocation ?? "",
      returnLocation: leg.booking.returnLocation,
      customerId: leg.booking.user?.id ?? leg.booking.userId ?? "",
      customerEmail: leg.booking.user?.email ?? "",
      customerName: leg.booking.user?.name ?? "Customer",
      customerPhone: leg.booking.user?.phoneNumber ?? null,
      chauffeurId: leg.booking.chauffeur?.id ?? null,
      chauffeurEmail: leg.booking.chauffeur?.email ?? null,
      chauffeurName: leg.booking.chauffeur?.name ?? null,
      chauffeurPhone: leg.booking.chauffeur?.phoneNumber ?? null,
      carId: leg.booking.car.id,
      carName: `${leg.booking.car.make} ${leg.booking.car.model}`,
      legId: leg.id,
      legStartDate: leg.legStartTime,
      legEndDate: leg.legEndTime,
      legPickupLocation: leg.booking.pickupLocation ?? "",
      legReturnLocation: leg.booking.returnLocation,
    };
  }

  private mapToReminderReadModel(leg: LegWithBookingRelations): BookingReminderReadModel {
    return this.mapLegToReadModel(leg);
  }

  private mapToNotificationReadModel(
    leg: LegWithBookingRelations,
  ): BookingLegNotificationReadModel {
    const base = this.mapLegToReadModel(leg);
    return {
      ...base,
      bookingStatus: leg.booking.status,
      bookingStartDate: leg.booking.startDate,
      bookingEndDate: leg.booking.endDate,
    };
  }

  /**
   * Create minute-precision time window for queries
   */
  private createMinuteWindow(): { start: Date; end: Date } {
    const now = new Date();
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        0,
        0,
      ),
      end: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        59,
        999,
      ),
    };
  }

  /**
   * Create minute-precision window for reminder queries (1 hour from now)
   *
   * Example: If called at 9:00 AM, returns window for 10:00:00.000 - 10:00:59.999
   * This ensures each leg is only picked up once for reminders.
   */
  private createReminderWindow(): { start: Date; end: Date } {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    return {
      start: new Date(
        oneHourFromNow.getFullYear(),
        oneHourFromNow.getMonth(),
        oneHourFromNow.getDate(),
        oneHourFromNow.getHours(),
        oneHourFromNow.getMinutes(),
        0,
        0,
      ),
      end: new Date(
        oneHourFromNow.getFullYear(),
        oneHourFromNow.getMonth(),
        oneHourFromNow.getDate(),
        oneHourFromNow.getHours(),
        oneHourFromNow.getMinutes(),
        59,
        999,
      ),
    };
  }

  async findEligibleLegsForStartRemindersWithData(): Promise<BookingReminderReadModel[]> {
    const { start, end } = this.createReminderWindow();

    const legs = await this.prisma.bookingLeg.findMany({
      where: {
        legStartTime: {
          gte: start,
          lte: end,
        },
        booking: {
          status: BookingStatusEnum.CONFIRMED,
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

    return legs.map((leg) => this.mapToReminderReadModel(leg));
  }

  async findEligibleLegsForEndRemindersWithData(): Promise<BookingReminderReadModel[]> {
    const { start, end } = this.createReminderWindow();

    const legs = await this.prisma.bookingLeg.findMany({
      where: {
        legEndTime: {
          gte: start,
          lte: end,
        },
        booking: {
          status: BookingStatusEnum.ACTIVE,
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

    return legs.map((leg) => this.mapToReminderReadModel(leg));
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

  async findStartingLegsForNotification(): Promise<BookingLegNotificationReadModel[]> {
    const { start: minuteStart, end: minuteEnd } = this.createMinuteWindow();

    const legs = await this.prisma.bookingLeg.findMany({
      where: {
        status: "CONFIRMED", // Only confirmed legs that need activation
        legStartTime: {
          gte: minuteStart,
          lte: minuteEnd,
        },
        booking: {
          status: { in: [BookingStatusEnum.CONFIRMED, BookingStatusEnum.ACTIVE] }, // Allow both - subsequent legs are ACTIVE
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
    return legs.map((leg) => this.mapToNotificationReadModel(leg));
  }

  async findEndingLegsForNotification(): Promise<BookingLegNotificationReadModel[]> {
    const { start: minuteStart, end: minuteEnd } = this.createMinuteWindow();

    const legs = await this.prisma.bookingLeg.findMany({
      where: {
        status: "ACTIVE", // Only active legs that need completion
        legEndTime: {
          gte: minuteStart,
          lte: minuteEnd,
        },
        booking: {
          status: { in: [BookingStatusEnum.ACTIVE, BookingStatusEnum.COMPLETED] }, // Allow both - booking may complete before all leg notifications sent
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

    return legs.map((leg) => this.mapToNotificationReadModel(leg));
  }
}
