import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { UserRepository } from "../../../iam/domain/repositories/user.repository";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCarDto } from "../../domain/dtos/car.dto";
import { Booking } from "../../domain/entities/booking.entity";
import { CarNotFoundError } from "../../domain/errors/car.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { CarRepository } from "../../domain/repositories/car.repository";
import { BookingAmountVerifierService } from "../../domain/services/booking-amount-verifier.service";
import {
  BookingDomainService,
  CreateBookingCommand,
} from "../../domain/services/booking-domain.service";
import {
  BookingTimeProcessorService,
  TimeProcessingResult,
} from "../../domain/services/booking-time-processor.service";
import { BookingType } from "../../domain/value-objects/booking-type.vo";
import { DateRange } from "../../domain/value-objects/date-range.vo";
import { PickupTime } from "../../domain/value-objects/pickup-time.vo";
import { CreateBookingDto } from "../../presentation/dto/create-booking.dto";

/**
 * Application service responsible for booking creation operations
 * Following SRP - focused only on creating bookings
 */
@Injectable()
export class BookingCreationService {
  constructor(
    @Inject("BookingRepository") private readonly bookingRepository: BookingRepository,
    @Inject("CarRepository") private readonly carRepository: CarRepository,
    @Inject("UserRepository") private readonly userRepository: UserRepository,
    private readonly bookingDomainService: BookingDomainService,
    private readonly bookingTimeProcessor: BookingTimeProcessorService,
    private readonly bookingAmountVerifier: BookingAmountVerifierService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BookingCreationService.name);
  }

  async createPendingBooking(
    dto: CreateBookingDto,
    user?: User,
  ): Promise<{ booking: Booking; timeResult: TimeProcessingResult }> {
    const { carId, bookingType, from, to, totalAmount, pickupTime } = dto;

    // Validate car exists
    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new CarNotFoundError(carId);
    }

    // Resolve customer ID
    const customerId = await this.resolveCustomerId(dto, user);

    // Process booking time using domain logic
    const bookingTypeObj = BookingType.create(bookingType);
    const pickupTimeObj = PickupTime.create(pickupTime);
    const timeResult = this.bookingTimeProcessor.processBookingTime(
      from,
      to,
      pickupTimeObj,
      bookingTypeObj,
    );

    // Create booking entity
    const booking = await this.createBookingEntity(
      dto,
      customerId,
      car,
      timeResult,
      bookingTypeObj,
    );

    // Verify client amount matches server calculation
    this.bookingAmountVerifier.verifyAmount(totalAmount, booking.getTotalAmount());

    // Save booking and publish events
    const savedBooking = await this.saveBookingAndPublishEvents(booking);

    this.logger.log(
      `Created pending booking ${savedBooking.getBookingReference()} with total amount: ${savedBooking.getTotalAmount()?.toString()}`,
    );

    return { booking: savedBooking, timeResult };
  }

  /**
   * Resolves customer ID based on authentication status
   * For authenticated users: Use their user ID
   * For guest users: Validate guest fields and create guest user record
   */
  private async resolveCustomerId(dto: CreateBookingDto, user?: User): Promise<string> {
    if (user) {
      // Authenticated user - validate they can make bookings
      if (!user.canMakeBookings()) {
        throw new BadRequestException(`User ${user.getEmail()} is not authorized to make bookings`);
      }

      this.logger.log(
        `Creating booking for authenticated ${user.isGuest() ? "guest" : "registered"} user: ${user.getId()}`,
      );
      return user.getId();
    }

    // Guest user - validate required fields
    const { email, name, phoneNumber } = dto;

    if (!email || !name || !phoneNumber) {
      throw new BadRequestException("Guest users must provide email, name, and phone number");
    }

    // Check if guest email belongs to existing registered user
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser?.isRegistered()) {
      throw new BadRequestException(
        `Email ${email} is already registered. Please sign in to make bookings.`,
      );
    }

    // If existing guest user found, use that
    if (existingUser?.isGuest()) {
      if (existingUser.isGuestExpired()) {
        throw new BadRequestException(
          `Guest user account has expired. Please create a new booking.`,
        );
      }

      this.logger.log(`Using existing guest user: ${existingUser.getId()}`);
      return existingUser.getId();
    }

    // Create new guest user
    const guestUser = User.createGuest(email, name, phoneNumber);
    await this.userRepository.save(guestUser);

    this.logger.log(`Created new guest user: ${guestUser.getId()}`);
    return guestUser.getId();
  }

  private async createBookingEntity(
    dto: CreateBookingDto,
    customerId: string,
    car: BookingCarDto,
    timeResult: TimeProcessingResult,
    bookingType: BookingType,
  ): Promise<Booking> {
    const {
      carId,
      pickupAddress,
      dropOffAddress,
      sameLocation,
      includeSecurityDetail,
      specialRequests,
      totalAmount,
      pickupTime,
    } = dto;

    const createCommand: CreateBookingCommand = {
      carId,
      pickupAddress,
      dropOffAddress: sameLocation ? pickupAddress : dropOffAddress,
      sameLocation,
      includeSecurityDetail,
      specialRequests,
      totalAmount,
      pickupTime,
      customerId,
      car,
      dateRange: DateRange.create(timeResult.startDateTime, timeResult.endDateTime),
      bookingType,
    };

    return await this.bookingDomainService.createBooking(createCommand);
  }

  private async saveBookingAndPublishEvents(booking: Booking): Promise<Booking> {
    const savedBooking = await this.bookingRepository.save(booking);

    // If this is a new booking (no ID before save), mark it as created to trigger domain events
    if (!booking.getId() && savedBooking.getId()) {
      savedBooking.markAsCreated();
    }

    await this.domainEventPublisher.publish(savedBooking);
    return savedBooking;
  }
}
