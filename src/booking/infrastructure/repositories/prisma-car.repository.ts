import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service";
import { CarDto } from "../../domain/dtos/car.dto";
import { CarRepository } from "../../domain/repositories/car.repository";

@Injectable()
export class PrismaCarRepository implements CarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(carId: string): Promise<CarDto | null> {
    const car = await this.prisma.car.findFirst({
      where: { id: carId },
      include: {
        images: true,
        documents: true,
      },
    });

    if (!car) {
      return null;
    }

    // Extract image URLs from VehicleImage relation
    const imageUrls = car.images.map((image) => image.url);

    // Extract certificate URLs from DocumentApproval relation
    const motDocument = car.documents.find((doc) => doc.documentType === "MOT_CERTIFICATE");
    const insuranceDocument = car.documents.find(
      (doc) => doc.documentType === "INSURANCE_CERTIFICATE",
    );

    return {
      id: car.id,
      make: car.make,
      model: car.model,
      year: car.year,
      color: car.color,
      registrationNumber: car.registrationNumber,
      ownerId: car.ownerId,
      rates: {
        dayRate: Number(car.dayRate),
        nightRate: Number(car.nightRate),
        hourlyRate: Number(car.hourlyRate),
      },
      status: car.status,
      approvalStatus: car.approvalStatus,
      imageUrls: imageUrls,
      motCertificateUrl: motDocument?.documentUrl || "",
      insuranceCertificateUrl: insuranceDocument?.documentUrl || "",
      createdAt: car.createdAt,
      updatedAt: car.updatedAt,
    };
  }
}
