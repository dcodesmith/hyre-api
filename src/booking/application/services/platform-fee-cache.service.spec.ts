import { Test, TestingModule } from "@nestjs/testing";
import { Decimal } from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoggerService } from "../../../shared/logging/logger.service";
import { CachedPlatformFeeRepository } from "../../infrastructure/repositories/cached-platform-fee.repository";
import { PlatformFeeCacheService } from "./platform-fee-cache.service";

describe("PlatformFeeCacheService", () => {
  let service: PlatformFeeCacheService;
  let mockRepository: CachedPlatformFeeRepository;
  let mockLogger: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformFeeCacheService,
        {
          provide: "PlatformFeeRepository",
          useValue: {
            invalidateCache: vi.fn(),
            preloadCache: vi.fn(),
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

    service = module.get<PlatformFeeCacheService>(PlatformFeeCacheService);
    mockRepository = module.get<CachedPlatformFeeRepository>("PlatformFeeRepository");
    mockLogger = module.get<LoggerService>(LoggerService);

    // Manually inject the logger since DI is not working
    (service as any).logger = mockLogger;
  });

  describe("invalidateRatesCache", () => {
    it("should invalidate platform fee rates cache", async () => {
      await service.invalidateRatesCache();

      expect(mockRepository.invalidateCache).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Invalidating platform fee rates cache due to admin change",
      );
    });
  });

  describe("preloadRatesCache", () => {
    it("should preload platform fee rates cache", async () => {
      await service.preloadRatesCache();

      expect(mockRepository.preloadCache).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("Preloading platform fee rates cache");
    });
  });

  describe("refreshRatesCache", () => {
    it("should invalidate and preload cache", async () => {
      await service.refreshRatesCache();

      expect(mockRepository.invalidateCache).toHaveBeenCalled();
      expect(mockRepository.preloadCache).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Invalidating platform fee rates cache due to admin change",
      );
      expect(mockLogger.info).toHaveBeenCalledWith("Preloading platform fee rates cache");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Platform fee rates cache refreshed successfully",
      );
    });

    it("should call methods in correct order", async () => {
      const callOrder: string[] = [];

      vi.mocked(mockRepository.invalidateCache).mockImplementation(async () => {
        callOrder.push("invalidate");
      });

      vi.mocked(mockRepository.preloadCache).mockImplementation(async () => {
        callOrder.push("preload");
        return {
          platformServiceFeeRate: new Decimal(10),
          fleetOwnerCommissionRate: new Decimal(10),
          vatRate: new Decimal(10),
        };
      });

      await service.refreshRatesCache();

      expect(callOrder).toEqual(["invalidate", "preload"]);
    });
  });
});
