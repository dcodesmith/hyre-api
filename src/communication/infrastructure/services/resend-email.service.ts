import { Injectable } from "@nestjs/common";
import { Resend } from "resend";
import { TypedConfigService } from "../../../shared/config/typed-config.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import {
  EmailRequest,
  EmailResponse,
  EmailService,
} from "../../domain/services/email.service.interface";
import { NotificationContent } from "../../domain/value-objects/notification-content.vo";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

@Injectable()
export class ResendEmailService extends EmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(
    private readonly configService: TypedConfigService,
    private readonly logger: LoggerService,
  ) {
    super();
    this.resend = new Resend(this.configService.email.resendApiKey);
    this.fromEmail = `Damola from ${this.configService.app.name} <no-reply@dcodesmith.com>`;
  }

  async sendEmail(request: EmailRequest): Promise<EmailResponse> {
    try {
      this.logger.log(`Sending email to ${request.to} with subject: ${request.subject}`);

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: request.to,
        subject: request.subject,
        html: request.htmlContent,
        text: request.textContent,
      });

      if (error) {
        this.logger.error(`Resend email error: ${error.message}`);
        return {
          success: false,
          error: error.message || "Unknown Resend error",
        };
      }

      this.logger.log(`Email sent successfully with ID: ${data?.id}`);

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send email: ${msg}`, stack);
      return {
        success: false,
        error: msg,
      };
    }
  }

  async renderTemplate(content: NotificationContent): Promise<string> {
    // For now, we'll use a simple template. In a real application,
    // you might want to use a proper templating engine like Handlebars
    // or React components for email templates.

    const interpolatedContent = content.interpolate();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(interpolatedContent.subject)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #f4f4f4;
              padding: 20px;
              text-align: center;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            .content {
              background-color: #fff;
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 5px;
            }
            .footer {
              margin-top: 20px;
              padding: 10px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${this.configService.app.name}</h1>
          </div>
          <div class="content">
            <h2>${escapeHtml(interpolatedContent.subject)}</h2>
            <div style="white-space: pre-line;">${escapeHtml(interpolatedContent.body)}</div>
          </div>
          <div class="footer">
            <p>This is an automated message from ${this.configService.app.name}.</p>
          </div>
        </body>
      </html>
    `;
  }
}
