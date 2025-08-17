import { Payout } from "../entities/payout.entity";
import { PayoutId } from "../value-objects/payout-id.vo";
import { PayoutStatus } from "../value-objects/payout-status.vo";

export abstract class PayoutRepository {
  abstract save(payout: Payout): Promise<void>;
  abstract findById(id: PayoutId): Promise<Payout | null>;
  abstract findByBookingId(bookingId: string): Promise<Payout[]>;
  abstract findByExtensionId(extensionId: string): Promise<Payout[]>;
  abstract findByFleetOwnerId(fleetOwnerId: string): Promise<Payout[]>;
  abstract findByStatus(status: PayoutStatus): Promise<Payout[]>;
  abstract findInProgressByFleetOwner(fleetOwnerId: string): Promise<Payout[]>;
  abstract findPendingPayouts(): Promise<Payout[]>;
  abstract findByProviderReference(reference: string): Promise<Payout | null>;
}
