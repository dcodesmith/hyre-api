import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { IamModule } from "../iam/iam.module";
import { LoggerService } from "../shared/logging/logger.service";
import { RedisModule } from "../shared/redis/redis.module";
import { RedisService } from "../shared/redis/redis.service";
import { SharedModule } from "../shared/shared.module";
import { CarUploadApplicationService } from "./application/services/car-upload-application.service";
// Application Services
import { FleetApplicationService } from "./application/services/fleet-application.service";
import { FleetCacheService } from "./application/services/fleet-cache.service";

// Domain Services
import { CarApprovalService } from "./domain/services/car-approval.service";
import { CarUploadService } from "./domain/services/car-upload.service";
import { FleetManagementService } from "./domain/services/fleet-management.service";

// Domain Repositories

import { CachedFleetCarRepository } from "./infrastructure/repositories/cached-fleet-car.repository";
// Infrastructure
import { PrismaCarRepository } from "./infrastructure/repositories/prisma-car.repository";
import { PrismaFleetRepository } from "./infrastructure/repositories/prisma-fleet.repository";

// Presentation
import { FleetController } from "./presentation/fleet.controller";

// Application Services
const applicationServices = [
  FleetApplicationService,
  CarUploadApplicationService,
  FleetCacheService,
];

// Domain Services
const domainServices = [FleetManagementService, CarApprovalService, CarUploadService];

// Repositories
const classProviders = [
  {
    provide: "FleetRepository",
    useClass: PrismaFleetRepository,
  },
];

const baseRepositories = [PrismaCarRepository];

const factoryProviders = [
  // Cached car repository with 7-day TTL for fleet operations
  {
    provide: "CarRepository",
    useFactory: (baseRepo: PrismaCarRepository, redis: RedisService, logger: LoggerService) => {
      return new CachedFleetCarRepository(baseRepo, redis, logger);
    },
    inject: [PrismaCarRepository, RedisService, LoggerService],
  },
];

// External Services (Anti-corruption layer)
const externalServices = [];

@Module({
  imports: [
    // Core modules
    CqrsModule,
    SharedModule,
    RedisModule, // For caching

    // Cross-domain dependencies
    IamModule, // For authorization services
  ],
  controllers: [FleetController],
  providers: [
    // Application layer
    ...applicationServices,

    // Domain layer
    ...domainServices,

    // Infrastructure layer
    ...classProviders,
    ...baseRepositories,
    ...factoryProviders,
    ...externalServices,
  ],
  exports: [
    // Export main services for use by other modules
    FleetApplicationService,
    FleetManagementService,
    CarApprovalService,
    FleetCacheService,

    // Export repositories for potential cross-domain use
    "FleetRepository",
    "CarRepository",
  ],
})
export class FleetModule {}
