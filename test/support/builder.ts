import { faker } from "@faker-js/faker";
import { Prisma, Status } from "@prisma/client";

export class Builder {
  buildUser(overrides: Partial<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
    return {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      phoneNumber: "08012345678",
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      hasOnboarded: false,
      ...overrides,
    };
  }

  buildCar(
    overrides: Partial<Prisma.CarUncheckedCreateInput> = {},
  ): Prisma.CarUncheckedCreateInput {
    const makes = ["BMW", "Mercedes-Benz", "Audi", "Jaguar", "Bentley", "Rolls-Royce"];
    const make = faker.helpers.arrayElement(makes);

    return {
      make,
      model: this.getModelForMake(make),
      year: faker.date.recent().getFullYear(),
      color: faker.color.human(),
      registrationNumber: this.generateNigerianRegistrationNumber(),
      status: Status.AVAILABLE,
      dayRate: faker.number.int({ min: 150, max: 400 }),
      hourlyRate: faker.number.int({ min: 20, max: 50 }),
      nightRate: faker.number.int({ min: 100, max: 300 }),
      ownerId: overrides.ownerId,
      ...overrides,
    };
  }

  private generateNigerianRegistrationNumber(): string {
    // Nigerian formats:
    // State format: ABC-123XX or ABC123XX (3 letters, 3 numbers, 2 letters)
    // Federal format: XX123XX (2 letters, 3 numbers, 2 letters)

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";

    // Randomly choose between state and federal format
    const isFederalFormat = Math.random() > 0.7; // 30% chance for federal format

    if (isFederalFormat) {
      // Federal format: XX123XX
      const firstPart = Array.from({ length: 2 }, () =>
        letters.charAt(Math.floor(Math.random() * letters.length)),
      ).join("");

      const middlePart = Array.from({ length: 3 }, () =>
        numbers.charAt(Math.floor(Math.random() * numbers.length)),
      ).join("");

      const lastPart = Array.from({ length: 2 }, () =>
        letters.charAt(Math.floor(Math.random() * letters.length)),
      ).join("");

      return `${firstPart}${middlePart}${lastPart}`;
    } else {
      // State format: ABC-123XX or ABC123XX
      const firstPart = Array.from({ length: 3 }, () =>
        letters.charAt(Math.floor(Math.random() * letters.length)),
      ).join("");

      const middlePart = Array.from({ length: 3 }, () =>
        numbers.charAt(Math.floor(Math.random() * numbers.length)),
      ).join("");

      const lastPart = Array.from({ length: 2 }, () =>
        letters.charAt(Math.floor(Math.random() * letters.length)),
      ).join("");

      // Randomly include or exclude the hyphen
      const includeHyphen = Math.random() > 0.5;
      return includeHyphen
        ? `${firstPart}-${middlePart}${lastPart}`
        : `${firstPart}${middlePart}${lastPart}`;
    }
  }

  private getModelForMake(make: string): string {
    const models = {
      BMW: ["3 Series", "5 Series", "7 Series", "X3", "X5"],
      "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLC", "GLE"],
      Audi: ["A3", "A4", "A6", "A8", "Q5", "Q7"],
      Jaguar: ["XE", "XF", "XJ", "F-PACE", "I-PACE"],
      Bentley: ["Continental", "Flying Spur", "Bentayga"],
      "Rolls-Royce": ["Ghost", "Phantom", "Cullinan"],
    };

    return faker.helpers.arrayElement(models[make] || ["Standard Model"]);
  }
}
