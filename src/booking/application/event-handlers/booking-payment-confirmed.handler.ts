import { Inject } from "@nestjs/common";
import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../../communication/domain/services/notification-factory.service";
import { BookingPaymentConfirmedEvent } from "../../../payment/domain/events/payment-confirmed.event";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingApplicationService } from "../services/booking-appication.service";

@EventsHandler(BookingPaymentConfirmedEvent)
export class BookingPaymentConfirmedHandler implements IEventHandler<BookingPaymentConfirmedEvent> {
  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly notificationService: NotificationService,
    @Inject("BookingRepository")
    private readonly bookingRepository: BookingRepository,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: BookingPaymentConfirmedEvent) {
    const { bookingId, paymentId } = event;

    this.logger.log(`Processing payment confirmation for booking ${bookingId}`);

    try {
      await this.bookingApplicationService.confirmBookingWithPayment(bookingId, paymentId);

      this.logger.log(`Booking confirmed via payment event ${bookingId}`);

      await this.sendBookingConfirmationNotifications(bookingId);
    } catch (error) {
      this.logger.error(
        `Error confirming booking payment: ${error.message}`,
        error.stack,
        "PaymentConfirmedHandler",
      );
      // Don't re-throw - we want to acknowledge the payment event was processed
      // even if booking confirmation fails (could be logged for manual review)
    }
  }

  private async sendBookingConfirmationNotifications(bookingId: string): Promise<void> {
    try {
      const booking = await this.bookingRepository.findById(bookingId);

      if (!booking) {
        this.logger.warn(
          `Booking or user not found for payment confirmed booking: ${bookingId}`,
          "PaymentConfirmedHandler",
        );
        return;
      }

      // TODO: Implement notification logic using BookingQueryService
      this.logger.log(
        `Payment confirmed for booking: ${booking.getBookingReference()}`,
        "PaymentConfirmedHandler",
      );
      /*
      // Commenting out notification logic until proper related data fetching is implemented
      const customerNotificationData: BookingStatusUpdateData = {
        bookingId: booking.getId(),
        bookingReference: booking.getBookingReference(),
        customerName: user.name || "Customer",
        carName: `${car.make} ${car.model}`,
        status: "CONFIRMED",
        startDate: booking.getDateRange().startDate.toISOString(),
        endDate: booking.getDateRange().endDate.toISOString(),
        pickupLocation: booking.getPickupAddress(),
        returnLocation: booking.getDropOffAddress(),
        customerId: user.id,
        customerEmail: user.email,
        customerPhone: user.phoneNumber,
      };

      await this.notificationService.sendBookingStatusUpdate(customerNotificationData);

      this.logger.log(
        "Customer booking confirmation sent for booking",
        booking.getBookingReference(),
      );

      // Send booking confirmation notification to fleet owner (after payment received)
      if (owner.email || owner.phoneNumber) {
        const fleetOwnerNotificationData: BookingStatusUpdateData = {
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          customerName: user.name || "Customer",
          carName: `${car.make} ${car.model}`,
          status: "CONFIRMED",
          startDate: booking.getDateRange().startDate.toISOString(),
          endDate: booking.getDateRange().endDate.toISOString(),
          pickupLocation: booking.getPickupAddress(),
          returnLocation: booking.getDropOffAddress(),
          customerId: owner.id,
          customerEmail: owner.email,
          customerPhone: owner.phoneNumber,
        };

        await this.notificationService.sendBookingStatusUpdate(fleetOwnerNotificationData);
        this.logger.log(
          "Fleet owner booking confirmation sent for booking",
          booking.getBookingReference(),
        );
      } else {
        this.logger.warn(
          "Cannot send fleet owner booking confirmation: No contact information available",
          booking.getBookingReference(),
        );
      }
      */
    } catch (error) {
      this.logger.error(
        `Error sending booking confirmation notifications for ${bookingId}: ${error.message}`,
        error.stack,
        "PaymentConfirmedHandler",
      );
    }
  }
}
