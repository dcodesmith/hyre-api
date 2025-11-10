import { ValueObject } from "../../../shared/domain/value-object";
import { generateSecureRandomId } from "../../../shared/utils/secure-random";

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
    const random = generateSecureRandomId();
    const id = `payout_${random}`;
    return new PayoutId({ value: id });
  }

  toString(): string {
    return this.props.value;
  }
}
