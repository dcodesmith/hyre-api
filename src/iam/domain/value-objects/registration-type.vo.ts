import { ValueObject } from "../../../shared/domain/value-object";

export enum RegistrationTypeEnum {
  SELF_REGISTRATION = "SELF_REGISTRATION", // Customer, Fleet Owner
  ADMIN_CREATED = "ADMIN_CREATED", // Staff
  FLEET_OWNER_ADDED = "FLEET_OWNER_ADDED", // Chauffeur
  GUEST_REGISTRATION = "GUEST_REGISTRATION", // Guest user
}

interface RegistrationTypeProps {
  value: RegistrationTypeEnum;
  createdBy?: string;
}

export class RegistrationType extends ValueObject<RegistrationTypeProps> {
  get value(): RegistrationTypeEnum {
    return this.props.value;
  }

  get createdBy(): string | undefined {
    return this.props.createdBy;
  }

  private constructor(props: RegistrationTypeProps) {
    super(props);
  }

  public static selfRegistration(): RegistrationType {
    return new RegistrationType({ value: RegistrationTypeEnum.SELF_REGISTRATION });
  }

  public static adminCreated(adminId: string): RegistrationType {
    return new RegistrationType({
      value: RegistrationTypeEnum.ADMIN_CREATED,
      createdBy: adminId,
    });
  }

  public static fleetOwnerAdded(fleetOwnerId: string): RegistrationType {
    return new RegistrationType({
      value: RegistrationTypeEnum.FLEET_OWNER_ADDED,
      createdBy: fleetOwnerId,
    });
  }

  public static guestRegistration(): RegistrationType {
    return new RegistrationType({
      value: RegistrationTypeEnum.GUEST_REGISTRATION,
      createdBy: "system",
    });
  }

  // Business rule methods
  public isSelfRegistration(): boolean {
    return this.props.value === RegistrationTypeEnum.SELF_REGISTRATION;
  }

  public isAdminCreated(): boolean {
    return this.props.value === RegistrationTypeEnum.ADMIN_CREATED;
  }

  public isFleetOwnerAdded(): boolean {
    return this.props.value === RegistrationTypeEnum.FLEET_OWNER_ADDED;
  }

  public isGuestRegistration(): boolean {
    return this.props.value === RegistrationTypeEnum.GUEST_REGISTRATION;
  }

  public requiresOtpVerification(): boolean {
    return this.props.value === RegistrationTypeEnum.SELF_REGISTRATION;
  }

  public requiresEmailSetup(): boolean {
    return this.props.value !== RegistrationTypeEnum.SELF_REGISTRATION;
  }

  public hasCreator(): boolean {
    return this.props.createdBy !== undefined;
  }

  public toString(): string {
    return this.props.value;
  }
}
