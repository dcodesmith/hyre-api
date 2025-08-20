import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingApplicationService } from "../../booking/application/services/booking-application.service";
import { NotificationService } from "../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../communication/domain/services/notification-factory.service";
import { FleetApplicationService } from "../../fleet/application/services/fleet-application.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { BookingPaymentConfirmedEvent } from "../../payment/domain/events/payment-confirmed.event";
import { LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for payment confirmation workflows
 * Coordinates between Payment, Booking, IAM, Fleet, and Communication domains
 * Handles both booking confirmation and cross-domain notification processes
 */
@EventsHandler(BookingPaymentConfirmedEvent)
export class PaymentConfirmationOrchestrator
  implements IEventHandler<BookingPaymentConfirmedEvent>
{
  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly userProfileService: UserProfileApplicationService,
    private readonly fleetApplicationService: FleetApplicationService,
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PaymentConfirmationOrchestrator.name);
  }

  async handle(event: BookingPaymentConfirmedEvent): Promise<void> {
    const { bookingId, paymentId } = event;

    this.logger.log(
      `Orchestrating payment confirmation for booking ${bookingId}`,
      PaymentConfirmationOrchestrator.name,
    );

    try {
      // Step 1: Confirm booking with payment in Booking domain
      await this.bookingApplicationService.confirmBookingWithPayment(bookingId, paymentId);

      this.logger.log(`Booking confirmed via payment: ${bookingId}`);

      // Step 2: Orchestrate cross-domain notifications
      await this.orchestratePaymentConfirmationNotifications(bookingId);

      this.logger.log(
        `Payment confirmation orchestration completed for booking: ${bookingId}`,
        PaymentConfirmationOrchestrator.name,
      );
    } catch (error) {
      this.logger.error(
        `Error orchestrating payment confirmation for booking ${bookingId}: ${error.message}`,
        error.stack,
        PaymentConfirmationOrchestrator.name,
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
          startDate: bookingData.getDateRange().startDate.toISOString(),
          endDate: bookingData.getDateRange().endDate.toISOString(),
          pickupLocation: bookingData.getPickupAddress(),
          returnLocation: bookingData.getDropOffAddress(),
          customerId: bookingData.getCustomerId(),
          customerEmail: customerData.getEmail(),
          customerPhone: customerData.getPhoneNumber() || "",
        };

        await this.notificationService.sendBookingStatusUpdate(customerNotificationData);
        this.logger.log(`Customer payment confirmation sent for booking: ${bookingId}`);
      }

      // Send fleet owner notification if available
      if (fleetOwnerData && carData) {
        const fleetOwnerNotificationData: BookingStatusUpdateData = {
          bookingId: bookingData.getId(),
          bookingReference: bookingData.getBookingReference(),
          customerName: customerData?.getName() || "Customer",
          carName: carData.displayName,
          status: "CONFIRMED",
          startDate: bookingData.getDateRange().startDate.toISOString(),
          endDate: bookingData.getDateRange().endDate.toISOString(),
          pickupLocation: bookingData.getPickupAddress(),
          returnLocation: bookingData.getDropOffAddress(),
          customerId: fleetOwnerData.getId(), // Fleet owner as recipient
          customerEmail: fleetOwnerData.getEmail(),
          customerPhone: fleetOwnerData.getPhoneNumber() || "",
        };

        await this.notificationService.sendBookingStatusUpdate(fleetOwnerNotificationData);
        this.logger.log(`Fleet owner payment confirmation sent for booking: ${bookingId}`);
      }
    } catch (error) {
      this.logger.error(
        `Error sending payment confirmation notifications for booking ${bookingId}: ${error.message}`,
        error.stack,
        PaymentConfirmationOrchestrator.name,
      );
    }
  }

  /**
   * Get booking data from Booking domain
   */
  private async getBookingData(bookingId: string) {
    return this.bookingApplicationService.getBookingById(bookingId);
  }

  /**
   * Get customer data from IAM domain via booking
   */
  private async getCustomerData(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingById(bookingId);
      return await this.userProfileService.getUserById(booking.getCustomerId());
    } catch (error) {
      this.logger.warn(
        `Failed to fetch customer data for booking ${bookingId}: ${error.message}`,
        PaymentConfirmationOrchestrator.name,
      );
      return null;
    }
  }

  /**
   * Get car data from Fleet domain via booking
   */
  private async getCarData(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingById(bookingId);
      return await this.fleetApplicationService.getCarById(booking.getCarId());
    } catch (error) {
      this.logger.warn(
        `Failed to fetch car data for booking ${bookingId}: ${error.message}`,
        PaymentConfirmationOrchestrator.name,
      );
      return null;
    }
  }

  /**
   * Get fleet owner data from IAM domain via car
   */
  private async getFleetOwnerData(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingById(bookingId);
      const car = await this.fleetApplicationService.getCarById(booking.getCarId());

      if (!car) return null;

      return await this.userProfileService.getUserById(car.ownerId);
    } catch (error) {
      this.logger.warn(
        `Failed to fetch fleet owner data for booking ${bookingId}: ${error.message}`,
        PaymentConfirmationOrchestrator.name,
      );
      return null;
    }
  }
}
