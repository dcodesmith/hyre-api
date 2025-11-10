import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaService } from "./shared/database/prisma.service";
import { AllExceptionsFilter } from "./shared/filters/all-exceptions.filter";
import { LoggingInterceptor } from "./shared/interceptors/logging.interceptor";
import { LoggerService } from "./shared/logging/logger.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Get logger service
  const loggerService = app.get(LoggerService);

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter(loggerService));

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(loggerService));

  // Prisma shutdown hook (Prisma 5.0.0+ compatible)
  const prismaService = app.get(PrismaService);

  // Enable graceful shutdown
  process.on("beforeExit", async () => {
    await prismaService.$disconnect();
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3000);

  await app.listen(port);
  loggerService.info(`Application is running on: http://localhost:${port}`);
}

bootstrap();
