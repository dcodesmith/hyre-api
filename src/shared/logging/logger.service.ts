import { Injectable, LoggerService as NestLoggerService } from "@nestjs/common";
import pino from "pino";
import { TypedConfigService } from "../config/typed-config.service";

type LogData = object | string | number;

export type { Logger } from "pino";

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: pino.Logger;

  constructor(private readonly configService: TypedConfigService) {
    this.logger = pino({
      level: process.env.LOG_LEVEL || (this.configService.isProduction ? "info" : "debug"),
      transport: !this.configService.isProduction
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
    });
  }

  log(message: string) {
    this.logger.info(message);
  }

  info(message: string, data?: LogData) {
    if (data && typeof data === "object") {
      this.logger.info(data, message);
    } else if (data !== undefined) {
      this.logger.info({ data }, message);
    } else {
      this.logger.info(message);
    }
  }

  error(message: string, trace?: string) {
    if (trace) {
      this.logger.error({ trace }, message);
    } else {
      this.logger.error(message);
    }
  }

  warn(message: string, data?: LogData) {
    if (data && typeof data === "object") {
      this.logger.warn(data, message);
    } else if (data !== undefined) {
      this.logger.warn({ data }, message);
    } else {
      this.logger.warn(message);
    }
  }

  debug(message: string, data?: LogData) {
    if (data && typeof data === "object") {
      this.logger.debug(data, message);
    } else if (data !== undefined) {
      this.logger.debug({ data }, message);
    } else {
      this.logger.debug(message);
    }
  }

  verbose(message: string) {
    this.logger.trace(message);
  }

  /**
   * Creates a child logger with the specified class name
   * Use this for class-specific logging context
   */
  createLogger(className: string): pino.Logger {
    return this.logger.child({ name: className });
  }
}
