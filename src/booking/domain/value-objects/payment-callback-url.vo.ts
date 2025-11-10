export class PaymentCallbackUrl {
  constructor(private readonly value: string) {
    this.validate();
  }

  private validate(): void {
    try {
      new URL(this.value);
    } catch {
      throw new Error(`Invalid callback URL: ${this.value}`);
    }
  }

  public static create(domain: string, bookingId: string): PaymentCallbackUrl {
    const base = new URL(domain);
    base.pathname = "/payment-status";
    base.search = new URLSearchParams({ bookingId }).toString();
    return new PaymentCallbackUrl(base.toString());
  }

  public toString(): string {
    return this.value;
  }
}
