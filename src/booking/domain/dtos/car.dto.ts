/**
 * DTO for car data used in booking domain
 * Prevents direct dependency on Fleet domain entities
 */
export interface CarDto {
  readonly id: string;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly color: string;
  readonly registrationNumber: string;
  readonly ownerId: string;
  readonly rates: CarRatesDto;
  readonly status: string;
  readonly approvalStatus: string;
  readonly imageUrls: readonly string[];
  readonly motCertificateUrl: string;
  readonly insuranceCertificateUrl: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CarRatesDto {
  readonly dayRate: number;
  readonly nightRate: number;
  readonly hourlyRate: number;
}

/**
 * Minimal car data for booking operations
 */
export interface BookingCarDto {
  readonly id: string;
  readonly make: string;
  readonly model: string;
  readonly ownerId: string;
  readonly rates: CarRatesDto;
  readonly status: string;
}
