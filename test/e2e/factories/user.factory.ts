import { faker } from "@faker-js/faker";
import { Factory } from "fishery";
import type { CreateBookingDto } from "../../../src/booking/presentation/dto/create-booking.dto";
import type { CreateCarDto } from "../../../src/fleet/presentation/dto/create-car.dto";
import type { RegisterCustomerDto } from "../../../src/iam/presentation/dto/register-customer.dto";

/**
 * UserFactory - Generates test data for user registration
 *
 * Uses the actual RegisterCustomerDto type from the IAM domain.
 * This ensures test data matches exactly what the API expects.
 *
 * Note: This generates a basic user registration payload. For fleet owners
 * and chauffeurs, additional steps are required via IAM endpoints after registration.
 */
export const UserFactory = Factory.define<RegisterCustomerDto>(({ sequence, params }) => ({
  email: `user${sequence}@test.com`,
  phoneNumber: "08012345678",
  otpCode: params.otpCode ?? "123456", // Override with actual OTP from email
  countryCode: "+234", // Nigeria
  name: faker.person.fullName(),
}));

export const CarFactory = Factory.define<CreateCarDto>(({ sequence }) => {
  const makes = ["BMW", "Mercedes-Benz", "Audi", "Jaguar", "Bentley"];
  const make = faker.helpers.arrayElement(makes);

  return {
    make,
    model: faker.vehicle.model(),
    year: new Date().getFullYear(),
    color: faker.color.human(),
    registrationNumber: `ABC${sequence}XY`,
    dayRate: faker.number.int({ min: 150, max: 400 }),
    nightRate: faker.number.int({ min: 100, max: 300 }),
    hourlyRate: faker.number.int({ min: 20, max: 50 }),
    currency: "NGN",
  };
});

export const BookingFactory = Factory.define<CreateBookingDto>(() => {
  const from = faker.date.soon({ days: 1 });
  const to = faker.date.soon({ days: 2, refDate: from });

  return {
    carId: faker.string.uuid(),
    from,
    to,
    pickupTime: "09:00 AM",
    pickupAddress: faker.location.streetAddress(),
    dropOffAddress: faker.location.streetAddress(),
    sameLocation: false,
    bookingType: "DAY",
    includeSecurityDetail: false,
    totalAmount: faker.number.int({ min: 30000, max: 100000 }),
    specialRequests: faker.helpers.maybe(() => faker.lorem.sentence()),
  };
});
