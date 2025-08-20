import { Controller, Get, Param, Post } from "@nestjs/common";
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { SchedulerService } from "../scheduling/application/services/scheduler.service";
import { TypedConfigService } from "../shared/config/typed-config.service";
import { PrismaHealthIndicator } from "./indicators/prisma-health.indicator";
import { RedisHealthIndicator } from "./indicators/redis-health.indicator";

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
    if (!isTest) {
      healthChecks.push(() => this.memory.checkRSS("memory_rss", memoryThreshold));
    }

    return this.health.check(healthChecks);
  }

  @Get("queue-stats")
  async getQueueStats() {
    try {
      const stats = await this.schedulerService.getQueueStats();
      return {
        status: "healthy",
        ...stats,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Post("trigger/reminders/:type")
  async triggerReminders(@Param("type") type: string) {
    try {
      const validTypes = ["trip-start", "trip-end", "leg-start", "leg-end"];

      if (!validTypes.includes(type)) {
        return {
          success: false,
          message: `Invalid reminder type. Valid types: ${validTypes.join(", ")}`,
        };
      }

      await this.schedulerService.triggerManualReminderJob(type as any);
      return { success: true, message: `${type} reminder job triggered` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Post("trigger/status-updates/:type")
  async triggerStatusUpdates(@Param("type") type: string) {
    try {
      const validTypes = ["confirmed-to-active", "active-to-completed"];

      if (!validTypes.includes(type)) {
        return {
          success: false,
          message: `Invalid status update type. Valid types: ${validTypes.join(", ")}`,
        };
      }

      await this.schedulerService.triggerManualStatusUpdate(type as any);
      return { success: true, message: `${type} status update job triggered` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Post("trigger/processing/:type")
  async triggerProcessing(@Param("type") type: string) {
    try {
      const validTypes = ["pending-payouts", "pending-notifications"];

      if (!validTypes.includes(type)) {
        return {
          success: false,
          message: `Invalid processing type. Valid types: ${validTypes.join(", ")}`,
        };
      }

      await this.schedulerService.triggerManualProcessing(type as any);
      return { success: true, message: `${type} processing job triggered` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
