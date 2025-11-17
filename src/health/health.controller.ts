import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { Roles } from "../iam/infrastructure/decorators/roles.decorator";
import { JwtAuthGuard } from "../iam/infrastructure/guards/jwt-auth.guard";
import { RolesGuard } from "../iam/infrastructure/guards/roles.guard";
import { SchedulerService } from "../scheduling/application/services/scheduler.service";
import { TypedConfigService } from "../shared/config/typed-config.service";
import { PrismaHealthIndicator } from "./indicators/prisma-health.indicator";
import { RedisHealthIndicator } from "./indicators/redis-health.indicator";

export enum ReminderType {
  TripStart = "trip-start",
  TripEnd = "trip-end",
  LegStart = "leg-start",
  LegEnd = "leg-end",
}

export enum StatusUpdateType {
  ConfirmedToActive = "confirmed-to-active",
  ActiveToCompleted = "active-to-completed",
}

export enum ProcessingType {
  PendingPayouts = "pending-payouts",
  PendingNotifications = "pending-notifications",
}
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealthIndicator: PrismaHealthIndicator,
    private readonly redisHealthIndicator: RedisHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly schedulerService: SchedulerService,
    private readonly configService: TypedConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    // Use different memory thresholds based on environment
    const isTest = this.configService.isTest || this.configService.app.testPort;
    const memoryThreshold = isTest ? 2 * 1024 * 1024 * 1024 : 150 * 1024 * 1024; // 2GB for tests, 150MB for production

    const healthChecks = [
      () => this.prismaHealthIndicator.pingCheck("database"),
      () => this.redisHealthIndicator.checkHealth("redis"),
      () => this.memory.checkHeap("memory_heap", memoryThreshold),
      () => this.disk.checkStorage("storage", { path: "/", thresholdPercent: 0.9 }),
    ];

    // Skip RSS check for tests as it's often unreliable
    // if (!isTest) {
    //   healthChecks.push(() => this.memory.checkRSS("memory_rss", memoryThreshold));
    // }

    return this.health.check(healthChecks);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "staff")
  @Post("trigger/reminders/:type")
  async triggerReminders(@Param("type", new ParseEnumPipe(ReminderType)) type: ReminderType) {
    try {
      await this.schedulerService.triggerManualReminderJob(type);
      return { success: true, message: `${type} reminder job triggered` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "staff")
  @Post("trigger/status-updates/:type")
  async triggerStatusUpdates(
    @Param("type", new ParseEnumPipe(StatusUpdateType)) type: StatusUpdateType,
  ) {
    try {
      const validTypes = ["confirmed-to-active", "active-to-completed"];

      if (!validTypes.includes(type)) {
        return {
          success: false,
          message: `Invalid status update type. Valid types: ${validTypes.join(", ")}`,
        };
      }

      await this.schedulerService.triggerManualStatusUpdate(type);
      return { success: true, message: `${type} status update job triggered` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "staff")
  @Post("trigger/processing/:type")
  async triggerProcessing(@Param("type", new ParseEnumPipe(ProcessingType)) type: ProcessingType) {
    try {
      await this.schedulerService.triggerManualProcessing(type);
      return { success: true, message: `${type} processing job triggered` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
