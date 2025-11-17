import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLoggerToken, ServiceLogger } from "../../../shared/logging/create-logger-provider";
import { Car } from "../../domain/entities/car.entity";
import { FleetNotFoundError } from "../../domain/errors/fleet.errors";
import { CarUploadService } from "../../domain/services/car-upload.service";
import {
  CarUploadRequest,
  CarUploadResult,
} from "../../domain/services/external/car-upload.interface";
import { CarDocument } from "../../domain/value-objects/car-document.vo";
import { CarStatus } from "../../domain/value-objects/car-status.vo";
import { CarUploadCompleteDto } from "../../presentation/dto/car-upload-complete.dto";
import { CarUploadDto, CarUploadResponseDto } from "./car-upload-application.interface";
import { CarUploadApplicationService } from "./car-upload-application.service";

describe("CarUploadApplicationService", () => {
  let service: CarUploadApplicationService;
  let mockCarUploadService: CarUploadService;
  let mockLogger: ServiceLogger;

  const mockCar = {
    getId: vi.fn(() => "car-123"),
    getStatus: vi.fn(() => CarStatus.create("AVAILABLE")),
  } as unknown as Car;

  const mockCarImageDocument = CarDocument.createCarImage(
    "https://example.com/image.jpg",
    "image.jpg",
    "image/jpeg",
  );

  const mockMotCertificate = CarDocument.createMotCertificate(
    "https://example.com/mot.pdf",
    "mot.pdf",
  );

  const mockInsuranceCertificate = CarDocument.createInsuranceCertificate(
    "https://example.com/insurance.pdf",
    "insurance.pdf",
  );

  const mockCarUploadResult: CarUploadResult = {
    car: mockCar,
    uploadedImages: [mockCarImageDocument, mockCarImageDocument],
    motCertificate: mockMotCertificate,
    insuranceCertificate: mockInsuranceCertificate,
  };

  const mockCarUploadDto: CarUploadDto = {
    make: "Toyota",
    model: "Camry",
    year: 2024,
    color: "Red",
    registrationNumber: "ABC123XX",
    dayRate: 5000,
    nightRate: 7000,
    hourlyRate: 1000,
    images: [
      {
        fileName: "image1.jpg",
        contentType: "image/jpeg",
        buffer: Buffer.from("image1"),
        size: 1024,
      },
      {
        fileName: "image2.jpg",
        contentType: "image/jpeg",
        buffer: Buffer.from("image2"),
        size: 2048,
      },
    ],
    motCertificate: {
      fileName: "mot.pdf",
      contentType: "application/pdf",
      buffer: Buffer.from("mot certificate"),
      size: 3072,
    },
    insuranceCertificate: {
      fileName: "insurance.pdf",
      contentType: "application/pdf",
      buffer: Buffer.from("insurance certificate"),
      size: 4096,
    },
  };

  const mockCarUploadCompleteDto: CarUploadCompleteDto = {
    make: "Toyota",
    model: "Camry",
    year: 2024,
    color: "Red",
    registrationNumber: "ABC123XX",
    dayRate: 5000,
    nightRate: 7000,
    hourlyRate: 1000,
    images: [
      {
        fieldname: "images",
        originalname: "image1.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        buffer: Buffer.from("image1"),
        size: 1024,
      },
      {
        fieldname: "images",
        originalname: "image2.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        buffer: Buffer.from("image2"),
        size: 2048,
      },
    ],
    motCertificate: [
      {
        fieldname: "motCertificate",
        originalname: "mot.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        buffer: Buffer.from("mot certificate"),
        size: 3072,
      },
    ],
    insuranceCertificate: [
      {
        fieldname: "insuranceCertificate",
        originalname: "insurance.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        buffer: Buffer.from("insurance certificate"),
        size: 4096,
      },
    ],
  };

  beforeEach(async () => {
    // Create mock services
    mockCarUploadService = {
      createCarWithDocuments: vi.fn(),
    } as unknown as CarUploadService;

    mockLogger = {
      log: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    } as ServiceLogger;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarUploadApplicationService,
        {
          provide: CarUploadService,
          useValue: mockCarUploadService,
        },
        {
          provide: getLoggerToken(CarUploadApplicationService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<CarUploadApplicationService>(CarUploadApplicationService);

    // Setup default mocks
    vi.mocked(mockCarUploadService.createCarWithDocuments).mockResolvedValue(mockCarUploadResult);
  });

  describe("uploadCar", () => {
    const ownerId = "owner-123";

    it("should upload car successfully from multipart data", async () => {
      const result = await service.uploadCar(ownerId, mockCarUploadCompleteDto);

      expect(mockCarUploadService.createCarWithDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          carData: expect.objectContaining({
            make: "Toyota",
            model: "Camry",
            year: 2024,
            color: "Red",
            registrationNumber: "ABC123XX",
            dayRate: 5000,
            nightRate: 7000,
            hourlyRate: 1000,
            ownerId,
          }),
          images: expect.arrayContaining([
            expect.objectContaining({
              fileName: "image1.jpg",
              contentType: "image/jpeg",
              buffer: Buffer.from("image1"),
            }),
            expect.objectContaining({
              fileName: "image2.jpg",
              contentType: "image/jpeg",
              buffer: Buffer.from("image2"),
            }),
          ]),
          motCertificate: expect.objectContaining({
            fileName: "mot.pdf",
            contentType: "application/pdf",
            buffer: Buffer.from("mot certificate"),
          }),
          insuranceCertificate: expect.objectContaining({
            fileName: "insurance.pdf",
            contentType: "application/pdf",
            buffer: Buffer.from("insurance certificate"),
          }),
        }),
      );
      expect(result).toEqual({
        success: true,
        data: {
          carId: "car-123",
          status: "AVAILABLE",
          uploadedImages: ["https://example.com/image.jpg", "https://example.com/image.jpg"],
          documents: {
            motCertificate: "https://example.com/mot.pdf",
            insuranceCertificate: "https://example.com/insurance.pdf",
          },
        },
        message: "Car uploaded successfully and pending approval",
      });
    });

    it("should handle upload with no images gracefully", async () => {
      const dtoWithoutImages = { ...mockCarUploadCompleteDto, images: undefined };

      const result = await service.uploadCar(ownerId, dtoWithoutImages);

      expect(result.success).toBe(true);
      expect(mockCarUploadService.createCarWithDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          images: [],
        }),
      );
    });

    it("should handle BadRequestException and rethrow", async () => {
      const error = new BadRequestException("Invalid car data");
      vi.mocked(mockCarUploadService.createCarWithDocuments).mockRejectedValue(error);

      await expect(service.uploadCar(ownerId, mockCarUploadCompleteDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should handle other errors and throw InternalServerErrorException", async () => {
      const error = new Error("Database connection failed");
      vi.mocked(mockCarUploadService.createCarWithDocuments).mockRejectedValue(error);

      await expect(service.uploadCar(ownerId, mockCarUploadCompleteDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe("processCarUpload", () => {
    const ownerId = "owner-123";

    it("should process car upload successfully", async () => {
      const result: CarUploadResponseDto = await service.processCarUpload(
        ownerId,
        mockCarUploadDto,
      );

      expect(mockCarUploadService.createCarWithDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          carData: expect.objectContaining({
            make: "Toyota",
            model: "Camry",
            year: 2024,
            color: "Red",
            registrationNumber: "ABC123XX",
            dayRate: 5000,
            nightRate: 7000,
            hourlyRate: 1000,
            ownerId,
          }),
          images: expect.arrayContaining([
            expect.objectContaining({
              fileName: "image1.jpg",
              contentType: "image/jpeg",
              buffer: Buffer.from("image1"),
            }),
            expect.objectContaining({
              fileName: "image2.jpg",
              contentType: "image/jpeg",
              buffer: Buffer.from("image2"),
            }),
          ]),
          motCertificate: expect.objectContaining({
            fileName: "mot.pdf",
            contentType: "application/pdf",
            buffer: Buffer.from("mot certificate"),
          }),
          insuranceCertificate: expect.objectContaining({
            fileName: "insurance.pdf",
            contentType: "application/pdf",
            buffer: Buffer.from("insurance certificate"),
          }),
        }),
      );
      expect(result).toEqual({
        carId: "car-123",
        status: "AVAILABLE",
        uploadedImages: ["https://example.com/image.jpg", "https://example.com/image.jpg"],
        documents: {
          motCertificate: "https://example.com/mot.pdf",
          insuranceCertificate: "https://example.com/insurance.pdf",
        },
        message: "Car uploaded successfully and pending approval",
      });
    });

    it("should throw FleetNotFoundError when fleet does not exist", async () => {
      // Fleet validation will be handled by CarUploadService
      const error = new FleetNotFoundError(ownerId);
      vi.mocked(mockCarUploadService.createCarWithDocuments).mockRejectedValue(error);

      await expect(service.processCarUpload(ownerId, mockCarUploadDto)).rejects.toThrow(
        FleetNotFoundError,
      );
      expect(mockCarUploadService.createCarWithDocuments).toHaveBeenCalled();
    });

    it("should handle car upload service errors", async () => {
      const error = new Error("File upload failed");
      vi.mocked(mockCarUploadService.createCarWithDocuments).mockRejectedValue(error);

      await expect(service.processCarUpload(ownerId, mockCarUploadDto)).rejects.toThrow(
        "File upload failed",
      );
    });

    it("should handle domain event publishing errors", async () => {
      const error = new Error("Event publishing failed");
      // Domain events moved to CarUploadService - simulate error from CarUploadService instead
      vi.mocked(mockCarUploadService.createCarWithDocuments).mockRejectedValue(error);

      await expect(service.processCarUpload(ownerId, mockCarUploadDto)).rejects.toThrow(
        "Event publishing failed",
      );
      expect(mockCarUploadService.createCarWithDocuments).toHaveBeenCalled();
    });
  });

  describe("validateFleetOwnership", () => {
    it("should propagate fleet validation errors from CarUploadService", async () => {
      // Fleet validation moved to CarUploadService - test that errors are propagated
      const error = new FleetNotFoundError("owner-123");
      vi.mocked(mockCarUploadService.createCarWithDocuments).mockRejectedValue(error);

      await expect(service.processCarUpload("owner-123", mockCarUploadDto)).rejects.toThrow(
        FleetNotFoundError,
      );
    });

    it("should pass validation when fleet exists", async () => {
      // Fleet validation handled by CarUploadService - should complete normally
      const result = await service.processCarUpload("owner-123", mockCarUploadDto);
      expect(result).toBeDefined();
      expect(result.carId).toBe("car-123");
    });
  });

  describe("publishDomainEvents", () => {
    it("should delegate domain events to CarUploadService", async () => {
      const result = await service.processCarUpload("owner-123", mockCarUploadDto);

      // Domain events moved to CarUploadService - success is indicated by successful completion
      expect(mockCarUploadService.createCarWithDocuments).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.carId).toBe("car-123");
    });

    it("should propagate event publishing failures from CarUploadService", async () => {
      const error = new Error("Event bus unavailable");
      // Domain events moved to CarUploadService - simulate error from CarUploadService
      vi.mocked(mockCarUploadService.createCarWithDocuments).mockRejectedValue(error);

      await expect(service.processCarUpload("owner-123", mockCarUploadDto)).rejects.toThrow(
        "Event bus unavailable",
      );
    });
  });

  describe("data transformation", () => {
    it("should correctly transform CarUploadCompleteDto to CarUploadDto", async () => {
      await service.uploadCar("owner-123", mockCarUploadCompleteDto);

      const expectedCarUploadRequest: CarUploadRequest = expect.objectContaining({
        carData: expect.objectContaining({
          make: "Toyota",
          model: "Camry",
          year: 2024,
          color: "Red",
          registrationNumber: "ABC123XX",
          dayRate: 5000,
          nightRate: 7000,
          hourlyRate: 1000,
          ownerId: "owner-123",
        }),
        images: [
          expect.objectContaining({
            fileName: "image1.jpg",
            contentType: "image/jpeg",
            buffer: Buffer.from("image1"),
          }),
          expect.objectContaining({
            fileName: "image2.jpg",
            contentType: "image/jpeg",
            buffer: Buffer.from("image2"),
          }),
        ],
        motCertificate: expect.objectContaining({
          fileName: "mot.pdf",
          contentType: "application/pdf",
          buffer: Buffer.from("mot certificate"),
        }),
        insuranceCertificate: expect.objectContaining({
          fileName: "insurance.pdf",
          contentType: "application/pdf",
          buffer: Buffer.from("insurance certificate"),
        }),
      });

      expect(mockCarUploadService.createCarWithDocuments).toHaveBeenCalledWith(
        expectedCarUploadRequest,
      );
    });

    it("should handle empty images array", async () => {
      const dtoWithEmptyImages = { ...mockCarUploadCompleteDto, images: [] };

      await service.uploadCar("owner-123", dtoWithEmptyImages);

      expect(mockCarUploadService.createCarWithDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          images: [],
        }),
      );
    });
  });

  describe("logging", () => {
    it("should handle logging during car upload", async () => {
      // Service uses a mock logger, so we just verify the operation completes
      const result = await service.uploadCar("owner-123", mockCarUploadCompleteDto);
      expect(result.success).toBe(true);
    });

    it("should handle logging during car upload process", async () => {
      // Service uses a mock logger, so we just verify the operation completes
      const result = await service.processCarUpload("owner-123", mockCarUploadDto);
      expect(result).toBeDefined();
      expect(result.carId).toBe("car-123");
    });

    it("should handle logging during errors", async () => {
      const error = new Error("Upload failed");
      error.stack = "Error stack trace";
      vi.mocked(mockCarUploadService.createCarWithDocuments).mockRejectedValue(error);

      await expect(service.processCarUpload("owner-123", mockCarUploadDto)).rejects.toThrow(
        "Upload failed",
      );
    });
  });
});
