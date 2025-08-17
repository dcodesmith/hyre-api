import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service";
import { BankDetails } from "../../domain/entities/bank-details.entity";
import { BankDetailsRepository } from "../../domain/repositories/bank-details.repository";

@Injectable()
export class PrismaBankDetailsRepository implements BankDetailsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(bankDetails: BankDetails): Promise<BankDetails> {
    const bankDetailsId = bankDetails.getId();
    const data = {
      userId: bankDetails.getUserId(),
      bankName: bankDetails.getBankName(),
      bankCode: bankDetails.getBankCode(),
      accountNumber: bankDetails.getAccountNumber(),
      accountName: bankDetails.getAccountName(),
      isVerified: bankDetails.isVerified(),
      lastVerifiedAt: bankDetails.getLastVerifiedAt(),
      verificationResponse: bankDetails.getVerificationResponse(),
      updatedAt: bankDetails.getUpdatedAt(),
    };

    if (bankDetailsId) {
      // Update existing bank details
      const updated = await this.prisma.bankDetails.update({
        where: { id: bankDetailsId },
        data,
      });
      return this.toDomainEntity(updated);
    } else {
      // Create new bank details
      const created = await this.prisma.bankDetails.create({
        data: {
          ...data,
          createdAt: bankDetails.getCreatedAt(),
        },
      });
      return this.toDomainEntity(created);
    }
  }

  async findByUserId(userId: string): Promise<BankDetails | null> {
    const bankDetails = await this.prisma.bankDetails.findUnique({
      where: { userId },
    });

    if (!bankDetails) {
      return null;
    }

    return this.toDomainEntity(bankDetails);
  }

  async findById(id: string): Promise<BankDetails | null> {
    const bankDetails = await this.prisma.bankDetails.findUnique({
      where: { id },
    });

    if (!bankDetails) {
      return null;
    }

    return this.toDomainEntity(bankDetails);
  }

  async update(bankDetails: BankDetails): Promise<BankDetails> {
    const updated = await this.prisma.bankDetails.update({
      where: { id: bankDetails.getId() },
      data: {
        userId: bankDetails.getUserId(),
        bankName: bankDetails.getBankName(),
        bankCode: bankDetails.getBankCode(),
        accountNumber: bankDetails.getAccountNumber(),
        accountName: bankDetails.getAccountName(),
        isVerified: bankDetails.isVerified(),
        lastVerifiedAt: bankDetails.getLastVerifiedAt(),
        verificationResponse: bankDetails.getVerificationResponse(),
        updatedAt: bankDetails.getUpdatedAt(),
      },
    });

    return this.toDomainEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.bankDetails.delete({
      where: { id },
    });
  }

  private toDomainEntity(bankDetails: any): BankDetails {
    return BankDetails.reconstitute({
      id: bankDetails.id,
      userId: bankDetails.userId,
      bankName: bankDetails.bankName,
      bankCode: bankDetails.bankCode,
      accountNumber: bankDetails.accountNumber,
      accountName: bankDetails.accountName,
      isVerified: bankDetails.isVerified,
      lastVerifiedAt: bankDetails.lastVerifiedAt,
      verificationResponse: bankDetails.verificationResponse,
      createdAt: bankDetails.createdAt,
      updatedAt: bankDetails.updatedAt,
    });
  }
}
