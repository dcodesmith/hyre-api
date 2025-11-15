import { User, UserProps } from "@/iam/domain/entities/user.entity";
import { ApprovalStatus } from "@/iam/domain/value-objects/approval-status.vo";
import { RegistrationType } from "@/iam/domain/value-objects/registration-type.vo";
import { UserRole } from "@/iam/domain/value-objects/user-role.vo";
import { UserType } from "@/iam/domain/value-objects/user-type.vo";

export function createUserEntity(overrides: Partial<UserProps> = {}): User {
  const now = new Date();

  const props = {
    id: "user-fixture-id",
    userType: UserType.registered(),
    email: "user.fixture@example.com",
    name: "Fixture User",
    phoneNumber: "+1234567890",
    address: "123 Main St",
    city: "New York",
    hasOnboarded: true,
    guestExpiresAt: undefined,
    roles: [UserRole.customer()],
    fleetOwnerId: undefined,
    approvalStatus: ApprovalStatus.approved("system"),
    registrationType: RegistrationType.selfRegistration(),
    bankDetailsId: undefined,
    driverLicenseNumber: undefined,
    createdAt: now,
    updatedAt: now,
  };

  return User.reconstitute({ ...props, ...overrides });
}
