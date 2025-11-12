import { Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import { PrismaService } from "../../../shared/database/prisma.service";
import { PlatformFeeRepository } from "../../domain/repositories/platform-fee.repository";
import { PlatformFeeRates } from "../../domain/services/booking-cost-calculator.service";

@Injectable()
export class PrismaPlatformFeeRepository implements PlatformFeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentRates(): Promise<PlatformFeeRates> {
    // Get current platform fee rates
    const platformFeeRates = await this.prisma.platformFeeRate.findFirst({
      where: {
        feeType: "PLATFORM_SERVICE_FEE",
        effectiveSince: { lte: new Date() },
        OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
      },
    });

    if (!platformFeeRates) {
      throw new Error("No active platform service fee rate found");
    }

    // Get fleet owner commission rate
    const fleetOwnerCommissionRate = await this.prisma.platformFeeRate.findFirst({
      where: {
        feeType: "FLEET_OWNER_COMMISSION",
        effectiveSince: { lte: new Date() },
        OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
      },
    });

    if (!fleetOwnerCommissionRate) {
      throw new Error("No active fleet owner commission rate found");
    }

    // Get current VAT rate
    const vatRate = await this.prisma.taxRate.findFirst({
      where: {
        effectiveSince: { lte: new Date() },
        OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
      },
    });

    if (!vatRate) {
      throw new Error("No active VAT rate found");
    }

    return {
      platformServiceFeeRate: new Decimal(platformFeeRates.ratePercent.toString()),
      fleetOwnerCommissionRate: new Decimal(fleetOwnerCommissionRate.ratePercent.toString()),
      vatRate: new Decimal(vatRate.ratePercent.toString()),
    };
  }
}
