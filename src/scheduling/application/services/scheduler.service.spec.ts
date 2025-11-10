import { Test, TestingModule } from "@nestjs/testing";
import { Queue } from "bull";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoggerService } from "../../../shared/logging/logger.service";
import {
  ProcessingJobData,
  ReminderJobData,
  SchedulerService,
  StatusUpdateJobData,
} from "./scheduler.service";

describe("SchedulerService", () => {
  let service: SchedulerService;
  let mockReminderQueue: Queue;
  let mockStatusQueue: Queue;
  let mockProcessingQueue: Queue;
  let mockLoggerService: LoggerService;

  const mockJob = {
    id: "job-123",
    data: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: "BullQueue_reminder-emails",
          useValue: {
            add: vi.fn(),
            getWaiting: vi.fn(),
            getActive: vi.fn(),
            getCompleted: vi.fn(),
            getFailed: vi.fn(),
            getDelayed: vi.fn(),
          },
        },
        {
          provide: "BullQueue_status-updates",
          useValue: {
            add: vi.fn(),
            getWaiting: vi.fn(),
            getActive: vi.fn(),
            getCompleted: vi.fn(),
            getFailed: vi.fn(),
            getDelayed: vi.fn(),
          },
        },
        {
          provide: "BullQueue_processing-jobs",
          useValue: {
            add: vi.fn(),
            getWaiting: vi.fn(),
            getActive: vi.fn(),
            getCompleted: vi.fn(),
            getFailed: vi.fn(),
            getDelayed: vi.fn(),
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

    service = module.get<SchedulerService>(SchedulerService);
    mockReminderQueue = module.get<Queue>("BullQueue_reminder-emails");
    mockStatusQueue = module.get<Queue>("BullQueue_status-updates");
    mockProcessingQueue = module.get<Queue>("BullQueue_processing-jobs");
    mockLoggerService = module.get<LoggerService>(LoggerService);

    // Setup default mocks
    vi.mocked(mockReminderQueue.add).mockResolvedValue(mockJob as never);
    vi.mocked(mockStatusQueue.add).mockResolvedValue(mockJob as never);
    vi.mocked(mockProcessingQueue.add).mockResolvedValue(mockJob as never);
  });

  describe("scheduleBookingLegStartReminders", () => {
    it("should schedule booking leg start reminder job", async () => {
      await service.scheduleBookingLegStartReminders();

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "booking-leg-start-reminder",
        expect.objectContaining({
          type: "leg-start",
          timestamp: expect.any(String),
        }),
        {
          priority: 10,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Scheduled booking leg start reminder job");
    });

    it("should handle queue errors", async () => {
      const error = new Error("Queue error");
      vi.mocked(mockReminderQueue.add).mockRejectedValue(error);

      await expect(service.scheduleBookingLegStartReminders()).rejects.toThrow("Queue error");
    });
  });

  describe("scheduleBookingLegEndReminders", () => {
    it("should schedule booking leg end reminder job", async () => {
      await service.scheduleBookingLegEndReminders();

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "booking-leg-end-reminder",
        expect.objectContaining({
          type: "leg-end",
          timestamp: expect.any(String),
        }),
        {
          priority: 10,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Scheduled booking leg end reminder job");
    });
  });

  describe("scheduleBookingStartReminders", () => {
    it("should schedule booking start reminder job", async () => {
      await service.scheduleBookingStartReminders();

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "booking-start-reminder",
        expect.objectContaining({
          type: "trip-start",
          timestamp: expect.any(String),
        }),
        {
          priority: 8,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Scheduled booking start reminder job");
    });
  });

  describe("scheduleBookingEndReminders", () => {
    it("should schedule booking end reminder job", async () => {
      await service.scheduleBookingEndReminders();

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "booking-end-reminder",
        expect.objectContaining({
          type: "trip-end",
          timestamp: expect.any(String),
        }),
        {
          priority: 8,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Scheduled booking end reminder job");
    });
  });

  describe("scheduleConfirmedToActiveUpdates", () => {
    it("should schedule confirmed to active status update job", async () => {
      await service.scheduleConfirmedToActiveUpdates();

      expect(mockStatusQueue.add).toHaveBeenCalledWith(
        "confirmed-to-active",
        expect.objectContaining({
          type: "confirmed-to-active",
          timestamp: expect.any(String),
        }),
        {
          priority: 15,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Scheduled confirmed to active status update job");
    });
  });

  describe("scheduleActiveToCompletedUpdates", () => {
    it("should schedule active to completed status update job", async () => {
      await service.scheduleActiveToCompletedUpdates();

      expect(mockStatusQueue.add).toHaveBeenCalledWith(
        "active-to-completed",
        expect.objectContaining({
          type: "active-to-completed",
          timestamp: expect.any(String),
        }),
        {
          priority: 15,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Scheduled active to completed status update job");
    });
  });

  describe("schedulePendingPayoutProcessing", () => {
    it("should schedule pending payout processing job", async () => {
      await service.schedulePendingPayoutProcessing();

      expect(mockProcessingQueue.add).toHaveBeenCalledWith(
        "process-pending-payouts",
        expect.objectContaining({
          type: "pending-payouts",
          timestamp: expect.any(String),
        }),
        {
          priority: 20,
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Scheduled pending payout processing job");
    });
  });

  describe("schedulePendingNotificationProcessing", () => {
    it("should schedule pending notification processing job", async () => {
      await service.schedulePendingNotificationProcessing();

      expect(mockProcessingQueue.add).toHaveBeenCalledWith(
        "process-pending-notifications",
        expect.objectContaining({
          type: "pending-notifications",
          timestamp: expect.any(String),
        }),
        {
          priority: 25,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Scheduled pending notification processing job");
    });
  });

  describe("triggerManualReminderJob", () => {
    it("should trigger manual trip-start reminder job", async () => {
      await service.triggerManualReminderJob("trip-start");

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "manual-trip-start-reminder",
        expect.objectContaining({
          type: "trip-start",
          timestamp: expect.any(String),
        }),
        {
          priority: 30,
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Manually triggered trip-start reminder job");
    });

    it("should trigger manual trip-end reminder job", async () => {
      await service.triggerManualReminderJob("trip-end");

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "manual-trip-end-reminder",
        expect.objectContaining({
          type: "trip-end",
          timestamp: expect.any(String),
        }),
        {
          priority: 30,
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Manually triggered trip-end reminder job");
    });

    it("should trigger manual leg-start reminder job", async () => {
      await service.triggerManualReminderJob("leg-start");

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "manual-leg-start-reminder",
        expect.objectContaining({
          type: "leg-start",
          timestamp: expect.any(String),
        }),
        {
          priority: 30,
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Manually triggered leg-start reminder job");
    });

    it("should trigger manual leg-end reminder job", async () => {
      await service.triggerManualReminderJob("leg-end");

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "manual-leg-end-reminder",
        expect.objectContaining({
          type: "leg-end",
          timestamp: expect.any(String),
        }),
        {
          priority: 30,
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Manually triggered leg-end reminder job");
    });

    it("should handle manual job errors", async () => {
      const error = new Error("Manual job error");
      vi.mocked(mockReminderQueue.add).mockRejectedValue(error);

      await expect(service.triggerManualReminderJob("trip-start")).rejects.toThrow(
        "Manual job error",
      );
    });
  });

  describe("triggerManualStatusUpdate", () => {
    it("should trigger manual confirmed-to-active status update", async () => {
      await service.triggerManualStatusUpdate("confirmed-to-active");

      expect(mockStatusQueue.add).toHaveBeenCalledWith(
        "manual-confirmed-to-active",
        expect.objectContaining({
          type: "confirmed-to-active",
          timestamp: expect.any(String),
        }),
        {
          priority: 30,
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith(
        "Manually triggered confirmed-to-active status update job",
      );
    });

    it("should trigger manual active-to-completed status update", async () => {
      await service.triggerManualStatusUpdate("active-to-completed");

      expect(mockStatusQueue.add).toHaveBeenCalledWith(
        "manual-active-to-completed",
        expect.objectContaining({
          type: "active-to-completed",
          timestamp: expect.any(String),
        }),
        {
          priority: 30,
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith(
        "Manually triggered active-to-completed status update job",
      );
    });
  });

  describe("triggerManualProcessing", () => {
    it("should trigger manual pending-payouts processing", async () => {
      await service.triggerManualProcessing("pending-payouts");

      expect(mockProcessingQueue.add).toHaveBeenCalledWith(
        "manual-pending-payouts",
        expect.objectContaining({
          type: "pending-payouts",
          timestamp: expect.any(String),
        }),
        {
          priority: 30,
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith("Manually triggered pending-payouts processing job");
    });

    it("should trigger manual pending-notifications processing", async () => {
      await service.triggerManualProcessing("pending-notifications");

      expect(mockProcessingQueue.add).toHaveBeenCalledWith(
        "manual-pending-notifications",
        expect.objectContaining({
          type: "pending-notifications",
          timestamp: expect.any(String),
        }),
        {
          priority: 30,
        },
      );

      const logger = mockLoggerService.createLogger(SchedulerService.name);
      expect(logger.info).toHaveBeenCalledWith(
        "Manually triggered pending-notifications processing job",
      );
    });
  });

  describe("getQueueStats", () => {
    beforeEach(() => {
      // Setup queue statistics mocks
      vi.mocked(mockReminderQueue.getWaiting).mockResolvedValue([mockJob] as never);
      vi.mocked(mockReminderQueue.getActive).mockResolvedValue([mockJob, mockJob] as never);
      vi.mocked(mockReminderQueue.getCompleted).mockResolvedValue([
        mockJob,
        mockJob,
        mockJob,
      ] as never);
      vi.mocked(mockReminderQueue.getFailed).mockResolvedValue([] as never);
      vi.mocked(mockReminderQueue.getDelayed).mockResolvedValue([mockJob] as never);

      vi.mocked(mockStatusQueue.getWaiting).mockResolvedValue([] as never);
      vi.mocked(mockStatusQueue.getActive).mockResolvedValue([mockJob] as never);
      vi.mocked(mockStatusQueue.getCompleted).mockResolvedValue([mockJob, mockJob] as never);
      vi.mocked(mockStatusQueue.getFailed).mockResolvedValue([mockJob] as never);
      vi.mocked(mockStatusQueue.getDelayed).mockResolvedValue([] as never);

      vi.mocked(mockProcessingQueue.getWaiting).mockResolvedValue([mockJob, mockJob] as never);
      vi.mocked(mockProcessingQueue.getActive).mockResolvedValue([] as never);
      vi.mocked(mockProcessingQueue.getCompleted).mockResolvedValue([mockJob] as never);
      vi.mocked(mockProcessingQueue.getFailed).mockResolvedValue([] as never);
      vi.mocked(mockProcessingQueue.getDelayed).mockResolvedValue([mockJob] as never);
    });

    it("should return queue statistics", async () => {
      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        timestamp: expect.any(String),
        queues: {
          "reminder-emails": {
            waiting: 1,
            active: 2,
            completed: 3,
            failed: 0,
            delayed: 1,
          },
          "status-updates": {
            waiting: 0,
            active: 1,
            completed: 2,
            failed: 1,
            delayed: 0,
          },
          "processing-jobs": {
            waiting: 2,
            active: 0,
            completed: 1,
            failed: 0,
            delayed: 1,
          },
        },
      });

      expect(mockReminderQueue.getWaiting).toHaveBeenCalled();
      expect(mockReminderQueue.getActive).toHaveBeenCalled();
      expect(mockReminderQueue.getCompleted).toHaveBeenCalled();
      expect(mockReminderQueue.getFailed).toHaveBeenCalled();
      expect(mockReminderQueue.getDelayed).toHaveBeenCalled();

      expect(mockStatusQueue.getWaiting).toHaveBeenCalled();
      expect(mockStatusQueue.getActive).toHaveBeenCalled();
      expect(mockStatusQueue.getCompleted).toHaveBeenCalled();
      expect(mockStatusQueue.getFailed).toHaveBeenCalled();
      expect(mockStatusQueue.getDelayed).toHaveBeenCalled();

      expect(mockProcessingQueue.getWaiting).toHaveBeenCalled();
      expect(mockProcessingQueue.getActive).toHaveBeenCalled();
      expect(mockProcessingQueue.getCompleted).toHaveBeenCalled();
      expect(mockProcessingQueue.getFailed).toHaveBeenCalled();
      expect(mockProcessingQueue.getDelayed).toHaveBeenCalled();
    });

    it("should handle queue statistics errors", async () => {
      const error = new Error("Queue stats error");
      vi.mocked(mockReminderQueue.getWaiting).mockRejectedValue(error);

      await expect(service.getQueueStats()).rejects.toThrow("Queue stats error");
    });
  });

  describe("job data validation", () => {
    it("should create valid ReminderJobData", async () => {
      await service.scheduleBookingStartReminders();

      const addCall = vi.mocked(mockReminderQueue.add).mock.calls[0];
      const jobData = addCall[1] as ReminderJobData;

      expect(jobData.type).toBe("trip-start");
      expect(jobData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should create valid StatusUpdateJobData", async () => {
      await service.scheduleConfirmedToActiveUpdates();

      const addCall = vi.mocked(mockStatusQueue.add).mock.calls[0];
      const jobData = addCall[1] as StatusUpdateJobData;

      expect(jobData.type).toBe("confirmed-to-active");
      expect(jobData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should create valid ProcessingJobData", async () => {
      await service.schedulePendingPayoutProcessing();

      const addCall = vi.mocked(mockProcessingQueue.add).mock.calls[0];
      const jobData = addCall[1] as ProcessingJobData;

      expect(jobData.type).toBe("pending-payouts");
      expect(jobData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe("job priorities and configurations", () => {
    it("should use correct priority for reminder jobs", async () => {
      await service.scheduleBookingLegStartReminders();
      await service.scheduleBookingStartReminders();

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "booking-leg-start-reminder",
        expect.any(Object),
        expect.objectContaining({ priority: 10 }),
      );

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "booking-start-reminder",
        expect.any(Object),
        expect.objectContaining({ priority: 8 }),
      );
    });

    it("should use correct priority for status update jobs", async () => {
      await service.scheduleConfirmedToActiveUpdates();

      expect(mockStatusQueue.add).toHaveBeenCalledWith(
        "confirmed-to-active",
        expect.any(Object),
        expect.objectContaining({ priority: 15 }),
      );
    });

    it("should use correct priority for processing jobs", async () => {
      await service.schedulePendingPayoutProcessing();
      await service.schedulePendingNotificationProcessing();

      expect(mockProcessingQueue.add).toHaveBeenCalledWith(
        "process-pending-payouts",
        expect.any(Object),
        expect.objectContaining({ priority: 20 }),
      );

      expect(mockProcessingQueue.add).toHaveBeenCalledWith(
        "process-pending-notifications",
        expect.any(Object),
        expect.objectContaining({ priority: 25 }),
      );
    });

    it("should use higher priority for manual jobs", async () => {
      await service.triggerManualReminderJob("trip-start");
      await service.triggerManualStatusUpdate("confirmed-to-active");
      await service.triggerManualProcessing("pending-payouts");

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "manual-trip-start-reminder",
        expect.any(Object),
        expect.objectContaining({ priority: 30 }),
      );

      expect(mockStatusQueue.add).toHaveBeenCalledWith(
        "manual-confirmed-to-active",
        expect.any(Object),
        expect.objectContaining({ priority: 30 }),
      );

      expect(mockProcessingQueue.add).toHaveBeenCalledWith(
        "manual-pending-payouts",
        expect.any(Object),
        expect.objectContaining({ priority: 30 }),
      );
    });

    it("should configure backoff strategy correctly", async () => {
      await service.scheduleBookingStartReminders();

      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        "booking-start-reminder",
        expect.any(Object),
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        }),
      );
    });

    it("should configure different backoff for payout processing", async () => {
      await service.schedulePendingPayoutProcessing();

      expect(mockProcessingQueue.add).toHaveBeenCalledWith(
        "process-pending-payouts",
        expect.any(Object),
        expect.objectContaining({
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        }),
      );
    });
  });
});
