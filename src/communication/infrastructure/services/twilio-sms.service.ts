import { Injectable } from "@nestjs/common";
import { Twilio } from "twilio";
import { TypedConfigService } from "../../../shared/config/typed-config.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import {
  SmsRequest,
  SmsResponse,
  SmsService,
  Template,
} from "../../domain/services/sms.service.interface";

@Injectable()
export class TwilioSmsService extends SmsService {
  private readonly twilioClient: Twilio;
  private readonly whatsappNumber: string;

  constructor(
    private readonly configService: TypedConfigService,
    private readonly logger: LoggerService,
  ) {
    super();

    const twilioConfig = this.configService.twilio;

    this.twilioClient = new Twilio(twilioConfig.accountSid, twilioConfig.authToken);
    const rawWa = twilioConfig.whatsappNumber;
    const normalizedWa = rawWa.startsWith("+") ? rawWa : `+${rawWa}`;
    this.whatsappNumber = rawWa.startsWith("whatsapp:") ? rawWa : `whatsapp:${normalizedWa}`;
  }

  async send(request: SmsRequest): Promise<SmsResponse> {
    try {
      this.logger.log(`Sending SMS to ${this.maskPhone(request.to)}`);

      if (request.templateKey && request.variables) {
        return await this.sendWhatsAppMessage(request);
      }
      return await this.sendPlainSms(request);
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async sendPlainSms(request: SmsRequest): Promise<SmsResponse> {
    try {
      if (!request.message || request.message.trim().length === 0) {
        return {
          success: false,
          error: "Plain SMS requires a non-empty message body",
        };
      }
      const message = await this.twilioClient.messages.create({
        body: request.message,
        from: this.configService.twilio.phoneNumber,
        to: request.to,
      });
      // …rest of implementation…
      this.logger.log(`SMS sent successfully with SID: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      return {
        success: false,
        error: `SMS sending failed: ${error.message}`,
      };
    }
  }

  private async sendWhatsAppMessage(request: SmsRequest): Promise<SmsResponse> {
    try {
      const whatsappTo = request.to.startsWith("whatsapp:") ? request.to : `whatsapp:${request.to}`;

      if (!request.templateKey) {
        throw new Error("Template key is required for template messages");
      }

      const message = await this.twilioClient.messages.create({
        contentSid: this.getContentSid(request.templateKey),
        contentVariables: JSON.stringify(request.variables || {}),
        from: this.whatsappNumber,
        to: whatsappTo,
      });

      this.logger.log(`WhatsApp template message sent successfully with SID: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      // Fallback to plain SMS if WhatsApp template fails AND a plain message is provided
      this.logger.warn(`WhatsApp template failed: ${error.message}`);

      if (request.message && request.message.trim().length > 0) {
        this.logger.warn("Falling back to plain SMS path");
        return await this.sendPlainSms(request);
      }

      return {
        success: false,
        error: `WhatsApp template failed and no plain SMS message provided: ${error.message}`,
      };
    }
  }

  private getContentSid(templateKey: Template): string {
    const contentSidMapping: Record<Template, string> = {
      [Template.BookingStatusUpdate]: "HX199f51dda921d5a781b2424b82b931a5",
      [Template.ClientBookingLegStartReminder]: "HX862149f716a87ae25ce34151140bfc60",
      [Template.ChauffeurBookingLegStartReminder]: "HX8d44b0747c995713d129d77f4cc3c860",
      [Template.ClientBookingLegEndReminder]: "HX0c8470054c0ff1a0b43c06fe196e2ec3",
      [Template.ChauffeurBookingLegEndReminder]: "HX9faf29432a18e9f8f8283a5e281e5a3c",
    };

    const sid = contentSidMapping[templateKey];

    if (!sid) {
      throw new Error(`Content SID not found for template: ${templateKey}`);
    }

    return sid;
  }

  private maskPhone(value: string): string {
    const v = value.replace(/^whatsapp:/, "");
    const digits = v.replace(/\D/g, "");
    if (digits.length <= 4) return `***${digits}`;
    return `${v.slice(0, v.length - 4).replace(/\d/g, "*")}${v.slice(-4)}`;
  }

  // Legacy method to maintain compatibility with existing message sending
  async sendMessage(params: {
    variables: Record<string, string>;
    to: string;
    templateKey: Template;
  }): Promise<void> {
    const response = await this.send({
      to: params.to,
      message: "", // Will be ignored for template messages
      templateKey: params.templateKey,
      variables: params.variables,
    });

    if (!response.success) {
      throw new Error(`Message sending failed: ${response.error}`);
    }
  }
}
