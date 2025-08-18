import { Module } from "@nestjs/common";
import { OtpAuthenticationService } from "../iam/domain/services/otp-authentication.service";
import { OtpGeneratedHandler } from "./application/event-handlers/otp-generated.handler";
import { NotificationService } from "./application/services/notification.service";
import { NotificationRepository } from "./domain/repositories/notification.repository";
import { AuthNotificationFactoryService } from "./domain/services/auth-notification-factory.service";
import { BookingNotificationFactoryService } from "./domain/services/booking-notification-factory.service";
import { EmailService } from "./domain/services/email.service.interface";
import { NotificationFactoryService } from "./domain/services/notification-factory.service";
import { NotificationTemplateService } from "./domain/services/notification-template.service";
import { SmsService } from "./domain/services/sms.service.interface";
import { PrismaNotificationRepository } from "./infrastructure/repositories/prisma-notification.repository";
import { ResendEmailService } from "./infrastructure/services/resend-email.service";
import { TwilioSmsService } from "./infrastructure/services/twilio-sms.service";

const applicationServices = [NotificationService];
const eventHandlers = [OtpGeneratedHandler];
const domainServices = [
  NotificationFactoryService, // Main orchestrator service
  BookingNotificationFactoryService,
  AuthNotificationFactoryService,
  NotificationTemplateService,
  OtpAuthenticationService,
];
const repositories = [
  {
    provide: NotificationRepository,
    useClass: PrismaNotificationRepository,
  },
];
const infrastructureServices = [
  {
    provide: EmailService,
    useClass: ResendEmailService,
  },
  {
    provide: SmsService,
    useClass: TwilioSmsService,
  },
];

@Module({
  providers: [
    ...applicationServices,
    ...eventHandlers,
    ...domainServices,
    ...repositories,
    ...infrastructureServices,
  ],
  exports: [NotificationService, NotificationRepository, EmailService, SmsService],
})
export class CommunicationModule {}
