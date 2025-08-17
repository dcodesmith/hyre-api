// app/db.server.ts (or wherever you prefer to initialize your PrismaClient)

import { PrismaClient } from "@prisma/client";
// import { logger } from "./logger.js"; // Assuming you have a logger utility

/**
 * Singleton Server-Side Pattern.
 * Ensures that only one instance of a given value is created and reused
 * across multiple calls within the same process/worker, which is crucial for
 * stateful resources like database clients in serverless environments.
 *
 * @param name A unique name for the singleton instance (e.g., "prisma", "redis").
 * @param value A function that returns the instance to be created. This function
 * will only be called once.
 * @returns The singleton instance.
 */
export function singleton<Value>(name: string, value: () => Value): Value {
  // We're extending the global object to store our singletons.
  // This is safe and common practice in Node.js serverless environments
  // where the 'global' object persists across warm function invocations.
  const globalStore = global as typeof global & {
    __singletons?: Record<string, Value>;
  };

  // Initialize the __singletons object if it doesn't exist.
  globalStore.__singletons ??= {};

  // If an instance with this name doesn't exist, create it.
  // Otherwise, return the existing instance.
  globalStore.__singletons[name] ??= value();

  return globalStore.__singletons[name];
}

const prisma = singleton("prisma", () => {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log:
      process.env.NODE_ENV === "development"
        ? [
            { level: "query", emit: "event" }, // Emit query events for detailed logging
            { level: "info", emit: "stdout" },
            { level: "warn", emit: "stdout" },
            { level: "error", emit: "stdout" },
          ]
        : [
            // In production, focus on warnings and errors to reduce log volume
            { level: "warn", emit: "stdout" },
            { level: "error", emit: "stdout" },
          ],
  });

  // Enhanced query logging in development for debugging slow queries
  if (process.env.NODE_ENV === "development") {
    client.$on("query", (queryEvent) => {
      // Log queries that take longer than 1000ms (1 second)
      if (queryEvent.duration > 1000) {
        console.warn(
          `[Prisma] Slow Query (${queryEvent.duration}ms): ${queryEvent.query} -- Params: ${queryEvent.params}`,
        );
      }
    });
  }

  client.$connect().catch((error) => {
    console.error(`[Prisma] Failed to connect to database on startup:`, error);
  });

  process.on("beforeExit", async () => {
    console.info("[Prisma] Disconnecting Prisma client on process exit.");
    await client.$disconnect();
  });

  return client;
});

export { prisma };
