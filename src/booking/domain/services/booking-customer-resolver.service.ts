import { Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { PaymentCustomer } from "../value-objects/payment-customer.vo";

@Injectable()
export class BookingCustomerResolverService {
  /**
   * Resolves payment customer information from the booking customer entity.
   * Always expects a concrete user (registered or guest) so downstream
   * payment services operate with consistent customer data.
   */
  resolvePaymentCustomer(customer: User): PaymentCustomer {
    const email = customer.getEmail();
    const name = customer.getName() || "Customer";
    const phoneNumber = customer.getPhoneNumber() || "";

    return PaymentCustomer.create(email, name, phoneNumber);
  }
}
