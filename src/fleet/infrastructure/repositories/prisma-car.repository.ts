import { Injectable } from "@nestjs/common";
import {
  CarApprovalStatus as PrismaCarApprovalStatus,
  Status as PrismaStatus,
} from "@prisma/client";
import { PrismaService } from "../../../shared/database/prisma.service";
import { Car } from "../../domain/entities/car.entity";
import {
  CarRates,
  CarRepository,
  CarSearchCriteria,
} from "../../domain/repositories/car.repository";
import { CarApprovalStatus } from "../../domain/value-objects/car-approval-status.vo";
import { CarStatus } from "../../domain/value-objects/car-status.vo";

@Injectable()
export class PrismaCarRepository implements CarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Car | null> {
    const result = await this.prisma.car.findUnique({
      where: { id },
    });

    return result ? this.mapToCar(result) : null;
  }

  async findByIdWithRates(id: string): Promise<CarRates | null> {
    const result = await this.prisma.car.findUnique({
      where: { id },
      select: {
        id: true,
        dayRate: true,
        nightRate: true,
        hourlyRate: true,
      },
    });

    if (!result) {
      return null;
    }

    return {
      carId: result.id,
      dayRate: result.dayRate,
      nightRate: result.nightRate,
      hourlyRate: result.hourlyRate,
      currency: "NGN", // System-wide currency
    };
  }

  async findByOwnerId(ownerId: string): Promise<Car[]> {
    const results = await this.prisma.car.findMany({
      where: { ownerId: ownerId },
      orderBy: { createdAt: "desc" },
    });

    return results.map((result) => this.mapToCar(result));
  }

  async findByRegistrationNumber(registrationNumber: string): Promise<Car | null> {
    const result = await this.prisma.car.findFirst({
      where: { registrationNumber },
    });

    return result ? this.mapToCar(result) : null;
  }

  async findByCriteria(criteria: CarSearchCriteria): Promise<Car[]> {
    const where: any = {};

    if (criteria.ownerId) {
      where.ownerId = criteria.ownerId;
    }

    if (criteria.status) {
      where.status = criteria.status.toString();
    }

    if (criteria.approvalStatus) {
      where.approvalStatus = criteria.approvalStatus.toString();
    }

    if (criteria.make) {
      where.make = { contains: criteria.make, mode: "insensitive" };
    }

    if (criteria.model) {
      where.model = { contains: criteria.model, mode: "insensitive" };
    }

    if (criteria.year) {
      where.year = criteria.year;
    }

    if (criteria.registrationNumber) {
      where.registrationNumber = { contains: criteria.registrationNumber, mode: "insensitive" };
    }

    const results = await this.prisma.car.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return results.map((result) => this.mapToCar(result));
  }

  async findAvailableCars(): Promise<Car[]> {
    const results = await this.prisma.car.findMany({
      where: {
        status: "AVAILABLE",
        approvalStatus: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
    });

    return results.map((result) => this.mapToCar(result));
  }

  async findPendingApprovalCars(): Promise<Car[]> {
    const results = await this.prisma.car.findMany({
      where: {
        approvalStatus: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    });

    return results.map((result) => this.mapToCar(result));
  }

  async save(car: Car): Promise<Car> {
    const createData = {
      id: car.getId(),
      make: car.getMake(),
      model: car.getModel(),
      year: car.getYear(),
      color: car.getColor(),
      registrationNumber: car.getRegistrationNumber(),
      ownerId: car.getOwnerId(),
      dayRate: car.getDayRate(),
      nightRate: car.getNightRate(),
      hourlyRate: car.getHourlyRate(),
      status: car.getStatus().toString() as PrismaStatus,
      approvalStatus: car.getApprovalStatus().toString() as PrismaCarApprovalStatus,
      createdAt: car.getCreatedAt(),
      updatedAt: car.getUpdatedAt(),
    };

    // Update data excludes ownerId as it's a relation field that shouldn't change
    const updateData = {
      make: car.getMake(),
      model: car.getModel(),
      year: car.getYear(),
      color: car.getColor(),
      registrationNumber: car.getRegistrationNumber(),
      dayRate: car.getDayRate(),
      nightRate: car.getNightRate(),
      hourlyRate: car.getHourlyRate(),
      status: car.getStatus().toString() as PrismaStatus,
      approvalStatus: car.getApprovalStatus().toString() as PrismaCarApprovalStatus,
      updatedAt: car.getUpdatedAt(),
    };

    await this.prisma.car.upsert({
      where: { id: car.getId() },
      create: createData,
      update: updateData,
    });

    return car;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.car.delete({
      where: { id },
    });
  }

  async existsByRegistrationNumber(registrationNumber: string): Promise<boolean> {
    const count = await this.prisma.car.count({
      where: { registrationNumber },
    });

    return count > 0;
  }

  private mapToCar(prismaData: any): Car {
    return Car.reconstitute(prismaData.id, {
      make: prismaData.make,
      model: prismaData.model,
      year: prismaData.year,
      color: prismaData.color,
      registrationNumber: prismaData.registrationNumber,
      ownerId: prismaData.ownerId,
      dayRate: Number(prismaData.dayRate),
      nightRate: Number(prismaData.nightRate),
      hourlyRate: Number(prismaData.hourlyRate),
      status: CarStatus.create(prismaData.status),
      imageUrls: prismaData.imageUrls,
      motCertificateUrl: prismaData.motCertificateUrl,
      insuranceCertificateUrl: prismaData.insuranceCertificateUrl,
      approvalStatus: CarApprovalStatus.create(prismaData.approvalStatus),
      createdAt: prismaData.createdAt,
      updatedAt: prismaData.updatedAt,
    });
  }
}
