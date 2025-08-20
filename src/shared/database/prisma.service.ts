import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { TypedConfigService } from "../config/typed-config.service";
import { LoggerService } from "../logging/logger.service";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly logger: LoggerService,
    private readonly configService: TypedConfigService,
  ) {
    super({
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "error" },
        { emit: "event", level: "info" },
        { emit: "event", level: "warn" },
      ],
      // Add this line to enable lifecycle events
      errorFormat: "pretty",
    });

    // Log database queries in development (but not in test environment)
    if (this.configService.isDevelopment && !this.configService.app.testPort) {
      this.$on("query", (queryEvent) => {
        this.logger.debug(
          `Query: ${queryEvent.query} - Params: ${queryEvent.params} - Duration: ${queryEvent.duration}ms`,
        );
      });
    }

    this.$on("error", (logEvent) => {
      this.logger.error("Prisma error:", logEvent.message);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Database connected successfully");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Database disconnected");
  }

  async enableShutdownHooks(app: INestApplication) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    this.$on("beforeExit" as any, async () => {
      await app.close();
    });
  }
}
