import { Inject, Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { UserRepository } from "../../domain/repositories/user.repository";
import { RoleAuthorizationService } from "../../domain/services/role-authorization.service";

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
 * Application service responsible for chauffeur management operations
 * Following SRP - focused only on chauffeur-related operations
 */
@Injectable()
export class ChauffeurManagementApplicationService {
  constructor(
    @Inject("UserRepository") private readonly userRepository: UserRepository,
    private readonly roleAuthorizationService: RoleAuthorizationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ChauffeurManagementApplicationService.name);
  }

  async getFleetChauffeurs(
    fleetOwnerId: string,
    requesterId?: string,
  ): Promise<UserSearchResponse> {
    // Authorization check
    if (requesterId && requesterId !== fleetOwnerId) {
      const requester = await this.userRepository.findByIdOrThrow(requesterId);
      this.roleAuthorizationService.requireAuthorization(requester, "view_admin_panel");
    }

    const result = await this.userRepository.findChauffeursByFleetOwner(fleetOwnerId, {
      page: 1,
      limit: 100,
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
}
