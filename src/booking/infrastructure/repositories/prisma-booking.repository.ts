import { Injectable } from "@nestjs/common";
import {
  Prisma,
  BookingStatus as PrismaBookingStatus,
  BookingLegStatus as PrismaBookingLegStatus,
  Status as PrismaCarStatus,
  PaymentStatus as PrismaPaymentStatus,
} from "@prisma/client";
import Decimal from "decimal.js";
import { PrismaService } from "../../../shared/database/prisma.service";
import { TransactionContext } from "../../../shared/database/transaction-context.type";
import { BookingLeg } from "../../domain/entities/booking-leg.entity";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingFinancials } from "../../domain/value-objects/booking-financials.vo";
import {
  BookingLegStatus,
  BookingLegStatusEnum,
} from "../../domain/value-objects/booking-leg-status.vo";
import { BookingPeriodFactory } from "../../domain/value-objects/booking-period.factory";
import { BookingStatus, BookingStatusEnum } from "../../domain/value-objects/booking-status.vo";
import { PaymentStatus } from "../../domain/value-objects/payment-status.vo";

@Injectable()
export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(booking: Booking): Promise<Booking> {
    const bookingId = booking.getId();

    // Get security detail cost from booking financials (already calculated during booking creation)
    const securityDetailCost = booking.getIncludeSecurityDetail()
      ? booking.getSecurityDetailCost()
      : undefined;

    const data: Prisma.BookingUncheckedCreateInput = {
      bookingReference: booking.getBookingReference(),
      status: booking.getStatus(),
      startDate: booking.getStartDateTime(),
      endDate: booking.getEndDateTime(),
      pickupLocation: booking.getPickupAddress(),
      returnLocation: booking.getDropOffAddress(),
      userId: booking.getCustomerId(),
      carId: booking.getCarId(),
      chauffeurId: booking.getChauffeurId(),
      specialRequests: booking.getSpecialRequests(),
      type: booking.getBookingType(),
      paymentStatus: booking.getPaymentStatus(),
      paymentIntent: booking.getPaymentIntent(),
      paymentId: booking.getPaymentId(),
      totalAmount: booking.getTotalAmount(),
      netTotal: booking.getNetTotal(),
      platformCustomerServiceFeeAmount: booking.getPlatformServiceFeeAmount(),
      vatAmount: booking.getVatAmount(),
      fleetOwnerPayoutAmountNet: booking.getFleetOwnerPayoutAmountNet(),
      securityDetailCost: securityDetailCost,
      cancelledAt: booking.getCancelledAt(),
      cancellationReason: booking.getCancellationReason(),
      updatedAt: new Date(),
    };

    if (bookingId) {
      // Update existing booking using unchecked API to avoid relation conflicts
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: data,
      });
      return booking;
    } else {
      // Create new booking with legs in a single transaction
      const savedBooking = await this.prisma.$transaction(async (tx) => {
        // Save booking first using unchecked API
        const savedBooking = await tx.booking.create({
          data,
        });

        // Save all legs with the booking ID
        const legs = booking.getLegs();
        for (const leg of legs) {
          await tx.bookingLeg.create({
            data: {
              bookingId: savedBooking.id,
              legDate: leg.getLegDate(),
              legStartTime: leg.getLegStartTime(),
              legEndTime: leg.getLegEndTime(),
              totalDailyPrice: leg.getTotalDailyPrice(),
              itemsNetValueForLeg: leg.getItemsNetValueForLeg(),
              fleetOwnerEarningForLeg: leg.getFleetOwnerEarningForLeg(),
              status: leg.getStatus().value,
              notes: leg.getNotes(),
            },
          });
        }

        return savedBooking;
      });

      // Return reconstituted booking with legs loaded from DB
      return this.findById(savedBooking.id);
    }
  }

  async saveWithTransaction(booking: Booking, tx: TransactionContext): Promise<Booking> {
    const bookingId = booking.getId();

    // Get security detail cost from booking financials (already calculated during booking creation)
    const securityDetailCost = booking.getIncludeSecurityDetail()
      ? booking.getSecurityDetailCost()
      : undefined;

    const data = {
      bookingReference: booking.getBookingReference(),
      status: booking.getStatus(),
      startDate: booking.getStartDateTime(),
      endDate: booking.getEndDateTime(),
      pickupLocation: booking.getPickupAddress(),
      returnLocation: booking.getDropOffAddress(),
      userId: booking.getCustomerId(),
      carId: booking.getCarId(),
      chauffeurId: booking.getChauffeurId(),
      specialRequests: booking.getSpecialRequests(),
      type: booking.getBookingType(),
      paymentStatus: booking.getPaymentStatus(),
      paymentIntent: booking.getPaymentIntent(),
      paymentId: booking.getPaymentId(),
      totalAmount: booking.getTotalAmount(),
      netTotal: booking.getNetTotal(),
      platformCustomerServiceFeeAmount: booking.getPlatformServiceFeeAmount(),
      vatAmount: booking.getVatAmount(),
      fleetOwnerPayoutAmountNet: booking.getFleetOwnerPayoutAmountNet(),
      securityDetailCost: securityDetailCost,
      cancelledAt: booking.getCancelledAt(),
      cancellationReason: booking.getCancellationReason(),
      updatedAt: new Date(),
    };

    if (bookingId) {
      // Update existing booking within transaction
      await tx.booking.update({
        where: { id: bookingId },
        data,
      });
      return booking;
    } else {
      // Create new booking within transaction
      const savedBooking = await tx.booking.create({
        data: {
          ...data,
          createdAt: booking.getCreatedAt(),
        },
      });

      // Save all legs with the booking ID within the same transaction
      const legs = booking.getLegs();
      for (const leg of legs) {
        // Check if leg already exists (has an ID) - update it, otherwise create
        if (leg.getId()) {
          await tx.bookingLeg.update({
            where: { id: leg.getId() },
            data: {
              status: leg.getStatus().value,
              notes: leg.getNotes(),
            },
          });
        } else {
          await tx.bookingLeg.create({
            data: {
              bookingId: savedBooking.id,
              legDate: leg.getLegDate(),
              legStartTime: leg.getLegStartTime(),
              legEndTime: leg.getLegEndTime(),
              totalDailyPrice: leg.getTotalDailyPrice(),
              itemsNetValueForLeg: leg.getItemsNetValueForLeg(),
              fleetOwnerEarningForLeg: leg.getFleetOwnerEarningForLeg(),
              status: leg.getStatus().value,
              notes: leg.getNotes(),
            },
          });
        }
      }

      // Load the persisted legs from the database within the transaction
      const persistedLegs = await tx.bookingLeg.findMany({
        where: { bookingId: savedBooking.id },
        include: { extensions: true },
      });

      const domainLegs = persistedLegs.map((leg) =>
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

      // Return reconstituted booking with legs loaded from the transaction
      return Booking.reconstitute({
        id: savedBooking.id,
        bookingReference: savedBooking.bookingReference,
        status: BookingStatus.create(savedBooking.status as BookingStatusEnum),
        bookingPeriod: BookingPeriodFactory.reconstitute(
          savedBooking.type,
          savedBooking.startDate,
          savedBooking.endDate,
        ),
        pickupAddress: savedBooking.pickupLocation || undefined,
        dropOffAddress: savedBooking.returnLocation,
        customerId: savedBooking.userId,
        carId: savedBooking.carId,
        chauffeurId: savedBooking.chauffeurId || undefined,
        specialRequests: savedBooking.specialRequests || undefined,
        legs: domainLegs,
        paymentStatus: PaymentStatus.create(savedBooking.paymentStatus),
        paymentIntent: savedBooking.paymentIntent || undefined,
        paymentId: savedBooking.paymentId || undefined,
        financials: this.createFinancialsFromPrisma(savedBooking),
        includeSecurityDetail: (savedBooking.securityDetailCost?.toNumber() ?? 0) > 0,
        cancelledAt: savedBooking.cancelledAt || undefined,
        cancellationReason: savedBooking.cancellationReason || undefined,
        createdAt: savedBooking.createdAt,
        updatedAt: savedBooking.updatedAt,
      });
    }
  }

  async findById(id: string): Promise<Booking | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return booking ? this.toDomain(booking) : null;
  }

  async findByReference(reference: string): Promise<Booking | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingReference: reference },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return booking ? this.toDomain(booking) : null;
  }

  async findAll(): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      include: {
        legs: {
          include: { extensions: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findByCustomerId(customerId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { userId: customerId },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findByFleetOwnerId(fleetOwnerId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        car: {
          ownerId: fleetOwnerId,
        },
      },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findByCarId(carId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { carId },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findByChauffeurId(chauffeurId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { chauffeurId },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findByStatus(status: BookingStatus): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { status: status.toString() },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findByStatusAndDateRange(
    status: BookingStatus,
    startDate: Date,
    endDate: Date,
  ): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: status.toString(),
        startDate: { gte: startDate },
        endDate: { lte: endDate },
      },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  private toDomain(
    prismaBooking: Prisma.BookingGetPayload<{
      include: {
        legs: true;
      };
    }>,
  ): Booking {
    const bookingPeriod = BookingPeriodFactory.reconstitute(
      prismaBooking.type,
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

  private createFinancialsFromPrisma(
    prismaBooking: Prisma.BookingGetPayload<Record<string, never>>,
  ): BookingFinancials {
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
}
