import { BaseDomainError } from "./base-domain.error";

export abstract class DocumentDomainError extends BaseDomainError {
  readonly context = "Document";
}

export class DocumentValidationError extends DocumentDomainError {
  readonly code = "DOCUMENT_VALIDATION_ERROR";
}

export class DocumentNotFoundError extends DocumentDomainError {
  readonly code = "DOCUMENT_NOT_FOUND";

  constructor(documentId: string) {
    super(`Document not found: ${documentId}`, { documentId });
  }
}

export class DocumentApprovalError extends DocumentDomainError {
  readonly code = "DOCUMENT_APPROVAL_ERROR";

  constructor(documentId: string, currentStatus: string, action: string) {
    super(`Cannot ${action} document ${documentId}: document is ${currentStatus}`, {
      documentId,
      currentStatus,
      action,
    });
  }
}

export class DocumentUploadError extends DocumentDomainError {
  readonly code = "DOCUMENT_UPLOAD_ERROR";

  constructor(fileName: string, reason: string) {
    super(`Failed to upload document ${fileName}: ${reason}`, { fileName, reason });
  }
}
