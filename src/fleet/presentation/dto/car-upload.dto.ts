import { z } from "zod";

// File validation schema
export const fileUploadSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  contentType: z.string().min(1, "Content type is required"),
  buffer: z.instanceof(Buffer, { message: "File buffer is required" }),
  size: z
    .number()
    .positive("File size must be positive")
    .max(5 * 1024 * 1024, "File size must not exceed 5MB"),
});

// Image-specific validation
export const imageFileSchema = fileUploadSchema.refine(
  (file) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    return validTypes.includes(file.contentType.toLowerCase());
  },
  {
    message: "Image must be JPEG, PNG, or WebP format",
  },
);

// PDF document validation
export const pdfFileSchema = fileUploadSchema.refine(
  (file) => file.contentType === "application/pdf",
  {
    message: "Document must be a PDF file",
  },
);

// Car upload schema
export const carUploadSchema = z.object({
  make: z
    .string()
    .min(1, "Make is required")
    .max(50, "Make must not exceed 50 characters")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Make contains invalid characters"),

  model: z
    .string()
    .min(1, "Model is required")
    .max(50, "Model must not exceed 50 characters")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Model contains invalid characters"),

  year: z
    .number()
    .int("Year must be an integer")
    .min(1990, "Year must be 1990 or later")
    .max(new Date().getFullYear() + 2, "Year cannot be more than 2 years in the future"),

  color: z
    .string()
    .min(1, "Color is required")
    .max(30, "Color must not exceed 30 characters")
    .regex(/^[a-zA-Z\s]+$/, "Color can only contain letters and spaces"),

  registrationNumber: z
    .string()
    .min(1, "Registration number is required")
    .max(20, "Registration number must not exceed 20 characters")
    .regex(/^[A-Z0-9-\s]+$/i, "Registration number contains invalid characters"),

  dayRate: z
    .number()
    .positive("Day rate must be positive")
    .max(1000000, "Day rate seems unreasonably high"),

  nightRate: z
    .number()
    .positive("Night rate must be positive")
    .max(1000000, "Night rate seems unreasonably high"),

  hourlyRate: z
    .number()
    .positive("Hourly rate must be positive")
    .max(100000, "Hourly rate seems unreasonably high"),

  images: z
    .array(imageFileSchema)
    .min(1, "At least one car image is required")
    .max(5, "Maximum 5 images allowed"),

  motCertificate: pdfFileSchema,

  insuranceCertificate: pdfFileSchema,
});

export type CarUploadDto = z.infer<typeof carUploadSchema>;

export interface CarUploadResponseDto {
  success: boolean;
  data?: {
    carId: string;
    status: string;
    uploadedImages: string[];
    documents: {
      motCertificate: string;
      insuranceCertificate: string;
    };
  };
  message: string;
  errors?: Record<string, string[]>;
}
