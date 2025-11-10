import { ValueObject } from "../../../shared/domain/value-object";

export enum UserRoleEnum {
  admin = "admin",
  staff = "staff",
  fleetOwner = "fleetOwner",
  chauffeur = "chauffeur",
  customer = "customer",
}

interface UserRoleProps {
  value: UserRoleEnum;
}

export class UserRole extends ValueObject<UserRoleProps> {
  get value(): UserRoleEnum {
    return this.props.value;
  }

  private constructor(props: UserRoleProps) {
    super(props);
  }

  public static admin(): UserRole {
    return new UserRole({ value: UserRoleEnum.admin });
  }

  public static staff(): UserRole {
    return new UserRole({ value: UserRoleEnum.staff });
  }

  public static fleetOwner(): UserRole {
    return new UserRole({ value: UserRoleEnum.fleetOwner });
  }

  public static chauffeur(): UserRole {
    return new UserRole({ value: UserRoleEnum.chauffeur });
  }

  public static customer(): UserRole {
    return new UserRole({ value: UserRoleEnum.customer });
  }

  public static fromString(role: string): UserRole {
    const enumValue = UserRoleEnum[role as keyof typeof UserRoleEnum];

    if (!enumValue) {
      throw new Error(`Invalid user role: ${role}`);
    }

    return new UserRole({ value: enumValue });
  }

  // Business rule methods
  public canMakeBookings(): boolean {
    return this.props.value === UserRoleEnum.customer;
  }

  public canApproveDocuments(): boolean {
    return [UserRoleEnum.admin, UserRoleEnum.staff].includes(this.props.value);
  }

  public canAddChauffeurs(): boolean {
    return this.props.value === UserRoleEnum.fleetOwner;
  }

  public canAssignChauffeurs(): boolean {
    return this.props.value === UserRoleEnum.fleetOwner;
  }

  public canAddStaff(): boolean {
    return this.props.value === UserRoleEnum.admin;
  }

  public requiresApproval(): boolean {
    return [UserRoleEnum.fleetOwner, UserRoleEnum.chauffeur].includes(this.props.value);
  }

  public canAccessAdminPanel(): boolean {
    return [UserRoleEnum.admin, UserRoleEnum.staff].includes(this.props.value);
  }

  public isFleetRole(): boolean {
    return [UserRoleEnum.fleetOwner, UserRoleEnum.chauffeur].includes(this.props.value);
  }

  public toString(): string {
    return this.props.value;
  }
}
