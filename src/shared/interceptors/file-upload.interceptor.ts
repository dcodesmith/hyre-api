import { BadRequestException } from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { Request } from "express";

// Multer file interface - matches what NestJS provides
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface FileFieldConfig {
  name: string;
  maxCount: number;
  allowedTypes: string[];
  description?: string; // For better error messages
}

export interface FileUploadConfig {
  fields: FileFieldConfig[];
  maxFileSize?: number; // Per file limit in bytes
  totalFileLimit?: number; // Total number of files across all fields
}

/**
 * Shared, configurable file upload interceptor
 * Handles multiple file fields with field-specific validation
 *
 * @param config Configuration for fields, file types, and limits
 * @returns FileFieldsInterceptor configured for the specified requirements
 */
export function createFileUploadInterceptor(config: FileUploadConfig) {
  const {
    fields,
    maxFileSize = 5 * 1024 * 1024, // Default 5MB per file
    totalFileLimit,
  } = config;

  // Calculate total file limit if not explicitly provided
  const calculatedTotalLimit =
    totalFileLimit || fields.reduce((sum, field) => sum + field.maxCount, 0);

  // Create field configuration for Multer
  const multerFields = fields.map((field) => ({
    name: field.name,
    maxCount: field.maxCount,
  }));

  // Create field lookup for validation
  const fieldLookup = new Map(fields.map((field) => [field.name, field]));

  const multerOptions: MulterOptions = {
    limits: {
      fileSize: maxFileSize,
      files: calculatedTotalLimit,
    },
    fileFilter: (
      _req: Request,
      file: UploadedFile,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const fieldConfig = fieldLookup.get(file.fieldname);

      if (!fieldConfig) {
        callback(new BadRequestException(`Unknown file field: ${file.fieldname}`), false);
        return;
      }

      if (fieldConfig.allowedTypes.includes(file.mimetype)) {
        callback(null, true);
      } else {
        const fieldDescription = fieldConfig.description || fieldConfig.name;
        callback(
          new BadRequestException(
            `Invalid file type for ${fieldDescription}. Expected: ${fieldConfig.allowedTypes.join(", ")}. Got: ${file.mimetype}`,
          ),
          false,
        );
      }
    },
  };

  return FileFieldsInterceptor(multerFields, multerOptions);
}

// Pre-configured interceptors for common use cases

/**
 * Car upload configuration for fleet management
 */
export const carUploadConfig: FileUploadConfig = {
  fields: [
    {
      name: "images",
      maxCount: 5,
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      description: "car images",
    },
    {
      name: "motCertificate",
      maxCount: 1,
      allowedTypes: ["application/pdf"],
      description: "MOT certificate",
    },
    {
      name: "insuranceCertificate",
      maxCount: 1,
      allowedTypes: ["application/pdf"],
      description: "insurance certificate",
    },
  ],
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

/**
 * Fleet owner onboarding configuration
 */
export const onboardingConfig: FileUploadConfig = {
  fields: [
    {
      name: "certificateOfIncorporation",
      maxCount: 1,
      allowedTypes: ["application/pdf"],
      description: "Certificate of Incorporation",
    },
  ],
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

/**
 * Pre-configured car upload interceptor
 * Usage: @UseInterceptors(CarUploadInterceptor)
 */
export const CarUploadInterceptor = createFileUploadInterceptor(carUploadConfig);

/**
 * Pre-configured onboarding upload interceptor
 * Usage: @UseInterceptors(OnboardingUploadInterceptor)
 */
export const OnboardingUploadInterceptor = createFileUploadInterceptor(onboardingConfig);

// Export configuration factory functions for advanced customization

/**
 * Create customized car upload interceptor
 * @param overrides Partial overrides to default car upload config
 */
export function createCarUploadInterceptor(overrides?: Partial<FileUploadConfig>) {
  return createFileUploadInterceptor({
    ...carUploadConfig,
    ...overrides,
  });
}

/**
 * Create customized onboarding upload interceptor
 * @param overrides Partial overrides to default onboarding config
 */
export function createOnboardingUploadInterceptor(overrides?: Partial<FileUploadConfig>) {
  return createFileUploadInterceptor({
    ...onboardingConfig,
    ...overrides,
  });
}
