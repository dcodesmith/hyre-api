export class BookingFinancialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingFinancialsError";
  }
}

export class InvalidFinancialAmountError extends BookingFinancialsError {
  constructor(fieldName: string, reason: string) {
    super(`Invalid ${fieldName}: ${reason}`);
    this.name = "InvalidFinancialAmountError";
  }
}

export class NegativeFinancialAmountError extends BookingFinancialsError {
  constructor(fieldName: string) {
    super(`${fieldName} cannot be negative`);
    this.name = "NegativeFinancialAmountError";
  }
}

export class NonPositiveFinancialAmountError extends BookingFinancialsError {
  constructor(fieldName: string) {
    super(`${fieldName} must be positive`);
    this.name = "NonPositiveFinancialAmountError";
  }
}
