import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";
import { ScheduleModule } from "@nestjs/schedule";
import { TerminusModule } from "@nestjs/terminus";
import { BookingModule } from "./booking/booking.module";
import { CommunicationModule } from "./communication/communication.module";
import { FleetModule } from "./fleet/fleet.module";
import { HealthModule } from "./health/health.module";
import { IamModule } from "./iam/iam.module";
import { PaymentModule } from "./payment/payment.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { envValidation } from "./shared/config/env.validation";
import { SharedModule } from "./shared/shared.module";

@Module({
  imports: [
    // Core configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
    }),

    // Queue system
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
          maxRetriesPerRequest: null,
          family: 6,
        },
      }),
      inject: [ConfigService],
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // CQRS for domain events
    CqrsModule,

    // Health checks
    TerminusModule,

    // Application modules
    SharedModule,
    IamModule,
    FleetModule,
    BookingModule,
    PaymentModule,
    CommunicationModule,
    SchedulingModule,
    HealthModule,
  ],
})
export class AppModule {}
