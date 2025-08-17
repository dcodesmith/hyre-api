import { ValueObject } from "../../../shared/domain/value-object";

interface PhoneNumberProps {
  value: string;
  countryCode: string;
}

export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  get value(): string {
    return this.props.value;
  }

  get countryCode(): string {
    return this.props.countryCode;
  }

  private constructor(props: PhoneNumberProps) {
    super(props);
  }

  public static create(phoneNumber: string, countryCode: string = "+234"): PhoneNumber {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      throw new Error("Phone number cannot be empty");
    }

    if (!countryCode || countryCode.trim().length === 0) {
      throw new Error("Country code cannot be empty");
    }

    // Remove any non-digit characters except the + for country code
    const cleanedPhone = phoneNumber.replace(/[^\d]/g, "");
    const cleanedCountryCode = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;

    // Validate phone number format (Nigerian format as default)
    if (countryCode === "+234" && !PhoneNumber.isValidNigerianNumber(cleanedPhone)) {
      throw new Error("Invalid Nigerian phone number format");
    }

    return new PhoneNumber({
      value: cleanedPhone,
      countryCode: cleanedCountryCode,
    });
  }

  private static isValidNigerianNumber(phoneNumber: string): boolean {
    // Nigerian numbers: 11 digits starting with 0, or 10 digits without 0
    const patterns = [
      /^0[789][01]\d{8}$/, // 11 digits starting with 0
      /^[789][01]\d{7}$/, // 10 digits without 0
    ];

    return patterns.some((pattern) => pattern.test(phoneNumber));
  }

  public getFullNumber(): string {
    return `${this.props.countryCode}${this.props.value}`;
  }

  public getDisplayFormat(): string {
    if (this.props.countryCode === "+234") {
      // Format Nigerian numbers as +234 XXX XXX XXXX
      const number = this.props.value;
      if (number.length === 11 && number.startsWith("0")) {
        const withoutZero = number.substring(1);
        return `+234 ${withoutZero.substring(0, 3)} ${withoutZero.substring(3, 6)} ${withoutZero.substring(6)}`;
      } else if (number.length === 10) {
        return `+234 ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
      }
    }

    return this.getFullNumber();
  }

  public canReceiveSms(): boolean {
    // Basic validation - could be enhanced with more sophisticated checks
    return this.props.value.length >= 10;
  }

  public toString(): string {
    return this.getFullNumber();
  }
}
