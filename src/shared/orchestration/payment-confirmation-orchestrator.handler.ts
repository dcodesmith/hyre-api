import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingApplicationService } from "../../booking/application/services/booking-application.service";
import { NotificationService } from "../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../communication/domain/services/notification-factory.service";
import { FleetApplicationService } from "../../fleet/application/services/fleet-application.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { BookingPaymentConfirmedEvent } from "../../payment/domain/events/payment-confirmed.event";
import { type Logger, LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for payment confirmation workflows
 * Coordinates between Payment, Booking, IAM, Fleet, and Communication domains
 * Handles both booking confirmation and cross-domain notification processes
 */
@EventsHandler(BookingPaymentConfirmedEvent)
export class PaymentConfirmationOrchestrator
  implements IEventHandler<BookingPaymentConfirmedEvent>
{
  private readonly logger: Logger;

  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly userProfileService: UserProfileApplicationService,
    private readonly fleetApplicationService: FleetApplicationService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(PaymentConfirmationOrchestrator.name);
  }

  async handle(event: BookingPaymentConfirmedEvent): Promise<void> {
    const { bookingId, paymentId } = event;
    this.logger.info(`Orchestrating payment confirmation for booking ${bookingId}`);

    try {
      // Step 1: Confirm booking with payment in Booking domain
      await this.bookingApplicationService.confirmBookingWithPayment(bookingId, paymentId);

      this.logger.info(`Booking confirmed via payment: ${bookingId}`);

      // Step 2: Orchestrate cross-domain notifications
      await this.orchestratePaymentConfirmationNotifications(bookingId);

      this.logger.info(`Payment confirmation orchestration completed for booking: ${bookingId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        { error: errorStack },
        `Error orchestrating payment confirmation for booking ${bookingId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Orchestrates all notification workflows for payment confirmation
   * Coordinates between multiple domains to gather data and send notifications
   */
  private async orchestratePaymentConfirmationNotifications(bookingId: string): Promise<void> {
    try {
      // Gather cross-domain data in parallel
      const [booking, customer, car, fleetOwner] = await Promise.allSettled([
        this.getBookingData(bookingId),
        this.getCustomerData(bookingId),
        this.getCarData(bookingId),
        this.getFleetOwnerData(bookingId),
      ]);

      // Extract successful results with fallbacks
      const bookingData = booking.status === "fulfilled" ? booking.value : null;
      const customerData = customer.status === "fulfilled" ? customer.value : null;
      const carData = car.status === "fulfilled" ? car.value : null;
      const fleetOwnerData = fleetOwner.status === "fulfilled" ? fleetOwner.value : null;

      if (!bookingData) {
        throw new Error(`Cannot send payment confirmation: booking ${bookingId} not found`);
      }

      // Send customer confirmation notification
      if (customerData) {
        const customerNotificationData: BookingStatusUpdateData = {
          bookingId: bookingData.getId(),
          bookingReference: bookingData.getBookingReference(),
          customerName: customerData.getName() || "Customer",
          carName: carData?.displayName || "Vehicle",
          status: "CONFIRMED",
          startDate: bookingData.getStartDateTime().toISOString(),
          endDate: bookingData.getEndDateTime().toISOString(),
          pickupLocation: bookingData.getPickupAddress(),
          returnLocation: bookingData.getDropOffAddress(),
          customerId: bookingData.getCustomerId(),
          customerEmail: customerData.getEmail(),
          customerPhone: customerData.getPhoneNumber() || "",
        };

        await this.notificationService.sendBookingStatusUpdate(customerNotificationData);
        this.logger.info(`Customer payment confirmation sent for booking: ${bookingId}`);
      }

      // Send fleet owner booking alert notification if available
      if (fleetOwnerData && carData) {
        const fleetOwnerAlertData = {
          bookingId: bookingData.getId(),
          bookingReference: bookingData.getBookingReference(),
          customerName: customerData?.getName() || "Customer",
          carName: carData.displayName,
          startDate: bookingData.getStartDateTime().toISOString(),
          endDate: bookingData.getEndDateTime().toISOString(),
          pickupLocation: bookingData.getPickupAddress(),
          returnLocation: bookingData.getDropOffAddress(),
          fleetOwnerId: fleetOwnerData.getId(),
          fleetOwnerName: fleetOwnerData.getName() || "Fleet Owner",
          fleetOwnerEmail: fleetOwnerData.getEmail(),
          fleetOwnerPhone: fleetOwnerData.getPhoneNumber() || undefined,
        };

        await this.notificationService.sendFleetOwnerBookingAlert(fleetOwnerAlertData);
        this.logger.info(`Fleet owner booking alert sent for booking: ${bookingId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error sending payment confirmation notifications for booking ${bookingId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Get booking data from Booking domain
   */
  private async getBookingData(bookingId: string) {
    return this.bookingApplicationService.getBookingByIdInternally(bookingId);
  }

  /**
   * Get customer data from IAM domain via booking
   */
  private async getCustomerData(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingByIdInternally(bookingId);
      const customerId = booking.getCustomerId();

      // Handle case where customer ID might not be set yet (shouldn't happen but defensive)
      if (!customerId) {
        this.logger.warn(`Booking ${bookingId} has no customer ID`);
        return null;
      }

      return await this.userProfileService.getUserById(customerId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to fetch customer data for booking ${bookingId}: ${errorMessage}`);
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

  /**
   * Get fleet owner data from IAM domain via car
   */
  private async getFleetOwnerData(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingByIdInternally(bookingId);
      const car = await this.fleetApplicationService.getCarById(booking.getCarId());

      if (!car) return null;

      // Handle case where car owner ID might not be set (shouldn't happen but defensive)
      if (!car.ownerId) {
        this.logger.warn(`Car ${booking.getCarId()} for booking ${bookingId} has no owner ID`);
        return null;
      }

      return await this.userProfileService.getUserById(car.ownerId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to fetch fleet owner data for booking ${bookingId}: ${errorMessage}`,
      );
      return null;
    }
  }
}
