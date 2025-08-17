import { DomainEvent } from "../../../shared/events/domain-event";

export class OtpGeneratedEvent extends DomainEvent {
  public readonly eventName = "OtpGeneratedEvent";

  constructor(
    aggregateId: string,
    public readonly userId: string | null,
    public readonly email: string,
    public readonly phoneNumber: string,
    public readonly otpType: "registration" | "login",
    public readonly expiresAt: Date,
  ) {
    super(aggregateId);
  }
}
