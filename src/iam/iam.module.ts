import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";
import { JwtModule } from "@nestjs/jwt";
import { CommunicationModule } from "../communication/communication.module";
import { PaymentModule } from "../payment/payment.module";
import { SharedModule } from "../shared/shared.module";
import { ChauffeurAddedHandler } from "./application/event-handlers/chauffeur-added.handler";
import { FleetOwnerApprovedHandler } from "./application/event-handlers/fleet-owner-approved.handler";
import { UserRegisteredHandler } from "./application/event-handlers/user-registered.handler";
import { AuthenticationService } from "./application/services/authentication.service";
// Application Services
import { ChauffeurManagementApplicationService } from "./application/services/chauffeur-management-application.service";
import { OnboardingApplicationService } from "./application/services/onboarding-application.service";
import { UserApprovalApplicationService } from "./application/services/user-approval-application.service";
import { UserManagementService } from "./application/services/user-management.service";
import { UserProfileApplicationService } from "./application/services/user-profile-application.service";
import { UserRegistrationApplicationService } from "./application/services/user-registration-application.service";
import { ApprovalWorkflowService } from "./domain/services/approval-workflow.service";
import { BankVerificationService } from "./domain/services/bank-verification.service";
import { FleetAuthorizationService } from "./domain/services/fleet-authorization.service";
import { JwtTokenService } from "./domain/services/jwt-token.service";
import { OtpAuthenticationService } from "./domain/services/otp-authentication.service";
import { RoleAuthorizationService } from "./domain/services/role-authorization.service";
import { SessionCleanupService } from "./domain/services/session-cleanup.service";
import { TokenBlacklistService } from "./domain/services/token-blacklist.service";
import { UserRegistrationService } from "./domain/services/user-registration.service";
import { JwtAuthGuard } from "./infrastructure/guards/jwt-auth.guard";
import { RolesGuard } from "./infrastructure/guards/roles.guard";
import { PrismaBankDetailsRepository } from "./infrastructure/repositories/prisma-bank-details.repository";
import { PrismaUserRepository } from "./infrastructure/repositories/prisma-user.repository";
import { FlutterwaveBankVerificationService } from "./infrastructure/services/flutterwave-bank-verification.service";
import { IamController } from "./presentation/iam.controller";

const applicationServices = [
  // Main orchestrator service
  UserManagementService,

  // Granular application services
  UserRegistrationApplicationService,
  UserApprovalApplicationService,
  ChauffeurManagementApplicationService,
  UserProfileApplicationService,

  // Other application services
  AuthenticationService,
  OnboardingApplicationService,
];

// Domain Services
const domainServices = [
  // Main orchestrator authorization service
  RoleAuthorizationService,

  // Granular authorization services (only what's still needed)
  FleetAuthorizationService,

  // Other domain services
  UserRegistrationService,
  OtpAuthenticationService,
  ApprovalWorkflowService,
  JwtTokenService,
  TokenBlacklistService,
  SessionCleanupService,
  BankVerificationService,
];

// Event Handlers
const eventHandlers = [UserRegisteredHandler, FleetOwnerApprovedHandler, ChauffeurAddedHandler];

// Guards
const guards = [JwtAuthGuard, RolesGuard];

// Repositories
const repositories = [
  {
    provide: "UserRepository",
    useClass: PrismaUserRepository,
  },
  {
    provide: "BankDetailsRepository",
    useClass: PrismaBankDetailsRepository,
  },
];

// External Services
const externalServices = [
  {
    provide: "BankVerificationProvider",
    useClass: FlutterwaveBankVerificationService,
  },
  {
    provide: "BankListProvider",
    useClass: FlutterwaveBankVerificationService, // Same service implements both interfaces
  },
];

@Module({
  imports: [
    // Core modules
    CqrsModule,
    SharedModule,
    ConfigModule,

    // JWT configuration
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "15m" },
      }),
      inject: [ConfigService],
    }),

    // Cross-domain dependencies
    CommunicationModule, // For notifications
    PaymentModule, // For payout setup
  ],
  controllers: [IamController],
  providers: [
    // Application layer
    ...applicationServices,

    // Domain layer
    ...domainServices,

    // Infrastructure layer
    ...repositories,
    ...externalServices,

    // Event handlers
    ...eventHandlers,

    // Guards
    ...guards,
  ],
  exports: [
    // Export main services for use by other modules
    UserManagementService,
    AuthenticationService,
    UserProfileApplicationService, // Needed by orchestrators
    RoleAuthorizationService,
    "UserRepository", // Token-based export for compatibility

    // Export domain services that might be needed by other domains
    UserRegistrationService,
    ApprovalWorkflowService,
    OtpAuthenticationService,
    JwtTokenService,
    TokenBlacklistService, // Needed by JwtAuthGuard

    // Export guards for use by other modules
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class IamModule {}
