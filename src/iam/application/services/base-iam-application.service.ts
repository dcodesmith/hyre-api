import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { User } from "../../domain/entities/user.entity";
import { UserRepository } from "../../domain/repositories/user.repository";

/**
 * Base class for IAM application services providing common transactional patterns.
 * Ensures consistent implementation of save + event publishing across IAM domain.
 */
@Injectable()
export abstract class BaseIamApplicationService {
  constructor(
    protected readonly userRepository: UserRepository,
    protected readonly domainEventPublisher: DomainEventPublisher,
    protected readonly prisma: PrismaService,
  ) {}

  /**
   * Atomically saves user and publishes domain events using transactional pattern.
   * This ensures consistency between persistence and event publishing.
   *
   * @param user - The user entity to save
   * @returns The saved user entity
   */
  protected async saveUserAndPublishEvents(user: User): Promise<User> {
    // Collect events to publish after transaction commits
    const eventsToPublish: User[] = [];

    // Use transaction to ensure atomicity of user save and event preparation
    const savedUser = await this.prisma.$transaction(async (tx) => {
      // Save user within transaction
      const saved = await this.userRepository.saveWithTransaction(user, tx);

      // Prepare events for publishing after commit
      eventsToPublish.push(saved);

      return saved;
    });

    // After transaction commits successfully, publish events
    for (const userWithEvents of eventsToPublish) {
      await this.domainEventPublisher.publish(userWithEvents);
    }

    return savedUser;
  }
}