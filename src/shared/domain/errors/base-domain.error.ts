export abstract class BaseDomainError extends Error {
  abstract readonly code: string;
  abstract readonly context: string;

  constructor(
    message: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
