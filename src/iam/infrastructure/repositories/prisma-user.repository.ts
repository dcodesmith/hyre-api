import { Injectable } from "@nestjs/common";
import { Prisma, Role as PrismaRole, User as PrismaUser } from "@prisma/client";
import { logger } from "test/support/logger";
import { TransactionContext } from "../../../shared/database/transaction-context.type";
import { PrismaService } from "../../../shared/database/prisma.service";
import { User } from "../../domain/entities/user.entity";
import { UserNotFoundError } from "../../domain/errors/iam.errors";
import {
  UserListOptions,
  UserListResult,
  UserRepository,
  UserSearchFilters,
} from "../../domain/repositories/user.repository";
import { ApprovalStatus, ApprovalStatusEnum } from "../../domain/value-objects/approval-status.vo";
import { RegistrationType } from "../../domain/value-objects/registration-type.vo";
import { UserRole, UserRoleEnum } from "../../domain/value-objects/user-role.vo";
import { UserType } from "../../domain/value-objects/user-type.vo";

type PrismaUserWithRoles = PrismaUser & {
  roles: PrismaRole[];
};

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<User> {
    try {
      const userData = this.mapUserToPrisma(user);
      const { id, roles, ...rest } = userData;
      let userWithRoles: PrismaUserWithRoles;

      if (!id) {
        userWithRoles = await this.prisma.user.create({
          data: {
            ...rest,
            roles: {
              connectOrCreate: roles.map((roleName: string) => ({
                where: { name: roleName },
                create: { name: roleName, description: `${roleName} role` },
              })),
            },
          },
          include: { roles: true },
        });
      } else {
        userWithRoles = await this.prisma.user.update({
          where: { id },
          data: { ...rest },
          include: { roles: true },
        });
      }

      const mappedUser = this.mapPrismaToUser(userWithRoles);
      return mappedUser;
    } catch (error) {
      logger.error("Error in save method:", error);

      // Handle unique constraint violations or other database errors
      throw new Error(`Failed to save user: ${error.message}`);
    }
  }

  async saveWithTransaction(user: User, tx: TransactionContext): Promise<User> {
    try {
      const userData = this.mapUserToPrisma(user);
      const { id, roles, ...rest } = userData;
      let userWithRoles: PrismaUserWithRoles;

      if (!id) {
        userWithRoles = await tx.user.create({
          data: {
            ...rest,
            roles: {
              connectOrCreate: roles.map((roleName: string) => ({
                where: { name: roleName },
                create: { name: roleName, description: `${roleName} role` },
              })),
            },
          },
          include: { roles: true },
        });
      } else {
        userWithRoles = await tx.user.update({
          where: { id },
          data: { ...rest },
          include: { roles: true },
        });
      }

      const mappedUser = this.mapPrismaToUser(userWithRoles);
      return mappedUser;
    } catch (error) {
      logger.error("Error in saveWithTransaction method:", error);

      // Handle unique constraint violations or other database errors
      throw new Error(`Failed to save user with transaction: ${error.message}`);
    }
  }

  async findById(id: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });

    return userData ? this.mapPrismaToUser(userData) : null;
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return user;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id: id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    return userData ? this.mapPrismaToUser(userData) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const userData = await this.prisma.user.findFirst({
      where: { phoneNumber },
      include: { roles: true },
    });

    return userData ? this.mapPrismaToUser(userData) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { username },
      include: { roles: true },
    });

    return userData ? this.mapPrismaToUser(userData) : null;
  }

  async findByRole(role: UserRole, options: UserListOptions = {}): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              name: role.toString(),
            },
          },
        },
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: {
          roles: {
            some: {
              name: role.toString(),
            },
          },
        },
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFleetOwners(options: UserListOptions = {}): Promise<UserListResult> {
    return this.findByRole(UserRole.fleetOwner(), options);
  }

  async findChauffeurs(
    fleetOwnerId?: string,
    options: UserListOptions = {},
  ): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {
      roles: {
        some: {
          name: UserRoleEnum.chauffeur,
        },
      },
    };

    if (fleetOwnerId) {
      whereClause.fleetOwnerId = fleetOwnerId;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAdminAndStaff(options: UserListOptions = {}): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              name: {
                in: [UserRoleEnum.admin, UserRoleEnum.staff],
              },
            },
          },
        },
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: {
          roles: {
            some: {
              name: {
                in: [UserRoleEnum.admin, UserRoleEnum.staff],
              },
            },
          },
        },
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPendingApprovals(
    role?: UserRole,
    options: UserListOptions = {},
  ): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "asc" } = options;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {
      OR: [{ fleetOwnerStatus: "PROCESSING" }, { chauffeurApprovalStatus: "PENDING" }],
    };

    if (role) {
      whereClause.roles = {
        some: {
          name: role.toString(),
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findApprovedUsers(role?: UserRole, options: UserListOptions = {}): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {
      OR: [
        { fleetOwnerStatus: "APPROVED" },
        { chauffeurApprovalStatus: "APPROVED" },
        {
          roles: {
            some: {
              name: {
                in: [UserRoleEnum.customer, UserRoleEnum.admin, UserRoleEnum.staff],
              },
            },
          },
        },
      ],
    };

    if (role) {
      whereClause.roles = {
        some: {
          name: role.toString(),
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findRejectedUsers(role?: UserRole, options: UserListOptions = {}): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {
      OR: [{ fleetOwnerStatus: "ARCHIVED" }, { chauffeurApprovalStatus: "REJECTED" }],
    };

    if (role) {
      whereClause.roles = {
        some: {
          name: role.toString(),
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findChauffeursByFleetOwner(
    fleetOwnerId: string,
    options: UserListOptions = {},
  ): Promise<UserListResult> {
    return this.findChauffeurs(fleetOwnerId, options);
  }

  async findFleetOwnerByChauffeur(chauffeurId: string): Promise<User | null> {
    const chauffeur = await this.prisma.user.findUnique({
      where: { id: chauffeurId },
      include: { fleetOwner: { include: { roles: true } } },
    });

    return chauffeur?.fleetOwner ? this.mapPrismaToUser(chauffeur.fleetOwner) : null;
  }

  async search(filters: UserSearchFilters, options: UserListOptions = {}): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {};

    if (filters.role) {
      whereClause.roles = {
        some: {
          name: filters.role.toString(),
        },
      };
    }

    if (filters.fleetOwnerId) {
      whereClause.fleetOwnerId = filters.fleetOwnerId;
    }

    if (filters.isOnboarded !== undefined) {
      whereClause.hasOnboarded = filters.isOnboarded;
    }

    if (filters.searchTerm) {
      whereClause.OR = [
        { name: { contains: filters.searchTerm, mode: "insensitive" } },
        { email: { contains: filters.searchTerm, mode: "insensitive" } },
        { phoneNumber: { contains: filters.searchTerm } },
      ];
    }

    if (filters.approvalStatus) {
      // Map approval status to Prisma fields
      const status = filters.approvalStatus.toString();
      if (status === "PENDING") {
        whereClause.OR = [
          { fleetOwnerStatus: "PROCESSING" },
          { chauffeurApprovalStatus: "PENDING" },
        ];
      } else if (status === "APPROVED") {
        whereClause.OR = [
          { fleetOwnerStatus: "APPROVED" },
          { chauffeurApprovalStatus: "APPROVED" },
        ];
      }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findUsersRequiringApproval(options: UserListOptions = {}): Promise<UserListResult> {
    return this.findPendingApprovals(undefined, options);
  }

  async findOnboardedUsers(
    role?: UserRole,
    options: UserListOptions = {},
  ): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {
      hasOnboarded: true,
    };

    if (role) {
      whereClause.roles = {
        some: {
          name: role.toString(),
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findUsersWithBankDetails(options: UserListOptions = {}): Promise<UserListResult> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          bankDetailsId: { not: null },
        },
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({
        where: {
          bankDetailsId: { not: null },
        },
      }),
    ]);

    return {
      users: users.map((user) => this.mapPrismaToUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      include: { roles: true },
    });

    return users.map((user) => this.mapPrismaToUser(user));
  }

  async findByEmails(emails: string[]): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      include: { roles: true },
    });

    return users.map((user) => this.mapPrismaToUser(user));
  }

  async findByPhoneNumbers(phoneNumbers: string[]): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { phoneNumber: { in: phoneNumbers } },
      include: { roles: true },
    });

    return users.map((user) => this.mapPrismaToUser(user));
  }

  async countByRole(role: UserRole): Promise<number> {
    return this.prisma.user.count({
      where: {
        roles: {
          some: {
            name: role.toString(),
          },
        },
      },
    });
  }

  async countByApprovalStatus(status: ApprovalStatus): Promise<number> {
    const statusValue = status.toString();
    let whereClause: Prisma.UserWhereInput = {};

    if (statusValue === "PENDING") {
      whereClause = {
        OR: [{ fleetOwnerStatus: "PROCESSING" }, { chauffeurApprovalStatus: "PENDING" }],
      };
    } else if (statusValue === "APPROVED") {
      whereClause = {
        OR: [{ fleetOwnerStatus: "APPROVED" }, { chauffeurApprovalStatus: "APPROVED" }],
      };
    }

    return this.prisma.user.count({ where: whereClause });
  }

  async countChauffeursByFleetOwner(fleetOwnerId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        fleetOwnerId,
        roles: {
          some: {
            name: UserRoleEnum.chauffeur,
          },
        },
      },
    });
  }

  async countPendingApprovals(): Promise<number> {
    return this.prisma.user.count({
      where: {
        OR: [{ fleetOwnerStatus: "PROCESSING" }, { chauffeurApprovalStatus: "PENDING" }],
      },
    });
  }

  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const whereClause: Prisma.UserWhereInput = { email };
    if (excludeUserId) {
      whereClause.id = { not: excludeUserId };
    }

    const count = await this.prisma.user.count({ where: whereClause });
    return count > 0;
  }

  async phoneNumberExists(phoneNumber: string, excludeUserId?: string): Promise<boolean> {
    const whereClause: Prisma.UserWhereInput = { phoneNumber };
    if (excludeUserId) {
      whereClause.id = { not: excludeUserId };
    }

    const count = await this.prisma.user.count({ where: whereClause });
    return count > 0;
  }

  async usernameExists(username: string, excludeUserId?: string): Promise<boolean> {
    const whereClause: Prisma.UserWhereInput = { username };
    if (excludeUserId) {
      whereClause.id = { not: excludeUserId };
    }

    const count = await this.prisma.user.count({ where: whereClause });
    return count > 0;
  }

  // Mapping methods
  private mapUserToPrisma(user: User) {
    const approvalStatus = user.getApprovalStatus();
    const primaryRole = user.getPrimaryRole();

    // Map approval status to Prisma fields based on role
    let fleetOwnerStatus = null;
    let chauffeurApprovalStatus = null;

    if (primaryRole.toString() === "fleetOwner") {
      fleetOwnerStatus = this.mapApprovalStatusToPrismaFleetOwner(approvalStatus);
    } else if (primaryRole.toString() === "chauffeur") {
      chauffeurApprovalStatus = this.mapApprovalStatusToPrismaChauffeur(approvalStatus);
    }

    return {
      id: user.getId(),
      email: user.getEmail(),
      username: null, // Not used in current implementation
      name: user.getName(),
      phoneNumber: user.getPhoneNumber(),
      address: user.getAddress(),
      city: user.getCity(),
      hasOnboarded: user.hasOnboarded(),
      fleetOwnerId: user.getFleetOwnerId(),
      fleetOwnerStatus,
      chauffeurApprovalStatus,
      bankDetailsId: null, // Not implemented yet
      roles: user.getRoles().map((role) => role.toString()),
      createdAt: user.getCreatedAt(),
      updatedAt: user.getUpdatedAt(),
    };
  }

  private mapPrismaToUser(userData: PrismaUserWithRoles): User {
    const roles = userData.roles.map((role) => UserRole.fromString(role.name));
    const primaryRole = roles[0];

    // Determine approval status based on role and Prisma fields
    let approvalStatus: ApprovalStatus;

    if (primaryRole.toString() === "fleetOwner") {
      approvalStatus = this.mapPrismaFleetOwnerToApprovalStatus(userData.fleetOwnerStatus);
    } else if (primaryRole.toString() === "chauffeur") {
      approvalStatus = this.mapPrismaChauffeurToApprovalStatus(userData.chauffeurApprovalStatus);
    } else {
      approvalStatus = ApprovalStatus.approved("system"); // Default for other roles
    }

    // Determine registration type
    let registrationType: RegistrationType;
    if (userData.fleetOwnerId) {
      registrationType = RegistrationType.fleetOwnerAdded(userData.fleetOwnerId);
    } else if (primaryRole.toString() === "staff") {
      registrationType = RegistrationType.adminCreated("system");
    } else {
      registrationType = RegistrationType.selfRegistration();
    }

    return User.reconstitute({
      id: userData.id,
      userType: UserType.fromString(userData.userType),
      email: userData.email,
      username: userData.username || undefined,
      name: userData.name || undefined,
      phoneNumber: userData.phoneNumber || undefined,
      address: userData.address || undefined,
      city: userData.city || undefined,
      hasOnboarded: userData.hasOnboarded,
      roles,
      fleetOwnerId: userData.fleetOwnerId || undefined,
      approvalStatus,
      registrationType,
      bankDetailsId: userData.bankDetailsId || undefined,
      driverLicenseNumber: undefined, // Not stored in current schema
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    });
  }

  private mapApprovalStatusToPrismaFleetOwner(status: ApprovalStatus): string {
    switch (status.value) {
      case ApprovalStatusEnum.PENDING:
        return "PROCESSING";
      case ApprovalStatusEnum.PROCESSING:
        return "PROCESSING";
      case ApprovalStatusEnum.APPROVED:
        return "APPROVED";
      case ApprovalStatusEnum.REJECTED:
        return "ARCHIVED";
      case ApprovalStatusEnum.ON_HOLD:
        return "ON_HOLD";
      case ApprovalStatusEnum.ARCHIVED:
        return "ARCHIVED";
      default:
        return "PROCESSING";
    }
  }

  private mapApprovalStatusToPrismaChauffeur(status: ApprovalStatus): string {
    switch (status.value) {
      case ApprovalStatusEnum.PENDING:
        return "PENDING";
      case ApprovalStatusEnum.PROCESSING:
        return "PENDING";
      case ApprovalStatusEnum.APPROVED:
        return "APPROVED";
      case ApprovalStatusEnum.REJECTED:
        return "REJECTED";
      case ApprovalStatusEnum.ON_HOLD:
        return "PENDING";
      case ApprovalStatusEnum.ARCHIVED:
        return "REJECTED";
      default:
        return "PENDING";
    }
  }

  private mapPrismaFleetOwnerToApprovalStatus(status: string | null): ApprovalStatus {
    switch (status) {
      case "PROCESSING":
        return ApprovalStatus.processing();
      case "APPROVED":
        return ApprovalStatus.approved("system");
      case "ON_HOLD":
        return ApprovalStatus.onHold("Under review");
      case "ARCHIVED":
        return ApprovalStatus.rejected("Account archived", "system");
      default:
        return ApprovalStatus.pending();
    }
  }

  private mapPrismaChauffeurToApprovalStatus(status: string | null): ApprovalStatus {
    switch (status) {
      case "PENDING":
        return ApprovalStatus.pending();
      case "APPROVED":
        return ApprovalStatus.approved("system");
      case "REJECTED":
        return ApprovalStatus.rejected("Application rejected", "system");
      default:
        return ApprovalStatus.pending();
    }
  }
}
