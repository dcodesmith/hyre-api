import { User, UserProps } from "@/iam/domain/entities/user.entity";
import { ApprovalStatus } from "@/iam/domain/value-objects/approval-status.vo";
import { RegistrationType } from "@/iam/domain/value-objects/registration-type.vo";
import { UserRole } from "@/iam/domain/value-objects/user-role.vo";
import { UserType } from "@/iam/domain/value-objects/user-type.vo";

export function createUserEntity(overrides: Partial<UserProps> = {}): User {
  const now = new Date();

  const props = {
    id: overrides.id ?? "user-fixture-id",
    userType: overrides.userType ?? UserType.registered(),
    email: overrides.email ?? "user.fixture@example.com",
    username: overrides.username,
    name: overrides.name ?? "Fixture User",
    phoneNumber: overrides.phoneNumber ?? "+1234567890",
    address: overrides.address,
    city: overrides.city,
    hasOnboarded: overrides.hasOnboarded ?? true,
    guestExpiresAt: overrides.guestExpiresAt,
    roles: overrides.roles ? [...overrides.roles] : [UserRole.customer()],
    fleetOwnerId: overrides.fleetOwnerId,
    approvalStatus: overrides.approvalStatus ?? ApprovalStatus.approved("system"),
    registrationType: overrides.registrationType ?? RegistrationType.selfRegistration(),
    bankDetailsId: overrides.bankDetailsId,
    driverLicenseNumber: overrides.driverLicenseNumber,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };

  return User.reconstitute(props);
}
