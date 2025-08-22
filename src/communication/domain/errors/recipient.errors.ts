import { BaseDomainError } from "../../../shared/domain/errors/base-domain.error";

export abstract class RecipientDomainError extends BaseDomainError {
  readonly context = "recipient";
}

export class RecipientIdRequiredError extends RecipientDomainError {
  readonly code = "RECIPIENT_ID_REQUIRED";
  constructor() {
    super("Recipient ID cannot be empty");
  }
}

export class RecipientNameRequiredError extends RecipientDomainError {
  readonly code = "RECIPIENT_NAME_REQUIRED";
  constructor() {
    super("Recipient name cannot be empty");
  }
}

export class RecipientContactRequiredError extends RecipientDomainError {
  readonly code = "RECIPIENT_CONTACT_REQUIRED";
  constructor() {
    super("Recipient must have either email or phone number");
  }
}
