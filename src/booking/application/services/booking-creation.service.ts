import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { UserRepository } from "../../../iam/domain/repositories/user.repository";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCarDto } from "../../domain/dtos/car.dto";
import { Booking } from "../../domain/entities/booking.entity";
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
    private readonly prisma: PrismaService,
    private readonly bookingDomainService: BookingDomainService,
    private readonly bookingTimeProcessor: BookingTimeProcessorService,
    private readonly bookingAmountVerifier: BookingAmountVerifierService,
    private readonly bookingCostCalculator: BookingCostCalculatorService,
    private readonly bookingDateService: BookingDateService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {}

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

    this.logger.info(
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
    } = dto;

    const dateRange = DateRange.create(timeResult.startDateTime, timeResult.endDateTime);

    // Generate booking dates - done at application layer
    const bookingDates = this.bookingDateService.generateBookingDates(
      dateRange.startDate,
      dateRange.endDate,
      bookingType,
    );

    // Calculate costs - done at application layer (cross-aggregate coordination)
    const costCalculation = await this.bookingCostCalculator.calculateBookingCostFromCar(
      car,
      bookingDates,
      dateRange,
      bookingType,
      includeSecurityDetail,
    );

    // Create command with precalculated data (no car data)
    const createCommand: CreateBookingCommand = {
      customerId,
      carId,
      dateRange,
      bookingType,
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
