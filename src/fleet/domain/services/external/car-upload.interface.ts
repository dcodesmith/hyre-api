import { Car } from "../../entities/car.entity";
import { CarDocument } from "../../value-objects/car-document.vo";

export interface CarUploadData {
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly color: string;
  readonly registrationNumber: string;
  readonly dayRate: number;
  readonly nightRate: number;
  readonly hourlyRate: number;
  readonly ownerId: string;
}

export interface FileUploadData {
  readonly fileName: string;
  readonly contentType: string;
  readonly buffer: Buffer;
}

export interface CarUploadRequest {
  readonly carData: CarUploadData;
  readonly images: FileUploadData[];
  readonly motCertificate: FileUploadData;
  readonly insuranceCertificate: FileUploadData;
}

export interface CarUploadResult {
  readonly car: Car;
  readonly uploadedImages: CarDocument[];
  readonly motCertificate: CarDocument;
  readonly insuranceCertificate: CarDocument;
}
