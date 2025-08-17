import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PrismaService } from "../../../shared/database/prisma.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { PayoutFailedEvent } from "../../domain/events/payout-failed.event";

@EventsHandler(PayoutFailedEvent)
export class PayoutFailedHandler implements IEventHandler<PayoutFailedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: PayoutFailedEvent) {
    this.logger.log(
      `Handling payout failed event for payout: ${event.aggregateId}`,
      "PayoutFailedHandler",
    );

    try {
      // Get fleet owner details for logging/notification
      const fleetOwner = await this.prisma.user.findUnique({
        where: { id: event.fleetOwnerId },
      });

      if (!fleetOwner) {
        this.logger.warn(`Fleet owner not found: ${event.fleetOwnerId}`, "PayoutFailedHandler");
        return;
      }

      // Log the payout failure for monitoring and alerting
      this.logger.error(
        `Payout failed for fleet owner ${fleetOwner.name}: ${event.failureReason}`,
        undefined,
        "PayoutFailedHandler",
      );

      // In a real implementation, you might want to:
      // 1. Send an alert to administrators
      // 2. Add the payout to a retry queue
      // 3. Send a notification to the fleet owner
      // 4. Update external monitoring systems

      // For now, we'll just ensure proper logging for monitoring
      this.logger.warn(
        `Payout failure requires attention - Fleet Owner: ${fleetOwner.id}, Reason: ${event.failureReason}`,
        "PayoutFailedHandler",
      );
    } catch (error) {
      this.logger.error(
        `Error handling payout failed event for ${event.aggregateId}: ${error.message}`,
        error.stack,
        "PayoutFailedHandler",
      );
    }
  }
}
