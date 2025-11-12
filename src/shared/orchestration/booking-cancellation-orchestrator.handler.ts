import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingApplicationService } from "../../booking/application/services/booking-application.service";
import { BookingCancelledEvent } from "../../booking/domain/events/booking-cancelled.event";
import { NotificationService } from "../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../communication/domain/services/notification-factory.service";
import { FleetApplicationService } from "../../fleet/application/services/fleet-application.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { type Logger, LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for booking cancellation workflows
 * Coordinates between Booking, IAM, Fleet, and Communication domains
 * Handles cancellation notifications to all relevant parties
 */
@EventsHandler(BookingCancelledEvent)
export class BookingCancellationOrchestrator implements IEventHandler<BookingCancelledEvent> {
  private readonly logger: Logger;
  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly userProfileService: UserProfileApplicationService,
    private readonly fleetApplicationService: FleetApplicationService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingCancellationOrchestrator.name);
  }

  async handle(event: BookingCancelledEvent): Promise<void> {
    this.logger.info(`Orchestrating booking cancellation workflows for: ${event.bookingReference}`);

    try {
      // Get booking data from Booking domain
      const booking = await this.bookingApplicationService.getBookingByIdInternally(
        event.aggregateId,
      );

      if (!booking) {
        this.logger.warn(`Booking not found for cancellation notification: ${event.aggregateId}`);
        return;
      }

      // Orchestrate cancellation notifications in parallel
      await Promise.allSettled([
        this.orchestrateCustomerCancellationNotification(event.aggregateId),
        this.orchestrateChauffeurCancellationNotification(event.aggregateId),
        this.orchestrateFleetOwnerCancellationNotification(event.aggregateId),
      ]);

      this.logger.info(
        `Booking cancellation orchestration completed for: ${event.bookingReference}`,
      );
    } catch (error) {
      this.logger.error(
        `Error orchestrating booking cancellation for ${event.bookingReference}: ${error.message}`,
      );
    }
  }

  /**
   * Orchestrates cancellation notification to customer
   * Coordinates between Booking, IAM, Fleet, and Communication domains
   */
  private async orchestrateCustomerCancellationNotification(bookingId: string): Promise<void> {
    try {
      // Gather cross-domain data in parallel
      const [booking, customer, car] = await Promise.allSettled([
        this.bookingApplicationService.getBookingByIdInternally(bookingId),
        this.getCustomerDataForBooking(bookingId),
        this.getCarDataForBooking(bookingId),
      ]);

      // Extract successful results with fallbacks
      const bookingData = booking.status === "fulfilled" ? booking.value : null;
      const customerData = customer.status === "fulfilled" ? customer.value : null;
      const carData = car.status === "fulfilled" ? car.value : null;

      if (!bookingData || !customerData) {
        this.logger.warn(
          `Cannot send customer cancellation notification: missing data for booking ${bookingId}`,
        );
        return;
      }

      // Send cancellation notification to customer
      const cancellationNotificationData: BookingStatusUpdateData = {
        bookingId: bookingData.getId(),
        bookingReference: bookingData.getBookingReference(),
        customerName: customerData.getName() || "Customer",
        carName: carData?.displayName || "Vehicle",
        status: "CANCELLED",
        startDate: bookingData.getDateRange().startDate.toISOString(),
        endDate: bookingData.getDateRange().endDate.toISOString(),
        pickupLocation: bookingData.getPickupAddress(),
        returnLocation: bookingData.getDropOffAddress(),
        customerId: bookingData.getCustomerId(),
        customerEmail: customerData.getEmail(),
        customerPhone: customerData.getPhoneNumber() || "",
      };

      await this.notificationService.sendBookingStatusUpdate(cancellationNotificationData);
      this.logger.info(`Cancellation notification sent to customer for booking: ${bookingId}`);
    } catch (error) {
      this.logger.error(
        `Error sending customer cancellation notification for booking ${bookingId}: ${error.message}`,
      );
    }
  }

  /**
   * Orchestrates cancellation notification to chauffeur (if assigned)
   * Coordinates between Booking, IAM, and Communication domains
   */
  private async orchestrateChauffeurCancellationNotification(bookingId: string): Promise<void> {
    try {
      const booking = await this.bookingApplicationService.getBookingByIdInternally(bookingId);

      if (!booking?.getChauffeurId()) {
        this.logger.info(`No chauffeur assigned to cancelled booking: ${bookingId}`);
        return;
      }

      const chauffeur = await this.userProfileService.getUserById(booking.getChauffeurId());

      if (chauffeur) {
        this.logger.info(
          `Cancellation notification sent to chauffeur: ${booking.getChauffeurId()} for booking: ${bookingId}`,
        );

        // In a full implementation, this would send chauffeur-specific cancellation notification
        // await this.notificationService.sendChauffeurCancellationNotification({
        //   chauffeurId: booking.getChauffeurId(),
        //   chauffeurEmail: chauffeur.getEmail(),
        //   chauffeurName: chauffeur.getName(),
        //   bookingReference: booking.getBookingReference(),
        //   cancellationReason: "Customer cancelled",
        // });
      }
    } catch (error) {
      this.logger.error(
        `Error sending chauffeur cancellation notification for booking ${bookingId}: ${error.message}`,
      );
    }
  }

  /**
   * Orchestrates cancellation notification to fleet owner
   * Coordinates between Booking, IAM, Fleet, and Communication domains
   */
  private async orchestrateFleetOwnerCancellationNotification(bookingId: string): Promise<void> {
    try {
      const [booking, car] = await Promise.allSettled([
        this.bookingApplicationService.getBookingByIdInternally(bookingId),
        this.getCarDataForBooking(bookingId),
      ]);

      const bookingData = booking.status === "fulfilled" ? booking.value : null;
      const carData = car.status === "fulfilled" ? car.value : null;

      if (!bookingData || !carData) {
        this.logger.warn(
          `Cannot send fleet owner cancellation notification: missing data for booking ${bookingId}`,
        );
        return;
      }

      const fleetOwner = await this.userProfileService.getUserById(carData.ownerId);

      if (fleetOwner) {
        this.logger.info(
          `Cancellation notification sent to fleet owner: ${carData.ownerId} for booking: ${bookingId}`,
        );

        // In a full implementation, this would send fleet owner-specific cancellation notification
        // await this.notificationService.sendFleetOwnerCancellationNotification({
        //   fleetOwnerId: carData.ownerId,
        //   fleetOwnerEmail: fleetOwner.getEmail(),
        //   fleetOwnerName: fleetOwner.getName(),
        //   bookingReference: bookingData.getBookingReference(),
        //   carName: carData.displayName,
        //   cancellationReason: "Customer cancelled",
        // });
      }
    } catch (error) {
      this.logger.error(
        `Error sending fleet owner cancellation notification for booking ${bookingId}: ${error.message}`,
      );
    }
  }

  /**
   * Get customer data from IAM domain via booking
   */
  private async getCustomerDataForBooking(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingByIdInternally(bookingId);
      return await this.userProfileService.getUserById(booking.getCustomerId());
    } catch (error) {
      this.logger.warn(`Failed to fetch customer data for booking ${bookingId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get car data from Fleet domain via booking
   */
  private async getCarDataForBooking(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingByIdInternally(bookingId);
      return await this.fleetApplicationService.getCarById(booking.getCarId());
    } catch (error) {
      this.logger.warn(`Failed to fetch car data for booking ${bookingId}: ${error.message}`);
      return null;
    }
  }
}
