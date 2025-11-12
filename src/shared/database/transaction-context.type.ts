/**
 * Transaction context type for Prisma transactions
 *
 * This type represents the Prisma transaction client that is passed to
 * repository methods that need to execute within a transaction context.
 *
 * It is extracted from Prisma's $transaction callback parameter type to
 * ensure type safety across all repository implementations.
 *
 * @example
 * ```typescript
 * async saveWithTransaction(entity: Entity, tx: TransactionContext): Promise<Entity> {
 *   return tx.entity.create({ data: entityData });
 * }
 * ```
 */
export type TransactionContext = Parameters<
  Parameters<import("@prisma/client").PrismaClient["$transaction"]>[0]
>[0];
