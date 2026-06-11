import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format d'email invalide"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format d'email invalide"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
  name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères"),
});

export const accountSchema = z.object({
  code: z.string().min(1, "Le code est requis").max(10),
  name: z.string().min(1, "Le nom est requis").max(100),
  class_code: z.union([z.string(), z.number()]).transform(val => String(val).charAt(0)),
  type: z.enum(['actif', 'passif', 'charge', 'produit', 'capitaux']),
});

export const transactionSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), "Date invalide"),
  description: z.string().min(3, "La description est requise").max(255),
  reference: z.string().optional().nullable(),
  entries: z.array(z.object({
    account_code: z.string().min(1),
    debit: z.number().nonnegative().optional().default(0),
    credit: z.number().nonnegative().optional().default(0),
    description: z.string().optional().nullable()
  })).min(2, "Une écriture doit avoir au moins deux lignes"),
  currency: z.string().min(3).max(10).optional(),
  exchange_rate: z.number().positive().optional(),
  third_party_id: z.number().optional().nullable(),
  occasional_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  transaction_id: z.number().optional().nullable(),
  due_date: z.string().optional().nullable(),
  operation_type: z.string().optional().nullable(),
  amount_ht: z.number().optional().nullable(),
  vat_rate: z.number().optional().nullable(),
  taxes_enabled: z.union([z.boolean(), z.number()]).optional().nullable(),
  payment_mode: z.string().optional().nullable(),
  treasury_account: z.string().optional().nullable(),
  creation_mode: z.string().optional().nullable()
}).refine((data) => {
  const totalDebit = data.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = data.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  // Using a small epsilon for floating point comparison
  return Math.abs(totalDebit - totalCredit) < 0.01;
}, {
  message: "L'écriture n'est pas équilibrée (Total Débit doit être égal au Total Crédit)"
});

export const companySettingsSchema = z.object({
  name: z.string().min(2).max(100).nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  fiscal_id: z.string().optional().nullable(),
  rccm: z.string().optional().nullable(),
  legal_form: z.string().optional().nullable(),
  activity: z.string().optional().nullable(),
  tax_regime: z.string().optional().nullable(),
  vat_regime: z.string().optional().nullable(),
  currency: z.string().min(3).max(10).nullable(),
  fiscal_year_start: z.string().optional().nullable(),
  fiscal_year_duration: z.number().optional().nullable(),
  vat_enabled: z.number().min(0).max(1).optional().nullable(),
  vat_rate: z.number().optional().nullable(),
  capital: z.number().optional().nullable(),
  manager_name: z.string().optional().nullable(),
  syscohada_system: z.string().optional().nullable(),
  corporate_tax_rate: z.number().optional().nullable(),
  imf_rate: z.number().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  bank_iban: z.string().optional().nullable(),
  bank_swift: z.string().optional().nullable(),
  payment_bank_enabled: z.union([z.boolean(), z.number()]).transform(v => Boolean(v)).optional(),
  payment_bank_account: z.string().optional().nullable(),
  payment_cash_enabled: z.union([z.boolean(), z.number()]).transform(v => Boolean(v)).optional(),
  payment_cash_account: z.string().optional().nullable(),
  payment_mobile_enabled: z.union([z.boolean(), z.number()]).transform(v => Boolean(v)).optional(),
  payment_mobile_account: z.string().optional().nullable(),
  invoiceReminderEnabled: z.union([z.boolean(), z.number()]).transform(v => Boolean(v)).optional(),
  invoiceReminderDays: z.number().optional().nullable(),
  invoiceReminderEmail: z.string().optional().nullable(),
  invoiceReminderSubject: z.string().optional().nullable(),
  invoiceReminderTemplate: z.string().optional().nullable(),
  cnps_employer_number: z.string().optional().nullable(),
  tax_office: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
});
