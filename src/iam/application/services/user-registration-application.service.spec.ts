import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { User } from "../../domain/entities/user.entity";
import { UserRepository } from "../../domain/repositories/user.repository";
import { UserRegistrationService } from "../../domain/services/user-registration.service";
import { ApprovalStatus } from "../../domain/value-objects/approval-status.vo";
import { Role } from "../../domain/value-objects/role.vo";
import {
  AddChauffeurDto,
  CreateStaffDto,
  RegisterCustomerDto,
  RegisterFleetOwnerDto,
  UserRegistrationResponseDto,
} from "../../presentation/dto";
import { UserRegistrationApplicationService } from "./user-registration-application.service";

describe("UserRegistrationApplicationService", () => {
  let service: UserRegistrationApplicationService;
  let mockUserRepository: UserRepository;
  let mockDomainEventPublisher: DomainEventPublisher;
  let mockPrismaService: PrismaService;
  let mockUserRegistrationService: UserRegistrationService;
  let mockLogger: LoggerService;

  const mockUser = {
    getId: vi.fn(() => "user-123"),
    getEmail: vi.fn(() => "test@example.com"),
    getName: vi.fn(() => "Test User"),
    getPhoneNumber: vi.fn(() => "+2341234567890"),
    getPrimaryRole: vi.fn(() => Role.create("customer")),
    getApprovalStatus: vi.fn(() => ApprovalStatus.create("PENDING")),
  } as unknown as User;

  const mockTransaction = vi.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRegistrationApplicationService,
        {
          provide: "UserRepository",
          useValue: {
            saveWithTransaction: vi.fn(),
          },
        },
        {
          provide: DomainEventPublisher,
          useValue: {
            publish: vi.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: vi.fn(),
          },
        },
        {
          provide: UserRegistrationService,
          useValue: {
            registerCustomer: vi.fn(),
            registerFleetOwner: vi.fn(),
            createChauffeur: vi.fn(),
            createStaff: vi.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserRegistrationApplicationService>(UserRegistrationApplicationService);
    mockUserRepository = module.get<UserRepository>("UserRepository");
    mockDomainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    mockPrismaService = module.get<PrismaService>(PrismaService);
    mockUserRegistrationService = module.get<UserRegistrationService>(UserRegistrationService);
    mockLogger = module.get<LoggerService>(LoggerService);

    // Setup default mocks
    vi.mocked(mockPrismaService.$transaction).mockImplementation(async (fn) => {
      return await fn(mockTransaction);
    });
    vi.mocked(mockUserRepository.saveWithTransaction).mockResolvedValue(mockUser);
  });

  describe("registerCustomer", () => {
    const registerCustomerDto: RegisterCustomerDto = {
      email: "customer@example.com",
      phoneNumber: "1234567890",
      otpCode: "123456",
      countryCode: "+234",
      name: "John Customer",
    };

    it("should register customer successfully", async () => {
      vi.mocked(mockUserRegistrationService.registerCustomer).mockResolvedValue(mockUser);

      const result: UserRegistrationResponseDto =
        await service.registerCustomer(registerCustomerDto);

      expect(mockUserRegistrationService.registerCustomer).toHaveBeenCalledWith({
        email: registerCustomerDto.email,
        phoneNumber: registerCustomerDto.phoneNumber,
        countryCode: registerCustomerDto.countryCode,
        name: registerCustomerDto.name,
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockUserRepository.saveWithTransaction).toHaveBeenCalledWith(
        mockUser,
        mockTransaction,
      );
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(mockUser);
      expect(mockLogger.info).toHaveBeenCalledWith("Registering new customer", {
        email: registerCustomerDto.email,
        phoneNumber: registerCustomerDto.phoneNumber,
      });
      expect(mockLogger.info).toHaveBeenCalledWith("Customer registered successfully", {
        userId: "user-123",
      });
      expect(result).toEqual({
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        phoneNumber: "+2341234567890",
        role: "customer",
        approvalStatus: "PENDING",
      });
    });

    it("should handle registration service errors", async () => {
      const error = new Error("Registration failed");
      vi.mocked(mockUserRegistrationService.registerCustomer).mockRejectedValue(error);

      await expect(service.registerCustomer(registerCustomerDto)).rejects.toThrow(
        "Registration failed",
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should handle transaction errors", async () => {
      const error = new Error("Transaction failed");
      vi.mocked(mockUserRegistrationService.registerCustomer).mockResolvedValue(mockUser);
      vi.mocked(mockPrismaService.$transaction).mockRejectedValue(error);

      await expect(service.registerCustomer(registerCustomerDto)).rejects.toThrow(
        "Transaction failed",
      );
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("registerFleetOwner", () => {
    const registerFleetOwnerDto: RegisterFleetOwnerDto = {
      email: "owner@example.com",
      phoneNumber: "1234567890",
      otpCode: "123456",
      countryCode: "+234",
      name: "Fleet Owner",
      address: "123 Main St",
      city: "Lagos",
    };

    it("should register fleet owner successfully", async () => {
      const fleetOwnerUser = {
        ...mockUser,
        getPrimaryRole: vi.fn(() => Role.create("fleetOwner")),
      } as unknown as User;

      vi.mocked(mockUserRegistrationService.registerFleetOwner).mockResolvedValue(fleetOwnerUser);
      vi.mocked(mockUserRepository.saveWithTransaction).mockResolvedValue(fleetOwnerUser);

      const result: UserRegistrationResponseDto =
        await service.registerFleetOwner(registerFleetOwnerDto);

      expect(mockUserRegistrationService.registerFleetOwner).toHaveBeenCalledWith({
        email: registerFleetOwnerDto.email,
        phoneNumber: registerFleetOwnerDto.phoneNumber,
        countryCode: registerFleetOwnerDto.countryCode,
        name: registerFleetOwnerDto.name,
        address: registerFleetOwnerDto.address,
        city: registerFleetOwnerDto.city,
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockUserRepository.saveWithTransaction).toHaveBeenCalledWith(
        fleetOwnerUser,
        mockTransaction,
      );
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(fleetOwnerUser);
      expect(mockLogger.info).toHaveBeenCalledWith("Registering new fleet owner", {
        email: registerFleetOwnerDto.email,
        phoneNumber: registerFleetOwnerDto.phoneNumber,
      });
      expect(mockLogger.info).toHaveBeenCalledWith("Fleet owner registered successfully", {
        userId: "user-123",
      });
      expect(result.role).toBe("fleetOwner");
    });

    it("should handle registration service errors", async () => {
      const error = new Error("Fleet owner registration failed");
      vi.mocked(mockUserRegistrationService.registerFleetOwner).mockRejectedValue(error);

      await expect(service.registerFleetOwner(registerFleetOwnerDto)).rejects.toThrow(
        "Fleet owner registration failed",
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("addChauffeur", () => {
    const addChauffeurDto: AddChauffeurDto = {
      phoneNumber: "1234567890",
      countryCode: "+234",
      driverLicenseNumber: "DL123456",
      name: "John Chauffeur",
    };
    const fleetOwnerId = "fleet-owner-123";

    it("should add chauffeur successfully", async () => {
      const chauffeurUser = {
        ...mockUser,
        getPrimaryRole: vi.fn(() => Role.create("chauffeur")),
      } as unknown as User;

      vi.mocked(mockUserRegistrationService.createChauffeur).mockResolvedValue(chauffeurUser);
      vi.mocked(mockUserRepository.saveWithTransaction).mockResolvedValue(chauffeurUser);

      const result: UserRegistrationResponseDto = await service.addChauffeur(
        fleetOwnerId,
        addChauffeurDto,
      );

      expect(mockUserRegistrationService.createChauffeur).toHaveBeenCalledWith({
        fleetOwnerId,
        phoneNumber: addChauffeurDto.phoneNumber,
        countryCode: addChauffeurDto.countryCode,
        driverLicenseNumber: addChauffeurDto.driverLicenseNumber,
        name: addChauffeurDto.name,
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockUserRepository.saveWithTransaction).toHaveBeenCalledWith(
        chauffeurUser,
        mockTransaction,
      );
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(chauffeurUser);
      expect(mockLogger.info).toHaveBeenCalledWith("Adding new chauffeur", {
        fleetOwnerId,
        phoneNumber: addChauffeurDto.phoneNumber,
      });
      expect(mockLogger.info).toHaveBeenCalledWith("Chauffeur added successfully", {
        chauffeurId: "user-123",
        fleetOwnerId,
      });
      expect(result.role).toBe("chauffeur");
    });

    it("should handle chauffeur creation errors", async () => {
      const error = new Error("Chauffeur creation failed");
      vi.mocked(mockUserRegistrationService.createChauffeur).mockRejectedValue(error);

      await expect(service.addChauffeur(fleetOwnerId, addChauffeurDto)).rejects.toThrow(
        "Chauffeur creation failed",
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("createStaff", () => {
    const createStaffDto: CreateStaffDto = {
      email: "staff@example.com",
      phoneNumber: "1234567890",
      countryCode: "+234",
      name: "Staff Member",
    };
    const adminId = "admin-123";

    it("should create staff successfully", async () => {
      const staffUser = {
        ...mockUser,
        getPrimaryRole: vi.fn(() => Role.create("staff")),
      } as unknown as User;

      vi.mocked(mockUserRegistrationService.createStaff).mockResolvedValue(staffUser);
      vi.mocked(mockUserRepository.saveWithTransaction).mockResolvedValue(staffUser);

      const result: UserRegistrationResponseDto = await service.createStaff(
        adminId,
        createStaffDto,
      );

      expect(mockUserRegistrationService.createStaff).toHaveBeenCalledWith({
        adminId,
        email: createStaffDto.email,
        phoneNumber: createStaffDto.phoneNumber,
        countryCode: createStaffDto.countryCode,
        name: createStaffDto.name,
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockUserRepository.saveWithTransaction).toHaveBeenCalledWith(
        staffUser,
        mockTransaction,
      );
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(staffUser);
      expect(mockLogger.info).toHaveBeenCalledWith("Creating new staff member", {
        adminId,
        email: createStaffDto.email,
      });
      expect(mockLogger.info).toHaveBeenCalledWith("Staff member created successfully", {
        staffId: "user-123",
        adminId,
      });
      expect(result.role).toBe("staff");
    });

    it("should handle staff creation errors", async () => {
      const error = new Error("Staff creation failed");
      vi.mocked(mockUserRegistrationService.createStaff).mockRejectedValue(error);

      await expect(service.createStaff(adminId, createStaffDto)).rejects.toThrow(
        "Staff creation failed",
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should handle transaction errors during staff creation", async () => {
      const staffUser = {
        ...mockUser,
        getPrimaryRole: vi.fn(() => Role.create("staff")),
      } as unknown as User;
      const error = new Error("Transaction failed");

      vi.mocked(mockUserRegistrationService.createStaff).mockResolvedValue(staffUser);
      vi.mocked(mockPrismaService.$transaction).mockRejectedValue(error);

      await expect(service.createStaff(adminId, createStaffDto)).rejects.toThrow(
        "Transaction failed",
      );
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("mapToRegistrationResponse", () => {
    it("should map user to registration response correctly", async () => {
      const registerCustomerDto: RegisterCustomerDto = {
        email: "customer@example.com",
        phoneNumber: "1234567890",
        otpCode: "123456",
        countryCode: "+234",
        name: "John Customer",
      };

      vi.mocked(mockUserRegistrationService.registerCustomer).mockResolvedValue(mockUser);

      const result = await service.registerCustomer(registerCustomerDto);

      expect(result).toEqual({
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        phoneNumber: "+2341234567890",
        role: "customer",
        approvalStatus: "PENDING",
      });
    });

    it("should handle user with undefined name", async () => {
      const userWithoutName = {
        ...mockUser,
        getName: vi.fn(() => undefined),
      } as unknown as User;

      const registerCustomerDto: RegisterCustomerDto = {
        email: "customer@example.com",
        phoneNumber: "1234567890",
        otpCode: "123456",
        countryCode: "+234",
      };

      vi.mocked(mockUserRegistrationService.registerCustomer).mockResolvedValue(userWithoutName);
      vi.mocked(mockUserRepository.saveWithTransaction).mockResolvedValue(userWithoutName);

      const result = await service.registerCustomer(registerCustomerDto);

      expect(result.name).toBeUndefined();
    });
  });

  describe("saveUserAndPublishEvents", () => {
    it("should handle event publishing errors gracefully", async () => {
      const publishError = new Error("Event publishing failed");
      vi.mocked(mockUserRegistrationService.registerCustomer).mockResolvedValue(mockUser);
      vi.mocked(mockDomainEventPublisher.publish).mockRejectedValue(publishError);

      const registerCustomerDto: RegisterCustomerDto = {
        email: "customer@example.com",
        phoneNumber: "1234567890",
        otpCode: "123456",
        countryCode: "+234",
        name: "John Customer",
      };

      await expect(service.registerCustomer(registerCustomerDto)).rejects.toThrow(
        "Event publishing failed",
      );
      expect(mockUserRepository.saveWithTransaction).toHaveBeenCalledWith(
        mockUser,
        mockTransaction,
      );
    });
  });
});
