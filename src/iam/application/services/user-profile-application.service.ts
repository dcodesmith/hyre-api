import { Inject, Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { User } from "../../domain/entities/user.entity";
import { UnauthorizedActionError, UserNotFoundError } from "../../domain/errors/iam.errors";
import { UserRepository } from "../../domain/repositories/user.repository";
import { UserRole } from "../../domain/value-objects/user-role.vo";
import { UpdateUserProfileDto } from "../../presentation/dto";

export interface UserSearchResponse {
  users: Array<{
    id: string;
    email: string;
    phoneNumber: string;
    name?: string;
    roles: string[];
    approvalStatus: string;
    hasOnboarded: boolean;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Application service responsible for user profile and query operations
 * Following SRP - focused only on profile management and user queries
 */
@Injectable()
export class UserProfileApplicationService {
  constructor(
    @Inject("UserRepository") private readonly userRepository: UserRepository,
    private readonly logger: LoggerService,
  ) {
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return user;
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
    // Authorization check
    if (requesterId) {
      const requester = await this.userRepository.findByIdOrThrow(requesterId);
      if (!requester.isAdmin() && !requester.isStaff()) {
        throw new UnauthorizedActionError("view_admin_panel", "Access denied");
      }
    }

    // Convert filters to domain objects
    const searchFilters: Record<string, unknown> = {};

    if (filters.role) {
      searchFilters.role = UserRole.fromString(filters.role);
    }

    if (filters.searchTerm) {
      searchFilters.searchTerm = filters.searchTerm;
    }

    if (filters.fleetOwnerId) {
      searchFilters.fleetOwnerId = filters.fleetOwnerId;
    }

    const result = await this.userRepository.search(searchFilters, {
      page: options.page || 1,
      limit: options.limit || 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    return {
      users: result.users.map((user) => ({
        id: user.getId(),
        email: user.getEmail(),
        phoneNumber: user.getPhoneNumber(),
        name: user.getName(),
        roles: user.getRoles().map((role) => role.toString()),
        approvalStatus: user.getApprovalStatus().toString(),
        hasOnboarded: user.hasOnboarded(),
        createdAt: user.getCreatedAt(),
      })),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  async completeOnboarding(userId: string): Promise<void> {
    this.logger.info("Completing user onboarding", { userId });

    const user = await this.userRepository.findByIdOrThrow(userId);
    user.completeOnboarding();

    await this.userRepository.save(user);

    this.logger.info("User onboarding completed", { userId });
  }

  async updateUserProfile(
    userId: string,
    updates: UpdateUserProfileDto,
    requesterId?: string,
  ): Promise<void> {
    // Authorization check
    if (requesterId && requesterId !== userId) {
      const requester = await this.userRepository.findByIdOrThrow(requesterId);
      if (!requester.isAdmin() && !requester.isStaff()) {
        throw new UnauthorizedActionError("update user profile", "Can only update own profile");
      }
    }

    const user = await this.userRepository.findByIdOrThrow(userId);
    user.updateProfile(updates.name, updates.address, updates.city);

    await this.userRepository.save(user);

    this.logger.info("User profile updated", { userId, updates });
  }
}
