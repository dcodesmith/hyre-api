import pino from "pino";

// Shared test logger instance
export const testLogger = pino({
  level: "debug",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss.l",
      ignore: "pid,hostname",
      messageFormat: "{msg}",
    },
  },
});

// Convenience functions for common test logging patterns
export const logger = {
  // Basic logging
  info: (msg: string, data?: object) => testLogger.info(data, msg),
  warn: (msg: string, data?: object) => testLogger.warn(data, msg),
  error: (msg: string, error?: Error | string) => {
    if (error instanceof Error) {
      testLogger.error({ error: error.message, stack: error.stack }, msg);
    } else {
      testLogger.error({ error }, msg);
    }
  },
  debug: (msg: string, data?: object) => testLogger.debug(data, msg),

  // Test-specific patterns
  testStart: (name: string) => testLogger.info({ test: name }, "Starting test"),
  testEnd: (name: string, duration?: number) =>
    testLogger.info({ test: name, duration }, "Test completed"),
  scenario: (msg: string, data?: object) => testLogger.info(data, `Scenario: ${msg}`),
  step: (msg: string, data?: object) => testLogger.debug(data, `Step: ${msg}`),
  api: (method: string, endpoint: string, status?: number) =>
    testLogger.debug({ method, endpoint, status }, "API Call"),
  database: (operation: string, data?: object) =>
    testLogger.debug({ operation, ...data }, "Database"),
  cache: (operation: string, key?: string) => testLogger.debug({ operation, key }, "Cache"),
};
