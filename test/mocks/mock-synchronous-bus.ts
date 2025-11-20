// // src/test/utils/synchronous-event-bus.ts
// import { Injectable } from "@nestjs/common";
// import { EventBus, IEvent } from "@nestjs/cqrs";

/**
 * A test-only implementation of EventBus that runs event handlers
 * synchronously and awaits their completion before returning from publish().
 * This synchronizes event processing for e2e tests.
 *
 * In NestJS CQRS v11+, EventBus uses RxJS observables and a publisher pattern.
 * Event handlers are executed asynchronously via the observable stream.
 * We add a delay to allow handlers to complete before returning.
 */
// @Injectable()
// export class SynchronousEventBus extends EventBus {
//   /**
//    * Overrides the default publish method to make it synchronous.
//    * Waits for event handlers to complete before returning.
//    *
//    * @param event The event to publish.
//    */
//   async publish<T extends IEvent>(event: T): Promise<void> {
//     // Call the parent's publish method which emits to the RxJS stream
//     super.publish(event);

//     // Wait for async operations to complete using multiple strategies:

//     // 1. setImmediate allows I/O operations to complete
//     await new Promise((resolve) => setImmediate(resolve));

//     // 2. Additional tick to ensure all microtasks are processed
//     await new Promise((resolve) => process.nextTick(resolve));

//     // 3. Small timeout as a final safety net for any lingering async operations
//     // This is crucial for Prisma operations which may take longer to complete
//     await new Promise((resolve) => setTimeout(resolve));
//   }

//   /**
//    * Overrides publishAll to make it synchronous as well
//    */
//   async publishAll<T extends IEvent>(events: T[]): Promise<void> {
//     // Publish events sequentially to ensure proper ordering
//     for (const event of events) {
//       await this.publish(event);
//     }
//   }
// }
// test/utils/synchronous-event-bus.ts
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
  async publish<T extends IEvent>(event: T): Promise<void> {
    // Publish the event
    this.subject$.next(event);

    // Wait for handlers to be invoked and complete
    // setImmediate ensures we wait for the next event loop tick
    await new Promise((resolve) => setImmediate(resolve));

    // Additional small delay to ensure async operations in handlers complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async publishAll<T extends IEvent>(events: T[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
