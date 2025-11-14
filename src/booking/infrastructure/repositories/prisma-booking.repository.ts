import { Injectable } from "@nestjs/common";
import {
  Prisma,
  BookingStatus as PrismaBookingStatus,
  BookingType as PrismaBookingType,
  PaymentStatus as PrismaPaymentStatus,
} from "@prisma/client";
import { TransactionContext } from "../../../shared/database/transaction-context.type";
import { PrismaService } from "../../../shared/database/prisma.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingLeg } from "../../domain/entities/booking-leg.entity";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingFinancials } from "../../domain/value-objects/booking-financials.vo";
import { BookingStatus, BookingStatusEnum } from "../../domain/value-objects/booking-status.vo";
import { BookingType } from "../../domain/value-objects/booking-type.vo";
import { DateRange } from "../../domain/value-objects/date-range.vo";
import { PaymentStatus } from "../../domain/value-objects/payment-status.vo";

@Injectable()
export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(booking: Booking): Promise<Booking> {
    const bookingId = booking.getId();
    const data = {
      bookingReference: booking.getBookingReference(),
      status: booking.getStatus().value as PrismaBookingStatus,
      startDate: booking.getDateRange().startDate,
      endDate: booking.getDateRange().endDate,
      pickupLocation: booking.getPickupAddress(),
      returnLocation: booking.getDropOffAddress(),
      userId: booking.getCustomerId(),
      carId: booking.getCarId(),
      chauffeurId: booking.getChauffeurId(),
      specialRequests: booking.getSpecialRequests(),
      type: booking.getBookingType().value as PrismaBookingType,
      paymentStatus: booking.getPaymentStatus().toString() as PrismaPaymentStatus,
      paymentIntent: booking.getPaymentIntent(),
      paymentId: booking.getPaymentId(),
      totalAmount: booking.getTotalAmount(),
      netTotal: booking.getNetTotal(),
      platformCustomerServiceFeeAmount: booking.getPlatformServiceFeeAmount(),
      vatAmount: booking.getVatAmount(),
      fleetOwnerPayoutAmountNet: booking.getFleetOwnerPayoutAmountNet(),
      securityDetailCost: booking.getIncludeSecurityDetail() ? 0 : undefined,
      cancelledAt: booking.getCancelledAt(),
      cancellationReason: booking.getCancellationReason(),
      updatedAt: new Date(),
    };

    if (bookingId) {
      // Update existing booking
      await this.prisma.booking.update({
        where: { id: bookingId },
        data,
      });
      return booking;
    } else {
      // Create new booking with legs in a single transaction
      const savedBooking = await this.prisma.$transaction(async (tx) => {
        // Save booking first
        const savedBooking = await tx.booking.create({
          data: { ...data },
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
    const data = {
      bookingReference: booking.getBookingReference(),
      status: booking.getStatus().value as PrismaBookingStatus,
      startDate: booking.getDateRange().startDate,
      endDate: booking.getDateRange().endDate,
      pickupLocation: booking.getPickupAddress(),
      returnLocation: booking.getDropOffAddress(),
      userId: booking.getCustomerId(),
      carId: booking.getCarId(),
      chauffeurId: booking.getChauffeurId(),
      specialRequests: booking.getSpecialRequests(),
      type: booking.getBookingType().value as PrismaBookingType,
      paymentStatus: booking.getPaymentStatus().toString() as PrismaPaymentStatus,
      paymentIntent: booking.getPaymentIntent(),
      paymentId: booking.getPaymentId(),
      totalAmount: booking.getTotalAmount(),
      netTotal: booking.getNetTotal(),
      platformCustomerServiceFeeAmount: booking.getPlatformServiceFeeAmount(),
      vatAmount: booking.getVatAmount(),
      fleetOwnerPayoutAmountNet: booking.getFleetOwnerPayoutAmountNet(),
      securityDetailCost: booking.getIncludeSecurityDetail() ? 0 : undefined,
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
        await tx.bookingLeg.create({
          data: {
            bookingId: savedBooking.id,
            legDate: leg.getLegDate(),
            legStartTime: leg.getLegStartTime(),
            legEndTime: leg.getLegEndTime(),
            totalDailyPrice: leg.getTotalDailyPrice(),
            itemsNetValueForLeg: leg.getItemsNetValueForLeg(),
            fleetOwnerEarningForLeg: leg.getFleetOwnerEarningForLeg(),
            notes: leg.getNotes(),
          },
        });
      }

      // Return reconstituted booking with the database-assigned ID
      return Booking.reconstitute({
        id: savedBooking.id,
        bookingReference: savedBooking.bookingReference,
        status: BookingStatus.create(savedBooking.status as BookingStatusEnum),
        dateRange: DateRange.create(savedBooking.startDate, savedBooking.endDate),
        pickupAddress: savedBooking.pickupLocation || undefined,
        dropOffAddress: savedBooking.returnLocation,
        customerId: savedBooking.userId,
        carId: savedBooking.carId,
        chauffeurId: savedBooking.chauffeurId || undefined,
        specialRequests: savedBooking.specialRequests || undefined,
        legs: [], // Legs will be loaded separately if needed
        bookingType: BookingType.create(savedBooking.type),
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
      where: { status: status.value as PrismaBookingStatus },
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
        status: status.value as PrismaBookingStatus,
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

  async findEligibleForActivation(): Promise<Booking[]> {
    const now = new Date();
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: PrismaBookingStatus.CONFIRMED,
        paymentStatus: "PAID",
        chauffeurId: { not: null },
        startDate: { lte: now },
        car: { status: "BOOKED" },
      },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findEligibleForCompletion(): Promise<Booking[]> {
    const now = new Date();
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: PrismaBookingStatus.ACTIVE,
        paymentStatus: "PAID",
        endDate: { lte: now },
        car: { status: "BOOKED" },
      },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findEligibleForStartReminders(): Promise<Booking[]> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: PrismaBookingStatus.CONFIRMED,
        paymentStatus: "PAID",
        chauffeurId: { not: null },
        startDate: {
          gte: now,
          lte: oneHourFromNow,
        },
      },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return bookings.map((booking) => this.toDomain(booking));
  }

  async findEligibleForEndReminders(): Promise<Booking[]> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: PrismaBookingStatus.ACTIVE,
        paymentStatus: "PAID",
        endDate: {
          gte: now,
          lte: oneHourFromNow,
        },
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
    const dateRange = DateRange.create(prismaBooking.startDate, prismaBooking.endDate);

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
        notes: leg.notes,
      }),
    );

    return Booking.reconstitute({
      id: prismaBooking.id,
      bookingReference: prismaBooking.bookingReference,
      status: BookingStatus.create(prismaBooking.status as BookingStatusEnum),
      dateRange,
      pickupAddress: prismaBooking.pickupLocation,
      dropOffAddress: prismaBooking.returnLocation,
      customerId: prismaBooking.userId,
      carId: prismaBooking.carId,
      chauffeurId: prismaBooking.chauffeurId || undefined,
      specialRequests: prismaBooking.specialRequests,
      legs,
      bookingType: BookingType.create(prismaBooking.type),
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
    prismaBooking: Prisma.BookingGetPayload<{}>,
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
      platformServiceFeeAmount: prismaBooking.platformCustomerServiceFeeAmount,
      vatAmount: prismaBooking.vatAmount,
      fleetOwnerPayoutAmountNet: prismaBooking.fleetOwnerPayoutAmountNet,
    });
  }
}
