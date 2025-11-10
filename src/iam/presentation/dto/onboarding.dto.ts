import { z } from "zod";

// Fleet Owner Onboarding Schema
export const fleetOwnerOnboardingSchema = z.object({
  name: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must not exceed 100 characters"),

  phoneNumber: z
    .string()
    .regex(
      /^\+234[789][01]\d{8}$/,
      "Phone number must be a valid Nigerian number (+234XXXXXXXXXX)",
    ),

  address: z
    .string()
    .min(10, "Address must be at least 10 characters")
    .max(200, "Address must not exceed 200 characters"),

  bankCode: z.string().regex(/^\d{3}$/, "Bank code must be 3 digits"),

  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),

  accountName: z
    .string()
    .min(2, "Account name must be at least 2 characters")
    .max(100, "Account name must not exceed 100 characters"),

  certificateOfIncorporation: z
    .array(z.any())
    .length(1, "Certificate of Incorporation is required")
    .refine((files) => {
      const file = files[0];
      return file && file.mimetype === "application/pdf";
    }, "Certificate must be a PDF file")
    .refine((files) => {
      const file = files[0];
      return file && file.size <= 5 * 1024 * 1024; // 5MB limit
    }, "Certificate file size must not exceed 5MB"),
});

export type FleetOwnerOnboardingDto = z.infer<typeof fleetOwnerOnboardingSchema>;

// Onboarding Success Response
export interface OnboardingSuccessResponse {
  success: true;
  data: {
    userId: string;
    userType: string;
    hasOnboarded: boolean;
    bankDetails: {
      bankName: string;
      accountNumber: string;
      isVerified: boolean;
    };
    documents: {
      type: string;
      url: string;
      status: string;
    }[];
  };
  message: string;
}

// Bank List Response
export interface BankInfo {
  name: string;
  code: string;
}

export interface BankListResponse {
  banks: BankInfo[];
}
