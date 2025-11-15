import {
  AssignChauffeurDto,
  GetAvailableChauffeursDto,
  UnassignChauffeurDto,
} from "@/booking/presentation/dto/assign-chauffeur.dto";
import { CreateBookingDto } from "@/booking/presentation/dto/create-booking.dto";
import { PaymentStatusQueryDto } from "@/booking/presentation/dto/payment-status.dto";

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export const createCreateBookingDto = (
  overrides: Partial<CreateBookingDto> = {},
): CreateBookingDto => {
  const defaultFrom = new Date(Date.now() + ONE_DAY_IN_MS);
  const defaultTo = new Date(defaultFrom.getTime() + 4 * 60 * 60 * 1000); // +4 hours

  return {
    from: defaultFrom,
    to: defaultTo,
    pickupTime: "8:00 AM",
    pickupAddress: "123 Pickup Street",
    dropOffAddress: "456 Drop-off Avenue",
    sameLocation: false,
    carId: "3d6f0b3e-9a86-4d73-a7a6-0a4e9a7a6db7",
    bookingType: "DAY",
    includeSecurityDetail: false,
    totalAmount: 25000,
    email: "guest@example.com",
    name: "Fixture Guest",
    phoneNumber: "+12345678901",
    ...overrides,
  };
};

export const createAssignChauffeurDto = (
  overrides: Partial<AssignChauffeurDto> = {},
): AssignChauffeurDto => ({
  chauffeurId: "chauffeur-fixture",
  ...overrides,
});

export const createUnassignChauffeurDto = (
  overrides: Partial<UnassignChauffeurDto> = {},
): UnassignChauffeurDto => ({
  reason: "Reason for unassignment",
  ...overrides,
});

export const createGetAvailableChauffeursDto = (
  overrides: Partial<GetAvailableChauffeursDto> = {},
): GetAvailableChauffeursDto => ({
  startDate: new Date(Date.now() + ONE_DAY_IN_MS),
  endDate: new Date(Date.now() + ONE_DAY_IN_MS * 2),
  fleetOwnerId: "fleet-owner-fixture",
  ...overrides,
});

export const createPaymentStatusQueryDto = (
  overrides: Partial<PaymentStatusQueryDto> = {},
): PaymentStatusQueryDto => ({
  transactionType: "transaction-type-fixture",
  transaction_id: "tx-fixture",
  tx_ref: "ref-fixture",
  status: "success",
  ...overrides,
});
