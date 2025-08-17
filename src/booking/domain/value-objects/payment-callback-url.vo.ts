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

  public static create(_domain: string, bookingId: string): PaymentCallbackUrl {
    const frontendUrl = "http://localhost:3001"; // Frontend domain
    const url = `${frontendUrl}/payment-status?bookingId=${bookingId}`;
    return new PaymentCallbackUrl(url);
  }

  public toString(): string {
    return this.value;
  }
}
