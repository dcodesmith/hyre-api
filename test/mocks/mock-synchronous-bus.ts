import { Injectable } from "@nestjs/common";
import { EventBus, IEvent } from "@nestjs/cqrs";

/**
 * Synchronous EventBus for e2e testing.
 *
 * In NestJS CQRS v11+, EventBus uses RxJS observables and a publisher pattern.
 * We override publish() to wait for the event to be processed before returning.
 */
@Injectable()
export class SynchronousEventBus extends EventBus {
  private static readonly EVENT_HANDLER_TIMEOUT_MS = 100;

  async publish<T extends IEvent>(event: T): Promise<void> {
    // Publish the event
    this.subject$.next(event);

    // Wait for handlers to be invoked and complete
    // setImmediate ensures we wait for the next event loop tick
    await new Promise((resolve) => setImmediate(resolve));

    // Additional tick to ensure all microtasks are processed
    await new Promise((resolve) => process.nextTick(resolve));

    // 3. Small timeout as a final safety net for any lingering async operations
    // This is crucial for Prisma operations which may take longer to complete
    await new Promise((resolve) =>
      setTimeout(resolve, SynchronousEventBus.EVENT_HANDLER_TIMEOUT_MS),
    );
  }

  async publishAll<T extends IEvent>(events: T[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
