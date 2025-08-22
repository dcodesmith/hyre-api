import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Car } from "../../domain/entities/car.entity";
import { FleetNotFoundError } from "../../domain/errors/fleet.errors";
import { CarUploadService } from "../../domain/services/car-upload.service";
import { CarUploadRequest } from "../../domain/services/external/car-upload.interface";
import { FleetManagementService } from "../../domain/services/fleet-management.service";
import { CarUploadCompleteDto } from "../../presentation/dto/car-upload-complete.dto";
import { CarUploadDto, CarUploadResponseDto } from "./car-upload-application.interface";

/**
 * Application service for car upload operations
 * Orchestrates the car upload workflow and handles cross-cutting concerns
 */
@Injectable()
export class CarUploadApplicationService {
  constructor(
    private readonly carUploadService: CarUploadService,
    private readonly fleetManagementService: FleetManagementService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Upload car from validated multipart data
   * Handles transformation and error handling for controller
   */
  async uploadCar(
    ownerId: string,
    validatedData: CarUploadCompleteDto,
  ): Promise<{
    success: boolean;
    data?: {
      carId: string;
      status: string;
      uploadedImages: string[];
      documents: {
        motCertificate: string;
        insuranceCertificate: string;
      };
    };
    message: string;
  }> {
    this.logger.info("Car upload request received", {
      ownerId,
      imagesCount: validatedData.images?.length || 0,
    });

    try {
      // Transform the validated data to application service format
      const carData: CarUploadDto = {
        make: validatedData.make,
        model: validatedData.model,
        year: validatedData.year,
        color: validatedData.color,
        registrationNumber: validatedData.registrationNumber,
        dayRate: validatedData.dayRate,
        nightRate: validatedData.nightRate,
        hourlyRate: validatedData.hourlyRate,
        images: (validatedData.images ?? []).map((file) => ({
          fileName: file.originalname,
          contentType: file.mimetype,
          buffer: file.buffer,
          size: file.size,
        })),
        motCertificate: {
          fileName: validatedData.motCertificate[0].originalname,
          contentType: validatedData.motCertificate[0].mimetype,
          buffer: validatedData.motCertificate[0].buffer,
          size: validatedData.motCertificate[0].size,
        },
        insuranceCertificate: {
          fileName: validatedData.insuranceCertificate[0].originalname,
          contentType: validatedData.insuranceCertificate[0].mimetype,
          buffer: validatedData.insuranceCertificate[0].buffer,
          size: validatedData.insuranceCertificate[0].size,
        },
      };

      // Process the upload using existing method
      const result = await this.processCarUpload(ownerId, carData);

      return {
        success: true,
        data: {
          carId: result.carId,
          status: result.status,
          uploadedImages: result.uploadedImages,
          documents: result.documents,
        },
        message: result.message,
      };
    } catch (error) {
      this.logger.error(`Car upload failed for owner ${ownerId}: ${error.message}`,
error.stack);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException("Car upload failed. Please try again.");
    }
  }

  async processCarUpload(ownerId: string, dto: CarUploadDto): Promise<CarUploadResponseDto> {
    this.logger.info("Starting car upload process", {
      ownerId,
      make: dto.make,
      model: dto.model,
      imagesCount: dto.images.length,
    });

    try {
      // Step 1: Validate fleet exists (business requirement)
      await this.validateFleetOwnership(ownerId);

      // Step 2: Transform DTO to domain request
      const uploadRequest: CarUploadRequest = {
        carData: {
          make: dto.make,
          model: dto.model,
          year: dto.year,
          color: dto.color,
          registrationNumber: dto.registrationNumber,
          dayRate: dto.dayRate,
          nightRate: dto.nightRate,
          hourlyRate: dto.hourlyRate,
          ownerId,
        },
        images: dto.images.map((img) => ({
          fileName: img.fileName,
          contentType: img.contentType,
          buffer: img.buffer,
        })),
        motCertificate: {
          fileName: dto.motCertificate.fileName,
          contentType: dto.motCertificate.contentType,
          buffer: dto.motCertificate.buffer,
        },
        insuranceCertificate: {
          fileName: dto.insuranceCertificate.fileName,
          contentType: dto.insuranceCertificate.contentType,
          buffer: dto.insuranceCertificate.buffer,
        },
      };

      // Step 3: Execute domain operation
      const result = await this.carUploadService.createCarWithDocuments(uploadRequest);
      const { car, uploadedImages, motCertificate, insuranceCertificate } = result;

      // Step 4: Publish domain events
      await this.publishDomainEvents(car);

      // Step 5: Transform to response DTO
      const response: CarUploadResponseDto = {
        carId: car.getId(),
        status: car.getStatus().toString(),
        uploadedImages: uploadedImages.map((doc) => doc.getUrl()),
        documents: {
          motCertificate: motCertificate.getUrl(),
          insuranceCertificate: insuranceCertificate.getUrl(),
        },
        message: "Car uploaded successfully and pending approval",
      };

      this.logger.info("Car upload completed successfully", {
        carId: car.getId(),
        ownerId,
      });

      return response;
    } catch (error) {
      this.logger.error(`Car upload failed for owner ${ownerId}: ${error.message}`,
error.stack);

      throw error;
    }
  }

  private async validateFleetOwnership(ownerId: string): Promise<void> {
    const fleet = await this.fleetManagementService.getFleetByOwnerId(ownerId);
    if (!fleet) {
      throw new FleetNotFoundError(ownerId);
    }
  }

  private async publishDomainEvents(car: Car): Promise<void> {
    await this.domainEventPublisher.publish(car);
  }
}
