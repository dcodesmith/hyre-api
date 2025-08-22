import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { config } from "dotenv";

// Load test environment variables BEFORE importing AppModule
// This ensures env validation has access to AWS vars
config({ path: ".env.test" });

import { AppModule } from "../../src/app.module";
import { NotificationService } from "../../src/communication/application/services/notification.service";
import { OnboardingApplicationService } from "../../src/iam/application/services/onboarding-application.service";
import { AllExceptionsFilter } from "../../src/shared/filters/all-exceptions.filter";
import { LoggerService } from "../../src/shared/logging/logger.service";
import { MockFileStorageService } from "../mocks/mock-file-storage.service";
import { MockNotificationService } from "../mocks/mock-notification.service";
import { MockOnboardingApplicationService } from "../mocks/mock-onboarding.service";
import { logger } from "./logger";

export class TestApp {
  private static instance: TestApp;
  private app: INestApplication;
  private module: TestingModule;
  public baseUrl: string;
  public port: number;

  private constructor() {
    // Override DATABASE_URL to use test database
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL || "postgresql://test:test@localhost:5432/test_db";

    this.port = parseInt(process.env.TEST_PORT || "3001");
    this.baseUrl = `http://localhost:${this.port}`;

    // Set TEST_PORT environment variable for health check detection
    process.env.TEST_PORT = this.port.toString();
  }

  static getInstance(): TestApp {
    if (!TestApp.instance) {
      TestApp.instance = new TestApp();
    }
    return TestApp.instance;
  }

  async start(): Promise<void> {
    if (this.app) {
      logger.info("Test app already running...");
      return;
    }

    try {
      // Create the testing module
      this.module = await Test.createTestingModule({
        imports: [AppModule],
      })
        // Override providers for testing
        .overrideProvider(LoggerService)
        .useValue({
          log: () => {},
          info: () => {},
          error: () => {},
          warn: () => {},
          debug: () => {},
          verbose: () => {},
          createLogger: () => {},
        })
        // Use mock notification service in tests
        .overrideProvider(NotificationService)
        .useClass(MockNotificationService)
        // Use mock file storage service to avoid S3 calls in tests
        .overrideProvider("FileStorageService")
        .useClass(MockFileStorageService)
        // Use mock onboarding service to avoid missing dependencies
        .overrideProvider(OnboardingApplicationService)
        .useClass(MockOnboardingApplicationService)
        .compile();

      // Create the application
      this.app = this.module.createNestApplication();

      // Apply global configurations
      this.app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );

      const loggerService = this.app.get(LoggerService);
      this.app.useGlobalFilters(new AllExceptionsFilter(loggerService));

      this.app.enableCors();

      await this.app.listen(this.port);

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      logger.error("Failed to start test application", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.app) {
      return;
    }

    try {
      await this.app.close();
      await this.module.close();
      this.app = null;
      this.module = null;
    } catch (error) {
      logger.error("Error stopping test application", error);
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getApp(): INestApplication {
    return this.app;
  }

  get<T = any>(token: any): T {
    return this.app.get<T>(token);
  }

  getMockNotificationService(): MockNotificationService {
    return this.app.get<MockNotificationService>(NotificationService);
  }

  getMockFileStorageService(): MockFileStorageService {
    return this.app.get<MockFileStorageService>("FileStorageService");
  }

  isRunning(): boolean {
    return !!this.app;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.app) return false;

    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
