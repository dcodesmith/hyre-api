import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../communication/application/services/notification.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { UserRegisteredEvent } from "../../iam/domain/events/user-registered.event";
import { type Logger, LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for user registration workflows
 * Coordinates between IAM and Communication domains
 * Handles welcome notifications and role-specific onboarding processes
 */
@EventsHandler(UserRegisteredEvent)
export class UserRegistrationOrchestrator implements IEventHandler<UserRegisteredEvent> {
  private readonly logger: Logger;
  constructor(
    private readonly userProfileService: UserProfileApplicationService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(UserRegistrationOrchestrator.name);
  }

  async handle(event: UserRegisteredEvent): Promise<void> {
    this.logger.info(`Orchestrating user registration workflows for user ${event.aggregateId}`);

    try {
      // Orchestrate cross-domain workflows in parallel
      await Promise.allSettled([
        this.orchestrateWelcomeNotifications(event),
        this.orchestrateRoleSpecificWorkflows(event),
      ]);

      this.logger.info(`User registration orchestration completed for user ${event.aggregateId}`);
    } catch (error) {
      this.logger.error(
        `Error orchestrating user registration for ${event.email}: ${error.message}`,
      );
    }
  }

  /**
   * Orchestrates welcome notification workflows
   * Coordinates between IAM and Communication domains
   */
  private async orchestrateWelcomeNotifications(event: UserRegisteredEvent): Promise<void> {
    try {
      // Get complete user data from IAM domain
      const userData = await this.getUserData(event.aggregateId);

      if (!userData) {
        this.logger.warn(`Cannot send welcome notifications: user ${event.aggregateId} not found`);
        return;
      }

      // Determine notification type based on role and registration type
      const notificationType = this.determineWelcomeNotificationType(event);

      // Send appropriate welcome notification via Communication domain
      await this.sendWelcomeNotification(userData, event, notificationType);

      this.logger.info(
        `Welcome notification sent for user ${event.aggregateId}: ${notificationType}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending welcome notifications for user ${event.aggregateId}: ${error.message}`,
      );
    }
  }

  /**
   * Orchestrates role-specific onboarding workflows
   * Handles different onboarding paths based on user role
   */
  private async orchestrateRoleSpecificWorkflows(event: UserRegisteredEvent): Promise<void> {
    try {
      // Handle role-specific processes
      switch (event.role) {
        case "FLEET_OWNER":
          await this.handleFleetOwnerRegistration(event);
          break;
        case "CHAUFFEUR":
          await this.handleChauffeurRegistration(event);
          break;
        case "CUSTOMER":
          await this.handleCustomerRegistration(event);
          break;
        case "ADMIN":
        case "STAFF":
          await this.handleStaffRegistration(event);
          break;
        default:
          this.logger.warn(`No specific workflow for role: ${event.role}`);
      }
    } catch (error) {
      this.logger.error(
        `Error in role-specific workflow for user ${event.aggregateId}: ${error.message}`,
      );
    }
  }

  /**
   * Get complete user data from IAM domain
   */
  private async getUserData(userId: string) {
    try {
      return await this.userProfileService.getUserById(userId);
    } catch (error) {
      this.logger.warn(`Failed to fetch user data for ID ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Determines the appropriate welcome notification type
   */
  private determineWelcomeNotificationType(event: UserRegisteredEvent): string {
    if (event.registrationType === "SELF_REGISTRATION") {
      return `SELF_REGISTRATION_WELCOME_${event.role}`;
    }
    return `ADMIN_CREATED_WELCOME_${event.role}`;
  }

  /**
   * Sends welcome notification via Communication domain
   */
  private async sendWelcomeNotification(
    userData: any,
    event: UserRegisteredEvent,
    notificationType: string,
  ): Promise<void> {
    // This would use the notification service to send role-specific welcome messages
    // The actual implementation would depend on the notification templates available

    this.logger.info(`Sending ${notificationType} notification to ${event.email}`);

    // For now, we'll log the intention
    // In a full implementation, this would call the appropriate notification method
    // await this.notificationService.sendWelcomeNotification({
    //   userId: userData.getId(),
    //   email: userData.getEmail(),
    //   name: userData.getName(),
    //   role: event.role,
    //   notificationType,
    // });
  }

  /**
   * Handles fleet owner specific registration workflows
   */
  private async handleFleetOwnerRegistration(event: UserRegisteredEvent): Promise<void> {
    this.logger.info(`Processing fleet owner registration workflow for user ${event.aggregateId}`);

    // Fleet owner specific processes would go here:
    // - Send onboarding checklist
    // - Schedule approval review
    // - Provide fleet management resources
  }

  /**
   * Handles chauffeur specific registration workflows
   */
  private async handleChauffeurRegistration(event: UserRegisteredEvent): Promise<void> {
    this.logger.info(`Processing chauffeur registration workflow for user ${event.aggregateId}`);

    // Chauffeur specific processes would go here:
    // - Send document upload instructions
    // - Schedule background check
    // - Provide chauffeur guidelines
  }

  /**
   * Handles customer specific registration workflows
   */
  private async handleCustomerRegistration(event: UserRegisteredEvent): Promise<void> {
    this.logger.info(`Processing customer registration workflow for user ${event.aggregateId}`);

    // Customer specific processes would go here:
    // - Send booking tutorial
    // - Provide promotional offers
    // - Set up preferences
  }

  /**
   * Handles staff/admin specific registration workflows
   */
  private async handleStaffRegistration(event: UserRegisteredEvent): Promise<void> {
    this.logger.info(`Processing staff registration workflow for user ${event.aggregateId}`);

    // Staff specific processes would go here:
    // - Send admin panel access instructions
    // - Provide training materials
    // - Set up permissions
  }
}
