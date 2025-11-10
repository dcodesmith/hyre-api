import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoggerService } from "../../../shared/logging/logger.service";
import { CachedCarRepository } from "../../infrastructure/repositories/cached-car.repository";
import { CarCacheService } from "./car-cache.service";

describe("CarCacheService", () => {
  let service: CarCacheService;
  let mockRepository: CachedCarRepository;
  let mockLogger: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarCacheService,
        {
          provide: "CarRepository",
          useValue: {
            invalidateCarCache: vi.fn(),
            invalidateMultipleCarCache: vi.fn(),
            preloadCarCache: vi.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CarCacheService>(CarCacheService);
    mockRepository = module.get<CachedCarRepository>("CarRepository");
    mockLogger = module.get<LoggerService>(LoggerService);

    // Manually inject the logger since DI is not working
    (service as any).logger = mockLogger;
  });

  describe("invalidateCarCache", () => {
    it("should invalidate cache for single car", async () => {
      const carId = "car-123";

      await service.invalidateCarCache(carId);

      expect(mockRepository.invalidateCarCache).toHaveBeenCalledWith(carId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache due to admin change for car car-123",
      );
    });
  });

  describe("invalidateMultipleCarCache", () => {
    it("should invalidate cache for multiple cars", async () => {
      const carIds = ["car-123", "car-456", "car-789"];

      await service.invalidateMultipleCarCache(carIds);

      expect(mockRepository.invalidateMultipleCarCache).toHaveBeenCalledWith(carIds);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache for 3 cars due to bulk update",
      );
    });

    it("should handle empty car IDs array", async () => {
      const carIds: string[] = [];

      await service.invalidateMultipleCarCache(carIds);

      expect(mockRepository.invalidateMultipleCarCache).toHaveBeenCalledWith(carIds);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache for 0 cars due to bulk update",
      );
    });
  });

  describe("preloadCarCache", () => {
    it("should preload cache for single car", async () => {
      const carId = "car-123";

      await service.preloadCarCache(carId);

      expect(mockRepository.preloadCarCache).toHaveBeenCalledWith(carId);
      expect(mockLogger.info).toHaveBeenCalledWith("Preloading car rates cache for car car-123");
    });
  });

  describe("refreshCarCache", () => {
    it("should invalidate and preload cache for single car", async () => {
      const carId = "car-123";

      await service.refreshCarCache(carId);

      expect(mockRepository.invalidateCarCache).toHaveBeenCalledWith(carId);
      expect(mockRepository.preloadCarCache).toHaveBeenCalledWith(carId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache due to admin change for car car-123",
      );
      expect(mockLogger.info).toHaveBeenCalledWith("Preloading car rates cache for car car-123");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Car rates cache refreshed successfully for car car-123",
      );
    });

    it("should call methods in correct order", async () => {
      const carId = "car-123";
      const callOrder: string[] = [];

      vi.mocked(mockRepository.invalidateCarCache).mockImplementation(async () => {
        callOrder.push("invalidate");
      });

      vi.mocked(mockRepository.preloadCarCache).mockImplementation(async () => {
        callOrder.push("preload");
        return {} as any;
      });

      await service.refreshCarCache(carId);

      expect(callOrder).toEqual(["invalidate", "preload"]);
    });
  });

  describe("refreshMultipleCarCache", () => {
    it("should refresh cache for multiple cars", async () => {
      const carIds = ["car-123", "car-456"];

      await service.refreshMultipleCarCache(carIds);

      expect(mockRepository.invalidateMultipleCarCache).toHaveBeenCalledWith(carIds);
      expect(mockRepository.preloadCarCache).toHaveBeenCalledWith("car-123");
      expect(mockRepository.preloadCarCache).toHaveBeenCalledWith("car-456");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache for 2 cars due to bulk update",
      );
      expect(mockLogger.info).toHaveBeenCalledWith("Car rates cache refreshed for 2 cars");
    });

    it("should preload each car individually", async () => {
      const carIds = ["car-123", "car-456", "car-789"];

      await service.refreshMultipleCarCache(carIds);

      expect(mockRepository.preloadCarCache).toHaveBeenCalledTimes(3);
      expect(mockRepository.preloadCarCache).toHaveBeenNthCalledWith(1, "car-123");
      expect(mockRepository.preloadCarCache).toHaveBeenNthCalledWith(2, "car-456");
      expect(mockRepository.preloadCarCache).toHaveBeenNthCalledWith(3, "car-789");
    });

    it("should handle empty car IDs array", async () => {
      const carIds: string[] = [];

      await service.refreshMultipleCarCache(carIds);

      expect(mockRepository.invalidateMultipleCarCache).toHaveBeenCalledWith([]);
      expect(mockRepository.preloadCarCache).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("Car rates cache refreshed for 0 cars");
    });

    it("should call methods in correct order for multiple cars", async () => {
      const carIds = ["car-123", "car-456"];
      const callOrder: string[] = [];

      vi.mocked(mockRepository.invalidateMultipleCarCache).mockImplementation(async () => {
        callOrder.push("invalidate-multiple");
      });

      vi.mocked(mockRepository.preloadCarCache).mockImplementation(async (carId) => {
        callOrder.push(`preload-${carId}`);
        return {} as any;
      });

      await service.refreshMultipleCarCache(carIds);

      expect(callOrder).toEqual(["invalidate-multiple", "preload-car-123", "preload-car-456"]);
    });
  });
});
