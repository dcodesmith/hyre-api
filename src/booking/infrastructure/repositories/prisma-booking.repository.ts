import { Injectable } from "@nestjs/common";
import {
  BookingStatus as PrismaBookingStatus,
  BookingType as PrismaBookingType,
  PaymentStatus as PrismaPaymentStatus,
} from "@prisma/client";
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
      pickupAddress: booking.getPickupAddress(),
      dropOffAddress: booking.getDropOffAddress(),
      customerId: booking.getCustomerId(),
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
      includeSecurityDetail: booking.getIncludeSecurityDetail(),
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
      // Create new booking - database will assign ID
      const savedBooking = await this.prisma.booking.create({
        data: {
          ...data,
          createdAt: booking.getCreatedAt(),
        },
      });

      // Return reconstituted booking with the database-assigned ID
      return Booking.reconstitute({
        id: savedBooking.id,
        bookingReference: savedBooking.bookingReference,
        status: BookingStatus.create(savedBooking.status as BookingStatusEnum),
        dateRange: DateRange.create(savedBooking.startDate, savedBooking.endDate),
        pickupAddress: savedBooking.pickupAddress || undefined,
        dropOffAddress: savedBooking.dropOffAddress,
        customerId: savedBooking.customerId,
        carId: savedBooking.carId,
        chauffeurId: savedBooking.chauffeurId || undefined,
        specialRequests: savedBooking.specialRequests || undefined,
        legs: [], // Will be loaded separately if needed
        bookingType: BookingType.create(savedBooking.type),
        paymentStatus: PaymentStatus.create(savedBooking.paymentStatus),
        paymentIntent: savedBooking.paymentIntent || undefined,
        paymentId: savedBooking.paymentId || undefined,
        financials: this.createFinancialsFromPrisma(savedBooking),
        includeSecurityDetail: savedBooking.includeSecurityDetail,
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

  async findByCustomerId(customerId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { customerId: customerId },
      include: {
        legs: {
          include: { extensions: true },
        },
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

  private toDomain(prismaBooking: any): Booking {
    const dateRange = DateRange.create(prismaBooking.startDate, prismaBooking.endDate);

    const legs = prismaBooking.legs.map((leg) =>
      BookingLeg.reconstitute({
        id: leg.id,
        bookingId: leg.bookingId,
        legDate: leg.legDate,
        legStartTime: leg.legStartTime,
        legEndTime: leg.legEndTime,
        totalDailyPrice: leg.totalDailyPrice,
        itemsNetValueForLeg: leg.itemsNetValueForLeg,
        fleetOwnerEarningForLeg: leg.fleetOwnerEarningForLeg,
        notes: leg.notes,
      }),
    );

    return Booking.reconstitute({
      id: prismaBooking.id,
      bookingReference: prismaBooking.bookingReference,
      status: BookingStatus.create(prismaBooking.status as BookingStatusEnum),
      dateRange,
      pickupAddress: prismaBooking.pickupAddress,
      dropOffAddress: prismaBooking.dropOffAddress,
      customerId: prismaBooking.customerId,
      carId: prismaBooking.carId,
      chauffeurId: prismaBooking.chauffeurId,
      specialRequests: prismaBooking.specialRequests,
      legs,
      bookingType: BookingType.create(prismaBooking.type),
      paymentStatus: PaymentStatus.create(prismaBooking.paymentStatus),
      paymentIntent: prismaBooking.paymentIntent,
      paymentId: prismaBooking.paymentId,
      financials: this.createFinancialsFromPrisma(prismaBooking),
      includeSecurityDetail: prismaBooking.includeSecurityDetail || false,
      cancelledAt: prismaBooking.cancelledAt,
      cancellationReason: prismaBooking.cancellationReason,
      createdAt: prismaBooking.createdAt,
      updatedAt: prismaBooking.updatedAt,
    });
  }

  private createFinancialsFromPrisma(prismaBooking: any): BookingFinancials {
    if (
      !prismaBooking.totalAmount ||
      !prismaBooking.netTotal ||
      !prismaBooking.platformCustomerServiceFeeAmount ||
      !prismaBooking.vatAmount ||
      !prismaBooking.fleetOwnerPayoutAmountNet
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
