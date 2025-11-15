import type { Provider } from "@nestjs/common";
import type { Logger } from "pino";
import { LoggerService } from "./logger.service";

type LogData = object | string | number;

/**
 * Logger interface that matches LoggerService methods but for individual service instances
 * This provides the same interface as LoggerService but pre-configured with service context
 */
export interface ServiceLogger {
  log(message: string): void;
  info(message: string, data?: LogData): void;
  error(message: string, trace?: string): void;
  warn(message: string, data?: LogData): void;
  debug(message: string, data?: LogData): void;
  verbose(message: string): void;
}

/**
 * Wrapper class that adapts pino.Logger to our ServiceLogger interface
 */
class PinoServiceLoggerAdapter implements ServiceLogger {
  constructor(private readonly pinoLogger: Logger) {}

  log(message: string): void {
    this.pinoLogger.info(message);
  }

  info(message: string, data?: LogData): void {
    if (data && typeof data === "object") {
      this.pinoLogger.info(data, message);
    } else if (data !== undefined) {
      this.pinoLogger.info({ data }, message);
    } else {
      this.pinoLogger.info(message);
    }
  }

  error(message: string, trace?: string): void {
    if (trace) {
      this.pinoLogger.error({ trace }, message);
    } else {
      this.pinoLogger.error(message);
    }
  }

  warn(message: string, data?: LogData): void {
    if (data && typeof data === "object") {
      this.pinoLogger.warn(data, message);
    } else if (data !== undefined) {
      this.pinoLogger.warn({ data }, message);
    } else {
      this.pinoLogger.warn(message);
    }
  }

  debug(message: string, data?: LogData): void {
    if (data && typeof data === "object") {
      this.pinoLogger.debug(data, message);
    } else if (data !== undefined) {
      this.pinoLogger.debug({ data }, message);
    } else {
      this.pinoLogger.debug(message);
    }
  }

  verbose(message: string): void {
    this.pinoLogger.trace(message);
  }
}

/**
 * Creates a provider for injecting a pre-configured ServiceLogger instance for a specific service
 * This eliminates the need for manual `createLogger()` calls in service constructors
 * 
 * @param serviceName - The name of the service (usually ClassName.name)
 * @returns NestJS Provider that can be added to module providers array
 * 
 * @example
 * ```typescript
 * // In your module:
 * @Module({
 *   providers: [
 *     MyService,
 *     createLoggerProvider(MyService.name),
 *   ]
 * })
 * 
 * // In your service:
 * constructor(
 *   @Inject(getLoggerToken(MyService.name)) 
 *   private readonly logger: ServiceLogger
 * ) {}
 * ```
 */
export function createLoggerProvider(serviceName: string): Provider {
  const token = `Logger_${serviceName}`;
  
  return {
    provide: token,
    useFactory: (loggerService: LoggerService): ServiceLogger => {
      const pinoLogger = loggerService.createLogger(serviceName);
      return new PinoServiceLoggerAdapter(pinoLogger);
    },
    inject: [LoggerService],
  };
}

/**
 * Helper function to create the injection token for a service logger
 * Use this in your service constructor @Inject() decorator
 * 
 * @param serviceName - The name of the service (usually ClassName.name)
 * @returns The injection token string
 */
export function getLoggerToken(serviceName: string): string {
  return `Logger_${serviceName}`;
}