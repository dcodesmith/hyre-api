import { Inject } from "@nestjs/common";
import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../../communication/domain/services/notification-factory.service";
import { PayoutService } from "../../../payment/application/services/payout.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCompletedEvent } from "../../domain/events/booking-completed.event";
import { BookingRepository } from "../../domain/repositories/booking.repository";

@EventsHandler(BookingCompletedEvent)
export class BookingCompletedHandler implements IEventHandler<BookingCompletedEvent> {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly notificationService: NotificationService,
    @Inject("BookingRepository")
    private readonly bookingRepository: BookingRepository,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: BookingCompletedEvent) {
    this.logger.log(
      `Handling booking completed event for booking: ${event.bookingReference}`,
      "BookingCompletedHandler",
    );

    try {
      const booking = await this.bookingRepository.findById(event.aggregateId);

      if (!booking) {
        this.logger.error(
          `Booking not found: ${event.aggregateId}`,
          undefined,
          "BookingCompletedHandler",
        );
        return;
      }

      // TODO: Implement proper related data fetching and notification logic
      this.logger.log(
        `Booking completed: ${booking.getBookingReference()}`,
        "BookingCompletedHandler",
      );
      /*

      // 2. Initiate payout to fleet owner using domain logic
      const fleetOwnerPayoutAmount = booking.getFleetOwnerPayoutAmountNet();

      if (fleetOwnerPayoutAmount && fleetOwnerPayoutAmount > 0) {
        const bankDetails = owner.bankDetails;

        if (bankDetails?.isVerified) {
          await this.payoutService.initiatePayout({
            fleetOwnerId: car.ownerId,
            amount: fleetOwnerPayoutAmount,
            currency: "NGN",
            bankCode: bankDetails.bankCode,
            accountNumber: bankDetails.accountNumber,
            bankName: bankDetails.bankName,
            accountName: bankDetails.accountName,
            bookingId: booking.getId(),
          });

          this.logger.log(
            `Payout initiated for booking ${event.bookingReference} - Amount: NGN ${fleetOwnerPayoutAmount}`,
            "BookingCompletedHandler",
          );
        } else {
          this.logger.warn(
            `Cannot initiate payout for booking ${event.bookingReference}: Fleet owner bank details not verified`,
            "BookingCompletedHandler",
          );
        }
      } else {
        this.logger.log(
          `No payout initiated for booking ${event.bookingReference} - Amount: ${fleetOwnerPayoutAmount.toString()}`,
          "BookingCompletedHandler",
        );
      }

      // 3. Send booking status update notification
      if (user) {
        const statusUpdateData: BookingStatusUpdateData = {
          bookingId: booking.getId(),
          bookingReference: booking.getBookingReference(),
          customerName: user.name || "Customer",
          carName: `${car.make} ${car.model}`,
          status: "COMPLETED",
          startDate: booking.getDateRange().startDate.toISOString(),
          endDate: booking.getDateRange().endDate.toISOString(),
          pickupLocation: booking.getPickupAddress(),
          returnLocation: booking.getDropOffAddress(),
          customerId: user.id,
          customerEmail: user.email,
          customerPhone: user.phoneNumber,
        };

        await this.notificationService.sendBookingStatusUpdate(statusUpdateData);

        this.logger.log(
          `Status update notification sent for booking ${event.bookingReference}`,
          "BookingCompletedHandler",
        );
      }
      */
    } catch (error) {
      this.logger.error(
        `Error handling booking completed event for ${event.bookingReference}: ${error.message}`,
        error.stack,
        "BookingCompletedHandler",
      );
    }
  }
}
