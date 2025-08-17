import { BankDetails } from "../entities/bank-details.entity";

export interface BankDetailsRepository {
  save(bankDetails: BankDetails): Promise<BankDetails>;
  findByUserId(userId: string): Promise<BankDetails | null>;
  findById(id: string): Promise<BankDetails | null>;
  update(bankDetails: BankDetails): Promise<BankDetails>;
  delete(id: string): Promise<void>;
}
