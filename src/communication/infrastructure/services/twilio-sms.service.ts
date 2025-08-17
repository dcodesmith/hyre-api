import { Injectable } from "@nestjs/common";
import { Twilio } from "twilio";
import { TypedConfigService } from "../../../shared/config/typed-config.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { SmsRequest, SmsResponse, SmsService } from "../../domain/services/sms.service.interface";

export enum Template {
  BookingStatusUpdate = "bookingStatusUpdate",
  ClientBookingLegStartReminder = "clientBookingLegStartReminder",
  ChauffeurBookingLegStartReminder = "chauffeurBookingLegStartReminder",
  ClientBookingLegEndReminder = "clientBookingLegEndReminder",
  ChauffeurBookingLegEndReminder = "chauffeurBookingLegEndReminder",
}

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
    this.whatsappNumber = `whatsapp:+${twilioConfig.whatsappNumber}`;
  }

  async send(request: SmsRequest): Promise<SmsResponse> {
    try {
      this.logger.log(`Sending SMS to ${request.to}`, "TwilioSmsService");

      if (request.templateKey && request.variables) {
        return await this.sendWhatsAppMessage(request);
      }
      return await this.sendPlainSms(request);
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`, error.stack, "TwilioSmsService");

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async sendPlainSms(request: SmsRequest): Promise<SmsResponse> {
    try {
      const message = await this.twilioClient.messages.create({
        body: request.message,
        from: this.configService.twilio.phoneNumber,
        to: request.to,
      });

      this.logger.log(`SMS sent successfully with SID: ${message.sid}`, "TwilioSmsService");

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

      this.logger.log(
        `WhatsApp template message sent successfully with SID: ${message.sid}`,
        "TwilioSmsService",
      );

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      // Fallback to plain SMS if WhatsApp template fails
      this.logger.warn(
        `WhatsApp template failed, falling back to SMS: ${error.message}`,
        "TwilioSmsService",
      );

      return await this.sendPlainSms(request);
    }
  }

  private getContentSid(templateKey: string): string {
    const contentSidMapping: Record<Template, string> = {
      [Template.BookingStatusUpdate]: "HX199f51dda921d5a781b2424b82b931a5",
      [Template.ClientBookingLegStartReminder]: "HX862149f716a87ae25ce34151140bfc60",
      [Template.ChauffeurBookingLegStartReminder]: "HX8d44b0747c995713d129d77f4cc3c860",
      [Template.ClientBookingLegEndReminder]: "HX0c8470054c0ff1a0b43c06fe196e2ec3",
      [Template.ChauffeurBookingLegEndReminder]: "HX9faf29432a18e9f8f8283a5e281e5a3c",
    };

    return contentSidMapping[templateKey] || "";
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
