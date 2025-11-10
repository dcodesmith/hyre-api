import { Injectable } from "@nestjs/common";
import { HealthIndicatorResult } from "@nestjs/terminus";
import { PrismaService } from "../../shared/database/prisma.service";

@Injectable()
export class PrismaHealthIndicator {
  constructor(private readonly prismaService: PrismaService) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return { [key]: { status: "up" } };
    } catch (error) {
      return { [key]: { status: "down", message: error.message } };
    }
  }
}
