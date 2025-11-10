import { Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { PaymentCustomer } from "../value-objects/payment-customer.vo";

export interface CustomerData {
  email?: string;
  name?: string;
  phoneNumber?: string;
}

@Injectable()
export class BookingCustomerResolverService {
  /**
   * Resolves payment customer information from authenticated user or guest data
   * Encapsulates the domain logic for customer resolution
   */
  resolvePaymentCustomer(user: User | undefined, guestData: CustomerData): PaymentCustomer {
    if (user) {
      return this.resolveFromAuthenticatedUser(user);
    }

    return this.resolveFromGuestData(guestData);
  }

  private resolveFromAuthenticatedUser(user: User): PaymentCustomer {
    const email = user.getEmail();
    const name = user.getName() || "Customer";
    const phoneNumber = user.getPhoneNumber() || "";

    return PaymentCustomer.create(email, name, phoneNumber);
  }

  private resolveFromGuestData(guestData: CustomerData): PaymentCustomer {
    const email = guestData.email || "";
    const name = guestData.name || "Guest Customer";
    const phoneNumber = guestData.phoneNumber || "";

    return PaymentCustomer.create(email, name, phoneNumber);
  }
}
