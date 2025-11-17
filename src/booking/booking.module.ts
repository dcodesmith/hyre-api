import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { CommunicationModule } from "../communication/communication.module";
import { FleetModule } from "../fleet/fleet.module";
import { PrismaCarRepository as FleetPrismaCarRepository } from "../fleet/infrastructure/repositories/prisma-car.repository";
import { IamModule } from "../iam/iam.module";
import { PaymentVerificationAdapter } from "../payment/infrastructure/adapters/payment-verification.adapter";
import { PaymentModule } from "../payment/payment.module";
import { LoggerService } from "../shared/logging/logger.service";
import { RedisModule } from "../shared/redis/redis.module";
import { RedisService } from "../shared/redis/redis.service";
import { BookingCancelledHandler } from "./application/event-handlers/booking-cancelled.handler";
import { BookingChauffeurAssignedHandler } from "./application/event-handlers/booking-chauffeur-assigned.handler";
import { BookingChauffeurUnassignedHandler } from "./application/event-handlers/booking-chauffeur-unassigned.handler";
import { BookingCreatedHandler } from "./application/event-handlers/booking-created.handler";
import { BookingPaymentConfirmedHandler } from "./application/event-handlers/booking-payment-confirmed.handler";
import { PaymentVerificationCompletedHandler } from "./application/event-handlers/payment-verification-completed.handler";
import { BookingLegQueryService } from "./application/queries/booking-leg-query.service";
import { BookingApplicationService } from "./application/services/booking-application.service";
import { BookingCreationService } from "./application/services/booking-creation.service";
import { BookingLifecycleService } from "./application/services/booking-lifecycle.service";
import { BookingPaymentService } from "./application/services/booking-payment.service";
import { BookingQueryService } from "./application/services/booking-query.service";
import { BookingReminderService } from "./application/services/booking-reminder.service";
import { CarCacheService } from "./application/services/car-cache.service";
import { ChauffeurAssignmentService } from "./application/services/chauffeur-assignment.service";
import { PlatformFeeCacheService } from "./application/services/platform-fee-cache.service";
import { BookingAmountVerifierService } from "./domain/services/booking-amount-verifier.service";
import { BookingAuthorizationService } from "./domain/services/booking-authorization.service";
import { BookingChauffeurService } from "./domain/services/booking-chauffeur.service";
import { BookingCostCalculatorService } from "./domain/services/booking-cost-calculator.service";
import { BookingCustomerResolverService } from "./domain/services/booking-customer-resolver.service";
import { BookingDateService } from "./domain/services/booking-date.service";
import { BookingDomainService } from "./domain/services/booking-domain.service";
import { BookingEligibilityService } from "./domain/services/booking-eligibility.service";
import { ChauffeurValidationAdapter } from "./infrastructure/adapters/chauffeur-validation.adapter";
import { FleetValidationAdapter } from "./infrastructure/adapters/fleet-validation.adapter";
import { CachedCarRepository } from "./infrastructure/repositories/cached-car.repository";
import { CachedPlatformFeeRepository } from "./infrastructure/repositories/cached-platform-fee.repository";
import { PrismaAddonRateRepository } from "./infrastructure/repositories/prisma-addon-rate.repository";
import { PrismaBookingRepository } from "./infrastructure/repositories/prisma-booking.repository";
import { PrismaCarRepository as BookingPrismaCarRepository } from "./infrastructure/repositories/prisma-car.repository";
import { PrismaPlatformFeeRepository } from "./infrastructure/repositories/prisma-platform-fee.repository";
import { FlutterwavePaymentIntentService } from "./infrastructure/services/flutterwave-payment-intent.service";
import { BookingController } from "./presentation/booking.controller";

const EventHandlers = [
  BookingCancelledHandler,
  BookingCreatedHandler,
  BookingChauffeurAssignedHandler,
  BookingChauffeurUnassignedHandler,
  BookingPaymentConfirmedHandler,
  PaymentVerificationCompletedHandler,
];

@Module({
  controllers: [BookingController],
  imports: [CqrsModule, CommunicationModule, FleetModule, IamModule, PaymentModule, RedisModule],
  providers: [
    // Main orchestrator service
    BookingApplicationService,

    // Granular application services
    BookingCreationService,
    BookingPaymentService,
    BookingLifecycleService,
    BookingQueryService,
    BookingReminderService,

    // Query services (CQRS read side)
    BookingLegQueryService,

    // Other application services
    ChauffeurAssignmentService,
    PlatformFeeCacheService,
    CarCacheService,

    // Domain services
    BookingAmountVerifierService,
    BookingAuthorizationService,
    BookingCostCalculatorService,
    BookingCustomerResolverService,
    BookingEligibilityService,
    BookingChauffeurService,
    BookingDomainService,
    BookingDateService,
    // Anti-corruption layer adapters
    {
      provide: "ChauffeurValidationService",
      useClass: ChauffeurValidationAdapter,
    },
    {
      provide: "FleetValidationService",
      useClass: FleetValidationAdapter,
    },
    {
      provide: "PaymentVerificationService",
      useClass: PaymentVerificationAdapter,
    },
    {
      provide: "BookingRepository",
      useClass: PrismaBookingRepository,
    },
    {
      provide: "AddonRateRepository",
      useClass: PrismaAddonRateRepository,
    },

    // Base car repository for booking operations (returns DTOs)
    BookingPrismaCarRepository,

    // Fleet car repository for anti-corruption layer (returns Fleet entities)
    FleetPrismaCarRepository,
    {
      provide: "FleetCarRepository",
      useClass: FleetPrismaCarRepository,
    },

    // Cached car repository with 7-day TTL for booking operations
    {
      provide: "CarRepository",
      useFactory: (
        baseRepo: BookingPrismaCarRepository,
        redis: RedisService,
        logger: LoggerService,
      ) => {
        return new CachedCarRepository(baseRepo, redis, logger);
      },
      inject: [BookingPrismaCarRepository, RedisService, LoggerService],
    },

    // Base platform fee repository
    PrismaPlatformFeeRepository,

    // Cached platform fee repository with 7-day TTL
    {
      provide: "PlatformFeeRepository",
      useFactory: (
        baseRepo: PrismaPlatformFeeRepository,
        redis: RedisService,
        logger: LoggerService,
      ) => {
        return new CachedPlatformFeeRepository(baseRepo, redis, logger);
      },
      inject: [PrismaPlatformFeeRepository, RedisService, LoggerService],
    },
    {
      provide: "PaymentIntentService",
      useClass: FlutterwavePaymentIntentService,
    },
    ...EventHandlers,
  ],
  exports: [
    BookingApplicationService,
    BookingReminderService,
    PlatformFeeCacheService,
    CarCacheService,
  ],
})
export class BookingModule {}
