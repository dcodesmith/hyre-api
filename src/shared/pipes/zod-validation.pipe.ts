import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ZodError, ZodType } from "zod";

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
          code: issue.code,
          path: issue.path,
          // Only add extra properties if they exist on the issue
          ...("expected" in issue && { expected: issue.expected }),
          ...("received" in issue && { received: issue.received }),
          ...("options" in issue && { options: issue.options }),
          ...("minimum" in issue && { minimum: issue.minimum }),
          ...("maximum" in issue && { maximum: issue.maximum }),
        }));

        throw new BadRequestException({
          message: "Validation failed",
          statusCode: 400,
          error: "Validation Error",
          errors: formattedErrors,
          timestamp: new Date().toISOString(),
        });
      }

      throw new BadRequestException({
        message: "Validation failed - unexpected error",
        statusCode: 400,
        error: "Validation Error",
      });
    }
  }
}
