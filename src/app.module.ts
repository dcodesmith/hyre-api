import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { BullModule } from "@nestjs/bullmq";
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
import { OrchestrationModule } from "./shared/orchestration/orchestration.module";
import { SharedModule } from "./shared/shared.module";

@Module({
  imports: [
    // Core configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
      ignoreEnvFile: process.env.NODE_ENV === "test",
    }),

    // Queue system
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
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

    // Bull Board UI for queue monitoring
    BullBoardModule.forRoot({
      route: "/admin/queues",
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: "reminder-emails",
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: "status-updates",
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: "processing-jobs",
      adapter: BullMQAdapter,
    }),

    // Application modules
    SharedModule,
    IamModule,
    FleetModule,
    BookingModule,
    PaymentModule,
    CommunicationModule,
    SchedulingModule,
    HealthModule,

    // Cross-domain orchestration (import last to have access to all domains)
    OrchestrationModule,
  ],
})
export class AppModule {}
