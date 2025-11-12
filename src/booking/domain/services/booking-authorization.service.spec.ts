import { beforeEach, describe, expect, it } from "vitest";
import { createBookingEntity } from "../../../../test/fixtures/booking.fixture";
import { createUserEntity } from "../../../../test/fixtures/user.fixture";
import { User } from "../../../iam/domain/entities/user.entity";
import { RegistrationType } from "../../../iam/domain/value-objects/registration-type.vo";
import { UserRole } from "../../../iam/domain/value-objects/user-role.vo";
import { Booking } from "../entities/booking.entity";
import { BookingAuthorizationService } from "./booking-authorization.service";

describe("BookingAuthorizationService", () => {
  let service: BookingAuthorizationService;
  let customerUser: User;
  let adminUser: User;
  let staffUser: User;
  let fleetOwnerUser: User;
  let otherCustomerUser: User;
  let booking: Booking;

  beforeEach(() => {
    service = new BookingAuthorizationService();

    customerUser = createUserEntity({
      id: "customer-123",
      email: "customer@example.com",
      roles: [UserRole.customer()],
    });

    adminUser = createUserEntity({
      id: "admin-123",
      email: "admin@example.com",
      roles: [UserRole.admin()],
      registrationType: RegistrationType.adminCreated("system"),
    });

    staffUser = createUserEntity({
      id: "staff-123",
      email: "staff@example.com",
      roles: [UserRole.staff()],
      registrationType: RegistrationType.adminCreated("admin-123"),
    });

    fleetOwnerUser = createUserEntity({
      id: "fleet-owner-123",
      email: "fleet@example.com",
      roles: [UserRole.fleetOwner()],
    });

    otherCustomerUser = createUserEntity({
      id: "other-customer-123",
      email: "other@example.com",
      roles: [UserRole.customer()],
    });

    booking = createBookingEntity({
      id: "booking-123",
      bookingReference: "BK-123",
      customerId: "customer-123",
      carId: "car-123",
    });
  });

  describe("#canViewAllBookings", () => {
    it("should allow admins to view all bookings", () => {
      const result = service.canViewAllBookings(adminUser);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow staff to view all bookings", () => {
      const result = service.canViewAllBookings(staffUser);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should not allow regular customers to view all bookings", () => {
      const result = service.canViewAllBookings(customerUser);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("Only admins and staff can view all bookings");
    });

    it("should not allow fleet owners to view all bookings", () => {
      const result = service.canViewAllBookings(fleetOwnerUser);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("Only admins and staff can view all bookings");
    });
  });

  describe("#canViewBooking", () => {
    it("should allow customer to view their own booking", () => {
      const result = service.canViewBooking(customerUser, booking);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow admin to view any booking", () => {
      const result = service.canViewBooking(adminUser, booking);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow staff to view any booking", () => {
      const result = service.canViewBooking(staffUser, booking);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow fleet owner to view bookings for their cars", () => {
      const result = service.canViewBooking(fleetOwnerUser, booking, "fleet-owner-123");

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should not allow fleet owner to view bookings for other owners cars", () => {
      const result = service.canViewBooking(fleetOwnerUser, booking, "other-fleet-owner");

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("You can only view your own bookings or bookings for your fleet");
    });

    it("should not allow other customers to view someone else's booking", () => {
      const result = service.canViewBooking(otherCustomerUser, booking);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("You can only view your own bookings or bookings for your fleet");
    });

    it("should allow fleet owner to view booking without fleetOwnerId parameter", () => {
      // When fleetOwnerId is not provided, it should only check if user is owner or admin
      const result = service.canViewBooking(fleetOwnerUser, booking);

      expect(result.isAuthorized).toBe(false);
    });
  });

  describe("#canModifyBooking", () => {
    it("should allow customer to modify their own booking", () => {
      const result = service.canModifyBooking(customerUser, booking);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should not allow other customers to modify someone else's booking", () => {
      const result = service.canModifyBooking(otherCustomerUser, booking);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("You can only modify your own bookings");
    });

    it("should not allow admin to modify bookings for other customers", () => {
      const result = service.canModifyBooking(adminUser, booking);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("You can only modify your own bookings");
    });

    it("should not allow staff to modify bookings for other customers", () => {
      const result = service.canModifyBooking(staffUser, booking);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("You can only modify your own bookings");
    });

    it("should not allow fleet owners to modify customer bookings", () => {
      const result = service.canModifyBooking(fleetOwnerUser, booking);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("You can only modify your own bookings");
    });
  });

  describe("#canCancelBooking", () => {
    it("should allow customer to cancel their own booking", () => {
      const result = service.canCancelBooking(customerUser, booking);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow admin to cancel any booking", () => {
      const result = service.canCancelBooking(adminUser, booking);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow staff to cancel any booking", () => {
      const result = service.canCancelBooking(staffUser, booking);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should not allow other customers to cancel someone else's booking", () => {
      const result = service.canCancelBooking(otherCustomerUser, booking);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("You can only cancel your own bookings");
    });

    it("should not allow fleet owners to cancel customer bookings", () => {
      const result = service.canCancelBooking(fleetOwnerUser, booking);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("You can only cancel your own bookings");
    });
  });

  describe("#canAssignChauffeur", () => {
    it("should allow admin to assign chauffeurs", () => {
      const result = service.canAssignChauffeur(adminUser);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow staff to assign chauffeurs", () => {
      const result = service.canAssignChauffeur(staffUser);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow fleet owners to assign chauffeurs", () => {
      const result = service.canAssignChauffeur(fleetOwnerUser);

      expect(result.isAuthorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should not allow regular customers to assign chauffeurs", () => {
      const result = service.canAssignChauffeur(customerUser);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toBe("Only fleet owners, admins, and staff can assign chauffeurs");
    });
  });
});
