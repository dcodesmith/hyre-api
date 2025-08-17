import { AggregateRoot } from "../aggregate-root";
import { DocumentValidationError } from "../errors/document.errors";

export enum DocumentType {
  NIN = "NIN",
  DRIVERS_LICENSE = "DRIVERS_LICENSE",
  MOT_CERTIFICATE = "MOT_CERTIFICATE",
  INSURANCE_CERTIFICATE = "INSURANCE_CERTIFICATE",
  VEHICLE_IMAGES = "VEHICLE_IMAGES",
  CERTIFICATE_OF_INCORPORATION = "CERTIFICATE_OF_INCORPORATION",
}

export enum DocumentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface DocumentApprovalProps {
  id?: string;
  documentType: DocumentType;
  status: DocumentStatus;
  documentUrl: string;
  notes?: string;
  approvedById?: string;
  approvedAt?: Date;
  userId?: string;
  carId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentApproval extends AggregateRoot {
  private constructor(private props: DocumentApprovalProps) {
    super();
    this.validateDocument();
  }

  public static create(
    documentType: DocumentType,
    documentUrl: string,
    userId?: string,
    carId?: string,
    notes?: string,
  ): DocumentApproval {
    const document = new DocumentApproval({
      documentType,
      status: DocumentStatus.PENDING,
      documentUrl,
      notes,
      userId,
      carId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return document;
  }

  public static reconstitute(props: DocumentApprovalProps): DocumentApproval {
    return new DocumentApproval(props);
  }

  // Getters
  public getId(): string {
    return this.props.id;
  }

  public getDocumentType(): DocumentType {
    return this.props.documentType;
  }

  public getStatus(): DocumentStatus {
    return this.props.status;
  }

  public getDocumentUrl(): string {
    return this.props.documentUrl;
  }

  public getNotes(): string | undefined {
    return this.props.notes;
  }

  public getApprovedById(): string | undefined {
    return this.props.approvedById;
  }

  public getApprovedAt(): Date | undefined {
    return this.props.approvedAt;
  }

  public getUserId(): string | undefined {
    return this.props.userId;
  }

  public getCarId(): string | undefined {
    return this.props.carId;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public approve(approvedById: string, notes?: string): void {
    if (!this.canBeApproved()) {
      throw new DocumentValidationError(
        `Document cannot be approved in current status: ${this.props.status}`,
      );
    }

    this.props.status = DocumentStatus.APPROVED;
    this.props.approvedById = approvedById;
    this.props.approvedAt = new Date();
    if (notes) this.props.notes = notes;
    this.props.updatedAt = new Date();
  }

  public reject(rejectedById: string, reason: string): void {
    if (!this.canBeRejected()) {
      throw new DocumentValidationError(
        `Document cannot be rejected in current status: ${this.props.status}`,
      );
    }

    this.props.status = DocumentStatus.REJECTED;
    this.props.approvedById = rejectedById;
    this.props.notes = reason;
    this.props.updatedAt = new Date();
  }

  public updateNotes(notes: string): void {
    this.props.notes = notes;
    this.props.updatedAt = new Date();
  }

  // Status checks
  public isApproved(): boolean {
    return this.props.status === DocumentStatus.APPROVED;
  }

  public isPending(): boolean {
    return this.props.status === DocumentStatus.PENDING;
  }

  public isRejected(): boolean {
    return this.props.status === DocumentStatus.REJECTED;
  }

  public canBeApproved(): boolean {
    return this.props.status === DocumentStatus.PENDING;
  }

  public canBeRejected(): boolean {
    return this.props.status === DocumentStatus.PENDING;
  }

  // Validation
  private validateDocument(): void {
    if (!this.props.documentUrl || this.props.documentUrl.trim().length === 0) {
      throw new DocumentValidationError("Document URL is required");
    }

    try {
      new URL(this.props.documentUrl);
    } catch {
      throw new DocumentValidationError("Document URL must be a valid URL");
    }

    if (this.props.userId && this.props.carId) {
      throw new DocumentValidationError("Document cannot belong to both user and car");
    }

    if (!this.props.userId && !this.props.carId) {
      throw new DocumentValidationError("Document must belong to either user or car");
    }

    this.validateDocumentType();
  }

  private validateDocumentType(): void {
    const userDocTypes = [
      DocumentType.NIN,
      DocumentType.DRIVERS_LICENSE,
      DocumentType.CERTIFICATE_OF_INCORPORATION,
    ];

    const carDocTypes = [
      DocumentType.MOT_CERTIFICATE,
      DocumentType.INSURANCE_CERTIFICATE,
      DocumentType.VEHICLE_IMAGES,
    ];

    if (this.props.userId && !userDocTypes.includes(this.props.documentType)) {
      throw new DocumentValidationError(
        `Document type ${this.props.documentType} is not valid for user documents`,
      );
    }

    if (this.props.carId && !carDocTypes.includes(this.props.documentType)) {
      throw new DocumentValidationError(
        `Document type ${this.props.documentType} is not valid for car documents`,
      );
    }
  }

  // Type-specific validations
  public isUserDocument(): boolean {
    return !!this.props.userId;
  }

  public isCarDocument(): boolean {
    return !!this.props.carId;
  }

  public isOnboardingDocument(): boolean {
    return this.props.documentType === DocumentType.CERTIFICATE_OF_INCORPORATION;
  }

  // Utility methods
  public toSummary(): {
    id: string;
    type: string;
    status: string;
    url: string;
    notes?: string;
    approvedAt?: Date;
  } {
    return {
      id: this.props.id,
      type: this.props.documentType,
      status: this.props.status,
      url: this.props.documentUrl,
      notes: this.props.notes,
      approvedAt: this.props.approvedAt,
    };
  }
}
