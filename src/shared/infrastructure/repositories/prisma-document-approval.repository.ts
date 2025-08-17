import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  DocumentApproval,
  DocumentStatus,
  DocumentType,
} from "../../domain/entities/document-approval.entity";
import { DocumentApprovalRepository } from "../../domain/repositories/document-approval.repository";

@Injectable()
export class PrismaDocumentApprovalRepository implements DocumentApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(document: DocumentApproval): Promise<DocumentApproval> {
    const documentId = document.getId();
    const data = {
      documentType: document.getDocumentType(),
      status: document.getStatus(),
      documentUrl: document.getDocumentUrl(),
      notes: document.getNotes(),
      approvedById: document.getApprovedById(),
      approvedAt: document.getApprovedAt(),
      userId: document.getUserId(),
      carId: document.getCarId(),
      updatedAt: document.getUpdatedAt(),
    };

    if (documentId) {
      // Update existing document
      const updated = await this.prisma.documentApproval.update({
        where: { id: documentId },
        data,
      });
      return this.toDomainEntity(updated);
    } else {
      // Create new document
      const created = await this.prisma.documentApproval.create({
        data: {
          ...data,
          createdAt: document.getCreatedAt(),
        },
      });
      return this.toDomainEntity(created);
    }
  }

  async findById(id: string): Promise<DocumentApproval | null> {
    const document = await this.prisma.documentApproval.findUnique({
      where: { id },
    });

    if (!document) {
      return null;
    }

    return this.toDomainEntity(document);
  }

  async findByUserIdAndType(userId: string, type: DocumentType): Promise<DocumentApproval | null> {
    const document = await this.prisma.documentApproval.findUnique({
      where: {
        documentType_userId: {
          documentType: type,
          userId: userId,
        },
      },
    });

    if (!document) {
      return null;
    }

    return this.toDomainEntity(document);
  }

  async findByCarIdAndType(carId: string, type: DocumentType): Promise<DocumentApproval | null> {
    const document = await this.prisma.documentApproval.findUnique({
      where: {
        documentType_carId: {
          documentType: type,
          carId: carId,
        },
      },
    });

    if (!document) {
      return null;
    }

    return this.toDomainEntity(document);
  }

  async findByUserId(userId: string): Promise<DocumentApproval[]> {
    const documents = await this.prisma.documentApproval.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return documents.map((doc) => this.toDomainEntity(doc));
  }

  async findByCarId(carId: string): Promise<DocumentApproval[]> {
    const documents = await this.prisma.documentApproval.findMany({
      where: { carId },
      orderBy: { createdAt: "desc" },
    });

    return documents.map((doc) => this.toDomainEntity(doc));
  }

  async findPendingDocuments(): Promise<DocumentApproval[]> {
    const documents = await this.prisma.documentApproval.findMany({
      where: { status: DocumentStatus.PENDING },
      orderBy: { createdAt: "asc" },
    });

    return documents.map((doc) => this.toDomainEntity(doc));
  }

  async update(document: DocumentApproval): Promise<DocumentApproval> {
    const updated = await this.prisma.documentApproval.update({
      where: { id: document.getId() },
      data: {
        documentType: document.getDocumentType(),
        status: document.getStatus(),
        documentUrl: document.getDocumentUrl(),
        notes: document.getNotes(),
        approvedById: document.getApprovedById(),
        approvedAt: document.getApprovedAt(),
        userId: document.getUserId(),
        carId: document.getCarId(),
        updatedAt: document.getUpdatedAt(),
      },
    });

    return this.toDomainEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.documentApproval.delete({
      where: { id },
    });
  }

  private toDomainEntity(document: any): DocumentApproval {
    return DocumentApproval.reconstitute({
      id: document.id,
      documentType: document.documentType as DocumentType,
      status: document.status as DocumentStatus,
      documentUrl: document.documentUrl,
      notes: document.notes,
      approvedById: document.approvedById,
      approvedAt: document.approvedAt,
      userId: document.userId,
      carId: document.carId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  }
}
