import { z } from "zod";

export const PaymentStatusQuerySchema = z.object({
  transactionType: z.string().optional(),
  transaction_id: z.string().optional(),
  tx_ref: z.string().optional(),
  status: z.string().optional(),
});

export type PaymentStatusQueryDto = z.infer<typeof PaymentStatusQuerySchema>;

export interface PaymentStatusCallbackResult {
  success: boolean;
  redirectUrl: string;
  message?: string;
  bookingStatus?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  bookingStatus: string;
  bookingReference?: string;
  message: string;
  paymentStatus?: string;
  redirectUrl?: string;
}
