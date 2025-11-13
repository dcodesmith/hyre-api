import { Inject, Injectable } from "@nestjs/common";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { BookingRepository } from "../../../booking/domain/repositories/booking.repository";
import { NotificationService } from "../../../communication/application/services/notification.service";
import {
  BookingLegReminderData,
  BookingReminderData,
} from "../../../communication/domain/services/notification-factory.service";
import { PrismaService } from "../../../shared/database/prisma.service";
import { LoggerService } from "../../../shared/logging/logger.service";

@Injectable()
export class ReminderProcessingService {
  constructor(
    @Inject("BookingRepository")
    private readonly bookingRepository: BookingRepository,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async processBookingStartReminders(): Promise<string> {
    const bookings = await this.bookingRepository.findEligibleForStartReminders();
    let processedCount = 0;

    for (const booking of bookings) {
      try {
        // Get full booking data with relations
        const bookingData = await this.prisma.booking.findUnique({
          where: { id: booking.getId() },
          include: {
            user: true,
            chauffeur: true,
            car: true,
          },
        });

        if (!bookingData) continue;

        const reminderData: BookingReminderData = {
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          customerName: bookingData.user?.name || "Customer",
          chauffeurName: bookingData.chauffeur?.name || "Chauffeur",
          carName: `${bookingData.car.make} ${bookingData.car.model}`,
          startTime: booking.getDateRange().startDate.toISOString(),
          endTime: booking.getDateRange().endDate.toISOString(),
          pickupLocation: booking.getPickupAddress(),
          returnLocation: booking.getDropOffAddress(),
          customerId: booking.getCustomerId(),
          customerEmail: bookingData.user?.email,
          customerPhone: bookingData.user?.phoneNumber,
          chauffeurId: booking.getChauffeurId(),
          chauffeurEmail: bookingData.chauffeur?.email,
          chauffeurPhone: bookingData.chauffeur?.phoneNumber,
        };

        await this.notificationService.sendBookingStartReminders(reminderData);
        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process booking start reminder for ${booking.getId()}: ${error.message}`,
          error.stack,
        );
      }
    }

    const result = `Processed ${processedCount} booking start reminders`;
    this.logger.log(result);
    return result;
  }

  async processBookingEndReminders(): Promise<string> {
    const bookings = await this.bookingRepository.findEligibleForEndReminders();
    let processedCount = 0;

    for (const booking of bookings) {
      try {
        // Get full booking data with relations
        const bookingData = await this.prisma.booking.findUnique({
          where: { id: booking.getId() },
          include: {
            user: true,
            chauffeur: true,
            car: true,
          },
        });

        if (!bookingData) continue;

        const reminderData: BookingReminderData = {
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          customerName: bookingData.user?.name || "Customer",
          chauffeurName: bookingData.chauffeur?.name || "Chauffeur",
          carName: `${bookingData.car.make} ${bookingData.car.model}`,
          startTime: booking.getDateRange().startDate.toISOString(),
          endTime: booking.getDateRange().endDate.toISOString(),
          pickupLocation: booking.getPickupAddress(),
          returnLocation: booking.getDropOffAddress(),
          customerId: booking.getCustomerId(),
          customerEmail: bookingData.user?.email,
          customerPhone: bookingData.user?.phoneNumber,
          chauffeurId: booking.getChauffeurId(),
          chauffeurEmail: bookingData.chauffeur?.email,
          chauffeurPhone: bookingData.chauffeur?.phoneNumber,
        };

        await this.notificationService.sendBookingEndReminders(reminderData);
        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process booking end reminder for ${booking.getId()}: ${error.message}`,
          error.stack,
        );
      }
    }

    const result = `Processed ${processedCount} booking end reminders`;
    this.logger.log(result);
    return result;
  }

  async processBookingLegStartReminders(): Promise<string> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find booking legs eligible for start reminders
    const bookingLegs = await this.prisma.bookingLeg.findMany({
      where: {
        legStartTime: {
          gte: now,
          lte: oneHourFromNow,
        },
        booking: {
          status: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          chauffeurId: { not: null },
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

    let processedCount = 0;

    for (const leg of bookingLegs) {
      try {
        const reminderData: BookingLegReminderData = {
          bookingId: leg.bookingId,
          bookingLegId: leg.id,
          customerName: leg.booking.user?.name || "Customer",
          chauffeurName: leg.booking.chauffeur?.name || "Chauffeur",
          carName: `${leg.booking.car.make} ${leg.booking.car.model}`,
          legStartTime: leg.legStartTime.toISOString(),
          legEndTime: leg.legEndTime.toISOString(),
          pickupLocation: leg.booking.pickupLocation,
          returnLocation: leg.booking.returnLocation,
          customerId: leg.booking.userId,
          customerEmail: leg.booking.user?.email,
          customerPhone: leg.booking.user?.phoneNumber,
          chauffeurId: leg.booking.chauffeurId,
          chauffeurEmail: leg.booking.chauffeur?.email,
          chauffeurPhone: leg.booking.chauffeur?.phoneNumber,
        };

        await this.notificationService.sendBookingLegStartReminders(reminderData);
        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process booking leg start reminder for ${leg.id}: ${error.message}`,
          error.stack,
        );
      }
    }

    const result = `Processed ${processedCount} booking leg start reminders`;
    this.logger.log(result);
    return result;
  }

  async processBookingLegEndReminders(): Promise<string> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find booking legs eligible for end reminders
    const bookingLegs = await this.prisma.bookingLeg.findMany({
      where: {
        legEndTime: {
          gte: now,
          lte: oneHourFromNow,
        },
        booking: {
          status: BookingStatus.ACTIVE,
          paymentStatus: PaymentStatus.PAID,
          chauffeurId: { not: null },
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

    let processedCount = 0;

    for (const leg of bookingLegs) {
      try {
        const reminderData: BookingLegReminderData = {
          bookingId: leg.bookingId,
          bookingLegId: leg.id,
          customerName: leg.booking.user?.name || "Customer",
          chauffeurName: leg.booking.chauffeur?.name || "Chauffeur",
          carName: `${leg.booking.car.make} ${leg.booking.car.model}`,
          legStartTime: leg.legStartTime.toISOString(),
          legEndTime: leg.legEndTime.toISOString(),
          pickupLocation: leg.booking.pickupLocation,
          returnLocation: leg.booking.returnLocation,
          customerId: leg.booking.userId,
          customerEmail: leg.booking.user?.email,
          customerPhone: leg.booking.user?.phoneNumber,
          chauffeurId: leg.booking.chauffeurId,
          chauffeurEmail: leg.booking.chauffeur?.email,
          chauffeurPhone: leg.booking.chauffeur?.phoneNumber,
        };

        await this.notificationService.sendBookingLegStartReminders(reminderData);
        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process booking leg end reminder for ${leg.id}: ${error.message}`,
        );
      }
    }

    const result = `Processed ${processedCount} booking leg end reminders`;
    this.logger.log(result);
    return result;
  }
}
