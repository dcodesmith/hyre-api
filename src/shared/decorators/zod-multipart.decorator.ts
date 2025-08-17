import { BadRequestException, createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ZodError, ZodType } from "zod";

/**
 * Custom decorator that validates both form data and files in multipart requests
 * Usage: @ZodMultipart(carUploadSchema)
 */
export const ZodMultipart = <T>(schema: ZodType<T>) =>
  createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // Get form data from body and files from multer
    const formData = request.body;
    const files = request.files;

    // Combine them into a single object for validation
    const combinedData = {
      ...formData,
      ...files,
    };

    try {
      return schema.parse(combinedData);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
          code: issue.code,
          path: issue.path,
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
  })();
