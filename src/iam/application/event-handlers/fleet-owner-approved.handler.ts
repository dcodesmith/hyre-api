import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { FleetOwnerApprovedEvent } from "../../domain/events/fleet-owner-approved.event";

/**
 * Pure domain event handler - handles only IAM domain concerns
 * Cross-domain coordination (notifications, onboarding, payout setup) is handled by orchestration handlers
 */
@EventsHandler(FleetOwnerApprovedEvent)
export class FleetOwnerApprovedHandler implements IEventHandler<FleetOwnerApprovedEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: FleetOwnerApprovedEvent) {
    this.logger.info(`Fleet owner approved: ${event.fleetOwnerId} by ${event.approvedBy}`);

    // This handler is focused purely on IAM domain concerns
    // Cross-domain coordination (notifications, onboarding, payout setup)
    // is handled by the FleetOwnerApprovalOrchestrator
    // Any IAM-specific side effects would go here
  }
}
