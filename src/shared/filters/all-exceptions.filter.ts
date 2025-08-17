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

    let status: number;
    let message: string;
    let errorCode: string | undefined;
    let context: string | undefined;
    let details: Record<string, any> | undefined;
    let errors: any[] | undefined;
    let errorType: string;

    // Determine error type and extract information
    if (exception instanceof BaseDomainError) {
      // Handle domain errors
      const result = this.handleDomainError(exception);
      status = result.status;
      message = result.message;
      errorCode = result.errorCode;
      context = result.context;
      details = result.details;
      errorType = "Domain Error";
    } else if (exception instanceof BadRequestException) {
      // Handle validation errors (potentially from ZodValidationPipe)
      const result = this.handleValidationError(exception);
      status = result.status;
      message = result.message;
      errors = result.errors;
      errorCode = result.errorCode;
      errorType = result.errorType;
    } else if (exception instanceof HttpException) {
      // Handle other HTTP exceptions
      status = exception.getStatus();
      message = exception.message;
      errorType = "HTTP Exception";

      // Try to extract additional details from the response
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, any>;
        if (responseObj.details) {
          details = responseObj.details;
        }
        if (responseObj.errors) {
          errors = responseObj.errors;
        }
      }
    } else {
      // Handle unknown errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      errorType = "Unknown Error";
    }

    // Log the error with appropriate level
    this.logError(request, status, exception, errorType, context);

    // Build standardized error response
    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    // Add optional fields based on error type
    if (errorCode) {
      errorResponse.error = errorCode;
    }

    if (context) {
      errorResponse.context = context;
    }

    if (details && Object.keys(details).length > 0) {
      errorResponse.details = details;
    }

    if (errors && errors.length > 0) {
      errorResponse.errors = errors;
    }

    // Add request correlation ID if available
    const correlationId = request.headers["x-correlation-id"] || request.headers["x-request-id"];
    if (correlationId) {
      errorResponse.correlationId = correlationId;
    }

    // Send response
    response.status(status).json(errorResponse);
  }

  private handleValidationError(exception: BadRequestException): {
    status: number;
    message: string;
    errors?: any[];
    errorCode?: string;
    errorType: string;
  } {
    const response = exception.getResponse();

    // Check if it's our structured Zod validation error
    if (typeof response === "object" && response !== null) {
      const responseObj = response as any;

      // Our ZodValidationPipe format
      if (responseObj.errors && Array.isArray(responseObj.errors)) {
        return {
          status: 400,
          message: responseObj.message || "Validation failed",
          errors: responseObj.errors,
          errorCode: "VALIDATION_ERROR",
          errorType: "Validation Error",
        };
      }

      // Other structured BadRequestException
      if (responseObj.message) {
        return {
          status: 400,
          message: responseObj.message,
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
    details?: Record<string, any>;
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
    const logMessage = `${request.method} ${request.url} - Status: ${status} - Type: ${errorType}${context ? ` - Context: ${context}` : ""}`;

    try {
      // Use injected logger service
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        // Server errors - full stack trace
        this.logger.error(
          logMessage,
          exception instanceof Error ? exception.stack : String(exception),
          "AllExceptionsFilter",
        );
      } else if (status >= 400) {
        // Client errors - warning level
        this.logger.warn(
          `${logMessage} - ${exception instanceof Error ? exception.message : String(exception)}`,
          "AllExceptionsFilter",
        );
      }
    } catch (loggerError) {
      // Fallback to internal logger if injected logger fails
      this.internalLogger.error(`Logging failed: ${loggerError}`);
      this.internalLogger.error(
        logMessage,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
  }
}
