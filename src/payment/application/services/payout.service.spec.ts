import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Payout } from "../../domain/entities/payout.entity";
import { PayoutRepository } from "../../domain/repositories/payout.repository";
import {
  PaymentGateway,
  PaymentGatewayResponse,
} from "../../domain/services/payment-gateway.interface";
import { PayoutPolicyService } from "../../domain/services/payout-policy.service";
import { BankAccount } from "../../domain/value-objects/bank-account.vo";
import { PayoutId } from "../../domain/value-objects/payout-id.vo";

import { InitiatePayoutCommand } from "../commands/initiate-payout.command";
import { PayoutService } from "./payout.service";

describe("PayoutService", () => {
  let service: PayoutService;
  let mockPayoutRepository: PayoutRepository;
  let mockPayoutPolicyService: PayoutPolicyService;
  let mockPaymentGateway: PaymentGateway;
  let mockDomainEventPublisher: DomainEventPublisher;
  let mockLoggerService: LoggerService;

  const mockBankAccount = {
    bankCode: "044",
    accountNumber: "1234567890",
    bankName: "Access Bank",
    accountName: "John Doe",
    isVerified: true,
  } as BankAccount;

  const mockPayout = {
    getId: vi.fn(() => ({ value: "payout-123" })),
    getFleetOwnerId: vi.fn(() => "fleet-owner-123"),
    getAmount: vi.fn(() => 50000),
    getBankAccount: vi.fn(() => mockBankAccount),
    getBookingId: vi.fn(() => "booking-123"),
    getExtensionId: vi.fn(() => undefined),
    getStatus: vi.fn(() => ({ isFailed: vi.fn(() => false) })),
    initiate: vi.fn(),
    markAsFailed: vi.fn(),
    retry: vi.fn(),
  } as unknown as Payout;

  const mockInitiatePayoutCommand: InitiatePayoutCommand = {
    fleetOwnerId: "fleet-owner-123",
    amount: 50000,
    currency: "NGN",
    bankCode: "044",
    accountNumber: "1234567890",
    bankName: "Access Bank",
    accountName: "John Doe",
    bookingId: "booking-123",
    extensionId: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutService,
        {
          provide: PayoutRepository,
          useValue: {
            findByBookingId: vi.fn(),
            findByExtensionId: vi.fn(),
            findPendingPayouts: vi.fn(),
            findById: vi.fn(),
            save: vi.fn(),
          },
        },
        {
          provide: PayoutPolicyService,
          useValue: {
            canInitiatePayout: vi.fn(),
            generatePayoutReference: vi.fn(),
          },
        },
        {
          provide: PaymentGateway,
          useValue: {
            initiatePayout: vi.fn(),
            verifyPayout: vi.fn(),
            verifyPayment: vi.fn(),
          },
        },
        {
          provide: DomainEventPublisher,
          useValue: {
            publish: vi.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            createLogger: vi.fn(() => ({
              log: vi.fn(),
              error: vi.fn(),
              warn: vi.fn(),
              info: vi.fn(),
              debug: vi.fn(),
              verbose: vi.fn(),
            })),
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

    service = module.get<PayoutService>(PayoutService);
    mockPayoutRepository = module.get<PayoutRepository>(PayoutRepository);
    mockPayoutPolicyService = module.get<PayoutPolicyService>(PayoutPolicyService);
    mockPaymentGateway = module.get<PaymentGateway>(PaymentGateway);
    mockDomainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    mockLoggerService = module.get<LoggerService>(LoggerService);

    // Setup default mocks
    vi.mocked(mockPayoutRepository.findByBookingId).mockResolvedValue([]);
    vi.mocked(mockPayoutRepository.findByExtensionId).mockResolvedValue([]);
    vi.mocked(mockPayoutPolicyService.canInitiatePayout).mockReturnValue({
      isEligible: true,
      reason: "",
    });
    vi.mocked(mockPayoutPolicyService.generatePayoutReference).mockReturnValue("PAY-REF-123");
    vi.spyOn(Payout, "create").mockReturnValue(mockPayout);
    vi.spyOn(BankAccount, "create").mockReturnValue(mockBankAccount);
  });

  describe("initiatePayout", () => {
    it("should initiate payout successfully for booking", async () => {
      const successResponse = PaymentGatewayResponse.success("gateway-ref-123", "Payout initiated");
      vi.mocked(mockPaymentGateway.initiatePayout).mockResolvedValue(successResponse);

      await service.initiatePayout(mockInitiatePayoutCommand);

      expect(BankAccount.create).toHaveBeenCalledWith(
        "044",
        "1234567890",
        "Access Bank",
        "John Doe",
        true,
      );
      expect(mockPayoutRepository.findByBookingId).toHaveBeenCalledWith("booking-123");
      expect(mockPayoutPolicyService.canInitiatePayout).toHaveBeenCalledWith(
        50000,
        mockBankAccount,
        [],
      );
      expect(Payout.create).toHaveBeenCalledWith(
        "fleet-owner-123",
        50000,
        mockBankAccount,
        "booking-123",
        undefined,
      );
      expect(mockPayoutPolicyService.generatePayoutReference).toHaveBeenCalledWith(
        "booking-123",
        undefined,
      );
      expect(mockPaymentGateway.initiatePayout).toHaveBeenCalledWith({
        bankAccount: mockBankAccount,
        amount: 50000,
        reference: "PAY-REF-123",
        narration: "Payout for booking booking-123",
      });
      expect(mockPayout.initiate).toHaveBeenCalledWith("gateway-ref-123");
      expect(mockPayoutRepository.save).toHaveBeenCalledWith(mockPayout);
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(mockPayout);
    });

    it("should initiate payout successfully for extension", async () => {
      const extensionCommand = {
        ...mockInitiatePayoutCommand,
        bookingId: undefined,
        extensionId: "extension-123",
      };
      const successResponse = PaymentGatewayResponse.success("gateway-ref-123", "Payout initiated");
      vi.mocked(mockPaymentGateway.initiatePayout).mockResolvedValue(successResponse);

      await service.initiatePayout(extensionCommand);

      expect(mockPayoutRepository.findByExtensionId).toHaveBeenCalledWith("extension-123");
      expect(mockPayoutPolicyService.generatePayoutReference).toHaveBeenCalledWith(
        undefined,
        "extension-123",
      );
      expect(mockPaymentGateway.initiatePayout).toHaveBeenCalledWith({
        bankAccount: mockBankAccount,
        amount: 50000,
        reference: "PAY-REF-123",
        narration: "Payout for extension extension-123",
      });
    });

    it("should handle payout eligibility failure", async () => {
      vi.mocked(mockPayoutPolicyService.canInitiatePayout).mockReturnValue({
        isEligible: false,
        reason: "Insufficient balance",
      });

      await expect(service.initiatePayout(mockInitiatePayoutCommand)).rejects.toThrow(
        "Payout not eligible: Insufficient balance",
      );
      expect(mockPaymentGateway.initiatePayout).not.toHaveBeenCalled();
      expect(mockPayoutRepository.save).not.toHaveBeenCalled();
    });

    it("should handle payment gateway failure", async () => {
      const failureResponse = PaymentGatewayResponse.failure("Gateway error");
      vi.mocked(mockPaymentGateway.initiatePayout).mockResolvedValue(failureResponse);

      await service.initiatePayout(mockInitiatePayoutCommand);

      expect(mockPayout.markAsFailed).toHaveBeenCalledWith("Gateway error");
      expect(mockPayoutRepository.save).toHaveBeenCalledWith(mockPayout);
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(mockPayout);
    });

    it("should handle invalid amount", async () => {
      const invalidCommand = { ...mockInitiatePayoutCommand, amount: -100 };

      await expect(service.initiatePayout(invalidCommand)).rejects.toThrow();
      expect(mockPaymentGateway.initiatePayout).not.toHaveBeenCalled();
    });

    it("should handle existing payouts validation", async () => {
      const existingPayouts = [mockPayout];
      vi.mocked(mockPayoutRepository.findByBookingId).mockResolvedValue(existingPayouts);
      vi.mocked(mockPayoutPolicyService.canInitiatePayout).mockReturnValue({
        isEligible: false,
        reason: "Payout already exists",
      });

      await expect(service.initiatePayout(mockInitiatePayoutCommand)).rejects.toThrow(
        "Payout not eligible: Payout already exists",
      );
      expect(mockPayoutPolicyService.canInitiatePayout).toHaveBeenCalledWith(
        50000,
        mockBankAccount,
        existingPayouts,
      );
    });

    it("should handle general errors", async () => {
      const error = new Error("Database connection failed");
      vi.mocked(mockPayoutRepository.findByBookingId).mockRejectedValue(error);

      await expect(service.initiatePayout(mockInitiatePayoutCommand)).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("processPendingPayouts", () => {
    it("should process pending payouts successfully", async () => {
      const pendingPayouts = [
        mockPayout,
        { ...mockPayout, getId: vi.fn(() => ({ value: "payout-456" })) },
      ];
      const successResponse = PaymentGatewayResponse.success("gateway-ref-123", "Payout initiated");

      vi.mocked(mockPayoutRepository.findPendingPayouts).mockResolvedValue(
        pendingPayouts as Payout[],
      );
      vi.mocked(mockPaymentGateway.initiatePayout).mockResolvedValue(successResponse);

      const result = await service.processPendingPayouts();

      expect(mockPayoutRepository.findPendingPayouts).toHaveBeenCalled();
      expect(mockPayoutPolicyService.generatePayoutReference).toHaveBeenCalledTimes(2);
      expect(mockPaymentGateway.initiatePayout).toHaveBeenCalledTimes(2);
      expect(mockPayout.initiate).toHaveBeenCalledWith("gateway-ref-123");
      expect(mockPayoutRepository.save).toHaveBeenCalledTimes(2);
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledTimes(2);
      expect(result).toBe("Processed pending payouts: 2 successful, 0 failed");
    });

    it("should handle mixed success and failure in pending payouts", async () => {
      const pendingPayouts = [
        mockPayout,
        { ...mockPayout, getId: vi.fn(() => ({ value: "payout-456" })) },
      ];
      const successResponse = PaymentGatewayResponse.success("gateway-ref-123", "Payout initiated");
      const failureResponse = PaymentGatewayResponse.failure("Gateway error");

      vi.mocked(mockPayoutRepository.findPendingPayouts).mockResolvedValue(
        pendingPayouts as Payout[],
      );
      vi.mocked(mockPaymentGateway.initiatePayout)
        .mockResolvedValueOnce(successResponse)
        .mockResolvedValueOnce(failureResponse);

      const result = await service.processPendingPayouts();

      expect(mockPayout.initiate).toHaveBeenCalledWith("gateway-ref-123");
      expect(mockPayout.markAsFailed).toHaveBeenCalledWith("Gateway error");
      expect(result).toBe("Processed pending payouts: 1 successful, 1 failed");
    });

    it("should handle errors during processing", async () => {
      const pendingPayouts = [mockPayout];
      const error = new Error("Processing error");

      vi.mocked(mockPayoutRepository.findPendingPayouts).mockResolvedValue(
        pendingPayouts as Payout[],
      );
      vi.mocked(mockPaymentGateway.initiatePayout).mockRejectedValue(error);

      const result = await service.processPendingPayouts();

      expect(result).toBe("Processed pending payouts: 0 successful, 1 failed");
    });

    it("should handle empty pending payouts", async () => {
      vi.mocked(mockPayoutRepository.findPendingPayouts).mockResolvedValue([]);

      const result = await service.processPendingPayouts();

      expect(mockPaymentGateway.initiatePayout).not.toHaveBeenCalled();
      expect(result).toBe("Processed pending payouts: 0 successful, 0 failed");
    });
  });

  describe("retryFailedPayout", () => {
    const payoutId = "payout-123";

    it("should retry failed payout successfully", async () => {
      const failedPayoutStatus = { isFailed: vi.fn(() => true) };
      const failedPayout = {
        ...mockPayout,
        getStatus: vi.fn(() => failedPayoutStatus),
      } as unknown as Payout;

      vi.mocked(mockPayoutRepository.findById).mockResolvedValue(failedPayout);
      vi.spyOn(service, "initiatePayout").mockResolvedValue(undefined);

      await service.retryFailedPayout(payoutId);

      expect(mockPayoutRepository.findById).toHaveBeenCalledWith(PayoutId.create(payoutId));
      expect(failedPayout.retry).toHaveBeenCalled();
      expect(mockPayoutRepository.save).toHaveBeenCalledWith(failedPayout);
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(failedPayout);
      expect(service.initiatePayout).toHaveBeenCalledWith({
        fleetOwnerId: "fleet-owner-123",
        amount: 50000,
        currency: "NGN",
        bankCode: "044",
        accountNumber: "1234567890",
        bankName: "Access Bank",
        accountName: "John Doe",
        bookingId: "booking-123",
        extensionId: undefined,
      });
    });

    it("should throw error when payout not found", async () => {
      vi.mocked(mockPayoutRepository.findById).mockResolvedValue(null);

      await expect(service.retryFailedPayout(payoutId)).rejects.toThrow(
        `Payout not found: ${payoutId}`,
      );
      expect(mockPayout.retry).not.toHaveBeenCalled();
    });

    it("should throw error when payout is not failed", async () => {
      const nonFailedPayoutStatus = { isFailed: vi.fn(() => false) };
      const nonFailedPayout = {
        ...mockPayout,
        getStatus: vi.fn(() => nonFailedPayoutStatus),
      } as unknown as Payout;

      vi.mocked(mockPayoutRepository.findById).mockResolvedValue(nonFailedPayout);

      await expect(service.retryFailedPayout(payoutId)).rejects.toThrow(
        "Can only retry failed payouts",
      );
      expect(nonFailedPayout.retry).not.toHaveBeenCalled();
    });

    it("should handle retry initiation failure", async () => {
      const failedPayoutStatus = { isFailed: vi.fn(() => true) };
      const failedPayout = {
        ...mockPayout,
        getStatus: vi.fn(() => failedPayoutStatus),
      } as unknown as Payout;
      const error = new Error("Retry failed");

      vi.mocked(mockPayoutRepository.findById).mockResolvedValue(failedPayout);
      vi.spyOn(service, "initiatePayout").mockRejectedValue(error);

      await expect(service.retryFailedPayout(payoutId)).rejects.toThrow("Retry failed");
      expect(failedPayout.retry).toHaveBeenCalled();
      expect(mockPayoutRepository.save).toHaveBeenCalledWith(failedPayout);
    });
  });

  describe("saveAndPublishEvents", () => {
    it("should save payout and publish events", async () => {
      await service.initiatePayout(mockInitiatePayoutCommand);

      expect(mockPayoutRepository.save).toHaveBeenCalledWith(mockPayout);
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(mockPayout);
    });

    it("should handle save errors", async () => {
      const error = new Error("Save failed");
      vi.mocked(mockPayoutRepository.save).mockRejectedValue(error);

      await expect(service.initiatePayout(mockInitiatePayoutCommand)).rejects.toThrow(
        "Save failed",
      );
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should handle event publishing errors", async () => {
      const error = new Error("Event publishing failed");
      vi.mocked(mockDomainEventPublisher.publish).mockRejectedValue(error);

      await expect(service.initiatePayout(mockInitiatePayoutCommand)).rejects.toThrow(
        "Event publishing failed",
      );
      expect(mockPayoutRepository.save).toHaveBeenCalledWith(mockPayout);
    });
  });

  describe("logging", () => {
    it("should log successful payout initiation", async () => {
      const successResponse = PaymentGatewayResponse.success("gateway-ref-123", "Payout initiated");
      vi.mocked(mockPaymentGateway.initiatePayout).mockResolvedValue(successResponse);

      await service.initiatePayout(mockInitiatePayoutCommand);

      const logger = mockLoggerService.createLogger(PayoutService.name);
      expect(logger.info).toHaveBeenCalledWith("Payout initiated successfully: payout-123");
    });

    it("should log failed payout initiation", async () => {
      const failureResponse = PaymentGatewayResponse.failure("Gateway error");
      vi.mocked(mockPaymentGateway.initiatePayout).mockResolvedValue(failureResponse);

      await service.initiatePayout(mockInitiatePayoutCommand);

      const logger = mockLoggerService.createLogger(PayoutService.name);
      expect(logger.error).toHaveBeenCalledWith("Payout initiation failed: Gateway error");
    });

    it("should log general errors", async () => {
      const error = new Error("Database error");
      vi.mocked(mockPayoutRepository.findByBookingId).mockRejectedValue(error);

      await expect(service.initiatePayout(mockInitiatePayoutCommand)).rejects.toThrow();

      const logger = mockLoggerService.createLogger(PayoutService.name);
      expect(logger.error).toHaveBeenCalledWith("Failed to initiate payout: Database error");
    });

    it("should log pending payout processing results", async () => {
      vi.mocked(mockPayoutRepository.findPendingPayouts).mockResolvedValue([]);

      const result = await service.processPendingPayouts();

      const logger = mockLoggerService.createLogger(PayoutService.name);
      expect(logger.info).toHaveBeenCalledWith(result);
    });

    it("should log retry initiation", async () => {
      const failedPayoutStatus = { isFailed: vi.fn(() => true) };
      const failedPayout = {
        ...mockPayout,
        getStatus: vi.fn(() => failedPayoutStatus),
      } as unknown as Payout;

      vi.mocked(mockPayoutRepository.findById).mockResolvedValue(failedPayout);
      vi.spyOn(service, "initiatePayout").mockResolvedValue(undefined);

      await service.retryFailedPayout("payout-123");

      const logger = mockLoggerService.createLogger(PayoutService.name);
      expect(logger.info).toHaveBeenCalledWith("Payout retry initiated: payout-123");
    });
  });
});
