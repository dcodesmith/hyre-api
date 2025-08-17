import { Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { User } from "../../domain/entities/user.entity";
import {
  AddChauffeurDto,
  CreateStaffDto,
  RegisterCustomerDto,
  RegisterFleetOwnerDto,
  UpdateUserProfileDto,
  UserRegistrationResponseDto,
} from "../../presentation/dto";
import { ChauffeurManagementApplicationService } from "./chauffeur-management-application.service";
import {
  UserApprovalApplicationService,
  UserApprovalResponse,
} from "./user-approval-application.service";
import {
  UserProfileApplicationService,
  UserSearchResponse,
} from "./user-profile-application.service";
import { UserRegistrationApplicationService } from "./user-registration-application.service";

/**
 * Main application service that orchestrates user management operations
 * Following the Facade pattern - delegates to specialized services
 * Maintains backward compatibility while improving internal structure
 */
@Injectable()
export class UserManagementService {
  constructor(
    private readonly userRegistrationService: UserRegistrationApplicationService,
    private readonly userApprovalService: UserApprovalApplicationService,
    private readonly chauffeurManagementService: ChauffeurManagementApplicationService,
    private readonly userProfileService: UserProfileApplicationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UserManagementService.name);
  }

  async registerCustomer(dto: RegisterCustomerDto): Promise<UserRegistrationResponseDto> {
    return this.userRegistrationService.registerCustomer(dto);
  }

  async registerFleetOwner(dto: RegisterFleetOwnerDto): Promise<UserRegistrationResponseDto> {
    return this.userRegistrationService.registerFleetOwner(dto);
  }

  async addChauffeur(
    fleetOwnerId: string,
    dto: AddChauffeurDto,
  ): Promise<UserRegistrationResponseDto> {
    return this.userRegistrationService.addChauffeur(fleetOwnerId, dto);
  }

  async createStaff(adminId: string, dto: CreateStaffDto): Promise<UserRegistrationResponseDto> {
    return this.userRegistrationService.createStaff(adminId, dto);
  }

  async approveUser(
    userId: string,
    approvedBy: string,
    notes?: string,
  ): Promise<UserApprovalResponse> {
    return this.userApprovalService.approveUser(userId, approvedBy, notes);
  }

  async rejectUser(
    userId: string,
    rejectedBy: string,
    reason: string,
  ): Promise<UserApprovalResponse> {
    return this.userApprovalService.rejectUser(userId, rejectedBy, reason);
  }

  async getUserById(userId: string): Promise<User> {
    return this.userProfileService.getUserById(userId);
  }

  async searchUsers(
    filters: {
      role?: string;
      approvalStatus?: string;
      fleetOwnerId?: string;
      searchTerm?: string;
    },
    options: {
      page?: number;
      limit?: number;
    } = {},
    requesterId?: string,
  ): Promise<UserSearchResponse> {
    return this.userProfileService.searchUsers(filters, options, requesterId);
  }

  async getPendingApprovals(
    requesterId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<UserSearchResponse> {
    return this.userApprovalService.getPendingApprovals(requesterId, options);
  }

  async getFleetChauffeurs(
    fleetOwnerId: string,
    requesterId?: string,
  ): Promise<UserSearchResponse> {
    return this.chauffeurManagementService.getFleetChauffeurs(fleetOwnerId, requesterId);
  }

  async completeOnboarding(userId: string): Promise<void> {
    return this.userProfileService.completeOnboarding(userId);
  }

  async updateUserProfile(
    userId: string,
    updates: UpdateUserProfileDto,
    requesterId?: string,
  ): Promise<void> {
    return this.userProfileService.updateUserProfile(userId, updates, requesterId);
  }
}
