import { DomainEvent } from "../../../shared/events/domain-event";

export class OtpVerifiedEvent extends DomainEvent {
  public readonly eventName = "OtpVerifiedEvent";

  constructor(
    aggregateId: string,
    public readonly userId: string,
    public readonly email: string,
    public readonly phoneNumber: string,
    public readonly otpType: "registration" | "login",
    public readonly verifiedAt: Date,
  ) {
    super(aggregateId);
  }
}
