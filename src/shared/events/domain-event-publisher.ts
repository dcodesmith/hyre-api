import { Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { DomainEvent } from "./domain-event";

/**
 * Interface for aggregates that can publish domain events
 */
export interface EventSourcedAggregate {
  getUncommittedEvents(): DomainEvent[];
  markEventsAsCommitted(): void;
}

/**
 * Domain service for publishing domain events
 * Provides a consistent abstraction over the CQRS EventBus
 */
@Injectable()
export class DomainEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  /**
   * Universal publish method that handles:
   * - Single domain events
   * - Arrays of domain events
   * - Event-sourced aggregates
   */
  async publish(input: DomainEvent | DomainEvent[] | EventSourcedAggregate): Promise<void> {
    // Handle aggregate
    if (this.isEventSourcedAggregate(input)) {
      const events = input.getUncommittedEvents();
      if (events.length > 0) {
        await this.publishEvents(events);
        input.markEventsAsCommitted();
      }
      return;
    }

    // Handle array of events
    if (Array.isArray(input)) {
      await this.publishEvents(input);
      return;
    }

    // Handle single event
    await this.eventBus.publish(input);
  }

  /**
   * Publish events from multiple aggregates atomically
   */
  async publishAll(aggregates: EventSourcedAggregate[]): Promise<void> {
    const allEvents: DomainEvent[] = [];

    // Collect all events first
    for (const aggregate of aggregates) {
      allEvents.push(...aggregate.getUncommittedEvents());
    }

    // Publish all events concurrently
    if (allEvents.length > 0) {
      await this.publishEvents(allEvents);

      // Mark all aggregates as committed
      for (const aggregate of aggregates) {
        aggregate.markEventsAsCommitted();
      }
    }
  }

  private async publishEvents(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    await Promise.all(events.map((event) => this.eventBus.publish(event)));
  }

  private isEventSourcedAggregate(input: any): input is EventSourcedAggregate {
    return (
      input &&
      typeof input.getUncommittedEvents === "function" &&
      typeof input.markEventsAsCommitted === "function"
    );
  }
}
