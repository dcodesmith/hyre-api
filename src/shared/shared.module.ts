import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";

import { TypedConfigService } from "./config/typed-config.service";
import { PrismaService } from "./database/prisma.service";
import { DomainEventPublisher } from "./events/domain-event-publisher";
import { S3FileStorageAdapter } from "./infrastructure/adapters/s3-file-storage.adapter";
import { AwsModule } from "./infrastructure/external/aws/aws.module";
import { FlutterwaveModule } from "./infrastructure/external/flutterwave/flutterwave.module";
import { PrismaDocumentApprovalRepository } from "./infrastructure/repositories/prisma-document-approval.repository";
import { LoggerService } from "./logging/logger.service";
import { RedisModule } from "./redis/redis.module";

@Global()
@Module({
  imports: [ConfigModule, CqrsModule, RedisModule, FlutterwaveModule, AwsModule],
  providers: [
    PrismaService,
    LoggerService,
    DomainEventPublisher,
    TypedConfigService,
    {
      provide: "DocumentApprovalRepository",
      useClass: PrismaDocumentApprovalRepository,
    },
    {
      provide: "FileStorageService",
      useClass: S3FileStorageAdapter,
    },
  ],
  exports: [
    PrismaService,
    LoggerService,
    DomainEventPublisher,
    TypedConfigService,
    RedisModule,
    FlutterwaveModule,
    AwsModule,
    "DocumentApprovalRepository",
    "FileStorageService",
  ],
})
export class SharedModule {}
