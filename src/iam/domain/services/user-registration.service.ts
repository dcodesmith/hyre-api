import { Inject, Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { DuplicateUserError, InvalidRegistrationError } from "../errors/iam.errors";
import { UserRepository } from "../repositories/user.repository";
import { PhoneNumber } from "../value-objects/phone-number.vo";

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
    return User.registerAsFleetOwner(data.email, phoneNumber.getFullNumber(), data.name);
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
}
