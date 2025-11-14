import { createHash } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { NotificationFactoryService } from "../../../communication/domain/services/notification-factory.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { User } from "../../domain/entities/user.entity";
import { ApprovalStatusError, TokenValidationError } from "../../domain/errors/iam.errors";
import { OtpGeneratedEvent } from "../../domain/events/otp-generated.event";
import { OtpVerifiedEvent } from "../../domain/events/otp-verified.event";
import { UserAuthenticatedEvent } from "../../domain/events/user-authenticated.event";
import { UserRepository } from "../../domain/repositories/user.repository";
import { JwtTokenService, TokenPair } from "../../domain/services/jwt-token.service";
import { OtpAuthenticationService } from "../../domain/services/otp-authentication.service";
import { SessionCleanupService } from "../../domain/services/session-cleanup.service";
import { TokenBlacklistService } from "../../domain/services/token-blacklist.service";
import { PhoneNumber } from "../../domain/value-objects/phone-number.vo";

export interface OtpGenerationResponse {
  success: boolean;
  message: string;
  expiresAt: number;
  phoneNumber: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    phoneNumber: string;
    name?: string;
    roles: string[];
    approvalStatus: string;
    hasOnboarded: boolean;
  };
  tokens?: TokenPair;
  message: string;
}

export interface AuthRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otpCode: string;
  role: string;
}

@Injectable()
export class AuthenticationService {
  constructor(
    @Inject("UserRepository") private readonly userRepository: UserRepository,
    private readonly otpAuthenticationService: OtpAuthenticationService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly sessionCleanupService: SessionCleanupService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly notificationService: NotificationService,
    private readonly notificationFactory: NotificationFactoryService,
    private readonly logger: LoggerService,
  ) {}

  // Authentication - Step 1: Generate OTP
  async generateOtp(request: AuthRequest): Promise<OtpGenerationResponse> {
    this.logger.info("Generating OTP for email authentication", { email: request.email });

    // Check if user exists by email
    const existingUser = await this.userRepository.findByEmail(request.email);

    let userId: string | null = null;
    let otpType: "registration" | "login" = "registration";

    if (existingUser) {
      // User exists - send login OTP
      userId = existingUser.getId();
      otpType = "login";

      this.logger.info("Existing user found, sending login OTP via email", {
        email: request.email,
        userId,
      });
    } else {
      // New user - send registration OTP via email
      this.logger.info("New user detected, sending registration OTP via email", {
        email: request.email,
      });
    }

    // Generate OTP
    const otpResult = await this.otpAuthenticationService.generateOtp(request.email);

    this.logger.info("OTP generated for email", {
      email: request.email,
      otpType,
      expiresAt: otpResult.expiresAt,
    });

    // Send OTP notification directly (synchronous) - fixes race condition in tests
    // Previously this was done via domain events which are fire-and-forget
    await this.sendOtpNotification(request.email, otpResult.otpCode, otpResult.expiresAt, userId, otpType);

    this.logger.info("OTP notification sent successfully", {
      email: request.email,
      otpType,
    });

    // Optionally publish event for audit/analytics (fire-and-forget is OK here)
    // This event can be used by other handlers that don't need to block the response
    await this.domainEventPublisher.publish(
      new OtpGeneratedEvent(
        userId || "anonymous",
        userId,
        request.email,
        "", // No phone number for email-based OTP
        otpType,
        otpResult.expiresAt,
      ),
    );

    return {
      success: true,
      message: `OTP sent to ${request.email}`,
      expiresAt: otpResult.expiresAt,
      phoneNumber: "", // Not applicable for email OTP
    };
  }

  // Authentication - Step 2: Verify OTP and authenticate/register
  async verifyOtpAndAuthenticate(
    request: VerifyOtpRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    this.logger.info("Verifying email OTP", { email: request.email, role: request.role });

    // Verify OTP first
    const verificationResult = await this.otpAuthenticationService.verifyOtp(
      request.email,
      request.otpCode,
    );

    if (!verificationResult.isValid) {
      this.logger.warn("Email OTP verification failed", {
        email: request.email,
        reason: verificationResult.reason,
      });

      throw new UnauthorizedException(verificationResult.reason || "OTP verification failed");
    }

    // Check if user exists
    let user = await this.userRepository.findByEmail(request.email);
    let isNewUser = false;

    if (!user) {
      // NEW USER - create account based on role
      isNewUser = true;

      // Validate that only customer and fleetOwner can register publicly
      if (request.role === "staff" || request.role === "chauffeur" || request.role === "admin") {
        this.logger.warn("Attempted public registration with restricted role", {
          email: request.email,
          role: request.role,
        });

        throw new ForbiddenException(`${request.role} accounts must be created by authorized users`);
      }

      // Use a placeholder phone number that the user can update later
      const placeholderPhone = PhoneNumber.create("0000000000", "+1");

      // Create user based on role
      if (request.role === "fleetOwner") {
        user = User.registerAsFleetOwner(
          request.email,
          placeholderPhone.getFullNumber(),
          undefined, // No name initially - user can add it later
        );
      } else if (request.role === "customer") {
        user = User.registerAsCustomer(
          request.email,
          placeholderPhone.getFullNumber(),
          undefined, // No name initially - user can add it later
        );
      } else {
        // This should never happen due to validation above, but just in case
        throw new BadRequestException("Invalid role for public registration");
      }

      user = await this.userRepository.save(user);

      this.logger.info("New user account created", {
        email: request.email,
        userId: user.getId(),
        role: request.role,
      });
    } else {
      // EXISTING USER - validate role matches
      const userRoles = user.getRoles().map((role) => role.toString());

      if (!userRoles.includes(request.role)) {
        this.logger.warn("Role mismatch for existing user", {
          email: request.email,
          requestedRole: request.role,
          actualRoles: userRoles,
        });

        throw new ForbiddenException(
          `User ${request.email} has role(s) [${userRoles.join(", ")}] but requested role "${request.role}"`,
        );
      }

      this.logger.info("Existing user authenticated", {
        email: request.email,
        userId: user.getId(),
        role: request.role,
      });
    }

    // Generate JWT tokens
    const tokens = this.jwtTokenService.generateTokens(user, { includeRefreshToken: true });

    // Publish domain events
    await this.domainEventPublisher.publish([
      new OtpVerifiedEvent(
        user.getId(),
        user.getId(),
        user.getEmail(),
        user.getPhoneNumber(),
        isNewUser ? "registration" : "login",
        new Date(),
      ),
      new UserAuthenticatedEvent(
        user.getId(),
        user.getId(),
        user.getEmail(),
        user.getPhoneNumber(),
        user.getRoles().map((role) => role.toString()),
        new Date(),
        ipAddress,
        userAgent,
      ),
    ]);

    this.logger.info(
      isNewUser ? "New user registered and authenticated" : "Existing user authenticated",
      {
        email: request.email,
        userId: user.getId(),
        role: request.role,
      },
    );

    return {
      success: true,
      user: this.mapUserToResponse(user),
      tokens,
      message: isNewUser
        ? "Welcome to Hyre! Registration successful"
        : "Welcome back! Login successful",
    };
  }

  // Logout (clear OTP and session data)
  async logout(userId: string, token?: string): Promise<void> {
    this.logger.info("User logout initiated", { userId });

    const user = await this.userRepository.findById(userId);
    if (!user) {
      this.logger.warn("Logout attempted for non-existent user");
      return;
    }

    try {
      // 1. Add token to blacklist if provided
      if (token) {
        const tokenClaims = this.jwtTokenService.getTokenClaims(token);
        if (tokenClaims?.exp) {
          const expiresAt = new Date(tokenClaims.exp * 1000);
          await this.tokenBlacklistService.blacklistToken(token, expiresAt);

          this.logger.info("Token blacklisted", {
            userId,
            tokenHash: this.hashToken(token),
            expiresAt,
          });
        }
      }

      // 2. Clear all session data for the user
      await this.sessionCleanupService.clearUserSessions(userId, user.getEmail());

      // 3. Clear any pending OTPs for this user (additional cleanup)
      await this.otpAuthenticationService.clearOtp(user.getEmail());

      // 4. Enhanced structured logging for audit trail
      this.logger.info("User logout completed successfully", {
        userId,
        email: user.getEmail(),
        timestamp: new Date().toISOString(),
        action: "logout",
        success: true,
        tokenProvided: !!token,
        sessionDataCleared: true,
        otpDataCleared: true,
      });
    } catch (error) {
      this.logger.error("Logout process failed", (error as Error).stack);
      throw error;
    }
  }

  // Helper methods
  private mapUserToResponse(user: User): LoginResponse["user"] {
    return {
      id: user.getId(),
      email: user.getEmail(),
      phoneNumber: user.getPhoneNumber(),
      name: user.getName(),
      roles: user.getRoles().map((role) => role.toString()),
      approvalStatus: user.getApprovalStatus().toString(),
      hasOnboarded: user.hasOnboarded(),
    };
  }

  /**
   * Send OTP notification directly (synchronous)
   * This replaces the async event-driven approach to fix race conditions in tests
   */
  private async sendOtpNotification(
    email: string,
    otpCode: string,
    expiresAt: number,
    userId: string | null,
    otpType: "registration" | "login",
  ): Promise<void> {
    try {
      // Create OTP notification using the Communication domain factory
      const notification = this.notificationFactory.createOtpNotification({
        userId: userId || "anonymous",
        email,
        otpCode,
        otpType,
        expiresAt,
      });

      // Send the notification synchronously
      await this.notificationService.sendNotification(notification);

      this.logger.info("OTP notification delivered", { email, otpType });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send OTP notification to ${email}: ${errorMessage}`);
      // Don't throw - we still want to return success if OTP was generated
      // The user can request a new OTP if they didn't receive it
    }
  }

  // Validate JWT token
  async validateToken(
    token: string,
  ): Promise<{ isValid: boolean; userId?: string; error?: string }> {
    // First check if token is blacklisted
    const isBlacklisted = await this.tokenBlacklistService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return {
        isValid: false,
        error: "Token has been revoked",
      };
    }

    const validation = this.jwtTokenService.validateAccessToken(token);

    if (!validation.isValid) {
      return {
        isValid: false,
        error: validation.error,
      };
    }

    // Additional checks: ensure user still exists and is approved
    if (validation.payload) {
      const user = await this.userRepository.findById(validation.payload.userId);
      if (!user?.isApproved()) {
        return {
          isValid: false,
          error: "User not found or not approved",
        };
      }
    }

    return {
      isValid: true,
      userId: validation.payload?.userId,
    };
  }

  // Refresh token
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const validation = this.jwtTokenService.validateRefreshToken(refreshToken);

    if (!validation.isValid) {
      throw new TokenValidationError(`Invalid refresh token: ${validation.error}`);
    }

    const user = await this.userRepository.findByIdOrThrow(validation.userId);

    if (!user.isApproved()) {
      throw new ApprovalStatusError(user.getApprovalStatus().toString(), "refresh token");
    }

    return this.jwtTokenService.refreshAccessToken(refreshToken, user);
  }

  private hashToken(token: string): string {
    return `${createHash("sha256").update(token).digest("hex").substring(0, 10)}...`;
  }

  // Security helpers (kept for backward compatibility)
  async validateSession(
    token: string,
  ): Promise<{ isValid: boolean; userId?: string; roles?: string[] }> {
    const validation = await this.validateToken(token);

    if (!validation.isValid) {
      return { isValid: false };
    }

    const tokenClaims = this.jwtTokenService.getTokenClaims(token);

    return {
      isValid: true,
      userId: validation.userId,
      roles: tokenClaims?.roles,
    };
  }

  async refreshSession(userId: string): Promise<{ token: string }> {
    const user = await this.userRepository.findByIdOrThrow(userId);

    if (!user.isApproved()) {
      throw new ApprovalStatusError(user.getApprovalStatus().toString(), "refresh token");
    }

    const tokens = this.jwtTokenService.generateTokens(user);

    return {
      token: tokens.accessToken,
    };
  }
}
