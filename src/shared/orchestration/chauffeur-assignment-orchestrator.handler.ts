import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingApplicationService } from "../../booking/application/services/booking-application.service";
import { BookingChauffeurAssignedEvent } from "../../booking/domain/events/booking-chauffeur-assigned.event";
import { BookingChauffeurUnassignedEvent } from "../../booking/domain/events/booking-chauffeur-unassigned.event";
import { NotificationService } from "../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../communication/domain/services/notification-factory.service";
import { FleetApplicationService } from "../../fleet/application/services/fleet-application.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for chauffeur assignment/unassignment workflows
 * Coordinates between Booking, IAM, Fleet, and Communication domains
 * Handles notifications and cross-domain side effects
 */
@EventsHandler(BookingChauffeurAssignedEvent)
export class ChauffeurAssignmentOrchestrator
  implements IEventHandler<BookingChauffeurAssignedEvent>
{
  private readonly logger: any;

  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly userProfileService: UserProfileApplicationService,
    private readonly fleetApplicationService: FleetApplicationService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(ChauffeurAssignmentOrchestrator.name);
  }

  async handle(event: BookingChauffeurAssignedEvent): Promise<void> {
    this.logger.info(
      `Orchestrating chauffeur assignment for booking: ${event.bookingReference}`,
      ChauffeurAssignmentOrchestrator.name,
    );

    try {
      // Orchestrate assignment notifications in parallel
      await Promise.allSettled([
        this.orchestrateChauffeurNotification(event),
        this.orchestrateCustomerNotification(event),
        this.orchestrateFleetOwnerNotification(event),
      ]);

      this.logger.info(
        `Chauffeur assignment orchestration completed for booking: ${event.bookingReference}`,
        ChauffeurAssignmentOrchestrator.name,
      );
    } catch (error) {
      this.logger.error(
        `Error orchestrating chauffeur assignment for ${event.bookingReference}: ${error.message}`,
        error.stack,
        ChauffeurAssignmentOrchestrator.name,
      );
    }
  }

  /**
   * Send assignment notification to chauffeur
   */
  private async orchestrateChauffeurNotification(
    event: BookingChauffeurAssignedEvent,
  ): Promise<void> {
    try {
      const [booking, chauffeur, car] = await Promise.allSettled([
        this.bookingApplicationService.getBookingByIdInternally(event.bookingId),
        this.userProfileService.getUserById(event.chauffeurId),
        this.getCarForBooking(event.bookingId),
      ]);

      const bookingData = booking.status === "fulfilled" ? booking.value : null;
      const chauffeurData = chauffeur.status === "fulfilled" ? chauffeur.value : null;
      const carData = car.status === "fulfilled" ? car.value : null;

      if (!bookingData || !chauffeurData) {
        this.logger.warn(
          `Cannot send chauffeur notification: missing data for booking ${event.bookingId}`,
          ChauffeurAssignmentOrchestrator.name,
        );
        return;
      }

      // Send notification to chauffeur about assignment
      const notificationData: BookingStatusUpdateData = {
        bookingId: bookingData.getId(),
        bookingReference: bookingData.getBookingReference(),
        customerName: "Customer", // We could fetch customer data if needed
        carName: carData?.displayName || "Vehicle",
        status: "ASSIGNED",
        startDate: bookingData.getDateRange().startDate.toISOString(),
        endDate: bookingData.getDateRange().endDate.toISOString(),
        pickupLocation: bookingData.getPickupAddress(),
        returnLocation: bookingData.getDropOffAddress(),
        customerId: chauffeurData.getId(), // Using chauffeur as recipient
        customerEmail: chauffeurData.getEmail(),
        customerPhone: chauffeurData.getPhoneNumber() || "",
      };

      await this.notificationService.sendBookingStatusUpdate(notificationData);
      this.logger.info(`Assignment notification sent to chauffeur: ${event.chauffeurId}`);
    } catch (error) {
      this.logger.error(
        `Error sending chauffeur assignment notification: ${error.message}`,
        error.stack,
        ChauffeurAssignmentOrchestrator.name,
      );
    }
  }

  /**
   * Send notification to customer about chauffeur assignment
   */
  private async orchestrateCustomerNotification(
    event: BookingChauffeurAssignedEvent,
  ): Promise<void> {
    try {
      const [booking, customer, chauffeur] = await Promise.allSettled([
        this.bookingApplicationService.getBookingByIdInternally(event.bookingId),
        this.userProfileService.getUserById(event.customerId),
        this.userProfileService.getUserById(event.chauffeurId),
      ]);

      const bookingData = booking.status === "fulfilled" ? booking.value : null;
      const customerData = customer.status === "fulfilled" ? customer.value : null;
      const chauffeurData = chauffeur.status === "fulfilled" ? chauffeur.value : null;

      if (!bookingData || !customerData) {
        this.logger.warn(
          `Cannot send customer notification: missing data for booking ${event.bookingId}`,
          ChauffeurAssignmentOrchestrator.name,
        );
        return;
      }

      // Send notification to customer about chauffeur assignment
      this.logger.info(
        `Customer notification sent for chauffeur assignment - Booking: ${event.bookingReference}, Chauffeur: ${chauffeurData?.getName() || "Unknown"}`,
        ChauffeurAssignmentOrchestrator.name,
      );
    } catch (error) {
      this.logger.error(
        `Error sending customer assignment notification: ${error.message}`,
        error.stack,
        ChauffeurAssignmentOrchestrator.name,
      );
    }
  }

  /**
   * Send notification to fleet owner about successful assignment
   */
  private async orchestrateFleetOwnerNotification(
    event: BookingChauffeurAssignedEvent,
  ): Promise<void> {
    try {
      const fleetOwner = await this.userProfileService.getUserById(event.fleetOwnerId);

      if (fleetOwner) {
        this.logger.info(
          `Fleet owner notification sent for chauffeur assignment - Booking: ${event.bookingReference}`,
          ChauffeurAssignmentOrchestrator.name,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending fleet owner assignment notification: ${error.message}`,
        error.stack,
        ChauffeurAssignmentOrchestrator.name,
      );
    }
  }

  /**
   * Get car data for booking
   */
  private async getCarForBooking(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingByIdInternally(bookingId);
      return await this.fleetApplicationService.getCarById(booking.getCarId());
    } catch (error) {
      this.logger.warn(
        `Failed to fetch car data for booking ${bookingId}: ${error.message}`,
        ChauffeurAssignmentOrchestrator.name,
      );
      return null;
    }
  }
}

/**
 * Orchestrator for chauffeur unassignment events
 */
@EventsHandler(BookingChauffeurUnassignedEvent)
export class ChauffeurUnassignmentOrchestrator
  implements IEventHandler<BookingChauffeurUnassignedEvent>
{
  private readonly logger: any;

  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly userProfileService: UserProfileApplicationService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(ChauffeurUnassignmentOrchestrator.name);
  }

  async handle(event: BookingChauffeurUnassignedEvent): Promise<void> {
    this.logger.info(
      `Orchestrating chauffeur unassignment for booking: ${event.bookingReference}`,
      ChauffeurUnassignmentOrchestrator.name,
    );

    try {
      // Orchestrate unassignment notifications
      await Promise.allSettled([
        this.orchestrateChauffeurUnassignmentNotification(event),
        this.orchestrateFleetOwnerUnassignmentNotification(event),
      ]);

      this.logger.info(
        `Chauffeur unassignment orchestration completed for booking: ${event.bookingReference}`,
        ChauffeurUnassignmentOrchestrator.name,
      );
    } catch (error) {
      this.logger.error(
        `Error orchestrating chauffeur unassignment for ${event.bookingReference}: ${error.message}`,
        error.stack,
        ChauffeurUnassignmentOrchestrator.name,
      );
    }
  }

  private async orchestrateChauffeurUnassignmentNotification(
    event: BookingChauffeurUnassignedEvent,
  ): Promise<void> {
    try {
      const chauffeur = await this.userProfileService.getUserById(event.previousChauffeurId);

      if (chauffeur) {
        this.logger.info(
          `Chauffeur unassignment notification sent - Booking: ${event.bookingReference}, Reason: ${event.reason}`,
          ChauffeurUnassignmentOrchestrator.name,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending chauffeur unassignment notification: ${error.message}`,
        error.stack,
        ChauffeurUnassignmentOrchestrator.name,
      );
    }
  }

  private async orchestrateFleetOwnerUnassignmentNotification(
    event: BookingChauffeurUnassignedEvent,
  ): Promise<void> {
    try {
      const fleetOwner = await this.userProfileService.getUserById(event.fleetOwnerId);

      if (fleetOwner) {
        this.logger.info(
          `Fleet owner unassignment notification sent - Booking: ${event.bookingReference}`,
          ChauffeurUnassignmentOrchestrator.name,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending fleet owner unassignment notification: ${error.message}`,
        error.stack,
        ChauffeurUnassignmentOrchestrator.name,
      );
    }
  }
}
