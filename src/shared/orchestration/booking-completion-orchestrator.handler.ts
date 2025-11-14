import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingApplicationService } from "../../booking/application/services/booking-application.service";
import { BookingCompletedEvent } from "../../booking/domain/events/booking-completed.event";
import { NotificationService } from "../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../communication/domain/services/notification-factory.service";
import { FleetApplicationService } from "../../fleet/application/services/fleet-application.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { PayoutService } from "../../payment/application/services/payout.service";
import { type Logger, LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for booking completion workflows
 * Coordinates between Booking, Payment, IAM, Fleet, and Communication domains
 * Handles both payout processing and cross-domain notification processes
 */
@EventsHandler(BookingCompletedEvent)
export class BookingCompletionOrchestrator implements IEventHandler<BookingCompletedEvent> {
  private readonly logger: Logger;
  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly payoutService: PayoutService,
    private readonly userProfileService: UserProfileApplicationService,
    private readonly fleetApplicationService: FleetApplicationService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingCompletionOrchestrator.name);
  }

  async handle(event: BookingCompletedEvent): Promise<void> {
    this.logger.info(`Orchestrating booking completion for booking: ${event.bookingReference}`);

    try {
      // Get booking data first
      const booking = await this.bookingApplicationService.getBookingByIdInternally(
        event.aggregateId,
      );

      if (!booking) {
        this.logger.error(`Booking not found: ${event.aggregateId}`);
        return;
      }

      // Orchestrate payout processing and notifications in parallel
      await Promise.allSettled([
        this.orchestrateFleetOwnerPayout(event.aggregateId),
        this.orchestrateCompletionNotifications(event.aggregateId),
      ]);

      this.logger.info(`Booking completion orchestration finished for: ${event.bookingReference}`);
    } catch (error) {
      this.logger.error(
        `Error orchestrating booking completion for ${event.bookingReference}: ${error.message}`,
      );
    }
  }

  /**
   * Orchestrates fleet owner payout processing
   * Coordinates between Booking, Fleet, IAM, and Payment domains
   */
  private async orchestrateFleetOwnerPayout(bookingId: string): Promise<void> {
    try {
      // Gather required data from multiple domains
      const [booking, car, fleetOwner] = await Promise.allSettled([
        this.bookingApplicationService.getBookingByIdInternally(bookingId),
        this.getCarDataForBooking(bookingId),
        this.getFleetOwnerDataForBooking(bookingId),
      ]);

      // Extract successful results
      const bookingData = booking.status === "fulfilled" ? booking.value : null;
      const carData = car.status === "fulfilled" ? car.value : null;
      const fleetOwnerData = fleetOwner.status === "fulfilled" ? fleetOwner.value : null;

      if (!bookingData || !carData || !fleetOwnerData) {
        this.logger.warn(`Cannot process payout: missing data for booking ${bookingId}`);
        return;
      }

      // Calculate payout amount from booking domain
      const fleetOwnerPayoutAmount = bookingData.getFleetOwnerPayoutAmountNet();

      if (!fleetOwnerPayoutAmount || fleetOwnerPayoutAmount <= 0) {
        this.logger.info(
          `No payout required for booking ${bookingId} - Amount: ${fleetOwnerPayoutAmount}`,
        );
        return;
      }

      // Check if fleet owner has verified bank details (this would be part of IAM domain)
      // For now, we'll log that payout would be initiated
      // In a full implementation, we'd fetch bank details from fleet owner profile

      this.logger.info(
        `Payout would be initiated for booking ${bookingId} - Amount: NGN ${fleetOwnerPayoutAmount}`,
      );

      // Implement full payout initiation with bank details
      // await this.payoutService.initiatePayout({
      //   fleetOwnerId: carData.ownerId,
      //   amount: fleetOwnerPayoutAmount,
      //   currency: "NGN",
      //   bankCode: bankDetails.bankCode,
      //   accountNumber: bankDetails.accountNumber,
      //   bankName: bankDetails.bankName,
      //   accountName: bankDetails.accountName,
      //   bookingId: bookingData.getId(),
      // });
    } catch (error) {
      this.logger.error(
        `Error processing fleet owner payout for booking ${bookingId}: ${error.message}`,
      );
    }
  }

  /**
   * Orchestrates completion notification workflows
   * Coordinates between Booking, IAM, Fleet, and Communication domains
   */
  private async orchestrateCompletionNotifications(bookingId: string): Promise<void> {
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

      if (!bookingData) {
        throw new Error(`Cannot send completion notifications: booking ${bookingId} not found`);
      }

      // Send completion notification to customer
      if (customerData) {
        const completionNotificationData: BookingStatusUpdateData = {
          bookingId: bookingData.getId(),
          bookingReference: bookingData.getBookingReference(),
          customerName: customerData.getName() || "Customer",
          carName: carData?.displayName || "Vehicle",
          status: "COMPLETED",
          startDate: bookingData.getStartDateTime().toISOString(),
          endDate: bookingData.getEndDateTime().toISOString(),
          pickupLocation: bookingData.getPickupAddress(),
          returnLocation: bookingData.getDropOffAddress(),
          customerId: bookingData.getCustomerId(),
          customerEmail: customerData.getEmail(),
          customerPhone: customerData.getPhoneNumber() || "",
        };

        await this.notificationService.sendBookingStatusUpdate(completionNotificationData);
        this.logger.info(`Completion notification sent for booking: ${bookingId}`);
      }
    } catch (error) {
      this.logger.error(
        `Error sending completion notifications for booking ${bookingId}: ${error.message}`,
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

  /**
   * Get fleet owner data from IAM domain via car
   */
  private async getFleetOwnerDataForBooking(bookingId: string) {
    try {
      const booking = await this.bookingApplicationService.getBookingByIdInternally(bookingId);
      const car = await this.fleetApplicationService.getCarById(booking.getCarId());

      if (!car) return null;

      return await this.userProfileService.getUserById(car.ownerId);
    } catch (error) {
      this.logger.warn(
        `Failed to fetch fleet owner data for booking ${bookingId}: ${error.message}`,
      );
      return null;
    }
  }
}
