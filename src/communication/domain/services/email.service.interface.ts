import { NotificationContent } from "../value-objects/notification-content.vo";

export interface EmailRequest {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export abstract class EmailService {
  abstract sendEmail(request: EmailRequest): Promise<EmailResponse>;
  abstract renderTemplate(content: NotificationContent): Promise<string>;
}
