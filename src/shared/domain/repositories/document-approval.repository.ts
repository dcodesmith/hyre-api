import { DocumentApproval, DocumentType } from "../entities/document-approval.entity";

export interface DocumentApprovalRepository {
  save(document: DocumentApproval): Promise<DocumentApproval>;
  findById(id: string): Promise<DocumentApproval | null>;
  findByUserIdAndType(userId: string, type: DocumentType): Promise<DocumentApproval | null>;
  findByCarIdAndType(carId: string, type: DocumentType): Promise<DocumentApproval | null>;
  findByUserId(userId: string): Promise<DocumentApproval[]>;
  findByCarId(carId: string): Promise<DocumentApproval[]>;
  findPendingDocuments(): Promise<DocumentApproval[]>;
  update(document: DocumentApproval): Promise<DocumentApproval>;
  delete(id: string): Promise<void>;
}
