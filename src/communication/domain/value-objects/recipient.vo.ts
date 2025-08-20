import { ValueObject } from "../../../shared/domain/value-object";

export enum RecipientRole {
  CUSTOMER = "CUSTOMER",
  CHAUFFEUR = "CHAUFFEUR",
  FLEET_OWNER = "FLEET_OWNER",
}

interface RecipientProps {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  role: RecipientRole;
}

export class Recipient extends ValueObject<RecipientProps> {
  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get phoneNumber(): string | undefined {
    return this.props.phoneNumber;
  }

  get role(): RecipientRole {
    return this.props.role;
  }

  private constructor(props: RecipientProps) {
    super(props);
  }

  public static create(
    id: string,
    name: string,
    role: RecipientRole,
    email?: string,
    phoneNumber?: string,
  ): Recipient {
    if (!id || id.trim().length === 0) {
      throw new Error("Recipient ID cannot be empty");
    }

    if (!name || name.trim().length === 0) {
      throw new Error("Recipient name cannot be empty");
    }

    if (!email && !phoneNumber) {
      throw new Error("Recipient must have either email or phone number");
    }

    return new Recipient({
      id: id.trim(),
      name: name.trim(),
      email: email?.trim(),
      phoneNumber: phoneNumber?.trim(),
      role,
    });
  }

  public hasEmail(): boolean {
    return !!this.props.email;
  }

  public hasPhoneNumber(): boolean {
    return !!this.props.phoneNumber;
  }

  public isCustomer(): boolean {
    return this.props.role === RecipientRole.CUSTOMER;
  }

  public isChauffeur(): boolean {
    return this.props.role === RecipientRole.CHAUFFEUR;
  }

  public isFleetOwner(): boolean {
    return this.props.role === RecipientRole.FLEET_OWNER;
  }

  toString(): string {
    return `${this.props.name} (${this.props.role})`;
  }
}
