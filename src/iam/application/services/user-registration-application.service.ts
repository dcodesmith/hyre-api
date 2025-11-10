import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { User } from "../../domain/entities/user.entity";
import { UserRepository } from "../../domain/repositories/user.repository";
import { UserRegistrationService } from "../../domain/services/user-registration.service";
import {
  AddChauffeurDto,
  CreateStaffDto,
  RegisterCustomerDto,
  RegisterFleetOwnerDto,
  UserRegistrationResponseDto,
} from "../../presentation/dto";
import { BaseIamApplicationService } from "./base-iam-application.service";

/**
 * Application service responsible for user registration operations
 * Following SRP - focused only on user registration and creation
 */
@Injectable()
export class UserRegistrationApplicationService extends BaseIamApplicationService {
  constructor(
    @Inject("UserRepository") userRepository: UserRepository,
    domainEventPublisher: DomainEventPublisher,
    prisma: PrismaService,
    private readonly userRegistrationService: UserRegistrationService,
    private readonly logger: LoggerService,
  ) {
    super(userRepository, domainEventPublisher, prisma);
  }

  async registerCustomer(dto: RegisterCustomerDto): Promise<UserRegistrationResponseDto> {
    this.logger.info("Registering new customer", {
      email: dto.email,
      phoneNumber: dto.phoneNumber,
    });

    // Register the customer using domain service
    const user = await this.userRegistrationService.registerCustomer({
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      countryCode: dto.countryCode,
      name: dto.name,
    });

    // Save and publish events atomically using transactional pattern
    await this.saveUserAndPublishEvents(user);

    this.logger.info("Customer registered successfully", { userId: user.getId() });

    return this.mapToRegistrationResponse(user);
  }

  async registerFleetOwner(dto: RegisterFleetOwnerDto): Promise<UserRegistrationResponseDto> {
    this.logger.info("Registering new fleet owner", {
      email: dto.email,
      phoneNumber: dto.phoneNumber,
    });

    // Register the fleet owner using domain service
    const user = await this.userRegistrationService.registerFleetOwner({
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      countryCode: dto.countryCode,
      name: dto.name,
      address: dto.address,
      city: dto.city,
    });

    // Save and publish events atomically using transactional pattern
    await this.saveUserAndPublishEvents(user);

    this.logger.info("Fleet owner registered successfully", { userId: user.getId() });

    return this.mapToRegistrationResponse(user);
  }

  async addChauffeur(
    fleetOwnerId: string,
    dto: AddChauffeurDto,
  ): Promise<UserRegistrationResponseDto> {
    this.logger.info("Adding new chauffeur", {
      fleetOwnerId,
      phoneNumber: dto.phoneNumber,
    });

    // Create chauffeur using domain service
    const chauffeur = await this.userRegistrationService.createChauffeur({
      fleetOwnerId,
      phoneNumber: dto.phoneNumber,
      countryCode: dto.countryCode,
      driverLicenseNumber: dto.driverLicenseNumber,
      name: dto.name,
    });

    // Save and publish events atomically using transactional pattern
    await this.saveUserAndPublishEvents(chauffeur);

    this.logger.info("Chauffeur added successfully", {
      chauffeurId: chauffeur.getId(),
      fleetOwnerId,
    });

    return this.mapToRegistrationResponse(chauffeur);
  }

  async createStaff(adminId: string, dto: CreateStaffDto): Promise<UserRegistrationResponseDto> {
    this.logger.info("Creating new staff member", {
      adminId,
      email: dto.email,
    });

    // Create staff using domain service
    const user = await this.userRegistrationService.createStaff({
      adminId,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      countryCode: dto.countryCode,
      name: dto.name,
    });

    // Save and publish events atomically using transactional pattern
    const savedUser = await this.saveUserAndPublishEvents(user);

    this.logger.info("Staff member created successfully", {
      staffId: savedUser.getId(),
      adminId,
    });

    return this.mapToRegistrationResponse(savedUser);
  }

  private mapToRegistrationResponse(user: User): UserRegistrationResponseDto {
    return {
      userId: user.getId(),
      email: user.getEmail(),
      name: user.getName(),
      phoneNumber: user.getPhoneNumber(),
      role: user.getPrimaryRole().toString(),
      approvalStatus: user.getApprovalStatus().toString(),
    };
  }
}
