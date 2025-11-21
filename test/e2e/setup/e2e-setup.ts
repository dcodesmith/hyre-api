import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "@dotenvx/dotenvx";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

/**
 * Global setup for E2E tests using Testcontainers
 *
 * This function runs once before all tests and:
 * 1. Loads environment variables from .env.test or .env file
 * 2. Starts PostgreSQL container
 * 3. Starts Redis container
 * 4. Overrides DATABASE_URL and REDIS_URL with container URLs
 * 5. Generates Prisma client
 * 6. Runs Prisma migrations
 * 7. Returns teardown function for cleanup
 */
export async function setup() {
  try {
    console.log("🚀 Starting Testcontainers for E2E tests...");

    // Load environment variables from .env.test or .env
    console.log("📄 Loading environment variables...");
    const envTestPath = resolve(process.cwd(), ".env.test");

    try {
      config({ path: envTestPath, quiet: true }); // Suppress dotenvx logs
      console.log("✅ Loaded .env.test");
    } catch {
      // Continue with existing environment variables
    }

    // Start PostgreSQL container
    console.log("📦 Starting PostgreSQL container...");
    pgContainer = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("hyre_e2e_db")
      .withUsername("testuser")
      .withPassword("testpassword")
      .withExposedPorts(5432) // Exposes 5432 inside container to a random host port
      .start();

    console.log(`✅ PostgreSQL started: ${pgContainer.getHost()}:${pgContainer.getPort()}`);

    // Start Redis container
    console.log("📦 Starting Redis container...");
    redisContainer = await new RedisContainer("redis:7-alpine").withExposedPorts(6379).start();

    const redisHost = redisContainer.getHost();
    const redisPort = redisContainer.getMappedPort(6379);
    const redisUrl = `redis://${redisHost}:${redisPort}`;
    console.log(`✅ Redis started: ${redisHost}:${redisPort}`);

    const databaseUrl = pgContainer.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.REDIS_HOST = redisHost;
    process.env.REDIS_PORT = redisPort.toString();
    process.env.NODE_ENV = "test";

    const prismaEnv = { ...process.env, DATABASE_URL: databaseUrl };

    // Generate Prisma client with test database URL
    console.log("🔧 Generating Prisma client with test database URL...");
    try {
      execSync("pnpm prisma generate", {
        env: prismaEnv,
        stdio: process.env.VERBOSE_TESTS ? "inherit" : "pipe", // Hide output unless VERBOSE_TESTS=true
      });
      console.log("✅ Prisma client generated successfully");
    } catch (error) {
      console.error("❌ Prisma client generation failed:", error);
      throw error;
    }

    // Push Prisma schema to test database (development mode)
    console.log("📋 Pushing Prisma schema to test database...");

    try {
      execSync("pnpm prisma db push --skip-generate", {
        env: prismaEnv,
        stdio: process.env.VERBOSE_TESTS ? "inherit" : "pipe", // Hide output unless VERBOSE_TESTS=true
      });
      console.log("✅ Prisma schema pushed successfully");
    } catch (error) {
      console.error("❌ Prisma db push failed:", error);
      throw error;
    }

    console.log("✨ E2E test environment ready!\n");

    // Return teardown function to stop containers after tests
    return async () => {
      if (pgContainer) {
        await pgContainer.stop();
      }

      if (redisContainer) {
        await redisContainer.stop();
      }
    };
  } catch (error) {
    if (pgContainer) {
      await pgContainer.stop().catch((stopError) => {
        console.error("Failed to stop PostgreSQL container during cleanup:", stopError);
      });
    }

    if (redisContainer) {
      await redisContainer.stop().catch((stopError) => {
        console.error("Failed to stop Redis container during cleanup:", stopError);
      });
    }

    throw error;
  }
}
