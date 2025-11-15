export interface FileUploadDto {
  readonly fileName: string;
  readonly contentType: string;
  readonly buffer: Buffer;
  readonly size: number;
}

export interface CarUploadDto {
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly color: string;
  readonly registrationNumber: string;
  readonly dayRate: number;
  readonly nightRate: number;
  readonly hourlyRate: number;
  readonly fullDayRate: number;
  readonly images: FileUploadDto[];
  readonly motCertificate: FileUploadDto;
  readonly insuranceCertificate: FileUploadDto;
}

export interface CarUploadResponseDto {
  readonly carId: string;
  readonly status: string;
  readonly uploadedImages: string[];
  readonly documents: {
    readonly motCertificate: string;
    readonly insuranceCertificate: string;
  };
  readonly message: string;
}
