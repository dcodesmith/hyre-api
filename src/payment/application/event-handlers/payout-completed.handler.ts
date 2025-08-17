import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
// import { NotificationService } from "../../../communication/application/services/notification.service";
import { PrismaService } from "../../../shared/database/prisma.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { PayoutCompletedEvent } from "../../domain/events/payout-completed.event";

@EventsHandler(PayoutCompletedEvent)
export class PayoutCompletedHandler implements IEventHandler<PayoutCompletedEvent> {
  constructor(
    // private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: PayoutCompletedEvent) {
    this.logger.log(
      `Handling payout completed event for payout: ${event.aggregateId}`,
      "PayoutCompletedHandler",
    );

    try {
      // Get fleet owner details for notification
      const fleetOwner = await this.prisma.user.findUnique({
        where: { id: event.fleetOwnerId },
      });

      if (!fleetOwner) {
        this.logger.warn(`Fleet owner not found: ${event.fleetOwnerId}`, "PayoutCompletedHandler");
        return;
      }

      // For now, we'll just log the payout completion
      // In a real implementation, you might want to send an email/SMS notification
      this.logger.log(
        `Payout completed for fleet owner ${fleetOwner.name}: NGN ${event.amount}`,
        "PayoutCompletedHandler",
      );

      // You could send a notification here:
      // await this.notificationService.sendPayoutCompletedNotification({
      //   fleetOwnerId: event.fleetOwnerId,
      //   fleetOwnerName: fleetOwner.name,
      //   amount: event.amount,
      //   bookingId: event.bookingId,
      //   fleetOwnerEmail: fleetOwner.email,
      //   fleetOwnerPhone: fleetOwner.phoneNumber,
      // });
    } catch (error) {
      this.logger.error(
        `Error handling payout completed event for ${event.aggregateId}: ${error.message}`,
        error.stack,
        "PayoutCompletedHandler",
      );
    }
  }
}
