import { z } from "zod";

// Webhook verification schema
export const WebhookVerificationSchema = z.object({
  "verif-hash": z.string(),
});

export type WebhookVerificationDto = z.infer<typeof WebhookVerificationSchema>;

// Flutterwave Customer schema
export const FlutterwaveCustomerSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone_number: z.string().nullable(),
  email: z.email(),
  created_at: z.string(),
});

export type FlutterwaveCustomer = z.infer<typeof FlutterwaveCustomerSchema>;

// Flutterwave Card schema (optional)
export const FlutterwaveCardSchema = z.object({
  first_6digits: z.string(),
  last_4digits: z.string(),
  issuer: z.string(),
  country: z.string(),
  type: z.string(),
  expiry: z.string(),
});

export type FlutterwaveCard = z.infer<typeof FlutterwaveCardSchema>;

// Flutterwave Metadata schema
export const FlutterwaveMetaDataSchema = z
  .object({
    transactionType: z.enum(["booking_creation", "booking_extension"]),
    bookingId: z.string().optional(), // Booking ID from frontend (camelCase)
    booking_id: z.string().optional(), // Booking ID (snake_case alternative)
  })
  .catchall(z.any()); // Allow additional properties

export type FlutterwaveMetaData = z.infer<typeof FlutterwaveMetaDataSchema>;

// Main webhook data schema
export const FlutterwaveWebhookDataSchema = z.object({
  id: z.number(),
  tx_ref: z.string(),
  flw_ref: z.string(),
  device_fingerprint: z.string().optional(),
  amount: z.number(),
  currency: z.string(),
  charged_amount: z.number(),
  app_fee: z.number(),
  merchant_fee: z.number(),
  processor_response: z.string(),
  auth_model: z.string(),
  ip: z.string().optional(),
  narration: z.string(),
  status: z.enum(["successful", "failed"]),
  payment_type: z.string(),
  created_at: z.string(),
  account_id: z.number(),
  customer: FlutterwaveCustomerSchema,
  card: FlutterwaveCardSchema.optional(),
});

export type FlutterwaveWebhookDto = z.infer<typeof FlutterwaveWebhookDataSchema>;

// Charge completed payload schema
export const FlutterwaveChargeCompletedPayloadSchema = z.object({
  event: z.literal("charge.completed"),
  data: FlutterwaveWebhookDataSchema,
  meta_data: FlutterwaveMetaDataSchema.optional(),
  "event.type": z.string(),
});

export type FlutterwaveChargeCompletedPayload = z.infer<
  typeof FlutterwaveChargeCompletedPayloadSchema
>;

// General webhook schema (can handle different event types)
export const FlutterwaveWebhookSchema = z.object({
  event: z.string(),
  data: FlutterwaveWebhookDataSchema,
  meta_data: FlutterwaveMetaDataSchema.optional(),
  "event.type": z.string().optional(),
});

export type FlutterwaveWebhookPayload = z.infer<typeof FlutterwaveWebhookSchema>;
