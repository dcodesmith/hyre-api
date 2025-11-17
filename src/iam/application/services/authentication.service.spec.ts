import { Test, TestingModule } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { ApprovalStatus } from "../../domain/value-objects/approval-status.vo";
import { Role } from "../../domain/value-objects/role.vo";
import {
  AuthenticationService,
  type AuthRequest,
  type LoginResponse,
  type OtpGenerationResponse,
  type VerifyOtpRequest,
} from "./authentication.service";

describe("AuthenticationService", () => {
  let service: AuthenticationService;
  let mockUserRepository: UserRepository;
  let mockOtpAuthenticationService: OtpAuthenticationService;
  let mockJwtTokenService: JwtTokenService;
  let mockTokenBlacklistService: TokenBlacklistService;
  let mockSessionCleanupService: SessionCleanupService;
  let mockDomainEventPublisher: DomainEventPublisher;
  let mockLogger: LoggerService;

  const mockUser = {
    getId: vi.fn(() => "user-123"),
    getEmail: vi.fn(() => "test@example.com"),
    getPhoneNumber: vi.fn(() => "+1234567890"),
    getName: vi.fn(() => "Test User"),
    getRoles: vi.fn(() => [Role.create("customer")]),
    getApprovalStatus: vi.fn(() => ApprovalStatus.create("APPROVED")),
    hasOnboarded: vi.fn(() => true),
    canMakeBookings: vi.fn(() => true),
    isApproved: vi.fn(() => true),
    isRegistered: vi.fn(() => true),
    isGuest: vi.fn(() => false),
  } as unknown as User;

  const mockTokenPair: TokenPair = {
    accessToken: "access-token-123",
    refreshToken: "refresh-token-123",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        {
          provide: "UserRepository",
          useValue: {
            findByEmail: vi.fn(),
            findById: vi.fn(),
            findByIdOrThrow: vi.fn(),
            save: vi.fn(),
          },
        },
        {
          provide: OtpAuthenticationService,
          useValue: {
            generateOtp: vi.fn(),
            verifyOtp: vi.fn(),
            clearOtp: vi.fn(),
          },
        },
        {
          provide: JwtTokenService,
          useValue: {
            generateTokens: vi.fn(),
            validateAccessToken: vi.fn(),
            validateRefreshToken: vi.fn(),
            refreshAccessToken: vi.fn(),
            getTokenClaims: vi.fn(),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklistToken: vi.fn(),
            isTokenBlacklisted: vi.fn(),
          },
        },
        {
          provide: SessionCleanupService,
          useValue: {
            clearUserSessions: vi.fn(),
          },
        },
        {
          provide: DomainEventPublisher,
          useValue: {
            publish: vi.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthenticationService>(AuthenticationService);
    mockUserRepository = module.get<UserRepository>("UserRepository");
    mockOtpAuthenticationService = module.get<OtpAuthenticationService>(OtpAuthenticationService);
    mockJwtTokenService = module.get<JwtTokenService>(JwtTokenService);
    mockTokenBlacklistService = module.get<TokenBlacklistService>(TokenBlacklistService);
    mockSessionCleanupService = module.get<SessionCleanupService>(SessionCleanupService);
    mockDomainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    mockLogger = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateOtp", () => {
    const authRequest: AuthRequest = { email: "test@example.com" };

    it("should generate OTP for existing user (login)", async () => {
      const otpResult = { expiresAt: Date.now() + 300000 };
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(mockOtpAuthenticationService.generateOtp).mockResolvedValue(otpResult);

      const result: OtpGenerationResponse = await service.generateOtp(authRequest);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(mockOtpAuthenticationService.generateOtp).toHaveBeenCalledWith("test@example.com");
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(expect.any(OtpGeneratedEvent));
      expect(result).toEqual({
        success: true,
        message: "OTP sent to test@example.com",
        expiresAt: otpResult.expiresAt,
        phoneNumber: "",
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Existing user found, sending login OTP via email",
        expect.any(Object),
      );
    });

    it("should generate OTP for new user (registration)", async () => {
      const otpResult = { expiresAt: Date.now() + 300000 };
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(mockOtpAuthenticationService.generateOtp).mockResolvedValue(otpResult);

      const result: OtpGenerationResponse = await service.generateOtp(authRequest);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(mockOtpAuthenticationService.generateOtp).toHaveBeenCalledWith("test@example.com");
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(expect.any(OtpGeneratedEvent));
      expect(result).toEqual({
        success: true,
        message: "OTP sent to test@example.com",
        expiresAt: otpResult.expiresAt,
        phoneNumber: "",
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "New user detected, sending registration OTP via email",
        expect.any(Object),
      );
    });
  });

  describe("verifyOtpAndAuthenticate", () => {
    const verifyRequest: VerifyOtpRequest = {
      email: "test@example.com",
      otpCode: "123456",
      role: "customer",
    };

    it("should authenticate existing user with valid OTP", async () => {
      const verificationResult = { isValid: true };
      vi.mocked(mockOtpAuthenticationService.verifyOtp).mockResolvedValue(verificationResult);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(mockJwtTokenService.generateTokens).mockReturnValue(mockTokenPair);

      const result: LoginResponse = await service.verifyOtpAndAuthenticate(verifyRequest);

      expect(mockOtpAuthenticationService.verifyOtp).toHaveBeenCalledWith(
        "test@example.com",
        "123456",
      );
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(mockJwtTokenService.generateTokens).toHaveBeenCalledWith(mockUser, {
        includeRefreshToken: true,
      });
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith([
        expect.any(OtpVerifiedEvent),
        expect.any(UserAuthenticatedEvent),
      ]);
      expect(result.success).toBe(true);
      expect(result.tokens).toEqual(mockTokenPair);
      expect(result.message).toBe("Welcome back! Login successful");
    });

    it("should register new customer user with valid OTP", async () => {
      const verificationResult = { isValid: true };
      const newUser = { ...mockUser, getId: vi.fn(() => "new-user-123") };

      vi.mocked(mockOtpAuthenticationService.verifyOtp).mockResolvedValue(verificationResult);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepository.save).mockResolvedValue(newUser as User);
      vi.mocked(mockJwtTokenService.generateTokens).mockReturnValue(mockTokenPair);
      vi.spyOn(User, "registerAsCustomer").mockReturnValue(newUser as User);

      const result: LoginResponse = await service.verifyOtpAndAuthenticate(verifyRequest);

      expect(User.registerAsCustomer).toHaveBeenCalledWith(
        "test@example.com",
        "+10000000000",
        undefined,
      );
      expect(mockUserRepository.save).toHaveBeenCalledWith(newUser);
      expect(result.success).toBe(true);
      expect(result.message).toBe("Welcome to Hyre! Registration successful");
    });

    it("should register new fleet owner user with valid OTP", async () => {
      const verificationResult = { isValid: true };
      const newUser = { ...mockUser, getId: vi.fn(() => "new-user-123") };
      const fleetOwnerRequest = { ...verifyRequest, role: "fleetOwner" };

      vi.mocked(mockOtpAuthenticationService.verifyOtp).mockResolvedValue(verificationResult);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepository.save).mockResolvedValue(newUser as User);
      vi.mocked(mockJwtTokenService.generateTokens).mockReturnValue(mockTokenPair);
      vi.spyOn(User, "registerAsFleetOwner").mockReturnValue(newUser as User);

      const result: LoginResponse = await service.verifyOtpAndAuthenticate(fleetOwnerRequest);

      expect(User.registerAsFleetOwner).toHaveBeenCalledWith(
        "test@example.com",
        "+10000000000",
        undefined,
      );
      expect(mockUserRepository.save).toHaveBeenCalledWith(newUser);
      expect(result.success).toBe(true);
      expect(result.message).toBe("Welcome to Hyre! Registration successful");
    });

    it("should reject invalid OTP", async () => {
      const verificationResult = { isValid: false, reason: "Invalid OTP code" };
      vi.mocked(mockOtpAuthenticationService.verifyOtp).mockResolvedValue(verificationResult);

      const result: LoginResponse = await service.verifyOtpAndAuthenticate(verifyRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid OTP code");
      expect(result.user).toBeUndefined();
      expect(result.tokens).toBeUndefined();
    });

    it("should reject restricted role registration", async () => {
      const verificationResult = { isValid: true };
      const restrictedRequest = { ...verifyRequest, role: "staff" };

      vi.mocked(mockOtpAuthenticationService.verifyOtp).mockResolvedValue(verificationResult);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);

      const result: LoginResponse = await service.verifyOtpAndAuthenticate(restrictedRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe("staff accounts must be created by authorized users");
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("should reject role mismatch for existing user", async () => {
      const verificationResult = { isValid: true };
      const mismatchRequest = { ...verifyRequest, role: "fleetOwner" };

      vi.mocked(mockOtpAuthenticationService.verifyOtp).mockResolvedValue(verificationResult);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser);

      const result: LoginResponse = await service.verifyOtpAndAuthenticate(mismatchRequest);

      expect(result.success).toBe(false);
      expect(result.message).toContain('has role(s) [customer] but requested role "fleetOwner"');
    });
  });

  describe("logout", () => {
    it("should logout user successfully with token", async () => {
      const token = "valid-token";
      const tokenClaims = { exp: Math.floor(Date.now() / 1000) + 3600 };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockJwtTokenService.getTokenClaims).mockReturnValue(tokenClaims);

      await service.logout("user-123", token);

      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
      expect(mockTokenBlacklistService.blacklistToken).toHaveBeenCalledWith(
        token,
        expect.any(Date),
      );
      expect(mockSessionCleanupService.clearUserSessions).toHaveBeenCalledWith(
        "user-123",
        "test@example.com",
      );
      expect(mockOtpAuthenticationService.clearOtp).toHaveBeenCalledWith("test@example.com");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "User logout completed successfully",
        expect.any(Object),
      );
    });

    it("should logout user successfully without token", async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);

      await service.logout("user-123");

      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
      expect(mockTokenBlacklistService.blacklistToken).not.toHaveBeenCalled();
      expect(mockSessionCleanupService.clearUserSessions).toHaveBeenCalledWith(
        "user-123",
        "test@example.com",
      );
    });

    it("should handle logout for non-existent user", async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await service.logout("non-existent-user");

      expect(mockLogger.warn).toHaveBeenCalledWith("Logout attempted for non-existent user");
      expect(mockSessionCleanupService.clearUserSessions).not.toHaveBeenCalled();
    });
  });

  describe("validateToken", () => {
    const token = "valid-token";

    it("should validate token successfully", async () => {
      const validation = { isValid: true, payload: { userId: "user-123" } };

      vi.mocked(mockTokenBlacklistService.isTokenBlacklisted).mockResolvedValue(false);
      vi.mocked(mockJwtTokenService.validateAccessToken).mockReturnValue(validation);
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);

      const result = await service.validateToken(token);

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe("user-123");
      expect(result.error).toBeUndefined();
    });

    it("should reject blacklisted token", async () => {
      vi.mocked(mockTokenBlacklistService.isTokenBlacklisted).mockResolvedValue(true);

      const result = await service.validateToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Token has been revoked");
    });

    it("should reject invalid token", async () => {
      const validation = { isValid: false, error: "Token expired" };

      vi.mocked(mockTokenBlacklistService.isTokenBlacklisted).mockResolvedValue(false);
      vi.mocked(mockJwtTokenService.validateAccessToken).mockReturnValue(validation);

      const result = await service.validateToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Token expired");
    });

    it("should reject token for non-approved user", async () => {
      const validation = { isValid: true, payload: { userId: "user-123" } };
      const unapprovedUser = { ...mockUser, isApproved: vi.fn(() => false) };

      vi.mocked(mockTokenBlacklistService.isTokenBlacklisted).mockResolvedValue(false);
      vi.mocked(mockJwtTokenService.validateAccessToken).mockReturnValue(validation);
      vi.mocked(mockUserRepository.findById).mockResolvedValue(unapprovedUser as User);

      const result = await service.validateToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("User not found or not approved");
    });
  });

  describe("refreshToken", () => {
    const refreshToken = "valid-refresh-token";

    it("should refresh token successfully", async () => {
      const validation = { isValid: true, userId: "user-123" };

      vi.mocked(mockJwtTokenService.validateRefreshToken).mockReturnValue(validation);
      vi.mocked(mockUserRepository.findByIdOrThrow).mockResolvedValue(mockUser);
      vi.mocked(mockJwtTokenService.refreshAccessToken).mockReturnValue(mockTokenPair);

      const result = await service.refreshToken(refreshToken);

      expect(mockJwtTokenService.validateRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUserRepository.findByIdOrThrow).toHaveBeenCalledWith("user-123");
      expect(mockJwtTokenService.refreshAccessToken).toHaveBeenCalledWith(refreshToken, mockUser);
      expect(result).toEqual(mockTokenPair);
    });

    it("should throw error for invalid refresh token", async () => {
      const validation = { isValid: false, error: "Invalid refresh token" };

      vi.mocked(mockJwtTokenService.validateRefreshToken).mockReturnValue(validation);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(TokenValidationError);
    });

    it("should throw error for unapproved user", async () => {
      const validation = { isValid: true, userId: "user-123" };
      const unapprovedUser = { ...mockUser, isApproved: vi.fn(() => false) };

      vi.mocked(mockJwtTokenService.validateRefreshToken).mockReturnValue(validation);
      vi.mocked(mockUserRepository.findByIdOrThrow).mockResolvedValue(unapprovedUser as User);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(ApprovalStatusError);
    });
  });

  describe("validateSession", () => {
    it("should validate session successfully", async () => {
      const token = "valid-token";
      const tokenClaims = { roles: ["customer"] };

      vi.spyOn(service, "validateToken").mockResolvedValue({
        isValid: true,
        userId: "user-123",
      });
      vi.mocked(mockJwtTokenService.getTokenClaims).mockReturnValue(tokenClaims);

      const result = await service.validateSession(token);

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe("user-123");
      expect(result.roles).toEqual(["customer"]);
    });

    it("should reject invalid session", async () => {
      const token = "invalid-token";

      vi.spyOn(service, "validateToken").mockResolvedValue({
        isValid: false,
        error: "Token expired",
      });

      const result = await service.validateSession(token);

      expect(result.isValid).toBe(false);
      expect(result.userId).toBeUndefined();
      expect(result.roles).toBeUndefined();
    });
  });

  describe("refreshSession", () => {
    it("should refresh session successfully", async () => {
      vi.mocked(mockUserRepository.findByIdOrThrow).mockResolvedValue(mockUser);
      vi.mocked(mockJwtTokenService.generateTokens).mockReturnValue(mockTokenPair);

      const result = await service.refreshSession("user-123");

      expect(mockUserRepository.findByIdOrThrow).toHaveBeenCalledWith("user-123");
      expect(mockJwtTokenService.generateTokens).toHaveBeenCalledWith(mockUser);
      expect(result.token).toBe("access-token-123");
    });

    it("should throw error for unapproved user", async () => {
      const unapprovedUser = { ...mockUser, isApproved: vi.fn(() => false) };

      vi.mocked(mockUserRepository.findByIdOrThrow).mockResolvedValue(unapprovedUser as User);

      await expect(service.refreshSession("user-123")).rejects.toThrow(ApprovalStatusError);
    });
  });
});
