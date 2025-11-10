import {
  RecipientContactRequiredError,
  RecipientIdRequiredError,
  RecipientNameRequiredError,
} from "../errors/recipient.errors";
import { Recipient, RecipientRole } from "./recipient.vo";

describe("Recipient Value Object", () => {
  describe("Creation", () => {
    it("should create a recipient with email and phone", () => {
      const recipient = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
        "+1234567890",
      );

      expect(recipient.id).toBe("customer-123");
      expect(recipient.name).toBe("John Doe");
      expect(recipient.email).toBe("john@example.com");
      expect(recipient.phoneNumber).toBe("+1234567890");
      expect(recipient.role).toBe(RecipientRole.CUSTOMER);
    });

    it("should create a recipient with only email", () => {
      const recipient = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );

      expect(recipient.hasEmail()).toBeTruthy();
      expect(recipient.hasPhoneNumber()).toBeFalsy();
    });

    it("should create a recipient with only phone", () => {
      const recipient = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        undefined,
        "+1234567890",
      );

      expect(recipient.hasEmail()).toBeFalsy();
      expect(recipient.hasPhoneNumber()).toBeTruthy();
    });

    it("should trim whitespace from inputs", () => {
      const recipient = Recipient.create(
        "  customer-123  ",
        "  John Doe  ",
        RecipientRole.CUSTOMER,
        "  john@example.com  ",
        "  +1234567890  ",
      );

      expect(recipient.id).toBe("customer-123");
      expect(recipient.name).toBe("John Doe");
      expect(recipient.email).toBe("john@example.com");
      expect(recipient.phoneNumber).toBe("+1234567890");
    });

    it("should throw error when ID is empty", () => {
      expect(() =>
        Recipient.create("", "John Doe", RecipientRole.CUSTOMER, "john@example.com"),
      ).toThrow(RecipientIdRequiredError);
    });

    it("should throw error when ID is whitespace only", () => {
      expect(() =>
        Recipient.create("   ", "John Doe", RecipientRole.CUSTOMER, "john@example.com"),
      ).toThrow(RecipientIdRequiredError);
    });

    it("should throw error when name is empty", () => {
      expect(() =>
        Recipient.create("customer-123", "", RecipientRole.CUSTOMER, "john@example.com"),
      ).toThrow(RecipientNameRequiredError);
    });

    it("should throw error when name is whitespace only", () => {
      expect(() =>
        Recipient.create("customer-123", "   ", RecipientRole.CUSTOMER, "john@example.com"),
      ).toThrow(RecipientNameRequiredError);
    });

    it("should throw error when both email and phone are missing", () => {
      expect(() => Recipient.create("customer-123", "John Doe", RecipientRole.CUSTOMER)).toThrow(
        RecipientContactRequiredError,
      );
    });
  });

  describe("Contact Methods", () => {
    it("should correctly identify if recipient has email", () => {
      const withEmail = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );
      const withoutEmail = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        undefined,
        "+1234567890",
      );

      expect(withEmail.hasEmail()).toBeTruthy();
      expect(withoutEmail.hasEmail()).toBeFalsy();
    });

    it("should correctly identify if recipient has phone number", () => {
      const withPhone = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        undefined,
        "+1234567890",
      );
      const withoutPhone = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );

      expect(withPhone.hasPhoneNumber()).toBeTruthy();
      expect(withoutPhone.hasPhoneNumber()).toBeFalsy();
    });
  });

  describe("Role Checks", () => {
    it("should correctly identify customer role", () => {
      const customer = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );

      expect(customer.isCustomer()).toBeTruthy();
      expect(customer.isChauffeur()).toBeFalsy();
      expect(customer.isFleetOwner()).toBeFalsy();
    });

    it("should correctly identify chauffeur role", () => {
      const chauffeur = Recipient.create(
        "chauffeur-123",
        "Jane Driver",
        RecipientRole.CHAUFFEUR,
        "jane@example.com",
      );

      expect(chauffeur.isCustomer()).toBeFalsy();
      expect(chauffeur.isChauffeur()).toBeTruthy();
      expect(chauffeur.isFleetOwner()).toBeFalsy();
    });

    it("should correctly identify fleet owner role", () => {
      const fleetOwner = Recipient.create(
        "fleet-123",
        "Fleet Corp",
        RecipientRole.FLEET_OWNER,
        "fleet@example.com",
      );

      expect(fleetOwner.isCustomer()).toBeFalsy();
      expect(fleetOwner.isChauffeur()).toBeFalsy();
      expect(fleetOwner.isFleetOwner()).toBeTruthy();
    });
  });

  describe("String Representation", () => {
    it("should return correct string representation", () => {
      const recipient = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );

      expect(recipient.toString()).toBe("John Doe (CUSTOMER)");
    });
  });

  describe("Value Object Equality", () => {
    it("should be equal when all properties match", () => {
      const recipient1 = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
        "+1234567890",
      );
      const recipient2 = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
        "+1234567890",
      );

      expect(recipient1.equals(recipient2)).toBeTruthy();
    });

    it("should not be equal when properties differ", () => {
      const recipient1 = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );
      const recipient2 = Recipient.create(
        "customer-456",
        "John Doe",
        RecipientRole.CUSTOMER,
        "john@example.com",
      );

      expect(recipient1.equals(recipient2)).toBeFalsy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string email and phone as undefined", () => {
      const recipient = Recipient.create(
        "customer-123",
        "John Doe",
        RecipientRole.CUSTOMER,
        "",
        "+1234567890",
      );

      // Empty string should be trimmed to empty, but since phone is provided, it should work
      expect(recipient.email).toBe("");
      expect(recipient.hasEmail()).toBeFalsy(); // Empty string is falsy
    });

    it("should handle different role combinations", () => {
      const roles = [RecipientRole.CUSTOMER, RecipientRole.CHAUFFEUR, RecipientRole.FLEET_OWNER];

      for (const role of roles) {
        const recipient = Recipient.create(
          `${role.toLowerCase()}-123`,
          "Test User",
          role,
          "test@example.com",
        );

        expect(recipient.role).toBe(role);
      }
    });
  });
});
