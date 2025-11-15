import { BookingCarDto, CarDto } from "@/booking/domain/dtos/car.dto";

export const createCarDto = (overrides: Partial<CarDto> = {}): CarDto => ({
  id: "car-fixture-id",
  make: "Toyota",
  model: "Camry",
  year: 2024,
  color: "Black",
  registrationNumber: "ABC-1234",
  ownerId: "owner-fixture-id",
  rates: {
    dayRate: 50000,
    nightRate: 70000,
    hourlyRate: 10000,
    fullDayRate: 90000,
  },
  status: "AVAILABLE",
  approvalStatus: "APPROVED",
  imageUrls: ["https://example.com/car-image.jpg"],
  motCertificateUrl: "https://example.com/mot-cert.pdf",
  insuranceCertificateUrl: "https://example.com/insurance-cert.pdf",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  ...overrides,
});

export const createBookingCarDto = (overrides: Partial<BookingCarDto> = {}): BookingCarDto => ({
  id: "car-fixture-id",
  make: "Toyota",
  model: "Camry",
  ownerId: "owner-fixture-id",
  rates: {
    dayRate: 50000,
    nightRate: 70000,
    hourlyRate: 10000,
    fullDayRate: 90000,
  },
  status: "AVAILABLE",
  ...overrides,
});

