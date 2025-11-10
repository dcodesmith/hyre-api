import { Inject, Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";

/**
 * Application service responsible for booking query operations
 * Following SRP - focused only on reading/querying booking data
 */
@Injectable()
export class BookingQueryService {
  constructor(
    @Inject("BookingRepository") private readonly bookingRepository: BookingRepository,
    private readonly logger: LoggerService,
  ) {
  }

  async getBookingById(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    return booking;
  }

  async findBookingsEligibleForStartReminders(): Promise<string[]> {
    const bookings = await this.bookingRepository.findEligibleForStartReminders();
    return bookings.map((booking) => booking.getId());
  }

  async findBookingsEligibleForEndReminders(): Promise<string[]> {
    const bookings = await this.bookingRepository.findEligibleForEndReminders();
    return bookings.map((booking) => booking.getId());
  }
}
