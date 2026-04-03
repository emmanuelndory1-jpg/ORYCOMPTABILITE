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
    crm: boolean;
    vendors: boolean;
    payroll: boolean;
    vat: boolean;
    assets: boolean;
    bankRec: boolean;
  };
}
