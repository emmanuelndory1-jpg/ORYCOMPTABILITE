export interface PartnerContribution {
  name: string;
  amount: number;
  type: 'cash' | 'kind';
  description?: string;
}

export interface TreasurySetup {
  name: string;
  type: 'bank' | 'cash' | 'mobile';
  initialBalance: number;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
  swift?: string;
  mobileProvider?: string;
  mobileNumber?: string;
}

export interface UserSetup {
  name: string;
  email: string;
  role: 'admin' | 'accountant' | 'manager' | 'viewer';
}

export interface OnboardingData {
  // Company Info
  name: string;
  legalForm: string;
  rccm: string;
  taxId: string;
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  managerName: string;

  // Banking (Main)
  bankName?: string;
  bankAccountNumber?: string;
  bankIban?: string;
  bankSwift?: string;

  // Payment Methods
  paymentBankEnabled: boolean;
  paymentBankAccount: string;
  paymentCashEnabled: boolean;
  paymentCashAccount: string;
  paymentMobileEnabled: boolean;
  paymentMobileAccount: string;

  // Accounting
  syscohadaSystem: 'normal' | 'minimalist';
  currency: string;
  fiscalYearStart: string;
  fiscalYearDuration: number; // in months, usually 12

  // Tax
  taxRegime: string;
  vatSubject: boolean;
  vatRate: number;

  // Capital
  capitalAmount: number;
  partners: PartnerContribution[];
  constitutionCosts: number;

  // Financials
  treasury: TreasurySetup[];

  // Users
  users: UserSetup[];

  // Modules
  modules: {
    accounting: boolean;
    invoicing: boolean;
    third_parties: boolean;
    payroll: boolean;
    vat: boolean;
    assets: boolean;
    bankRec: boolean;
  };
}
