import { Inject, Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { DuplicateUserError, InvalidRegistrationError } from "../errors/iam.errors";
import { UserRepository } from "../repositories/user.repository";
import { PhoneNumber } from "../value-objects/phone-number.vo";
import { UserRole } from "../value-objects/user-role.vo";

export interface CustomerRegistrationData {
  email: string;
  phoneNumber: string;
  countryCode?: string;
  name?: string;
}

export interface FleetOwnerRegistrationData {
  email: string;
  phoneNumber: string;
  countryCode?: string;
  name?: string;
  address?: string;
  city?: string;
}

export interface ChauffeurCreationData {
  fleetOwnerId: string;
  phoneNumber: string;
  countryCode?: string;
  driverLicenseNumber: string;
  name?: string;
}

export interface StaffCreationData {
  adminId: string;
  email: string;
  phoneNumber: string;
  countryCode?: string;
  name?: string;
}

export interface AdminCreationData {
  email: string;
  phoneNumber: string;
  countryCode?: string;
  name?: string;
}

@Injectable()
export class UserRegistrationService {
  constructor(@Inject("UserRepository") private readonly userRepository: UserRepository) {}

  async registerCustomer(data: CustomerRegistrationData): Promise<User> {
    await this.validateUniqueUser(data.email, data.phoneNumber, data.countryCode);

    const phoneNumber = PhoneNumber.create(data.phoneNumber, data.countryCode);
    return User.registerAsCustomer(data.email, phoneNumber.getFullNumber(), data.name);
  }

  async registerFleetOwner(data: FleetOwnerRegistrationData): Promise<User> {
    await this.validateUniqueUser(data.email, data.phoneNumber, data.countryCode);

    const phoneNumber = PhoneNumber.create(data.phoneNumber, data.countryCode);
    return User.registerAsFleetOwner(
      data.email,
      phoneNumber.getFullNumber(),
      data.name,
      data.address,
      data.city,
    );
  }

  async createChauffeur(data: ChauffeurCreationData): Promise<User> {
    // Validate that the fleet owner exists and is approved
    const fleetOwner = await this.userRepository.findById(data.fleetOwnerId);
    if (!fleetOwner) {
      throw new InvalidRegistrationError("Fleet owner not found");
    }

    if (!fleetOwner.isFleetOwner()) {
      throw new InvalidRegistrationError("Creator must be a fleet owner");
    }

    if (!fleetOwner.isApproved()) {
      throw new InvalidRegistrationError("Fleet owner must be approved to add chauffeurs");
    }

    // Check for duplicate phone number
    await this.validateUniquePhoneNumber(data.phoneNumber, data.countryCode);

    const phoneNumber = PhoneNumber.create(data.phoneNumber, data.countryCode);
    return User.createChauffeur(
      data.fleetOwnerId,
      phoneNumber.getFullNumber(),
      data.driverLicenseNumber,
      data.name,
    );
  }

  async createStaff(data: StaffCreationData): Promise<User> {
    // Validate that the admin exists and has permission
    const admin = await this.userRepository.findById(data.adminId);

    if (!admin) {
      throw new InvalidRegistrationError("Admin not found");
    }

    if (!admin.isApproved()) {
      throw new InvalidRegistrationError("Admin must be approved");
    }

    await this.validateUniqueUser(data.email, data.phoneNumber, data.countryCode);

    const phoneNumber = PhoneNumber.create(data.phoneNumber, data.countryCode);
    return User.createStaff(data.adminId, data.email, phoneNumber.getFullNumber(), data.name);
  }

  async createAdmin(data: AdminCreationData): Promise<User> {
    await this.validateUniqueUser(data.email, data.phoneNumber, data.countryCode);

    const phoneNumber = PhoneNumber.create(data.phoneNumber, data.countryCode);
    return User.createAdmin(data.email, phoneNumber.getFullNumber(), data.name);
  }

  // Validation methods
  private async validateUniqueUser(
    email: string,
    phoneNumber: string,
    countryCode?: string,
  ): Promise<void> {
    await this.validateUniqueEmail(email);
    await this.validateUniquePhoneNumber(phoneNumber, countryCode);
  }

  private async validateUniqueEmail(email: string): Promise<void> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new DuplicateUserError("email", email);
    }
  }

  private async validateUniquePhoneNumber(
    phoneNumber: string,
    countryCode?: string,
  ): Promise<void> {
    const phoneNumberVo = PhoneNumber.create(phoneNumber, countryCode);
    const existingUser = await this.userRepository.findByPhoneNumber(phoneNumberVo.getFullNumber());
    if (existingUser) {
      throw new DuplicateUserError("phone number", phoneNumberVo.getDisplayFormat());
    }
  }

  // Business rule validations
  validateRegistrationBusinessRules(userRole: UserRole, registrationData: any): void {
    switch (userRole.value) {
      case "customer":
        this.validateCustomerRegistration(registrationData);
        break;
      case "fleetOwner":
        this.validateFleetOwnerRegistration(registrationData);
        break;
      case "chauffeur":
        this.validateChauffeurCreation(registrationData);
        break;
      case "staff":
        this.validateStaffCreation(registrationData);
        break;
      case "admin":
        this.validateAdminCreation(registrationData);
        break;
      default:
        throw new InvalidRegistrationError(`Invalid user role: ${userRole.value}`);
    }
  }

  private validateCustomerRegistration(data: CustomerRegistrationData): void {
    if (!data.phoneNumber) {
      throw new InvalidRegistrationError("Phone number is required for customer registration");
    }
  }

  private validateFleetOwnerRegistration(data: FleetOwnerRegistrationData): void {
    if (!data.phoneNumber) {
      throw new InvalidRegistrationError("Phone number is required for fleet owner registration");
    }

    // Fleet owners might need additional validation for business purposes
    if (!data.name || data.name.trim().length < 2) {
      throw new InvalidRegistrationError("Full name is required for fleet owner registration");
    }
  }

  private validateChauffeurCreation(data: ChauffeurCreationData): void {
    if (!data.phoneNumber) {
      throw new InvalidRegistrationError("Phone number is required for chauffeur creation");
    }

    if (!data.driverLicenseNumber || data.driverLicenseNumber.trim().length < 5) {
      throw new InvalidRegistrationError(
        "Valid driver license number is required for chauffeur creation",
      );
    }

    if (!data.fleetOwnerId) {
      throw new InvalidRegistrationError("Fleet owner ID is required for chauffeur creation");
    }
  }

  private validateStaffCreation(data: StaffCreationData): void {
    if (!data.phoneNumber) {
      throw new InvalidRegistrationError("Phone number is required for staff creation");
    }

    if (!data.adminId) {
      throw new InvalidRegistrationError("Admin ID is required for staff creation");
    }
  }

  private validateAdminCreation(data: AdminCreationData): void {
    if (!data.phoneNumber) {
      throw new InvalidRegistrationError("Phone number is required for admin creation");
    }
  }

  // Helper methods for specific business rules
  canUserCreateRole(creator: User, targetRole: UserRole): boolean {
    if (!creator.isApproved()) {
      return false;
    }

    switch (targetRole.value) {
      case "customer":
        return false; // Customers self-register

      case "fleetOwner":
        return false; // Fleet owners self-register

      case "chauffeur":
        return creator.isFleetOwner();

      case "staff":
        return creator.hasRole("ADMIN");

      case "admin":
        return creator.hasRole("ADMIN"); // Only existing admins can create new admins

      default:
        return false;
    }
  }

  getRequiredFieldsForRole(role: UserRole): string[] {
    switch (role.value) {
      case "customer":
        return ["email", "phoneNumber"];

      case "fleetOwner":
        return ["email", "phoneNumber", "name"];

      case "chauffeur":
        return ["phoneNumber", "driverLicenseNumber", "fleetOwnerId"];

      case "staff":
        return ["email", "phoneNumber", "adminId"];

      case "admin":
        return ["email", "phoneNumber"];

      default:
        return [];
    }
  }
}
