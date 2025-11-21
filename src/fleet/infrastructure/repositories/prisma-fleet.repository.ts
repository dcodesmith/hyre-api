import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../shared/database/prisma.service";
import { TransactionContext } from "../../../shared/database/transaction-context.type";
import { Fleet } from "../../domain/entities/fleet.entity";
import { FleetRepository } from "../../domain/repositories/fleet.repository";

@Injectable()
export class PrismaFleetRepository implements FleetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Fleet | null> {
    const result = await this.prisma.user.findFirst({
      where: {
        id: id,
        roles: {
          some: {
            name: "fleetOwner",
          },
        },
      },
      include: {
        cars: true,
        chauffeurs: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    return this.mapToFleet(result);
  }

  async findByOwnerId(ownerId: string): Promise<Fleet | null> {
    const result = await this.prisma.user.findFirst({
      where: {
        id: ownerId,
        roles: {
          some: {
            name: "fleetOwner",
          },
        },
      },
      include: {
        cars: true,
        chauffeurs: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    return this.mapToFleet(result);
  }

  async save(fleet: Fleet): Promise<Fleet> {
    const _fleetData = {
      id: fleet.getId(),
      name: fleet.getName(),
      // Note: User data is managed by IAM domain
      updatedAt: fleet.getUpdatedAt(),
    };

    // For now, we'll just return the fleet as-is since the user data
    // is managed by the IAM domain. In a real implementation, we might
    // store fleet-specific data in a separate Fleet table.
    return fleet;
  }

  async saveWithTransaction(fleet: Fleet, tx: TransactionContext): Promise<Fleet> {
    // For now, just return the fleet as-is (same as regular save)
    // In a real implementation with separate Fleet table, would use tx
    return fleet;
  }

  async delete(id: string): Promise<void> {
    // Mark fleet as inactive rather than deleting
    await this.prisma.user.update({
      where: { id: id },
      data: { updatedAt: new Date() },
    });
  }

  async findActiveFleets(): Promise<Fleet[]> {
    const results = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            name: "fleetOwner",
          },
        },
        fleetOwnerStatus: "APPROVED",
      },
      include: {
        cars: true,
        chauffeurs: true,
      },
    });

    return results.map((result) => this.mapToFleet(result));
  }

  async findFleetsByOwnerIds(ownerIds: string[]): Promise<Fleet[]> {
    const results = await this.prisma.user.findMany({
      where: {
        id: {
          in: ownerIds,
        },
        roles: {
          some: {
            name: "fleetOwner",
          },
        },
      },
      include: {
        cars: true,
        chauffeurs: {
          select: {
            id: true,
          },
        },
      },
    });

    return results.map((result) => this.mapToFleet(result));
  }

  private mapToFleet(
    prismaData: Prisma.UserGetPayload<{
      include: {
        cars: true;
        chauffeurs: {
          select: {
            id: true;
          };
        };
      };
    }>,
  ): Fleet {
    const chauffeurIds = prismaData.chauffeurs.map(({ id }) => id);

    return Fleet.reconstitute(
      prismaData.id,
      prismaData.fleetOwnerId, // Fleet owner is the user
      prismaData.name || "Default Fleet",
      chauffeurIds,
      true,
      prismaData.createdAt,
      prismaData.updatedAt,
    );
  }

  // private mapToCar(prismaCarData: any): Car {
  //   return Car.reconstitute(prismaCarData.id, {
  //     make: prismaCarData.make,
  //     model: prismaCarData.model,
  //     year: prismaCarData.year,
  //     color: prismaCarData.color,
  //     registrationNumber: prismaCarData.registrationNumber,
  //     ownerId: prismaCarData.ownerId,
  //     dayRate: Number(prismaCarData.dayRate),
  //     nightRate: Number(prismaCarData.nightRate),
  //     hourlyRate: Number(prismaCarData.hourlyRate),
  //     status: CarStatus.create(prismaCarData.status),
  //     approvalStatus: CarApprovalStatus.create(prismaCarData.approvalStatus),
  //     createdAt: prismaCarData.createdAt,
  //     imageUrls: prismaCarData.imageUrls,
  //     motCertificateUrl: prismaCarData.motCertificateUrl,
  //     insuranceCertificateUrl: prismaCarData.insuranceCertificateUrl,
  //     updatedAt: prismaCarData.updatedAt,
  //   });
  // }
}
