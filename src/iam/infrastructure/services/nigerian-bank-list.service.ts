import { Injectable } from "@nestjs/common";
import {
  BankInfo,
  BankListProvider,
} from "../../domain/services/external/bank-verification.interface";

@Injectable()
export class NigerianBankListService implements BankListProvider {
  private readonly banks: BankInfo[] = [
    { name: "Access Bank", code: "044" },
    { name: "Citibank Nigeria", code: "023" },
    { name: "Diamond Bank", code: "063" },
    { name: "Ecobank Nigeria", code: "050" },
    { name: "Fidelity Bank", code: "070" },
    { name: "First Bank of Nigeria", code: "011" },
    { name: "First City Monument Bank", code: "214" },
    { name: "Guaranty Trust Bank", code: "058" },
    { name: "Heritage Bank", code: "030" },
    { name: "Keystone Bank", code: "082" },
    { name: "Polaris Bank", code: "076" },
    { name: "Providus Bank", code: "101" },
    { name: "Stanbic IBTC Bank", code: "221" },
    { name: "Standard Chartered Bank", code: "068" },
    { name: "Sterling Bank", code: "232" },
    { name: "Union Bank of Nigeria", code: "032" },
    { name: "United Bank For Africa", code: "033" },
    { name: "Unity Bank", code: "215" },
    { name: "Wema Bank", code: "035" },
    { name: "Zenith Bank", code: "057" },
    { name: "Jaiz Bank", code: "301" },
    { name: "SunTrust Bank", code: "100" },
    { name: "Kuda Bank", code: "999992" },
    { name: "Rubies Bank", code: "125" },
    { name: "TCF MFB", code: "90115" },
    { name: "Titan Bank", code: "102" },
    { name: "VFD Microfinance Bank", code: "566" },
    { name: "Coronation Merchant Bank", code: "559" },
    { name: "FSDH Merchant Bank Limited", code: "501" },
    { name: "Rand Merchant Bank", code: "502" },
    { name: "Nova Merchant Bank", code: "103" },
    { name: "TAJ Bank", code: "302" },
    { name: "Optimus Bank", code: "107" },
    { name: "Globus Bank", code: "103" },
    { name: "PalmPay", code: "999991" },
    { name: "Opay", code: "999992" },
    { name: "Carbon", code: "565" },
    { name: "GoMoney", code: "100022" },
    { name: "Moniepoint MFB", code: "50515" },
  ];

  getAllBanks(): BankInfo[] {
    return [...this.banks];
  }

  getBankByCode(code: string): BankInfo | undefined {
    return this.banks.find((bank) => bank.code === code);
  }

  getBankByName(name: string): BankInfo | undefined {
    return this.banks.find((bank) => bank.name.toLowerCase().includes(name.toLowerCase()));
  }

  searchBanks(query: string): BankInfo[] {
    const lowerQuery = query.toLowerCase();
    return this.banks.filter(
      (bank) => bank.name.toLowerCase().includes(lowerQuery) || bank.code.includes(query),
    );
  }
}
