import { CarDocumentValidationError } from "../errors/fleet.errors";

export enum DocumentType {
  CAR_IMAGE = "CAR_IMAGE",
  MOT_CERTIFICATE = "MOT_CERTIFICATE",
  INSURANCE_CERTIFICATE = "INSURANCE_CERTIFICATE",
}

export enum DocumentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export class CarDocument {
  private constructor(
    private readonly type: DocumentType,
    private readonly url: string,
    private readonly fileName: string,
    private readonly contentType: string,
    private readonly status: DocumentStatus = DocumentStatus.PENDING,
  ) {
    this.validateUrl();
    this.validateContentType();
  }

  public static createCarImage(url: string, fileName: string, contentType: string): CarDocument {
    return new CarDocument(DocumentType.CAR_IMAGE, url, fileName, contentType);
  }

  public static createMotCertificate(url: string, fileName: string): CarDocument {
    return new CarDocument(DocumentType.MOT_CERTIFICATE, url, fileName, "application/pdf");
  }

  public static createInsuranceCertificate(url: string, fileName: string): CarDocument {
    return new CarDocument(DocumentType.INSURANCE_CERTIFICATE, url, fileName, "application/pdf");
  }

  public getType(): DocumentType {
    return this.type;
  }

  public getUrl(): string {
    return this.url;
  }

  public getFileName(): string {
    return this.fileName;
  }

  public getContentType(): string {
    return this.contentType;
  }

  public getStatus(): DocumentStatus {
    return this.status;
  }

  public isImage(): boolean {
    return this.type === DocumentType.CAR_IMAGE;
  }

  public isCertificate(): boolean {
    return (
      this.type === DocumentType.MOT_CERTIFICATE || this.type === DocumentType.INSURANCE_CERTIFICATE
    );
  }

  private validateUrl(): void {
    if (!this.url || this.url.trim().length === 0) {
      throw new CarDocumentValidationError("URL", "Document URL cannot be empty");
    }

    try {
      new URL(this.url);
    } catch {
      throw new CarDocumentValidationError("URL", "Document URL must be a valid URL", {
        url: this.url,
      });
    }
  }

  private validateContentType(): void {
    if (this.isImage()) {
      const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validImageTypes.includes(this.contentType.toLowerCase())) {
        throw new CarDocumentValidationError(
          "contentType",
          `Invalid image content type: ${this.contentType}. Allowed: ${validImageTypes.join(", ")}`,
          { contentType: this.contentType, validTypes: validImageTypes },
        );
      }
    }

    if (this.isCertificate() && this.contentType !== "application/pdf") {
      throw new CarDocumentValidationError(
        "contentType",
        `Certificate documents must be PDF, got: ${this.contentType}`,
        { contentType: this.contentType, expectedType: "application/pdf" },
      );
    }
  }

  public equals(other: CarDocument): boolean {
    return this.type === other.type && this.url === other.url && this.fileName === other.fileName;
  }
}
