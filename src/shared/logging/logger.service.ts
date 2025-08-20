import { Injectable, LoggerService as NestLoggerService } from "@nestjs/common";
import pino, { Logger } from "pino";
import { TypedConfigService } from "../config/typed-config.service";

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: Logger;
  private context?: string;

  constructor(private readonly configService: TypedConfigService) {
    this.logger = pino({
      level: this.configService.isProduction ? "info" : "debug",
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

  log(message: string, context?: string) {
    const logContext = context || this.context;
    if (logContext) {
      this.logger.info({ context: logContext }, message);
    } else {
      this.logger.info(message);
    }
  }

  info(message: string, data?: object | string | number) {
    const contextualData = this.getContextualData(data);
    if (Object.keys(contextualData).length > 0) {
      this.logger.info(contextualData, message);
    } else {
      this.logger.info(message);
    }
  }

  error(message: string, trace?: string, context?: string) {
    const errorData: Record<string, unknown> = {};
    if (trace) errorData.trace = trace;

    const logContext = context || this.context;
    if (logContext) errorData.context = logContext;

    if (Object.keys(errorData).length > 0) {
      this.logger.error(errorData, message);
    } else {
      this.logger.error(message);
    }
  }

  warn(message: string, context?: string | object) {
    if (context) {
      if (typeof context === "string") {
        this.logger.warn({ context }, message);
      } else {
        const contextualData = this.getContextualData(context);
        this.logger.warn(contextualData, message);
      }
    } else if (this.context) {
      this.logger.warn({ context: this.context }, message);
    } else {
      this.logger.warn(message);
    }
  }

  debug(message: string, context?: string) {
    const logContext = context || this.context;
    if (logContext) {
      this.logger.debug({ context: logContext }, message);
    } else {
      this.logger.debug(message);
    }
  }

  verbose(message: string, context?: string) {
    const logContext = context || this.context;
    if (logContext) {
      this.logger.trace({ context: logContext }, message);
    } else {
      this.logger.trace(message);
    }
  }

  setContext(context: string) {
    this.context = context;
  }

  private getContextualData(data?: object | string | number): object {
    const contextualData = this.context ? { context: this.context } : {};

    if (data && typeof data === "object") {
      return { ...contextualData, ...data };
    } else if (data !== undefined) {
      return { ...contextualData, data };
    }

    return contextualData;
  }
}
