import { Injectable } from "@nestjs/common";
import { AddonType } from "@prisma/client";
import { PrismaService } from "../../../shared/database/prisma.service";
import { AddonRateRepository } from "../../domain/repositories/addon-rate.repository";

@Injectable()
export class PrismaAddonRateRepository implements AddonRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrentRate(addonType: AddonType, effectiveDate: Date = new Date()): Promise<number | null> {
    const addonRate = await this.prisma.addonRate.findFirst({
      where: {
        addonType,
        effectiveSince: { lte: effectiveDate },
        OR: [{ effectiveUntil: { gt: effectiveDate } }, { effectiveUntil: null }],
      },
      orderBy: { effectiveSince: "desc" },
    });

    return addonRate ? addonRate.rateAmount.toNumber() : null;
  }
}
