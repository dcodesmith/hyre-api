import { Inject, Injectable } from "@nestjs/common";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { UserRepository } from "../../domain/repositories/user.repository";
import { ApprovalWorkflowService } from "../../domain/services/approval-workflow.service";
import { RoleAuthorizationService } from "../../domain/services/role-authorization.service";

export interface UserApprovalResponse {
  userId: string;
  newStatus: string;
  message: string;
}

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
 * Application service responsible for user approval workflow operations
 * Following SRP - focused only on user approval and rejection processes
 */
@Injectable()
export class UserApprovalApplicationService {
  constructor(
    @Inject("UserRepository") private readonly userRepository: UserRepository,
    private readonly roleAuthorizationService: RoleAuthorizationService,
    private readonly approvalWorkflowService: ApprovalWorkflowService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UserApprovalApplicationService.name);
  }

  async approveUser(
    userId: string,
    approvedBy: string,
    notes?: string,
  ): Promise<UserApprovalResponse> {
    this.logger.info("Approving user", { userId, approvedBy });

    // Get both users
    const user = await this.userRepository.findByIdOrThrow(userId);
    const approver = await this.userRepository.findByIdOrThrow(approvedBy);

    // Validate authorization
    this.roleAuthorizationService.requireAuthorization(
      approver,
      "approve_user",
      undefined,
      undefined,
      { targetUserRole: user.getPrimaryRole().toString() },
    );

    // Process approval through domain service
    const result = this.approvalWorkflowService.processApprovalDecision(
      user,
      {
        decision: "approve",
        approvedBy,
        reason: notes,
      },
      approver,
    );

    // Save and publish events
    await this.userRepository.save(user);
    await this.domainEventPublisher.publish(user);

    this.logger.info("User approved successfully", {
      userId,
      approvedBy,
    });

    return {
      userId: user.getId(),
      newStatus: result.newStatus.toString(),
      message: result.message,
    };
  }

  async rejectUser(
    userId: string,
    rejectedBy: string,
    reason: string,
  ): Promise<UserApprovalResponse> {
    this.logger.info("Rejecting user", { userId, rejectedBy, reason });

    const user = await this.userRepository.findByIdOrThrow(userId);
    const rejector = await this.userRepository.findByIdOrThrow(rejectedBy);

    // Validate authorization
    this.roleAuthorizationService.requireAuthorization(
      rejector,
      "approve_user",
      undefined,
      undefined,
      { targetUserRole: user.getPrimaryRole().toString() },
    );

    // Process rejection through domain service
    const result = this.approvalWorkflowService.processApprovalDecision(
      user,
      {
        decision: "reject",
        reason,
        approvedBy: rejectedBy,
      },
      rejector,
    );

    // Save and publish events
    await this.userRepository.save(user);
    await this.domainEventPublisher.publish(user);

    this.logger.info("User rejected", { userId, rejectedBy });

    return {
      userId: user.getId(),
      newStatus: result.newStatus.toString(),
      message: result.message,
    };
  }

  async getPendingApprovals(
    requesterId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<UserSearchResponse> {
    const requester = await this.userRepository.findByIdOrThrow(requesterId);
    this.roleAuthorizationService.requireAuthorization(requester, "approve_user");

    const result = await this.userRepository.findPendingApprovals(undefined, {
      page: options.page || 1,
      limit: options.limit || 20,
      sortBy: "createdAt",
      sortOrder: "asc",
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
