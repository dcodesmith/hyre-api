export class PaymentCustomer {
  constructor(
    private readonly email: string,
    private readonly name: string,
    private readonly phoneNumber: string,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error("Customer name is required");
    }
    if (!this.phoneNumber || this.phoneNumber.trim().length === 0) {
      throw new Error("Customer phone number is required");
    }
  }

  public static create(email: string, name: string, phoneNumber: string): PaymentCustomer {
    return new PaymentCustomer(email, name, phoneNumber);
  }

  public getEmail(): string {
    return this.email;
  }

  public getName(): string {
    return this.name;
  }

  public getPhoneNumber(): string {
    return this.phoneNumber;
  }

  public toPaymentService(): { email: string; name: string; phone_number: string } {
    return {
      email: this.email,
      name: this.name,
      phone_number: this.phoneNumber,
    };
  }
}
