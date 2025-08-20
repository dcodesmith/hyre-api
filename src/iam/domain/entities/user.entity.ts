import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import {
  ApprovalStatusError,
  FleetOwnerRelationshipError,
  InvalidRegistrationError,
  InvalidUserStateError,
  UnauthorizedActionError,
} from "../errors/iam.errors";
import { FleetOwnerApprovedEvent } from "../events/fleet-owner-approved.event";
import { UserApprovedEvent } from "../events/user-approved.event";
import { UserRegisteredEvent } from "../events/user-registered.event";
import { UserRoleAssignedEvent } from "../events/user-role-assigned.event";
import { ApprovalStatus } from "../value-objects/approval-status.vo";
import { RegistrationType } from "../value-objects/registration-type.vo";
import { UserRole } from "../value-objects/user-role.vo";
import { UserType } from "../value-objects/user-type.vo";

export interface UserProps {
  id?: string;
  userType: UserType;
  email: string;
  username?: string;
  name: string; // Now required for both registered and guest users
  phoneNumber: string; // Now required for both registered and guest users
  address?: string;
  city?: string;
  hasOnboarded: boolean;
  guestExpiresAt?: Date; // For guest user cleanup
  roles: UserRole[];
  fleetOwnerId?: string;
  approvalStatus: ApprovalStatus;
  registrationType: RegistrationType;
  bankDetailsId?: string;
  driverLicenseNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot {
  private constructor(private readonly props: UserProps) {
    super();
  }

  // Factory methods for different registration types
  public static registerAsCustomer(email: string, phoneNumber: string, name: string): User {
    const user = new User({
      userType: UserType.registered(),
      email,
      phoneNumber,
      name,
      hasOnboarded: false,
      roles: [UserRole.customer()],
      approvalStatus: ApprovalStatus.approved("system"), // Customers are auto-approved
      registrationType: RegistrationType.selfRegistration(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return user;
  }

  /**
   * Creates a guest user for booking purposes
   * Guest users have a 90-day expiry and limited permissions
   */
  public static createGuest(email: string, name: string, phoneNumber: string): User {
    const guestExpiresAt = new Date();
    guestExpiresAt.setDate(guestExpiresAt.getDate() + 90); // 90 days from now

    const user = new User({
      userType: UserType.guest(),
      email,
      phoneNumber,
      name,
      hasOnboarded: false,
      guestExpiresAt,
      roles: [UserRole.customer()], // Guests can make bookings like customers
      approvalStatus: ApprovalStatus.approved("system"), // Guests are auto-approved for booking
      registrationType: RegistrationType.guestRegistration(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Emit guest user created event
    user.addDomainEvent(
      new UserRegisteredEvent(user.getId(), email, phoneNumber, "guest", "guest_registration"),
    );

    return user;
  }

  public static registerAsFleetOwner(email: string, phoneNumber: string, name: string): User {
    const user = new User({
      userType: UserType.registered(),
      email,
      phoneNumber,
      name,
      hasOnboarded: false,
      roles: [UserRole.fleetOwner()],
      approvalStatus: ApprovalStatus.pending(), // Fleet owners need approval
      registrationType: RegistrationType.selfRegistration(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return user;
  }

  public static createChauffeur(
    fleetOwnerId: string,
    // phoneNumber: PhoneNumber,
    phoneNumber: string,
    driverLicenseNumber: string,
    name: string,
  ): User {
    if (!fleetOwnerId || fleetOwnerId.trim().length === 0) {
      throw new InvalidRegistrationError("Fleet owner ID is required for chauffeur creation");
    }

    if (!driverLicenseNumber || driverLicenseNumber.trim().length === 0) {
      throw new InvalidRegistrationError("Driver license number is required for chauffeurs");
    }

    // Generate email for chauffeur based on phone number
    const email = `chauffeur_${phoneNumber}@hyre.local`;

    const user = new User({
      // id: userId,
      userType: UserType.registered(),
      email,
      phoneNumber,
      name,
      hasOnboarded: false,
      roles: [UserRole.chauffeur()],
      fleetOwnerId,
      approvalStatus: ApprovalStatus.pending(),
      registrationType: RegistrationType.fleetOwnerAdded(fleetOwnerId),
      driverLicenseNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return user;
  }

  public static createStaff(
    adminId: string,
    email: string,
    phoneNumber: string,
    name: string,
  ): User {
    if (!adminId || adminId.trim().length === 0) {
      throw new InvalidRegistrationError("Admin ID is required for staff creation");
    }

    const user = new User({
      userType: UserType.registered(),
      email,
      phoneNumber,
      name,
      hasOnboarded: false,
      roles: [UserRole.staff()],
      approvalStatus: ApprovalStatus.approved(adminId),
      registrationType: RegistrationType.adminCreated(adminId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return user;
  }

  public static reconstitute(props: UserProps): User {
    return new User(props);
  }

  // Getters
  public getId(): string | undefined {
    return this.props.id;
  }

  public getUserType(): UserType {
    return this.props.userType;
  }

  public getEmail(): string {
    return this.props.email;
  }

  // public getPhoneNumber(): PhoneNumber {
  //   return this.props.phoneNumber;
  // }

  public getPhoneNumber(): string | undefined {
    return this.props.phoneNumber;
  }

  public getName(): string {
    return this.props.name;
  }

  public getRoles(): UserRole[] {
    return [...this.props.roles];
  }

  public getApprovalStatus(): ApprovalStatus {
    return this.props.approvalStatus;
  }

  public getFleetOwnerId(): string | undefined {
    return this.props.fleetOwnerId;
  }

  public getDriverLicenseNumber(): string | undefined {
    return this.props.driverLicenseNumber;
  }

  public hasOnboarded(): boolean {
    return this.props.hasOnboarded;
  }

  public getAddress(): string | undefined {
    return this.props.address;
  }

  public getCity(): string | undefined {
    return this.props.city;
  }

  public getRegistrationType(): RegistrationType {
    return this.props.registrationType;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business rule methods
  public hasRole(role: string): boolean {
    return this.props.roles.some((r) => r.toString() === role);
  }

  public getPrimaryRole(): UserRole {
    return this.props.roles[0];
  }

  public canMakeBookings(): boolean {
    if (this.isGuest()) {
      return this.canMakeBookingsAsGuest();
    }
    return this.getPrimaryRole().canMakeBookings() && this.isApproved();
  }

  public canApproveDocuments(): boolean {
    return this.getPrimaryRole().canApproveDocuments() && this.isApproved();
  }

  public canAddChauffeurs(): boolean {
    return this.getPrimaryRole().canAddChauffeurs() && this.isApproved();
  }

  public canAssignChauffeurs(): boolean {
    return this.getPrimaryRole().canAssignChauffeurs() && this.isApproved();
  }

  public canAddStaff(): boolean {
    return this.getPrimaryRole().canAddStaff() && this.isApproved();
  }

  public canAccessAdminPanel(): boolean {
    return this.getPrimaryRole().canAccessAdminPanel() && this.isApproved();
  }

  public isApproved(): boolean {
    return this.props.approvalStatus.isApproved();
  }

  public isPending(): boolean {
    return this.props.approvalStatus.isPending();
  }

  public isRejected(): boolean {
    return this.props.approvalStatus.isRejected();
  }

  public isFleetOwner(): boolean {
    return this.hasRole("fleetOwner");
  }

  public isChauffeur(): boolean {
    return this.hasRole("chauffeur");
  }

  public isAdmin(): boolean {
    return this.hasRole("admin");
  }

  public isStaff() {
    return this.hasRole("staff");
  }

  public isCustomer(): boolean {
    return this.hasRole("customer");
  }

  public isAdminOrStaff(): boolean {
    return this.hasRole("admin") || this.hasRole("staff");
  }

  public belongsToFleetOwner(fleetOwnerId: string): boolean {
    return this.props.fleetOwnerId === fleetOwnerId;
  }

  // Guest user specific methods
  public isGuest(): boolean {
    return this.props.userType.isGuest();
  }

  public isRegistered(): boolean {
    return this.props.userType.isRegistered();
  }

  public isGuestExpired(): boolean {
    if (!this.isGuest() || !this.props.guestExpiresAt) {
      return false;
    }
    return new Date() > this.props.guestExpiresAt;
  }

  public canMakeBookingsAsGuest(): boolean {
    return this.isGuest() && !this.isGuestExpired() && this.isApproved();
  }

  public getGuestExpiryDate(): Date | undefined {
    return this.props.guestExpiresAt;
  }

  public upgradeToRegistered(): void {
    if (!this.isGuest()) {
      throw new InvalidUserStateError("Only guest users can be upgraded to registered");
    }

    this.props.userType = UserType.registered();
    this.props.registrationType = RegistrationType.selfRegistration();
    this.props.guestExpiresAt = undefined; // Remove expiry for registered users
    this.props.updatedAt = new Date();

    // Emit upgrade event
    this.addDomainEvent(
      new UserRegisteredEvent(
        this.props.id,
        this.props.email,
        this.props.phoneNumber,
        "registered",
        "upgrade_from_guest",
      ),
    );
  }

  // State transition methods
  public approve(approvedBy: string): void {
    if (!this.props.approvalStatus.canBeApproved()) {
      throw new ApprovalStatusError(this.props.approvalStatus.toString(), "approve");
    }

    this.props.approvalStatus = ApprovalStatus.approved(approvedBy);
    this.props.updatedAt = new Date();

    // Emit specific event for fleet owner approval
    if (this.isFleetOwner()) {
      this.addDomainEvent(
        new FleetOwnerApprovedEvent(
          this.props.id,
          this.props.id,
          this.props.email,
          this.props.phoneNumber.toString(),
          approvedBy,
        ),
      );
    } else {
      this.addDomainEvent(
        new UserApprovedEvent(
          this.props.id,
          this.props.id,
          this.getPrimaryRole().toString(),
          approvedBy,
        ),
      );
    }
  }

  public reject(reason: string, rejectedBy: string): void {
    if (!this.props.approvalStatus.canBeRejected()) {
      throw new ApprovalStatusError(this.props.approvalStatus.toString(), "reject");
    }

    this.props.approvalStatus = ApprovalStatus.rejected(reason, rejectedBy);
    this.props.updatedAt = new Date();
  }

  public putOnHold(reason: string): void {
    if (!this.props.approvalStatus.canBePutOnHold()) {
      throw new ApprovalStatusError(this.props.approvalStatus.toString(), "put on hold");
    }

    this.props.approvalStatus = ApprovalStatus.onHold(reason);
    this.props.updatedAt = new Date();
  }

  public completeOnboarding(): void {
    if (!this.isApproved()) {
      throw new InvalidUserStateError("User must be approved before completing onboarding");
    }

    this.props.hasOnboarded = true;
    this.props.updatedAt = new Date();
  }

  public assignRole(role: UserRole, assignedBy: string): void {
    if (!this.isApproved()) {
      throw new InvalidUserStateError("User must be approved before assigning additional roles");
    }

    // Check if user already has this role
    if (this.hasRole(role.toString())) {
      return; // No need to add duplicate role
    }

    this.props.roles.push(role);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new UserRoleAssignedEvent(this.props.id, this.props.id, role.toString(), assignedBy),
    );
  }

  public updateProfile(name?: string, address?: string, city?: string): void {
    if (name !== undefined) this.props.name = name;
    if (address !== undefined) this.props.address = address;
    if (city !== undefined) this.props.city = city;
    this.props.updatedAt = new Date();
  }

  public linkBankDetails(bankDetailsId: string): void {
    if (!this.isFleetOwner()) {
      throw new UnauthorizedActionError(
        "link bank details",
        "Only fleet owners can link bank details",
      );
    }

    if (!this.isApproved()) {
      throw new InvalidUserStateError("Fleet owner must be approved before linking bank details");
    }

    this.props.bankDetailsId = bankDetailsId;
    this.props.updatedAt = new Date();
  }

  // Chauffeur-specific methods
  public canBeAssignedToBooking(): boolean {
    return this.isChauffeur() && this.isApproved();
  }

  public hasValidDriverLicense(): boolean {
    return this.isChauffeur() && !!this.props.driverLicenseNumber;
  }

  // Fleet owner-specific methods
  public canAddChauffeurToFleet(chauffeurFleetOwnerId?: string): boolean {
    if (!this.isFleetOwner() || !this.isApproved()) {
      return false;
    }

    // If chauffeur already belongs to a fleet, they can't be added to another
    return !chauffeurFleetOwnerId || chauffeurFleetOwnerId === this.props.id;
  }

  public validateChauffeurRelationship(
    _chauffeurUserId: string,
    chauffeurFleetOwnerId?: string,
  ): void {
    if (!this.isFleetOwner()) {
      throw new FleetOwnerRelationshipError("User is not a fleet owner");
    }

    if (!this.isApproved()) {
      throw new FleetOwnerRelationshipError("Fleet owner must be approved");
    }

    if (chauffeurFleetOwnerId && chauffeurFleetOwnerId !== this.props.id) {
      throw new FleetOwnerRelationshipError("Chauffeur belongs to different fleet owner");
    }
  }

  public toSummary(): {
    id: string;
    email: string;
    phoneNumber: string;
    name?: string;
    roles: string[];
    approvalStatus: string;
    isOnboarded: boolean;
  } {
    try {
      const summary = {
        id: this.props.id,
        email: this.props.email,
        phoneNumber: this.props.phoneNumber || "",
        name: this.props.name,
        roles: this.props.roles?.map((role) => role.toString()) || [],
        approvalStatus: this.props.approvalStatus?.toString() || "UNKNOWN",
        isOnboarded: this.props.hasOnboarded || false,
      };
      return summary;
    } catch (error) {
      console.error("Error in toSummary for user:", this.props.id, error);
      throw error;
    }
  }
}
