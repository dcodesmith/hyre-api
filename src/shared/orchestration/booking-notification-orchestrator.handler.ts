import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingApplicationService } from "../../booking/application/services/booking-application.service";
import { BookingActivatedEvent } from "../../booking/domain/events/booking-activated.event";
import { NotificationService } from "../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../communication/domain/services/notification-factory.service";
import { FleetApplicationService } from "../../fleet/application/services/fleet-application.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for cross-domain notification coordination
 * Sits above all domains and coordinates notification workflows
 * This is where cross-domain business processes are managed
 */
@EventsHandler(BookingActivatedEvent)
export class BookingNotificationOrchestrator implements IEventHandler<BookingActivatedEvent> {
  private readonly logger: any;

  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly userProfileService: UserProfileApplicationService,
    private readonly fleetApplicationService: FleetApplicationService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingNotificationOrchestrator.name);
  }

  async handle(event: BookingActivatedEvent): Promise<void> {
    this.logger.info(
      `Orchestrating notifications for activated booking: ${event.bookingReference}`,
    );

    try {
      // Cross-domain data gathering - this is the orchestrator's responsibility
      const notificationData = await this.assembleNotificationData(event);

      // Send notification using assembled cross-domain data
      await this.notificationService.sendBookingStatusUpdate(notificationData);

      this.logger.info(`Notification sent for activated booking: ${event.bookingReference}`);
    } catch (error) {
      this.logger.error(
        { error: error.message, stack: error.stack },
        `Error orchestrating notifications for booking ${event.bookingReference}: ${error.message}`,
      );
    }
  }

  /**
   * Assembles notification data by coordinating across multiple domains
   * This is cross-domain orchestration - exactly what this layer is for
   */
  private async assembleNotificationData(
    event: BookingActivatedEvent,
  ): Promise<BookingStatusUpdateData> {
    // Gather data from all relevant domains in parallel
    const [booking, customer, car] = await Promise.allSettled([
      this.getBookingData(event.aggregateId),
      this.getCustomerData(event.customerId),
      this.getCarData(event.aggregateId), // Get car through booking to avoid extra field in event
    ]);

    // Extract successful results with fallbacks
    const bookingData = booking.status === "fulfilled" ? booking.value : null;
    const customerData = customer.status === "fulfilled" ? customer.value : null;
    const carData = car.status === "fulfilled" ? car.value : null;

    if (!bookingData) {
      throw new Error(`Cannot assemble notification data: booking ${event.aggregateId} not found`);
    }

    // Assemble cross-domain notification payload
    return {
      bookingId: bookingData.getId(),
      bookingReference: bookingData.getBookingReference(),
      customerName: customerData?.getName() || "Customer",
      carName: carData?.displayName || "Vehicle",
      status: "ACTIVE",
      startDate: bookingData.getDateRange().startDate.toISOString(),
      endDate: bookingData.getDateRange().endDate.toISOString(),
      pickupLocation: bookingData.getPickupAddress(),
      returnLocation: bookingData.getDropOffAddress(),
      customerId: bookingData.getCustomerId(),
      customerEmail: customerData?.getEmail() || "",
      customerPhone: customerData?.getPhoneNumber() || "",
    };
  }

  /**
   * Get booking data from Booking domain
   */
  private async getBookingData(bookingId: string) {
    return this.bookingApplicationService.getBookingByIdInternally(bookingId);
  }

  /**
   * Get customer data from IAM domain
   */
  private async getCustomerData(customerId: string) {
    try {
      return await this.userProfileService.getUserById(customerId);
    } catch (error) {
      this.logger.warn(`Failed to fetch customer data for ID ${customerId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get car data from Fleet domain via booking
   */
  private async getCarData(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingByIdInternally(bookingId);
      return await this.fleetApplicationService.getCarById(booking.getCarId());
    } catch (error) {
      this.logger.warn(`Failed to fetch car data for booking ${bookingId}: ${error.message}`);
      return null;
    }
  }
}
