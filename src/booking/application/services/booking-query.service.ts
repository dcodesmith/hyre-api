import { Inject, Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { CarRepository } from "../../domain/repositories/car.repository";
import { BookingAuthorizationService } from "../../domain/services/booking-authorization.service";
import { BookingDto, BookingMapper } from "../mappers/booking.mapper";

/**
 * Application service responsible for user-facing booking query operations
 *
 * Focused on authorization-aware queries that return DTOs for API responses.
 * Delegates authorization decisions to BookingAuthorizationService (domain layer).
 *
 * NOTE: System/background job queries are handled by:
 * - BookingLegQueryService: leg-based queries for reminders and status transitions
 * - BookingReminderService: reminder processing and notification coordination
 */
@Injectable()
export class BookingQueryService {
  constructor(
    @Inject("BookingRepository") private readonly bookingRepository: BookingRepository,
    @Inject("CarRepository") private readonly carRepository: CarRepository,
    private readonly bookingAuthorizationService: BookingAuthorizationService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Get booking entity with authorization check
   * Use this for internal operations that need the full entity
   */
  async getBookingEntityById(bookingId: string, currentUser: User): Promise<Booking> {
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

    this.logger.info("User fetching booking entity", {
      userId: currentUser.getId(),
      bookingId,
    });

    return booking;
  }

  /**
   * Get booking as DTO for API responses
   * Use this for GET endpoints that return data to the client
   */
  async getBookingById(bookingId: string, currentUser: User): Promise<BookingDto> {
    const booking = await this.getBookingEntityById(bookingId, currentUser);

    // Use mapper to convert entity to DTO
    return BookingMapper.toDto(booking);
  }

  async getBookingByIdInternal(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    this.logger.info("System fetching booking details", { bookingId });

    return booking;
  }

  async getBookings(currentUser: User): Promise<BookingDto[]> {
    const { isAuthorized } = this.bookingAuthorizationService.canViewAllBookings(currentUser);

    let bookings: Booking[];

    if (isAuthorized) {
      this.logger.info("Admin/Staff fetching all bookings", { userId: currentUser.getId() });
      bookings = await this.bookingRepository.findAll();
    } else if (currentUser.isFleetOwner()) {
      // Fleet owners can see bookings for their cars
      this.logger.info("Fleet owner fetching bookings for their fleet", {
        userId: currentUser.getId(),
      });
      bookings = await this.bookingRepository.findByFleetOwnerId(currentUser.getId());
    } else {
      // Regular users can only see their own bookings
      this.logger.info("User fetching their bookings", { userId: currentUser.getId() });
      bookings = await this.bookingRepository.findByCustomerId(currentUser.getId());
    }

    // Map all bookings to DTOs
    return BookingMapper.toDtoList(bookings);
  }
}
