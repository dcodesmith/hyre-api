import { Inject, Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { CarRepository } from "../../domain/repositories/car.repository";
import { BookingAuthorizationService } from "../../domain/services/booking-authorization.service";

/**
 * Application service responsible for booking query operations
 * Following SRP - focused only on reading/querying booking data
 * Delegates authorization decisions to BookingAuthorizationService (domain layer)
 */
@Injectable()
export class BookingQueryService {
  constructor(
    @Inject("BookingRepository") private readonly bookingRepository: BookingRepository,
    @Inject("CarRepository") private readonly carRepository: CarRepository,
    private readonly bookingAuthorizationService: BookingAuthorizationService,
    private readonly logger: LoggerService,
  ) {}

  async getBookingById(bookingId: string, currentUser: User): Promise<Booking> {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    const car = await this.carRepository.findById(booking.getCarId());
    const fleetOwnerId = car?.ownerId;

    const { isAuthorized } = this.bookingAuthorizationService.canViewBooking(
      currentUser,
      booking,
      fleetOwnerId,
    );

    if (!isAuthorized) {
      // Return not found instead of forbidden to prevent information disclosure
      throw new BookingNotFoundError(bookingId);
    }

    this.logger.info("User fetching booking details", {
      userId: currentUser.getId(),
      bookingId,
    });

    return booking;
  }

  async getBookingByIdInternal(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    this.logger.info("System fetching booking details", { bookingId });

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

  async getBookings(currentUser: User): Promise<Booking[]> {
    const { isAuthorized } = this.bookingAuthorizationService.canViewAllBookings(currentUser);

    if (isAuthorized) {
      this.logger.info("Admin/Staff fetching all bookings", { userId: currentUser.getId() });
      return this.bookingRepository.findAll();
    }

    // Fleet owners can see bookings for their cars
    if (currentUser.isFleetOwner()) {
      this.logger.info("Fleet owner fetching bookings for their fleet", {
        userId: currentUser.getId(),
      });
      return this.bookingRepository.findByFleetOwnerId(currentUser.getId());
    }

    // Regular users can only see their own bookings
    this.logger.info("User fetching their bookings", { userId: currentUser.getId() });
    return this.bookingRepository.findByCustomerId(currentUser.getId());
  }
}
