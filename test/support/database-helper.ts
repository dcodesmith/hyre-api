import { Booking, Car, PlatformFeeType, Prisma, PrismaClient, User } from "@prisma/client";
import { Builder } from "./builder";
import { Cache } from "./cache";
import { logger } from "./logger";
import { Role, RoleType } from "./support.interface";

export class DatabaseHelper {
  private static instance: DatabaseHelper;
  private static isInitialized = false;
  private prisma: PrismaClient;
  private builder: Builder;
  private cache: Cache;

  constructor(builder: Builder, cache: Cache) {
    this.builder = builder;
    this.cache = cache;

    // Only initialize database connection once
    if (!DatabaseHelper.isInitialized) {
      // Ensure we're using the test database URL
      const testDbUrl =
        process.env.TEST_DATABASE_URL || "postgresql://test:test@localhost:5432/test_db";

      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: testDbUrl,
          },
        },
      });

      // Use the test schema for Prisma operations - override the app's DATABASE_URL
      process.env.DATABASE_URL = testDbUrl;
      DatabaseHelper.isInitialized = true;

      // Seed basic data once during first initialization
      this.seedBasicData().catch((error) => {
        logger.error("Failed to seed basic data:", error);
      });
    } else {
      // Reuse existing Prisma instance
      this.prisma = DatabaseHelper.instance.prisma;
    }

    DatabaseHelper.instance = this;
  }

  async testConnection(): Promise<void> {
    await this.prisma.$connect();
  }

  async cleanDatabase(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.extension.deleteMany();
      await tx.bookingLeg.deleteMany();
      await tx.booking.deleteMany();
      await tx.vehicleImage.deleteMany();
      await tx.documentApproval.deleteMany();
      await tx.car.deleteMany();
      await tx.payoutTransaction.deleteMany();
      await tx.payment.deleteMany();
      await tx.bankDetails.deleteMany();
      await tx.user.deleteMany();
    });

    this.cache.clear();
  }

  async seedBasicData(): Promise<void> {
    await Promise.all([
      this.prisma.platformFeeRate.upsert({
        where: { id: "default" },
        update: {},
        create: {
          id: "default",
          feeType: PlatformFeeType.FLEET_OWNER_COMMISSION,
          ratePercent: 10.0,
          effectiveSince: new Date(),
        },
      }),
      this.prisma.platformFeeRate.upsert({
        where: { id: "default" },
        update: {},
        create: {
          id: "default",
          feeType: PlatformFeeType.PLATFORM_SERVICE_FEE,
          ratePercent: 5.0,
          effectiveSince: new Date(),
        },
      }),
      this.prisma.taxRate.upsert({
        where: { id: "default" },
        update: {},
        create: {
          id: "default",
          ratePercent: 20.0,
          effectiveSince: new Date(),
        },
      }),
    ]);
  }

  // Enhanced methods that integrate with cache and test data builder
  async createUser(
    cacheKey: string,
    roleType: RoleType = Role.USER,
    overrides: Partial<Prisma.UserCreateInput> = {},
  ): Promise<User> {
    const user = this.builder.buildUser(overrides);

    try {
      const roleConfigs: Record<RoleType, Partial<Prisma.UserCreateInput>> = {
        user: { hasOnboarded: true },
        fleetOwner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
        chauffeur: { chauffeurApprovalStatus: "APPROVED", hasOnboarded: true },
        staff: { hasOnboarded: true },
        admin: { hasOnboarded: true },
      };

      const data = {
        ...user,
        ...roleConfigs[roleType],
        roles: {
          connectOrCreate: {
            where: { name: roleType },
            create: { name: roleType, description: `${roleType} role` },
          },
        },
      };

      const createdUser = await this.prisma.user.create({ data });

      // Cache the actual database result (not the input data)
      this.cache.user.set(cacheKey, createdUser);
      return createdUser;
    } catch (error) {
      logger.error("Error creating user:", error);
      throw error;
    }
  }

  async createCar(
    cacheKey: string,
    carIdOrOverrides: Partial<Prisma.CarUncheckedCreateInput> = {},
  ): Promise<Car> {
    const car = this.builder.buildCar({ ...carIdOrOverrides });
    const keyToUse = cacheKey || car.id;

    const createdCar = await this.prisma.car.create({ data: car });

    this.cache.car.set(keyToUse, createdCar);
    return createdCar;
  }

  // async createBooking(
  //   bookingIdOrOverrides: string | Partial<Prisma.BookingCreateInput>,
  //   cacheKey?: string,
  // ): Promise<Booking> {
  //   let booking: any;
  //   let keyToUse: string;

  //   if (typeof bookingIdOrOverrides === "string") {
  //     const bookingId = bookingIdOrOverrides;
  //     booking = this.testDataBuilder.buildBooking({ id: bookingId });
  //     keyToUse = cacheKey || bookingId;
  //   } else {
  //     booking = this.testDataBuilder.buildBooking(bookingIdOrOverrides);
  //     keyToUse = cacheKey || booking.id;
  //   }

  //   // Convert test data builder fields to Prisma fields
  //   const prismaBookingData: Prisma.BookingCreateInput = {
  //     id: booking.id,
  //     bookingReference: booking.bookingReference,
  //     startDate: booking.startDate,
  //     endDate: booking.endDate,
  //     totalAmount: booking.totalAmount,
  //     pickupLocation: booking.pickupLocation,
  //     returnLocation: booking.returnLocation,
  //     specialRequests: booking.specialRequests,
  //     // Convert field names from test data builder to Prisma schema
  //     ...(booking.userId && { user: { connect: { id: booking.userId } } }),
  //     ...(booking.carId && { car: { connect: { id: booking.carId } } }),
  //     ...(booking.chauffeurId && { chauffeur: { connect: { id: booking.chauffeurId } } }),
  //     // Handle legacy field names from test data builder
  //     ...(booking.customerId && { user: { connect: { id: booking.customerId } } }),
  //     ...(booking.driverId && { chauffeur: { connect: { id: booking.driverId } } }),
  //   };

  //   const createdBooking = await this.prisma.booking.create({ data: prismaBookingData });
  //   return this.cache.booking.set(keyToUse, createdBooking);
  // }

  // async createPayment(
  //   paymentIdOrOverrides: string | Partial<Prisma.PaymentCreateInput>,
  //   cacheKey?: string,
  // ): Promise<Payment> {
  //   let payment: Prisma.PaymentCreateInput;
  //   let keyToUse: string;

  //   if (typeof paymentIdOrOverrides === "string") {
  //     const paymentId = paymentIdOrOverrides;
  //     payment = this.testDataBuilder.buildPayment({ id: paymentId });
  //     keyToUse = cacheKey || paymentId;
  //   } else {
  //     payment = this.testDataBuilder.buildPayment(paymentIdOrOverrides);
  //     keyToUse = cacheKey || payment.id;
  //   }

  //   const createdPayment = await this.prisma.payment.create({ data: payment });
  //   return this.cache.payment.set(keyToUse, createdPayment);
  // }

  // Convenience methods

  async createCustomerWithCar(
    customerId: string,
    carId: string,
  ): Promise<{
    customer: User;
    car: Car;
  }> {
    const customer = await this.createUser(customerId);
    const car = await this.createCar(carId);
    return { customer, car };
  }

  // Update methods
  async updateBooking(
    bookingId: string,
    updates: Partial<Prisma.BookingUpdateInput>,
  ): Promise<void> {
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: updates,
    });

    // Update cache if exists
    const cachedBooking = this.cache.booking.findById(bookingId);
    if (cachedBooking) {
      Object.assign(cachedBooking, updates);
    }
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<Prisma.UserUpdateInput>,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: customerId },
      data: updates,
    });

    const cachedCustomer = this.cache.customer.findById(customerId);
    if (cachedCustomer) {
      Object.assign(cachedCustomer, updates);
    }
  }

  async updateCar(carId: string, updates: Partial<Prisma.CarUpdateInput>): Promise<void> {
    await this.prisma.car.update({
      where: { id: carId },
      data: updates,
    });

    const cachedCar = this.cache.car.findById(carId);
    if (cachedCar) {
      Object.assign(cachedCar, updates);
    }
  }

  // Find methods (cache-first)
  async findBookingById(bookingId: string): Promise<Booking | null> {
    // Try cache first
    const cached = this.cache.booking.findById(bookingId);
    if (cached) {
      return cached;
    }

    // Fallback to database
    return await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
  }

  async findCustomerById(customerId: string): Promise<User | null> {
    const cached = this.cache.customer.findById(customerId);
    if (cached) {
      return cached;
    }

    return await this.prisma.user.findUnique({
      where: { id: customerId },
    });
  }

  async findCarById(carId: string): Promise<Car | null> {
    const cached = this.cache.car.findById(carId);
    if (cached) {
      return cached;
    }

    return await this.prisma.car.findUnique({
      where: { id: carId },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
