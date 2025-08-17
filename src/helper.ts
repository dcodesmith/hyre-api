import { BookingStatus, Prisma } from "@prisma/client";
import { format } from "date-fns";
import {
  BookingLegWithRelations,
  BookingWithRelations,
  NormalisedBookingDetails,
  NormalisedBookingLegDetails,
} from "./types";

// Helper to generate a user-friendly name or email
export function getUserDisplayName(
  booking: Omit<BookingWithRelations, "legs">,
  target: "user" | "owner" | "chauffeur" = "user",
): string {
  if (target === "user") {
    return (
      booking.customer?.name || booking.customer?.username || booking.customer?.email || "Customer"
    );
  }

  if (target === "owner") {
    return (
      booking.car.owner?.name ||
      booking.car.owner?.username ||
      booking.car.owner?.email ||
      "Fleet Owner"
    );
  }

  if (target === "chauffeur" && booking.chauffeur) {
    return booking.chauffeur.name || booking.chauffeur.email || "Chauffeur";
  }

  return "User";
}

export function formatDate(date: string | Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });

  function replaceWithOrdinalSuffix(day: string) {
    const num = Number.parseInt(day);
    const suffix = ["th", "st", "nd", "rd"][
      num % 10 > 3 || (num % 100) - (num % 10) === 10 ? 0 : num % 10
    ];
    return `${num}${suffix}`;
  }

  return formatter
    .format(new Date(date))
    .replace(/,/g, " @")
    .replace(/(\d+)(?=\s)/, replaceWithOrdinalSuffix);
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(amount);
};

export function getCustomerDetails(
  booking: Prisma.BookingGetPayload<{
    include: { customer: true };
  }>,
): { email: string; name: string; phone_number: string } {
  const email = booking.customer?.email ?? "";
  const name = booking.customer?.name ?? "";
  const phone_number = booking.customer?.phoneNumber ?? "";

  return { email, name, phone_number };
}

export function normaliseBookingDetails(booking: BookingWithRelations): NormalisedBookingDetails {
  const customerName = getUserDisplayName(booking, "user");
  const ownerName = getUserDisplayName(booking, "owner");
  const chauffeurName = getUserDisplayName(booking, "chauffeur");
  const carName = `${booking.car.make} ${booking.car.model} (${booking.car.year})`;
  const { pickupAddress, dropOffAddress, id, bookingReference } = booking;

  let title: string;
  let status: string;

  if (booking.status === BookingStatus.CONFIRMED) {
    title = "started";
    status = "active";
  } else if (booking.status === BookingStatus.ACTIVE) {
    title = "ended";
    status = "completed";
  } else {
    title = `status is ${booking.status.toLowerCase()}`;
    status = booking.status.toLowerCase();
  }

  return {
    bookingReference,
    id,
    ownerName,
    customerName,
    chauffeurName,
    chauffeurPhoneNumber: booking.chauffeur?.phoneNumber ?? "",
    carName,
    title,
    status,
    cancellationReason: booking.cancellationReason ?? "No reason provided",
    pickupAddress,
    dropOffAddress,
    startDate: formatDate(booking.startDate),
    endDate: formatDate(booking.endDate),
    totalAmount: formatCurrency(Number(booking.totalAmount.toFixed(2))),
  };
}

export function normaliseBookingLegDetails(
  bookingLeg: BookingLegWithRelations,
): NormalisedBookingLegDetails {
  const { booking } = bookingLeg;
  const customerName = getUserDisplayName(booking, "user");
  const chauffeurName = getUserDisplayName(booking, "chauffeur");
  const carName = `${booking.car.make} ${booking.car.model} (${booking.car.year})`;

  return {
    bookingId: booking.id,
    customerName,
    chauffeurName,
    legDate: format(bookingLeg.legDate, "PPPP"),
    legStartTime: format(bookingLeg.legStartTime, "p"),
    legEndTime: format(bookingLeg.legEndTime, "p"),
    chauffeurPhoneNumber: booking.chauffeur?.phoneNumber ?? "",
    pickupAddress: booking.pickupAddress,
    dropOffAddress: booking.dropOffAddress,
    carName,
  };
}
