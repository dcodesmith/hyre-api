import { Inject, Injectable } from "@nestjs/common";
import { FileStorageService } from "../../../shared/domain/file-storage.interface";
import { Car, CarCreationParams } from "../entities/car.entity";
import {
  CarDuplicateRegistrationError,
  CarFileUploadError,
  CarFileUrlError,
  CarUploadServiceError,
} from "../errors/fleet.errors";
import { CarRepository } from "../repositories/car.repository";
import { CarDocument, DocumentType } from "../value-objects/car-document.vo";
import {
  CarUploadData,
  CarUploadRequest,
  CarUploadResult,
  FileUploadData,
} from "./external/car-upload.interface";

/**
 * Domain service responsible for orchestrating car creation with file uploads
 * This service coordinates between car creation and document management
 */
@Injectable()
export class CarUploadService {
  constructor(
    @Inject("CarRepository") private readonly carRepository: CarRepository,
    @Inject("FileStorageService") private readonly fileStorageService: FileStorageService,
  ) {}

  async createCarWithDocuments(request: CarUploadRequest): Promise<CarUploadResult> {
    const { carData } = request;

    try {
      // Step 1: Validate unique registration number (domain business rule)
      const existingCar = await this.carRepository.findByRegistrationNumber(
        carData.registrationNumber,
      );

      if (existingCar) {
        throw new CarDuplicateRegistrationError(carData.registrationNumber);
      }

      // Step 2: Upload all files to S3 to get URLs
      const [uploadedImages, motCertificate, insuranceCertificate] = await Promise.all([
        this.uploadCarImages(carData, request.images),
        this.uploadDocument(carData, request.motCertificate, DocumentType.MOT_CERTIFICATE),
        this.uploadDocument(
          carData,
          request.insuranceCertificate,
          DocumentType.INSURANCE_CERTIFICATE,
        ),
      ]);

      // Step 3: Extract URLs from uploaded documents
      const imageUrls = uploadedImages.map((doc) => doc.getUrl());
      const motCertificateUrl = motCertificate.getUrl();
      const insuranceCertificateUrl = insuranceCertificate.getUrl();

      // Step 4: Create the car entity WITH the S3 URLs and ownerId (establishes fleet relationship)
      const carParams: CarCreationParams = {
        make: carData.make,
        model: carData.model,
        year: carData.year,
        color: carData.color,
        registrationNumber: carData.registrationNumber,
        ownerId: carData.ownerId, // This establishes the fleet relationship!
        dayRate: carData.dayRate,
        nightRate: carData.nightRate,
        hourlyRate: carData.hourlyRate,
        imageUrls,
        motCertificateUrl,
        insuranceCertificateUrl,
      };
      const car = Car.create(carParams);

      // Step 5: Persist the car - relationship with fleet established via ownerId
      const savedCar = await this.carRepository.save(car);

      // Step 6: Return the complete result
      return {
        car: savedCar,
        uploadedImages,
        motCertificate,
        insuranceCertificate,
      };
    } catch (error) {
      // Clean up any uploaded files on failure
      await this.cleanupUploadedFiles(`temp-${Date.now()}`);
      throw new CarUploadServiceError(error.message, { originalError: error.name });
    }
  }

  private async uploadCarImages(
    carData: CarUploadData,
    images: FileUploadData[],
  ): Promise<CarDocument[]> {
    const uploadPromises = images.map(async (image) => {
      const result = await this.fileStorageService.uploadFile({
        fileName: image.fileName,
        contentType: image.contentType,
        buffer: image.buffer,
        folder: `cars/${carData.ownerId}/${Date.now()}`, // Consistent folder structure
      });

      if (!result.success) {
        throw new CarFileUploadError(image.fileName, result.errorMessage || "Unknown upload error");
      }

      if (!result.url) {
        throw new CarFileUrlError(image.fileName, "image");
      }

      return CarDocument.createCarImage(result.url, image.fileName, image.contentType);
    });

    return Promise.all(uploadPromises);
  }

  private async uploadDocument(
    carData: CarUploadData,
    file: FileUploadData,
    documentType: DocumentType,
  ): Promise<CarDocument> {
    const result = await this.fileStorageService.uploadFile({
      fileName: file.fileName,
      contentType: file.contentType,
      buffer: file.buffer,
      folder: `cars/${carData.ownerId}/${Date.now()}`, // Use timestamp since car ID doesn't exist yet
    });

    if (!result.success) {
      throw new CarFileUploadError(file.fileName, result.errorMessage || "Unknown upload error");
    }

    if (!result.url) {
      throw new CarFileUrlError(file.fileName, documentType);
    }

    switch (documentType) {
      case DocumentType.MOT_CERTIFICATE:
        return CarDocument.createMotCertificate(result.url, file.fileName);
      case DocumentType.INSURANCE_CERTIFICATE:
        return CarDocument.createInsuranceCertificate(result.url, file.fileName);
      default:
        throw new CarUploadServiceError(`Unsupported document type: ${documentType}`, {
          documentType,
        });
    }
  }

  private async cleanupUploadedFiles(_carId: string): Promise<void> {
    // Note: In a production system, you might want to keep track of uploaded files
    // and delete them individually. For now, this is a placeholder for cleanup logic.
    // The actual cleanup would depend on your file storage implementation.
  }
}
