import { ValueObject } from "../../../shared/domain/value-object";

interface PayoutIdProps {
  value: string;
}

export class PayoutId extends ValueObject<PayoutIdProps> {
  get value(): string {
    return this.props.value;
  }

  private constructor(props: PayoutIdProps) {
    super(props);
  }

  public static create(value: string): PayoutId {
    if (!value || value.trim().length === 0) {
      throw new Error("PayoutId cannot be empty");
    }
    return new PayoutId({ value: value.trim() });
  }

  public static generate(): PayoutId {
    // In production, use a proper ID generation strategy
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const id = `payout_${timestamp}_${random}`;
    return new PayoutId({ value: id });
  }

  toString(): string {
    return this.props.value;
  }
}
