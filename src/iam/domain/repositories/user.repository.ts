import { TransactionContext } from "../../../shared/database/transaction-context.type";
import { User } from "../entities/user.entity";
import { ApprovalStatus } from "../value-objects/approval-status.vo";
import { UserRole } from "../value-objects/user-role.vo";

export interface UserSearchFilters {
  role?: UserRole;
  approvalStatus?: ApprovalStatus;
  fleetOwnerId?: string;
  isOnboarded?: boolean;
  searchTerm?: string; // For name, email, phone search
}

export interface UserListOptions {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "name" | "email";
  sortOrder?: "asc" | "desc";
}

export interface UserListResult {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserRepository {
  // Basic CRUD operations
  save(user: User): Promise<User>;
  saveWithTransaction(user: User, tx: TransactionContext): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByIdOrThrow(id: string): Promise<User>;
  delete(id: string): Promise<void>;

  // Unique field lookups
  findByEmail(email: string): Promise<User | null>;
  findByPhoneNumber(phoneNumber: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;

  // Role-based queries
  findByRole(role: UserRole, options?: UserListOptions): Promise<UserListResult>;
  findFleetOwners(options?: UserListOptions): Promise<UserListResult>;
  findChauffeurs(fleetOwnerId?: string, options?: UserListOptions): Promise<UserListResult>;
  findAdminAndStaff(options?: UserListOptions): Promise<UserListResult>;

  // Approval status queries
  findPendingApprovals(role?: UserRole, options?: UserListOptions): Promise<UserListResult>;
  findApprovedUsers(role?: UserRole, options?: UserListOptions): Promise<UserListResult>;
  findRejectedUsers(role?: UserRole, options?: UserListOptions): Promise<UserListResult>;

  // Fleet relationship queries
  findChauffeursByFleetOwner(
    fleetOwnerId: string,
    options?: UserListOptions,
  ): Promise<UserListResult>;
  findFleetOwnerByChauffeur(chauffeurId: string): Promise<User | null>;

  // Advanced search
  search(filters: UserSearchFilters, options?: UserListOptions): Promise<UserListResult>;

  // Specific business queries
  findUsersRequiringApproval(options?: UserListOptions): Promise<UserListResult>;
  findOnboardedUsers(role?: UserRole, options?: UserListOptions): Promise<UserListResult>;
  findUsersWithBankDetails(options?: UserListOptions): Promise<UserListResult>;

  // Batch operations
  findByIds(ids: string[]): Promise<User[]>;
  findByEmails(emails: string[]): Promise<User[]>;
  findByPhoneNumbers(phoneNumbers: string[]): Promise<User[]>;

  // Counting operations
  countByRole(role: UserRole): Promise<number>;
  countByApprovalStatus(status: ApprovalStatus): Promise<number>;
  countChauffeursByFleetOwner(fleetOwnerId: string): Promise<number>;
  countPendingApprovals(): Promise<number>;

  // Validation helpers
  emailExists(email: string, excludeUserId?: string): Promise<boolean>;
  phoneNumberExists(phoneNumber: string, excludeUserId?: string): Promise<boolean>;
  usernameExists(username: string, excludeUserId?: string): Promise<boolean>;
}
