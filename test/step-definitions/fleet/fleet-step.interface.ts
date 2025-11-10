import { z } from "zod";

// Multer file schema (matches Express.Multer.File structure)
const multerFileSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string(),
  buffer: z.instanceof(Buffer),
  size: z
    .number()
    .positive()
    .max(5 * 1024 * 1024, "File size must not exceed 5MB"),
});

// Image file validation
const imageFileSchema = multerFileSchema.refine((file) => file.mimetype.startsWith("image/"), {
  message: "Must be an image file",
});

// PDF file validation
const pdfFileSchema = multerFileSchema.refine((file) => file.mimetype === "application/pdf", {
  message: "Must be a PDF file",
});

// Complete car upload schema that includes both form data and files
export const carUploadCompleteSchema = z.object({
  // Form fields (come as strings from multipart)
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
    .string()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num)) {
        throw new Error("Year must be a valid number");
      }
      return num;
    })
    .refine((num) => num >= 1990, "Year must be 1990 or later")
    .refine(
      (num) => num <= new Date().getFullYear() + 2,
      "Year cannot be more than 2 years in the future",
    ),

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

  dayRate: z.coerce.number().positive(),
  nightRate: z.coerce.number().positive(),
  hourlyRate: z.coerce.number().positive(),

  // File fields (come as arrays from multer)
  images: z
    .array(imageFileSchema)
    .min(1, "At least one car image is required")
    .max(5, "Maximum 5 images allowed"),

  motCertificate: z.array(pdfFileSchema).length(1, "MOT certificate is required"),

  insuranceCertificate: z.array(pdfFileSchema).length(1, "Insurance certificate is required"),
});

export type CarUploadCompleteDto = z.infer<typeof carUploadCompleteSchema>;
