import { Module } from "@nestjs/common";
import { CommunicationModule } from "../../communication/communication.module";
import { FleetModule } from "../../fleet/fleet.module";
import { IamModule } from "../../iam/iam.module";
import { PaymentModule } from "../../payment/payment.module";
import { ChauffeurValidationAdapter } from "./adapters/chauffeur-validation.adapter";
import { FleetValidationAdapter } from "./adapters/fleet-validation.adapter";
import { PaymentVerificationAdapter } from "./adapters/payment-verification.adapter";

/**
 * Shared validation module that provides cross-domain validation services
 * This module contains anti-corruption layer adapters that coordinate between domains
 */
@Module({
  imports: [
    // Import all domain modules needed for cross-domain validation
    IamModule,
    FleetModule,
    PaymentModule,
    CommunicationModule,
  ],
  providers: [
    // Cross-domain validation adapters
    {
      provide: "ChauffeurValidationService",
      useClass: ChauffeurValidationAdapter,
    },
    {
      provide: "FleetValidationService",
      useClass: FleetValidationAdapter,
    },
    {
      provide: "PaymentVerificationService",
      useClass: PaymentVerificationAdapter,
    },
  ],
  exports: [
    // Export validation services for use by other modules
    "ChauffeurValidationService",
    "FleetValidationService",
    "PaymentVerificationService",
  ],
})
export class SharedValidationModule {}
