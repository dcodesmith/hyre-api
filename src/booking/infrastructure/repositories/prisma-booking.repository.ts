import { Injectable } from "@nestjs/common";
import {
  Prisma,
  PaymentStatus as PrismaPaymentStatus,
  BookingLegStatus as PrismaBookingLegStatus,
} from "@prisma/client";
import { PrismaService } from "../../../shared/database/prisma.service";
import { TransactionContext } from "../../../shared/database/transaction-context.type";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingStatus } from "../../domain/value-objects/booking-status.vo";
import { BookingPrismaMapper } from "../mappers/booking-prisma.mapper";

@Injectable()
export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(booking: Booking): Promise<Booking> {
    const bookingId = booking.getId();

    // Get security detail cost from booking financials (already calculated during booking creation)
    const securityDetailCost = booking.getIncludeSecurityDetail()
      ? booking.getSecurityDetailCost()
      : null;

    if (bookingId) {
      // Update existing booking and its legs using unchecked style (direct FKs)
      // Note: Not using $transaction here to avoid "Response from Engine was empty" errors
      // in async event handler contexts. Each update is atomic anyway.
      const updateData: Prisma.BookingUncheckedUpdateInput = {
        bookingReference: booking.getBookingReference(),
        status: booking.getStatus(),
        startDate: booking.getStartDateTime(),
        endDate: booking.getEndDateTime(),
        pickupLocation: booking.getPickupAddress(),
        returnLocation: booking.getDropOffAddress(),
        chauffeurId: booking.getChauffeurId(),
        specialRequests: booking.getSpecialRequests(),
        type: booking.getBookingType(),
        paymentStatus: booking.getPaymentStatus() as PrismaPaymentStatus,
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
      };

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: updateData,
      });

      // Update all legs
      const legs = booking.getLegs();
      for (const leg of legs) {
        const legId = leg.getId();
        if (legId) {
          await this.prisma.bookingLeg.update({
            where: { id: legId },
            data: {
              status: leg.getStatus().value,
              notes: leg.getNotes(),
            },
          });
        }
      }

      return booking;
    } else {
      // Create new booking with legs in a single transaction
      const savedBooking = await this.prisma.$transaction(async (tx) => {
        // Save booking using checked style with relation connects
        const createData: Prisma.BookingCreateInput = {
          bookingReference: booking.getBookingReference(),
          status: booking.getStatus(),
          startDate: booking.getStartDateTime(),
          endDate: booking.getEndDateTime(),
          pickupLocation: booking.getPickupAddress(),
          returnLocation: booking.getDropOffAddress(),
          specialRequests: booking.getSpecialRequests(),
          type: booking.getBookingType(),
          paymentStatus: booking.getPaymentStatus() as PrismaPaymentStatus,
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
          // Use checked style - connect relations instead of direct FKs
          car: { connect: { id: booking.getCarId() } },
          user: booking.getCustomerId()
            ? { connect: { id: booking.getCustomerId() } }
            : undefined,
          chauffeur: booking.getChauffeurId()
            ? { connect: { id: booking.getChauffeurId() } }
            : undefined,
          legs: {
            create: booking.getLegs().map((leg) => ({
              legDate: leg.getLegDate(),
              legStartTime: leg.getLegStartTime(),
              legEndTime: leg.getLegEndTime(),
              totalDailyPrice: leg.getTotalDailyPrice(),
              itemsNetValueForLeg: leg.getItemsNetValueForLeg(),
              fleetOwnerEarningForLeg: leg.getFleetOwnerEarningForLeg(),
              status: leg.getStatus().value as PrismaBookingLegStatus,
              notes: leg.getNotes(),
            })),
          },
        };

        const savedBooking = await tx.booking.create({
          data: createData,
        });

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
      : null;

    if (bookingId) {
      // Update existing booking within transaction using unchecked style
      const txUpdateData: Prisma.BookingUncheckedUpdateInput = {
        bookingReference: booking.getBookingReference(),
        status: booking.getStatus(),
        startDate: booking.getStartDateTime(),
        endDate: booking.getEndDateTime(),
        pickupLocation: booking.getPickupAddress(),
        returnLocation: booking.getDropOffAddress(),
        chauffeurId: booking.getChauffeurId() ?? null,
        specialRequests: booking.getSpecialRequests(),
        type: booking.getBookingType(),
        paymentStatus: booking.getPaymentStatus() as PrismaPaymentStatus,
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
      };

      await tx.booking.update({
        where: { id: bookingId },
        data: txUpdateData,
      });
      return booking;
    } else {
      // Create new booking within transaction using checked style
      const txCreateData: Prisma.BookingCreateInput = {
        bookingReference: booking.getBookingReference(),
        status: booking.getStatus(),
        startDate: booking.getStartDateTime(),
        endDate: booking.getEndDateTime(),
        pickupLocation: booking.getPickupAddress(),
        returnLocation: booking.getDropOffAddress(),
        specialRequests: booking.getSpecialRequests(),
        type: booking.getBookingType(),
        paymentStatus: booking.getPaymentStatus() as PrismaPaymentStatus,
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
        createdAt: booking.getCreatedAt(),
        car: { connect: { id: booking.getCarId() } },
        user: booking.getCustomerId()
          ? { connect: { id: booking.getCustomerId() } }
          : undefined,
        chauffeur: booking.getChauffeurId()
          ? { connect: { id: booking.getChauffeurId() } }
          : undefined,
      };

      const savedBooking = await tx.booking.create({
        data: txCreateData,
      });

      // Save all legs with the booking ID within the same transaction
      const legs = booking.getLegs();
      for (const leg of legs) {
        const legData = {
          bookingId: savedBooking.id,
          legDate: leg.getLegDate(),
          legStartTime: leg.getLegStartTime(),
          legEndTime: leg.getLegEndTime(),
          totalDailyPrice: leg.getTotalDailyPrice(),
          itemsNetValueForLeg: leg.getItemsNetValueForLeg(),
          fleetOwnerEarningForLeg: leg.getFleetOwnerEarningForLeg(),
          status: leg.getStatus().value,
          notes: leg.getNotes(),
        };

        const legId = leg.getId();
        if (legId) {
          // Update existing leg
          await tx.bookingLeg.upsert({
            where: { id: legId },
            create: legData,
            update: {
              status: leg.getStatus().value,
              notes: leg.getNotes(),
            },
          });
        } else {
          // Create new leg
          await tx.bookingLeg.create({
            data: legData,
          });
        }
      }

      // Load the persisted legs from the database within the transaction
      const persistedLegs = await tx.bookingLeg.findMany({
        where: { bookingId: savedBooking.id },
        include: { extensions: true },
      });

      // Return reconstituted booking with legs loaded from the transaction
      return BookingPrismaMapper.toDomain({
        ...savedBooking,
        legs: persistedLegs,
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

    return booking ? BookingPrismaMapper.toDomain(booking) : null;
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

    return booking ? BookingPrismaMapper.toDomain(booking) : null;
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

    return bookings.map((booking) => BookingPrismaMapper.toDomain(booking));
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

    return bookings.map((booking) => BookingPrismaMapper.toDomain(booking));
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

    return bookings.map((booking) => BookingPrismaMapper.toDomain(booking));
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

    return bookings.map((booking) => BookingPrismaMapper.toDomain(booking));
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

    return bookings.map((booking) => BookingPrismaMapper.toDomain(booking));
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

    return bookings.map((booking) => BookingPrismaMapper.toDomain(booking));
  }

  async findByIds(ids: string[]): Promise<Booking[]> {
    if (ids.length === 0) {
      return [];
    }

    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: ids } },
      include: {
        legs: {
          include: { extensions: true },
        },
      },
    });

    return bookings.map((booking) => BookingPrismaMapper.toDomain(booking));
  }

  async saveAll(bookings: Booking[]): Promise<void> {
    if (bookings.length === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const booking of bookings) {
        await this.saveWithTransaction(booking, tx);
      }
    });
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

    return bookings.map((booking) => BookingPrismaMapper.toDomain(booking));
  }
}
