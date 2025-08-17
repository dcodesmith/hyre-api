import { after, afterAll, before, beforeAll, binding } from "cucumber-tsflow";
import { TestApp } from "../support/app";
import { Builder } from "../support/builder";
import { Cache } from "../support/cache";
import { DatabaseHelper } from "../support/database-helper";
import { logger } from "../support/logger";

@binding([])
class Hooks {
  private testApp: TestApp;
  private hooksDatabaseHelper: DatabaseHelper;
  private cache: Cache;

  constructor() {
    this.testApp = TestApp.getInstance();
    // const apiClient = ApiClient.getInstance(this.testApp.baseUrl);
    const builder = new Builder();
    this.cache = new Cache();
    this.hooksDatabaseHelper = new DatabaseHelper(builder, this.cache);
  }

  @beforeAll()
  public static async beforeAllScenarios(): Promise<void> {
    const testApp = TestApp.getInstance();
    await testApp.start();

    const isHealthy = await testApp.healthCheck();
    if (!isHealthy) {
      throw new Error("Test application failed health check");
    }
  }

  @afterAll()
  public static async afterAllScenarios(): Promise<void> {
    const testApp = TestApp.getInstance();
    await testApp.stop();
  }

  @before()
  public async beforeScenario(): Promise<void> {
    try {
      if (!this.testApp.isRunning()) {
        await this.testApp.start();
      }

      try {
        await this.hooksDatabaseHelper.cleanDatabase();
      } catch (dbError) {
        logger.warn("Database operations skipped:", dbError.message);
        logger.warn("Continuing without database setup");
      }
    } catch (error) {
      logger.error("Error in beforeScenario:", error);
      throw error;
    }
  }

  @after()
  public async afterScenario(): Promise<void> {
    try {
      try {
        this.cache.clear();
        await this.hooksDatabaseHelper.cleanDatabase();
      } catch (cacheError) {
        logger.warn("Cache clear skipped:", cacheError.message);
      }
    } catch (error) {
      logger.error("Error in afterScenario:", error);
    }
  }
}

export = Hooks;
