import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { UserRegisteredEvent } from "../../domain/events/user-registered.event";

@EventsHandler(UserRegisteredEvent)
export class UserRegisteredHandler implements IEventHandler<UserRegisteredEvent> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: UserRegisteredEvent) {
    this.logger.info("Handling user registered event", {
      userId: event.aggregateId,
      email: event.email,
      role: event.role,
    });

    try {
      // Send welcome notification based on user role
      await this.sendWelcomeNotification(event);

      // Additional actions based on registration type
      if (event.registrationType === "SELF_REGISTRATION") {
        await this.handleSelfRegistration(event);
      }

      this.logger.info("User registered event handled successfully", { userId: event.aggregateId });
    } catch (error) {
      this.logger.error(
        "Failed to handle user registered event",
        error.stack,
        "UserRegisteredHandler",
      );
      // Don't rethrow - we don't want to fail the registration for notification issues
    }
  }

  private async sendWelcomeNotification(event: UserRegisteredEvent): Promise<void> {
    const welcomeMessages = {
      CUSTOMER:
        "Welcome to Hyre! You can now start booking vehicles for your transportation needs.",
      FLEET_OWNER:
        "Welcome to Hyre! Your registration is being reviewed. You'll be notified once your account is approved.",
      CHAUFFEUR: "Welcome to Hyre! Your chauffeur account has been created by your fleet owner.",
      STAFF: "Welcome to the Hyre admin team! Your staff account has been created.",
      ADMIN: "Welcome to Hyre! Your admin account has been created.",
    };

    const message =
      welcomeMessages[event.role as keyof typeof welcomeMessages] || "Welcome to Hyre!";

    // TODO: Send email notification if available when NotificationService API is ready
    // if (event.email) {
    //   await this.notificationService.sendEmail({
    //     recipientId: event.aggregateId,
    //     subject: "Welcome to Hyre",
    //     templateId: "user-welcome",
    //     templateData: {
    //       role: event.role,
    //       message,
    //     },
    //   });
    // }

    // TODO: Send SMS notification when NotificationService API is ready
    // await this.notificationService.sendSms({
    //   recipientId: event.aggregateId,
    //   message: `${message} Your user ID is ${event.aggregateId.substring(0, 8)}.`,
    // });
  }

  private async handleSelfRegistration(event: UserRegisteredEvent): Promise<void> {
    // Additional processing for self-registered users
    if (event.role === "FLEET_OWNER") {
      // TODO: Notify admins about new fleet owner registration when NotificationService API is ready
      // await this.notificationService.notifyAdmins({
      //   type: "NEW_FLEET_OWNER_REGISTRATION",
      //   data: {
      //     userId: event.aggregateId,
      //     email: event.email,
      //     phoneNumber: event.phoneNumber,
      //   },
      // });
    }
  }
}
