import { Prisma } from "@prisma/client";

export interface EmailTemplateProps {
  children: React.ReactNode;
  previewText: string;
  pageTitle?: string;
}

export interface GuestUserDetails {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
}

export type NormalisedBookingDetails = {
  bookingReference: string;
  id: string;
  customerName: string;
  ownerName: string;
  chauffeurName: string;
  chauffeurPhoneNumber: string;
  carName: string;
  pickupAddress: string;
  dropOffAddress: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
  title: string;
  status: string;
  cancellationReason: string;
};

export type NormalisedBookingLegDetails = {
  bookingId: string;
  customerName: string;
  chauffeurName: string;
  legDate: string;
  legStartTime: string;
  legEndTime: string;
  chauffeurPhoneNumber: string;
  carName: string;
  pickupAddress: string;
  dropOffAddress: string;
};

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    chauffeur: true;
    customer: true;
    car: { include: { owner: true } };
    legs: {
      include: {
        extensions: true;
      };
    };
  };
}>;

export type BookingLegWithRelations = Prisma.BookingLegGetPayload<{
  include: {
    extensions: true;
    booking: {
      include: {
        car: { include: { owner: true } };
        customer: true;
        chauffeur: true;
      };
    };
  };
}>;
