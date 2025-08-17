import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Ip,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { ZodBody, ZodQuery } from "../../shared/decorators/zod-body.decorator";
import { ZodMultipart } from "../../shared/decorators/zod-multipart.decorator";
import { OnboardingUploadInterceptor } from "../../shared/interceptors/file-upload.interceptor";
import { LoggerService } from "../../shared/logging/logger.service";
import { AuthenticationService } from "../application/services/authentication.service";
import { AuthorizationService } from "../application/services/authorization.service";
import { OnboardingApplicationService } from "../application/services/onboarding-application.service";
import { UserManagementService } from "../application/services/user-management.service";
import { User } from "../domain/entities/user.entity";
import { UserRepository } from "../domain/repositories/user.repository";
import { BankVerificationService } from "../domain/services/bank-verification.service";
import { JwtTokenService } from "../domain/services/jwt-token.service";
import { Roles } from "../infrastructure/decorators/roles.decorator";
import { CurrentUser } from "../infrastructure/decorators/user.decorator";
import { JwtAuthGuard } from "../infrastructure/guards/jwt-auth.guard";
import { RolesGuard } from "../infrastructure/guards/roles.guard";
import {
  AddChauffeurDto,
  ApprovalActionQueryDto,
  ApproveUserDto,
  AuthDto,
  addChauffeurSchema,
  approvalActionQuerySchema,
  approveUserSchema,
  authSchema,
  CreateStaffDto,
  createStaffSchema,
  FleetChauffeursQueryDto,
  fleetChauffeursQuerySchema,
  PendingApprovalsQueryDto,
  pendingApprovalsQuerySchema,
  RefreshSessionDto,
  RefreshTokenDto,
  RejectionActionQueryDto,
  RejectUserDto,
  refreshSessionSchema,
  refreshTokenSchema,
  rejectionActionQuerySchema,
  rejectUserSchema,
  UpdateProfileQueryDto,
  UpdateUserProfileDto,
  UserRegistrationResponseDto,
  updateProfileQuerySchema,
  updateUserProfileSchema,
  VerifyOtpDto,
  VerifySessionDto,
  verifyOtpSchema,
  verifySessionSchema,
} from "./dto";
import {
  AuthenticationResponseDto,
  OtpGenerationResponseDto,
  SessionValidationResponseDto,
} from "./dto/authentication-response.dto";
import {
  BankListResponse,
  FleetOwnerOnboardingDto,
  fleetOwnerOnboardingSchema,
  OnboardingSuccessResponse,
} from "./dto/onboarding.dto";

@Controller()
export class IamController {
  constructor(
    private readonly userManagementService: UserManagementService,
    private readonly authenticationService: AuthenticationService,
    private readonly authorizationService: AuthorizationService,
    private readonly onboardingService: OnboardingApplicationService,
    private readonly bankVerificationService: BankVerificationService,
    @Inject("UserRepository") private readonly userRepository: UserRepository,
    private readonly jwtTokenService: JwtTokenService,
    private readonly logger: LoggerService,
  ) {}

  @Post("auth/otp")
  async generateOtp(@ZodBody(authSchema) dto: AuthDto): Promise<OtpGenerationResponseDto> {
    this.logger.info("Generating OTP", { email: dto.email, role: dto.role });

    return this.authenticationService.generateOtp(dto);
  }

  @Post("auth/verify")
  async verifyOtp(
    @ZodBody(verifyOtpSchema) dto: VerifyOtpDto,
    @Req() request: Request,
    @Ip() ipAddress: string,
  ): Promise<AuthenticationResponseDto> {
    this.logger.info("Verifying OTP", { email: dto.email });

    const userAgent = request.get("User-Agent");

    return this.authenticationService.verifyOtpAndAuthenticate(dto, ipAddress, userAgent);
  }

  @Post("auth/logout")
  async logout(@Req() request: Request) {
    const authHeader = request.get("Authorization");
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    if (!token) {
      throw new Error("No authentication token provided");
    }

    // Extract user info from JWT token
    const tokenClaims = this.jwtTokenService.getTokenClaims(token);
    const email = tokenClaims?.email;

    if (!email) {
      throw new Error("Invalid token - no email found");
    }

    // Get userId from email by looking up the user
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new Error("User not found");
    }

    const userId = user.getId();
    this.logger.info("Processing logout", { userId, email });

    await this.authenticationService.logout(userId, token);
    return { success: true, message: "Logged out successfully" };
  }

  @Post("users/fleet-owners/:fleetOwnerId/chauffeurs")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  async addChauffeur(
    @Param("fleetOwnerId") fleetOwnerId: string,
    @ZodBody(addChauffeurSchema) dto: AddChauffeurDto,
    @CurrentUser() currentUser: User,
  ): Promise<UserRegistrationResponseDto> {
    // Verify the fleet owner is adding chauffeurs to their own fleet
    if (currentUser.getId() !== fleetOwnerId) {
      throw new ForbiddenException("You can only add chauffeurs to your own fleet");
    }

    this.logger.info("Adding chauffeur", {
      fleetOwnerId,
      phoneNumber: dto.phoneNumber,
      addedBy: currentUser.getId(),
    });

    // Domain-level ownership validation will be handled by the application service
    return this.userManagementService.addChauffeur(fleetOwnerId, dto);
  }

  @Post("users/admins/:adminId/staff")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async createStaff(
    @Param("adminId") adminId: string,
    @ZodBody(createStaffSchema) dto: CreateStaffDto,
    @CurrentUser() _currentUser: User,
  ): Promise<UserRegistrationResponseDto> {
    return this.userManagementService.createStaff(adminId, dto);
  }

  // User management endpoints
  @Get("users/me")
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() currentUser: User) {
    this.logger.info("Getting current user details", { userId: currentUser.getId() });
    return {
      success: true,
      data: currentUser.toSummary(),
      message: "User profile retrieved successfully",
    };
  }

  @Get("users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "staff")
  async getUser(@Param("id") userId: string, @CurrentUser() _currentUser: User) {
    const user = await this.userManagementService.getUserById(userId);
    return user.toSummary();
  }

  // @Get("users")
  // async searchUsers(
  //   @ZodQuery(searchUsersQuerySchema) query: SearchUsersQueryDto,
  // ): Promise<UserSearchResponseDto> {
  //   const { role, approvalStatus, fleetOwnerId, searchTerm, page, limit, requesterId } = query;

  //   return this.userManagementService.searchUsers(
  //     { role, approvalStatus, fleetOwnerId, searchTerm },
  //     { page, limit },
  //     requesterId,
  //   );
  // }

  @Get("users/pending-approvals")
  @UseGuards(JwtAuthGuard)
  async getPendingApprovals(
    @ZodQuery(pendingApprovalsQuerySchema) query: PendingApprovalsQueryDto,
    @CurrentUser() currentUser: User,
  ) {
    // Authorization handled by application service
    this.authorizationService.requireCanViewPendingApprovals(currentUser);

    const requesterId = currentUser.getId();
    const { page, limit } = query;
    return this.userManagementService.getPendingApprovals(requesterId, { page, limit });
  }

  @Get("users/fleet-owners/:fleetOwnerId/chauffeurs")
  async getFleetChauffeurs(
    @Param("fleetOwnerId") fleetOwnerId: string,
    @ZodQuery(fleetChauffeursQuerySchema) query: FleetChauffeursQueryDto,
  ) {
    return this.userManagementService.getFleetChauffeurs(fleetOwnerId, query.requesterId);
  }

  // Approval endpoints
  @Put("users/:userId/approve")
  @UseGuards(JwtAuthGuard)
  async approveUser(
    @Param("userId") userId: string,
    @ZodBody(approveUserSchema) dto: ApproveUserDto,
    @ZodQuery(approvalActionQuerySchema) _query: ApprovalActionQueryDto,
    @CurrentUser() currentUser: User,
  ) {
    // Authorization handled by application service
    this.authorizationService.requireCanApproveUsers(currentUser);

    const approvedBy = currentUser.getId();
    this.logger.info("Approving user", { userId, approvedBy });

    return this.userManagementService.approveUser(userId, approvedBy, dto.notes);
  }

  @Put("users/:userId/reject")
  @UseGuards(JwtAuthGuard)
  async rejectUser(
    @Param("userId") userId: string,
    @ZodBody(rejectUserSchema) dto: RejectUserDto,
    @ZodQuery(rejectionActionQuerySchema) _query: RejectionActionQueryDto,
    @CurrentUser() currentUser: User,
  ) {
    // Authorization handled by application service
    this.authorizationService.requireCanRejectUsers(currentUser);

    const rejectedBy = currentUser.getId();
    this.logger.info("Rejecting user", { userId, rejectedBy });

    return this.userManagementService.rejectUser(userId, rejectedBy, dto.reason);
  }

  @Put("users/:userId/profile")
  async updateProfile(
    @Param("userId") userId: string,
    @ZodBody(updateUserProfileSchema) dto: UpdateUserProfileDto,
    @ZodQuery(updateProfileQuerySchema) query: UpdateProfileQueryDto,
  ) {
    this.logger.info("Updating user profile", { userId, updates: dto });

    await this.userManagementService.updateUserProfile(userId, dto, query.requesterId);
    return { success: true, message: "Profile updated" };
  }

  // Token management endpoints
  @Post("auth/refresh-token")
  async refreshToken(@ZodBody(refreshTokenSchema) dto: RefreshTokenDto) {
    this.logger.info("Refreshing access token");

    const tokens = await this.authenticationService.refreshToken(dto.refreshToken);
    return {
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
      },
      message: "Token refreshed successfully",
    };
  }

  @Post("auth/validate-token")
  async validateToken(@ZodBody(verifySessionSchema) dto: VerifySessionDto) {
    this.logger.info("Validating token");

    const result = await this.authenticationService.validateToken(dto.token);
    return {
      isValid: result.isValid,
      userId: result.userId,
      error: result.error,
    };
  }

  // Utility endpoints

  @Post("auth/verify-session")
  async verifySession(
    @ZodBody(verifySessionSchema) dto: VerifySessionDto,
  ): Promise<SessionValidationResponseDto> {
    const result = await this.authenticationService.validateSession(dto.token);
    return {
      isValid: result.isValid,
      userId: result.userId,
      roles: result.roles,
    };
  }

  @Post("auth/refresh")
  async refreshSession(@ZodBody(refreshSessionSchema) dto: RefreshSessionDto) {
    return this.authenticationService.refreshSession(dto.userId);
  }

  // Onboarding endpoints

  @Post("onboarding")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  @UseInterceptors(OnboardingUploadInterceptor)
  async processOnboarding(
    @ZodMultipart(fleetOwnerOnboardingSchema) dto: FleetOwnerOnboardingDto,
    @CurrentUser() currentUser: User,
  ): Promise<OnboardingSuccessResponse> {
    const userId = currentUser.getId();

    this.logger.info("Processing fleet owner onboarding", {
      userId,
      phoneNumber: dto.phoneNumber,
      bankCode: dto.bankCode,
    });

    const result = await this.onboardingService.completeOnboarding({
      userId,
      dto,
    });

    return {
      success: true,
      data: {
        userId: result.user.getId(),
        userType: result.user.getPrimaryRole().toString(),
        hasOnboarded: result.user.hasOnboarded(),
        bankDetails: {
          bankName: result.bankDetails.getBankName(),
          accountNumber: result.bankDetails.getAccountNumber(),
          isVerified: result.bankDetails.isVerified(),
        },
        documents: result.documents.map((doc) => ({
          type: doc.getDocumentType().toString(),
          url: doc.getDocumentUrl(),
          status: doc.getStatus().toString(),
        })),
      },
      message: result.message,
    };
  }

  @Get("onboarding/banks")
  async getSupportedBanks(): Promise<BankListResponse> {
    this.logger.info("Getting supported banks list");

    const banks = this.bankVerificationService.getSupportedBanks();
    return { banks };
  }
}
