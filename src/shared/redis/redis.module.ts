import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { RedisService } from "./redis.service";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
          maxRetriesPerRequest: null,
          lazyConnect: true,
          enableReadyCheck: true,
          tls: configService.get("NODE_ENV") === "production" ? {} : undefined,
        });
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService, "REDIS_CLIENT"],
})
export class RedisModule {}
