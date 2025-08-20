export interface SmsRequest {
  to: string;
  message: string;
  templateKey?: Template;
  variables?: Record<string, string>;
}

export interface SmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export abstract class SmsService {
  abstract send(request: SmsRequest): Promise<SmsResponse>;
}

export enum Template {
  BookingStatusUpdate = "bookingStatusUpdate",
  ClientBookingLegStartReminder = "clientBookingLegStartReminder",
  ChauffeurBookingLegStartReminder = "chauffeurBookingLegStartReminder",
  ClientBookingLegEndReminder = "clientBookingLegEndReminder",
  ChauffeurBookingLegEndReminder = "chauffeurBookingLegEndReminder",
}
