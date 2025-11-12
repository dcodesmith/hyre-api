import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoggerService } from "../../../shared/logging/logger.service";
import { CachedCarRepository } from "../../infrastructure/repositories/cached-car.repository";
import { CarCacheService } from "./car-cache.service";

/**
 * Testing Strategy for CarCacheService:
 *
 * This service orchestrates cache operations for car data.
 * We test:
 * 1. Single car cache operations (invalidate, preload, refresh)
 * 2. Bulk car cache operations (invalidate multiple, refresh multiple)
 * 3. Method execution order for refresh operations
 * 4. Edge cases (empty arrays)
 */
describe("CarCacheService", () => {
  let service: CarCacheService;
  let repository: CachedCarRepository;
  let logger: LoggerService;

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
    repository = module.get<CachedCarRepository>("CarRepository");
    logger = module.get<LoggerService>(LoggerService);
  });

  describe("invalidateCarCache", () => {
    it("should invalidate cache for single car", async () => {
      const carId = "car-123";

      await service.invalidateCarCache(carId);

      expect(repository.invalidateCarCache).toHaveBeenCalledWith(carId);
      expect(logger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache due to admin change for car car-123",
      );
    });
  });

  describe("invalidateMultipleCarCache", () => {
    it("should invalidate cache for multiple cars", async () => {
      const carIds = ["car-123", "car-456", "car-789"];

      await service.invalidateMultipleCarCache(carIds);

      expect(repository.invalidateMultipleCarCache).toHaveBeenCalledWith(carIds);
      expect(logger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache for 3 cars due to bulk update",
      );
    });

    it("should handle empty car IDs array", async () => {
      const carIds: string[] = [];

      await service.invalidateMultipleCarCache(carIds);

      expect(repository.invalidateMultipleCarCache).toHaveBeenCalledWith(carIds);
      expect(logger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache for 0 cars due to bulk update",
      );
    });
  });

  describe("preloadCarCache", () => {
    it("should preload cache for single car", async () => {
      const carId = "car-123";

      await service.preloadCarCache(carId);

      expect(repository.preloadCarCache).toHaveBeenCalledWith(carId);
      expect(logger.info).toHaveBeenCalledWith("Preloading car rates cache for car car-123");
    });
  });

  describe("refreshCarCache", () => {
    it("should invalidate and preload cache for single car", async () => {
      const carId = "car-123";

      await service.refreshCarCache(carId);

      expect(repository.invalidateCarCache).toHaveBeenCalledWith(carId);
      expect(repository.preloadCarCache).toHaveBeenCalledWith(carId);
      expect(logger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache due to admin change for car car-123",
      );
      expect(logger.info).toHaveBeenCalledWith("Preloading car rates cache for car car-123");
      expect(logger.info).toHaveBeenCalledWith(
        "Car rates cache refreshed successfully for car car-123",
      );
    });

    it("should call methods in correct order", async () => {
      const carId = "car-123";
      const callOrder: string[] = [];

      vi.mocked(repository.invalidateCarCache).mockImplementation(async () => {
        callOrder.push("invalidate");
      });

      vi.mocked(repository.preloadCarCache).mockImplementation(async () => {
        callOrder.push("preload");
        return null; // preloadCarCache returns Promise<CarDto | null>
      });

      await service.refreshCarCache(carId);

      expect(callOrder).toEqual(["invalidate", "preload"]);
    });
  });

  describe("refreshMultipleCarCache", () => {
    it("should refresh cache for multiple cars", async () => {
      const carIds = ["car-123", "car-456"];

      await service.refreshMultipleCarCache(carIds);

      expect(repository.invalidateMultipleCarCache).toHaveBeenCalledWith(carIds);
      expect(repository.preloadCarCache).toHaveBeenCalledWith("car-123");
      expect(repository.preloadCarCache).toHaveBeenCalledWith("car-456");
      expect(logger.info).toHaveBeenCalledWith(
        "Invalidating car rates cache for 2 cars due to bulk update",
      );
      expect(logger.info).toHaveBeenCalledWith("Car rates cache refreshed for 2 cars");
    });

    it("should preload each car individually", async () => {
      const carIds = ["car-123", "car-456", "car-789"];

      await service.refreshMultipleCarCache(carIds);

      expect(repository.preloadCarCache).toHaveBeenCalledTimes(3);
      expect(repository.preloadCarCache).toHaveBeenNthCalledWith(1, "car-123");
      expect(repository.preloadCarCache).toHaveBeenNthCalledWith(2, "car-456");
      expect(repository.preloadCarCache).toHaveBeenNthCalledWith(3, "car-789");
    });

    it("should handle empty car IDs array", async () => {
      const carIds: string[] = [];

      await service.refreshMultipleCarCache(carIds);

      expect(repository.invalidateMultipleCarCache).toHaveBeenCalledWith([]);
      expect(repository.preloadCarCache).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith("Car rates cache refreshed for 0 cars");
    });

    it("should call methods in correct order for multiple cars", async () => {
      const carIds = ["car-123", "car-456"];
      const callOrder: string[] = [];

      vi.mocked(repository.invalidateMultipleCarCache).mockImplementation(async () => {
        callOrder.push("invalidate-multiple");
      });

      vi.mocked(repository.preloadCarCache).mockImplementation(async (carId: string) => {
        callOrder.push(`preload-${carId}`);
        return null; // preloadCarCache returns Promise<CarDto | null>
      });

      await service.refreshMultipleCarCache(carIds);

      expect(callOrder).toEqual(["invalidate-multiple", "preload-car-123", "preload-car-456"]);
    });
  });
});
