import { Module } from "@nestjs/common";
import { BookingModule } from "../../booking/booking.module";
import { CommunicationModule } from "../../communication/communication.module";
import { FleetModule } from "../../fleet/fleet.module";
import { IamModule } from "../../iam/iam.module";
import { PaymentModule } from "../../payment/payment.module";
import { BookingCancellationOrchestrator } from "./booking-cancellation-orchestrator.handler";
import { BookingCompletionOrchestrator } from "./booking-completion-orchestrator.handler";
import { BookingNotificationOrchestrator } from "./booking-notification-orchestrator.handler";
import {
  ChauffeurAssignmentOrchestrator,
  ChauffeurUnassignmentOrchestrator,
} from "./chauffeur-assignment-orchestrator.handler";
import { ChauffeurOnboardingOrchestrator } from "./chauffeur-onboarding-orchestrator.handler";
import { FleetOwnerApprovalOrchestrator } from "./fleet-owner-approval-orchestrator.handler";
import { OtpNotificationOrchestrator } from "./otp-notification-orchestrator.handler";
import { PaymentConfirmationOrchestrator } from "./payment-confirmation-orchestrator.handler";
import { PaymentVerificationOrchestrator } from "./payment-verification-orchestrator.handler";
import {
  PayoutCompletionOrchestrator,
  PayoutFailureOrchestrator,
} from "./payout-notification-orchestrator.handler";
import { UserRegistrationOrchestrator } from "./user-registration-orchestrator.handler";

/**
 * Orchestration module for cross-domain coordination
 * This module sits above all domains and handles cross-domain workflows
 * It imports all necessary domain modules to coordinate between them
 */
@Module({
  imports: [BookingModule, IamModule, FleetModule, CommunicationModule, PaymentModule],
  providers: [
    // Cross-domain orchestration handlers
    BookingNotificationOrchestrator, // Handles booking activation notifications
    PaymentConfirmationOrchestrator, // Handles payment confirmation workflows
    BookingCompletionOrchestrator, // Handles booking completion with payouts
    UserRegistrationOrchestrator, // Handles user registration workflows
    ChauffeurAssignmentOrchestrator, // Handles chauffeur assignment notifications
    ChauffeurUnassignmentOrchestrator, // Handles chauffeur unassignment notifications
    ChauffeurOnboardingOrchestrator, // Handles chauffeur onboarding workflows
    FleetOwnerApprovalOrchestrator, // Handles fleet owner approval workflows
    PaymentVerificationOrchestrator, // Handles payment verification completion
    PayoutCompletionOrchestrator, // Handles payout completion notifications
    PayoutFailureOrchestrator, // Handles payout failure workflows
    BookingCancellationOrchestrator, // Handles booking cancellation notifications
    OtpNotificationOrchestrator, // Handles OTP delivery workflows
  ],
  exports: [],
})
export class OrchestrationModule {}
