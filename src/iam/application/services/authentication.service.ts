import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { User } from "../../domain/entities/user.entity";
import { OtpVerificationError } from "../../domain/errors/iam.errors";
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
  expiresAt: Date;
  phoneNumber: string;
}

export interface LoginResponse {
  success: boolean;
  user: {
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
  role: string;
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

    // Publish domain event
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

    this.logger.info("OTP generated for email", {
      email: request.email,
      otpType,
      expiresAt: otpResult.expiresAt,
    });

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
    this.logger.info("Verifying email OTP", { email: request.email });

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

      return {
        success: false,
        user: undefined, // Will be handled by error response
        message: verificationResult.reason || "OTP verification failed",
      };
    }

    // Check if user exists
    let user = await this.userRepository.findByEmail(request.email);
    let isNewUser = false;

    if (!user) {
      // New user - create account with just email (phone number can be added later)
      isNewUser = true;

      // Use a placeholder phone number that the user can update later
      const placeholderPhone = PhoneNumber.create("0000000000", "+1");

      // Create user based on role
      if (request.role === "fleetOwner") {
        user = User.registerAsFleetOwner(
          request.email,
          placeholderPhone.getFullNumber(),
          undefined, // No name initially - user can add it later
        );
      } else {
        user = User.registerAsCustomer(
          request.email,
          placeholderPhone.getFullNumber(),
          undefined, // No name initially - user can add it later
        );
      }

      user = await this.userRepository.save(user);

      this.logger.info("New user account created", {
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

  // Check if user can authenticate
  async canUserAuthenticate(
    userId: string,
  ): Promise<{ canAuthenticate: boolean; reason?: string }> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return {
        canAuthenticate: false,
        reason: "User not found",
      };
    }

    if (!user.isApproved()) {
      return {
        canAuthenticate: false,
        reason: "User account is not approved",
      };
    }

    // if (user.requiresOtpAuthentication() && !user.canReceiveNotifications()) {
    if (user.requiresOtpAuthentication()) {
      return {
        canAuthenticate: false,
        reason: "User cannot receive OTP notifications",
      };
    }

    return {
      canAuthenticate: true,
    };
  }

  // Logout (clear OTP and session data)
  async logout(userId: string, token?: string): Promise<void> {
    this.logger.info("User logout initiated", { userId });

    const user = await this.userRepository.findById(userId);
    if (!user) {
      this.logger.warn("Logout attempted for non-existent user", { userId });
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
      this.logger.error(
        "Logout process failed",
        (error as Error).stack,
        JSON.stringify({
          userId,
          email: user.getEmail(),
          timestamp: new Date().toISOString(),
          action: "logout",
          success: false,
          error: (error as Error).message,
        }),
      );
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
      if (!user || !user.isApproved()) {
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
      throw new OtpVerificationError(`Invalid refresh token: ${validation.error}`);
    }

    const user = await this.userRepository.findByIdOrThrow(validation.userId);

    if (!user.isApproved()) {
      throw new OtpVerificationError("User account is not approved");
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
      throw new OtpVerificationError("User account is not approved");
    }

    const tokens = this.jwtTokenService.generateTokens(user);

    return {
      token: tokens.accessToken,
    };
  }
}
