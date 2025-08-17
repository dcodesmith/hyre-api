import { Injectable } from "@nestjs/common";
import { PayoutTransactionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../shared/database/prisma.service";
import { Payout } from "../../domain/entities/payout.entity";
import { PayoutRepository } from "../../domain/repositories/payout.repository";
import { BankAccount } from "../../domain/value-objects/bank-account.vo";
import { PayoutId } from "../../domain/value-objects/payout-id.vo";
import { PayoutStatus, PayoutStatusEnum } from "../../domain/value-objects/payout-status.vo";

@Injectable()
export class PrismaPayoutRepository extends PayoutRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(payout: Payout): Promise<void> {
    const data = {
      id: payout.getId().value,
      fleetOwnerId: payout.getFleetOwnerId(),
      bookingId: payout.getBookingId(),
      extensionId: payout.getExtensionId(),
      amountToPay: payout.getAmount(),
      currency: "NGN",
      status: this.mapStatusToPrisma(payout.getStatus()),
      payoutProviderReference: payout.getProviderReference(),
      payoutMethodDetails: `Bank: ${payout.getBankAccount().bankName}, Account: ${payout.getBankAccount().accountNumber}`,
      notes: payout.getFailureReason(),
      updatedAt: new Date(),
    };

    await this.prisma.payoutTransaction.upsert({
      where: { id: payout.getId().value },
      create: {
        ...data,
        processedAt: payout.getProcessedAt(),
      },
      update: data,
    });
  }

  async findById(id: PayoutId): Promise<Payout | null> {
    const payout = await this.prisma.payoutTransaction.findUnique({
      where: { id: id.value },
      include: {
        fleetOwner: {
          include: {
            bankDetails: true,
          },
        },
      },
    });

    return payout ? this.toDomain(payout) : null;
  }

  async findByBookingId(bookingId: string): Promise<Payout[]> {
    const payouts = await this.prisma.payoutTransaction.findMany({
      where: { bookingId },
      include: {
        fleetOwner: {
          include: {
            bankDetails: true,
          },
        },
      },
    });

    return payouts.map((payout) => this.toDomain(payout));
  }

  async findByExtensionId(extensionId: string): Promise<Payout[]> {
    const payouts = await this.prisma.payoutTransaction.findMany({
      where: { extensionId },
      include: {
        fleetOwner: {
          include: {
            bankDetails: true,
          },
        },
      },
    });

    return payouts.map((payout) => this.toDomain(payout));
  }

  async findByFleetOwnerId(fleetOwnerId: string): Promise<Payout[]> {
    const payouts = await this.prisma.payoutTransaction.findMany({
      where: { fleetOwnerId },
      include: {
        fleetOwner: {
          include: {
            bankDetails: true,
          },
        },
      },
    });

    return payouts.map((payout) => this.toDomain(payout));
  }

  async findByStatus(status: PayoutStatus): Promise<Payout[]> {
    const payouts = await this.prisma.payoutTransaction.findMany({
      where: { status: this.mapStatusToPrisma(status) },
      include: {
        fleetOwner: {
          include: {
            bankDetails: true,
          },
        },
      },
    });

    return payouts.map((payout) => this.toDomain(payout));
  }

  async findInProgressByFleetOwner(fleetOwnerId: string): Promise<Payout[]> {
    const payouts = await this.prisma.payoutTransaction.findMany({
      where: {
        fleetOwnerId,
        status: {
          in: [PayoutTransactionStatus.PENDING_DISBURSEMENT, PayoutTransactionStatus.PROCESSING],
        },
      },
      include: {
        fleetOwner: {
          include: {
            bankDetails: true,
          },
        },
      },
    });

    return payouts.map((payout) => this.toDomain(payout));
  }

  async findPendingPayouts(): Promise<Payout[]> {
    const payouts = await this.prisma.payoutTransaction.findMany({
      where: { status: PayoutTransactionStatus.PENDING_DISBURSEMENT },
      include: {
        fleetOwner: {
          include: {
            bankDetails: true,
          },
        },
      },
    });

    return payouts.map((payout) => this.toDomain(payout));
  }

  async findByProviderReference(reference: string): Promise<Payout | null> {
    const payout = await this.prisma.payoutTransaction.findFirst({
      where: { payoutProviderReference: reference },
      include: {
        fleetOwner: {
          include: {
            bankDetails: true,
          },
        },
      },
    });

    return payout ? this.toDomain(payout) : null;
  }

  private toDomain(
    payoutTransaction: Prisma.PayoutTransactionGetPayload<{
      include: {
        fleetOwner: {
          include: {
            bankDetails: {
              select: {
                bankCode: true;
                accountNumber: true;
                bankName: true;
                accountName: true;
                isVerified: true;
              };
            };
          };
        };
      };
    }>,
  ): Payout {
    const bankDetails = payoutTransaction.fleetOwner.bankDetails;

    if (!bankDetails) {
      throw new Error(`Fleet owner ${payoutTransaction.fleetOwnerId} has no bank details`);
    }

    const amount = Number(payoutTransaction.amountToPay);

    const bankAccount = BankAccount.create(
      bankDetails.bankCode,
      bankDetails.accountNumber,
      bankDetails.bankName,
      bankDetails.accountName,
      bankDetails.isVerified,
    );

    return Payout.reconstitute({
      id: PayoutId.create(payoutTransaction.id),
      fleetOwnerId: payoutTransaction.fleetOwnerId,
      bookingId: payoutTransaction.bookingId,
      extensionId: payoutTransaction.extensionId,
      amount,
      bankAccount,
      status: this.mapStatusFromPrisma(payoutTransaction.status),
      providerReference: payoutTransaction.payoutProviderReference,
      failureReason: payoutTransaction.notes,
    });
  }

  private mapStatusToPrisma(status: PayoutStatus): PayoutTransactionStatus {
    const mapping: Record<PayoutStatusEnum, PayoutTransactionStatus> = {
      [PayoutStatusEnum.PENDING_DISBURSEMENT]: PayoutTransactionStatus.PENDING_DISBURSEMENT,
      [PayoutStatusEnum.PROCESSING]: PayoutTransactionStatus.PROCESSING,
      [PayoutStatusEnum.COMPLETED]: PayoutTransactionStatus.PAID_OUT,
      [PayoutStatusEnum.FAILED]: PayoutTransactionStatus.FAILED,
    };

    return mapping[status.value];
  }

  private mapStatusFromPrisma(status: PayoutTransactionStatus): PayoutStatus {
    const mapping: Record<PayoutTransactionStatus, PayoutStatusEnum> = {
      [PayoutTransactionStatus.PENDING_APPROVAL]: PayoutStatusEnum.PENDING_DISBURSEMENT,
      [PayoutTransactionStatus.PENDING_DISBURSEMENT]: PayoutStatusEnum.PENDING_DISBURSEMENT,
      [PayoutTransactionStatus.PROCESSING]: PayoutStatusEnum.PROCESSING,
      [PayoutTransactionStatus.PAID_OUT]: PayoutStatusEnum.COMPLETED,
      [PayoutTransactionStatus.FAILED]: PayoutStatusEnum.FAILED,
      [PayoutTransactionStatus.REVERSED]: PayoutStatusEnum.FAILED,
    };

    return PayoutStatus.create(mapping[status]);
  }
}
