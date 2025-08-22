import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { BaseDomainError } from "../domain/errors/base-domain.error";
import { LoggerService } from "../logging/logger.service";
import { statusCodeMap } from "./status-code-map";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly internalLogger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolved = this.resolveException(exception);

    // Log the error with appropriate level
    this.logError(request, resolved.status, exception, resolved.errorType, resolved.context);

    // Build standardized error response
    const errorResponse = this.buildErrorResponse(request, resolved);

    // Send response
    response.status(resolved.status).json(errorResponse);
  }

  private handleValidationError(exception: BadRequestException): {
    status: number;
    message: string;
    errors?: unknown[];
    errorCode?: string;
    errorType: string;
  } {
    const response = exception.getResponse();

    // Check if it's our structured Zod validation error
    if (typeof response === "object" && response !== null) {
      const responseObj = response as Record<string, unknown>;

      // Our ZodValidationPipe format
      if (responseObj.errors && Array.isArray(responseObj.errors)) {
        return {
          status: 400,
          message:
            typeof responseObj.message === "string" ? responseObj.message : "Validation failed",
          errors: responseObj.errors,
          errorCode: "VALIDATION_ERROR",
          errorType: "Validation Error",
        };
      }

      // Other structured BadRequestException
      if (responseObj.message) {
        return {
          status: 400,
          message: typeof responseObj.message === "string" ? responseObj.message : "Bad Request",
          errorCode: "BAD_REQUEST",
          errorType: "Bad Request",
        };
      }
    }

    // Fallback for simple BadRequestException
    return {
      status: 400,
      message: exception.message || "Bad Request",
      errorCode: "BAD_REQUEST",
      errorType: "Bad Request",
    };
  }

  private handleDomainError(exception: BaseDomainError): {
    status: number;
    message: string;
    errorCode: string;
    context: string;
    details?: Record<string, unknown>;
  } {
    const status = statusCodeMap[exception.code] || HttpStatus.INTERNAL_SERVER_ERROR;

    return {
      status,
      message: exception.message,
      errorCode: exception.code,
      context: exception.context,
      details: exception.details,
    };
  }

  private logError(
    request: Request,
    status: number,
    exception: unknown,
    errorType: string,
    context?: string,
  ): void {
    const contextSuffix = context ? ` - Context: ${context}` : "";
    const logMessage = `${request.method} ${request.url} - Status: ${status} - Type: ${errorType}${contextSuffix}`;

    try {
      // Use injected logger service
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        // Server errors - full stack trace
        this.logger.error(
          logMessage,
          exception instanceof Error ? exception.message : "Unknown error",
        );
      } else if (status >= 400) {
        // Client errors - warning level
        this.logger.warn(
          logMessage,
          exception instanceof Error ? exception.message : "Unknown error",
        );
      }
    } catch (loggerError) {
      // Fallback to internal logger if injected logger fails
      this.internalLogger.error(`Logging failed: ${loggerError.message}`);
    }
  }

  private resolveException(exception: unknown): {
    status: number;
    message: string;
    errorCode?: string;
    context?: string;
    details?: Record<string, unknown>;
    errors?: unknown[];
    errorType: string;
  } {
    if (exception instanceof BaseDomainError) {
      const result = this.handleDomainError(exception);
      return {
        ...result,
        errorType: "Domain Error",
      };
    }

    if (exception instanceof BadRequestException) {
      const result = this.handleValidationError(exception);
      return result;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = exception.message;
      let details: Record<string, unknown> | undefined;
      let errors: unknown[] | undefined;

      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        details = (responseObj.details as Record<string, unknown>) || undefined;
        errors = (responseObj.errors as unknown[]) || undefined;
      }

      return {
        status,
        message,
        details,
        errors,
        errorType: "HTTP Exception",
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      errorType: "Unknown Error",
    };
  }

  private buildErrorResponse(
    request: Request,
    resolved: {
      status: number;
      message: string;
      errorCode?: string;
      context?: string;
      details?: Record<string, unknown>;
      errors?: unknown[];
    },
  ): Record<string, unknown> {
    const errorResponse: Record<string, unknown> = {
      statusCode: resolved.status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: resolved.message,
    };

    if (resolved.errorCode) {
      errorResponse.error = resolved.errorCode;
    }

    if (resolved.context) {
      errorResponse.context = resolved.context;
    }

    if (resolved.details && Object.keys(resolved.details).length > 0) {
      errorResponse.details = resolved.details;
    }
    if (resolved.errors && resolved.errors.length > 0) {
      errorResponse.errors = resolved.errors;
    }

    const correlationId = this.getCorrelationId(request);
    if (correlationId) {
      errorResponse.correlationId = correlationId;
    }

    return errorResponse;
  }

  private getCorrelationId(request: Request): string | string[] | undefined {
    return request.headers["x-correlation-id"] || request.headers["x-request-id"];
  }
}
