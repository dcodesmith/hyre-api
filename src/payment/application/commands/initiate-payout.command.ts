export class InitiatePayoutCommand {
  constructor(
    public readonly fleetOwnerId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly bankCode: string,
    public readonly accountNumber: string,
    public readonly bankName: string,
    public readonly accountName: string,
    public readonly bookingId?: string,
    public readonly extensionId?: string,
  ) {}
}
