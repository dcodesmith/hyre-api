import { Inject, Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { UserRepository } from "../../../iam/domain/repositories/user.repository";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCarDto } from "../../domain/dtos/car.dto";
import { Booking } from "../../domain/entities/booking.entity";
import {
  BookingCustomerNotAuthorizedError,
  GuestCustomerAccountExpiredError,
  GuestCustomerDetailsRequiredError,
  GuestCustomerEmailRegisteredError,
} from "../../domain/errors/booking.errors";
import { CarNotFoundError } from "../../domain/errors/car.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { CarRepository } from "../../domain/repositories/car.repository";
import { BookingAmountVerifierService } from "../../domain/services/booking-amount-verifier.service";
import { BookingCostCalculatorService } from "../../domain/services/booking-cost-calculator.service";
import { BookingDateService } from "../../domain/services/booking-date.service";
import {
  BookingDomainService,
  CreateBookingCommand,
} from "../../domain/services/booking-domain.service";
import { BookingPeriodFactory } from "../../domain/value-objects/booking-period.factory";
import type { BookingPeriod } from "../../domain/value-objects/booking-period.vo";
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
    private readonly prisma: PrismaService,
    private readonly bookingDomainService: BookingDomainService,
    private readonly bookingAmountVerifier: BookingAmountVerifierService,
    private readonly bookingCostCalculator: BookingCostCalculatorService,
    private readonly bookingDateService: BookingDateService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {}

  async createPendingBooking(
    dto: CreateBookingDto,
    user?: User,
  ): Promise<{ booking: Booking; bookingPeriod: BookingPeriod; customer: User }> {
    const { carId, bookingType, from, to, totalAmount, pickupTime } = dto;

    const car = await this.carRepository.findById(carId);

    if (!car) {
      throw new CarNotFoundError(carId);
    }

    // Resolve customer entity (registered or guest)
    const customer = await this.resolveCustomer(dto, user);

    // Create booking period with validation using BookingPeriodFactory
    const pickupTimeObj = pickupTime ? PickupTime.create(pickupTime) : undefined;
    const bookingPeriod = BookingPeriodFactory.create({
      bookingType: bookingType,
      startDate: from,
      endDate: to,
      pickupTime: pickupTimeObj,
    });

    // Create booking entity
    const booking = await this.createBookingEntity(dto, customer.getId(), car, bookingPeriod);

    // Verify client amount matches server calculation
    this.bookingAmountVerifier.verifyAmount(totalAmount, booking.getTotalAmount());

    // Save booking and publish events
    const savedBooking = await this.saveBookingAndPublishEvents(booking);

    this.logger.info(
      `Created pending booking ${savedBooking.getBookingReference()} with total amount: ${savedBooking.getTotalAmount()?.toString()}`,
    );

    return { booking: savedBooking, bookingPeriod, customer };
  }

  /**
   * Resolves customer ID based on authentication status
   * For authenticated users: Use their user ID
   * For guest users: Validate guest fields and create guest user record
   */
  private async resolveCustomer(dto: CreateBookingDto, user?: User): Promise<User> {
    if (user) {
      // Authenticated user - validate they can make bookings
      if (!user.canMakeBookings()) {
        throw new BookingCustomerNotAuthorizedError(user.getId(), user.getEmail());
      }

      this.logger.log(
        `Creating booking for authenticated ${user.isGuest() ? "guest" : "registered"} user: ${user.getId()}`,
      );
      return user;
    }

    // Guest user - validate required fields
    const { email, name, phoneNumber } = dto;

    const missingFields = [
      !email ? "email" : null,
      !name ? "name" : null,
      !phoneNumber ? "phoneNumber" : null,
    ].filter((field): field is string => Boolean(field));

    if (missingFields.length > 0) {
      throw new GuestCustomerDetailsRequiredError(missingFields);
    }

    // Check if guest email belongs to existing registered user
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser?.isRegistered()) {
      throw new GuestCustomerEmailRegisteredError(email);
    }

    // If existing guest user found, use that
    if (existingUser?.isGuest()) {
      if (existingUser.isGuestExpired()) {
        throw new GuestCustomerAccountExpiredError(existingUser.getEmail() ?? email);
      }

      this.logger.log(`Using existing guest user: ${existingUser.getId()}`);
      return existingUser;
    }

    // Create new guest user
    const guestUser = User.createGuest(email, name, phoneNumber);
    const savedGuestUser = await this.userRepository.save(guestUser);

    this.logger.log(`Created new guest user: ${savedGuestUser.getId()}`);
    return savedGuestUser;
  }

  private async createBookingEntity(
    dto: CreateBookingDto,
    customerId: string,
    car: BookingCarDto,
    bookingPeriod: BookingPeriod,
  ): Promise<Booking> {
    const {
      carId,
      pickupAddress,
      dropOffAddress,
      sameLocation,
      includeSecurityDetail,
      specialRequests,
    } = dto;

    // Generate booking dates - done at application layer
    const bookingDates = this.bookingDateService.generateBookingDates(
      bookingPeriod.startDateTime,
      bookingPeriod.endDateTime,
      bookingPeriod.getBookingType(),
    );

    // Calculate costs - done at application layer (cross-aggregate coordination)
    const costCalculation = await this.bookingCostCalculator.calculateBookingCostFromCar(
      car,
      bookingDates,
      bookingPeriod,
      includeSecurityDetail,
    );

    // Create command with precalculated data (no car data)
    const createCommand: CreateBookingCommand = {
      customerId,
      carId,
      bookingPeriod,
      pickupAddress,
      dropOffAddress: sameLocation ? pickupAddress : dropOffAddress,
      includeSecurityDetail,
      specialRequests,
      precalculatedCosts: costCalculation,
      precalculatedBookingDates: bookingDates,
    };

    return this.bookingDomainService.createBooking(createCommand);
  }

  private async saveBookingAndPublishEvents(booking: Booking): Promise<Booking> {
    // Collect events to publish after transaction commits
    const eventsToPublish: Booking[] = [];

    // Use transaction to ensure atomicity of booking save and event preparation
    const savedBooking = await this.prisma.$transaction(async (tx) => {
      // Save booking within transaction
      const saved = await this.bookingRepository.saveWithTransaction(booking, tx);

      // If this is a new booking, mark it as created to trigger domain events
      if (!booking.getId() && saved.getId()) {
        saved.markAsCreated();
        eventsToPublish.push(saved); // Prepare for event publishing
      }

      return saved;
    });

    // After transaction commits successfully, publish events
    for (const bookingWithEvents of eventsToPublish) {
      await this.domainEventPublisher.publish(bookingWithEvents);
    }

    return savedBooking;
  }
}
