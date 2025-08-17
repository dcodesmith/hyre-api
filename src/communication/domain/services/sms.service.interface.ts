export interface SmsRequest {
  to: string;
  message: string;
  templateKey?: string;
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
