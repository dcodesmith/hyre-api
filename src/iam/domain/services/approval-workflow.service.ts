import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { ApprovalStatusError, UnauthorizedActionError } from "../errors/iam.errors";
import { ApprovalStatus } from "../value-objects/approval-status.vo";

export interface ApprovalDecision {
  decision: "approve" | "reject" | "hold";
  reason?: string;
  approvedBy: string;
}

export interface ApprovalWorkflowResult {
  success: boolean;
  newStatus: ApprovalStatus;
  message: string;
}

@Injectable()
export class ApprovalWorkflowService {
  processApprovalDecision(
    user: User,
    decision: ApprovalDecision,
    approver: User,
  ): ApprovalWorkflowResult {
    // Validate approver permissions
    this.validateApproverPermissions(approver, user);

    // Validate current state allows the decision
    this.validateApprovalState(user, decision.decision);

    switch (decision.decision) {
      case "approve":
        return this.approveUser(user, decision.approvedBy);

      case "reject":
        return this.rejectUser(user, decision.reason || "No reason provided", decision.approvedBy);

      case "hold":
        return this.putUserOnHold(user, decision.reason || "Under review");

      default:
        throw new Error(`Invalid approval decision: ${decision.decision}`);
    }
  }

  canApproverProcessUser(approver: User, targetUser: User): boolean {
    // Basic permission check
    if (!approver.canApproveDocuments()) {
      return false;
    }

    // Role-specific business rules
    if (targetUser.hasRole("STAFF") && !approver.hasRole("ADMIN")) {
      return false; // Only admins can approve staff
    }

    // Can't approve yourself
    if (approver.getId() === targetUser.getId()) {
      return false;
    }

    return true;
  }

  getApprovalRequirements(user: User): string[] {
    const requirements: string[] = [];

    if (user.isFleetOwner()) {
      requirements.push("Business registration documents");
      requirements.push("Driver's license verification");
      requirements.push("Vehicle insurance certificates");
      requirements.push("Background check completion");
    }

    if (user.isChauffeur()) {
      requirements.push("Driver's license verification");
      requirements.push("Background check completion");
      requirements.push("Fleet owner verification");
    }

    if (user.hasRole("STAFF")) {
      requirements.push("Employment verification");
      requirements.push("Admin authorization");
    }

    return requirements;
  }

  isUserEligibleForApproval(user: User): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (
      !user.isPending() &&
      !user.getApprovalStatus().isProcessing() &&
      !user.getApprovalStatus().isOnHold()
    ) {
      reasons.push("User is not in a pending state");
    }

    if (user.isFleetOwner()) {
      // Fleet owner specific checks
      if (!user.getName() || user.getName().trim().length < 2) {
        reasons.push("Full name is required");
      }

      if (!user.getAddress()) {
        reasons.push("Business address is required");
      }

      if (!user.getPhoneNumber()) {
        reasons.push("Valid phone number is required");
      }
    }

    if (user.isChauffeur()) {
      // Chauffeur specific checks
      if (!user.hasValidDriverLicense()) {
        reasons.push("Valid driver's license is required");
      }

      if (!user.getFleetOwnerId()) {
        reasons.push("Must be associated with an approved fleet owner");
      }
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  getNextApprovalSteps(user: User): string[] {
    const steps: string[] = [];

    if (user.isPending()) {
      steps.push("Initial document review");
      steps.push("Background verification");
    }

    if (user.getApprovalStatus().isProcessing()) {
      if (user.isFleetOwner()) {
        steps.push("Business verification");
        steps.push("Insurance validation");
        steps.push("Final approval");
      }

      if (user.isChauffeur()) {
        steps.push("License validation");
        steps.push("Fleet owner confirmation");
        steps.push("Final approval");
      }
    }

    return steps;
  }

  // Workflow state management
  canTransitionToProcessing(user: User): boolean {
    return user.isPending();
  }

  transitionToProcessing(user: User): void {
    if (!this.canTransitionToProcessing(user)) {
      throw new ApprovalStatusError(
        user.getApprovalStatus().toString(),
        "transition to processing",
      );
    }

    // This would update the status to processing
    // The actual state change should happen in the User entity
  }

  // Batch approval operations
  canBatchApprove(users: User[], approver: User): { canApprove: boolean; reasons: string[] } {
    const reasons: string[] = [];

    for (const user of users) {
      if (!this.canApproverProcessUser(approver, user)) {
        reasons.push(`Cannot approve user ${user.getId()}: Insufficient permissions`);
      }

      const eligibility = this.isUserEligibleForApproval(user);
      if (!eligibility.eligible) {
        reasons.push(`User ${user.getId()} is not eligible: ${eligibility.reasons.join(", ")}`);
      }
    }

    return {
      canApprove: reasons.length === 0,
      reasons,
    };
  }

  private approveUser(user: User, approvedBy: string): ApprovalWorkflowResult {
    user.approve(approvedBy);

    return {
      success: true,
      newStatus: user.getApprovalStatus(),
      message: `User ${user.getId()} has been approved successfully`,
    };
  }

  private rejectUser(user: User, reason: string, rejectedBy: string): ApprovalWorkflowResult {
    user.reject(reason, rejectedBy);

    return {
      success: true,
      newStatus: user.getApprovalStatus(),
      message: `User ${user.getId()} has been rejected: ${reason}`,
    };
  }

  private putUserOnHold(user: User, reason: string): ApprovalWorkflowResult {
    user.putOnHold(reason);

    return {
      success: true,
      newStatus: user.getApprovalStatus(),
      message: `User ${user.getId()} has been put on hold: ${reason}`,
    };
  }

  private validateApproverPermissions(approver: User, targetUser: User): void {
    if (!this.canApproverProcessUser(approver, targetUser)) {
      throw new UnauthorizedActionError(
        "approve user",
        "Insufficient permissions to approve this user",
      );
    }
  }

  private validateApprovalState(user: User, decision: string): void {
    const status = user.getApprovalStatus();

    switch (decision) {
      case "approve":
        if (!status.canBeApproved()) {
          throw new ApprovalStatusError(status.toString(), "approve");
        }
        break;

      case "reject":
        if (!status.canBeRejected()) {
          throw new ApprovalStatusError(status.toString(), "reject");
        }
        break;

      case "hold":
        if (!status.canBePutOnHold()) {
          throw new ApprovalStatusError(status.toString(), "put on hold");
        }
        break;
    }
  }
}
