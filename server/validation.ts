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
  document_url: z.string().optional().nullable(),
  operation_type: z.string().optional().nullable(),
  amount_ht: z.number().optional().nullable(),
  vat_rate: z.number().optional().nullable(),
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
  name: z.string().min(2).max(100),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  fiscal_id: z.string().optional(),
  rccm: z.string().optional(),
  legal_form: z.string().optional(),
  activity: z.string().optional(),
  tax_regime: z.string().optional(),
  vat_regime: z.string().optional(),
  currency: z.string().min(3).max(10),
  fiscal_year_start: z.string().optional(),
  fiscal_year_duration: z.number().optional(),
  vat_enabled: z.number().min(0).max(1).optional(),
  vat_rate: z.number().optional(),
  capital: z.number().optional(),
  manager_name: z.string().optional(),
  syscohada_system: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_iban: z.string().optional(),
  bank_swift: z.string().optional(),
  payment_bank_enabled: z.boolean().optional(),
  payment_bank_account: z.string().optional(),
  payment_cash_enabled: z.boolean().optional(),
  payment_cash_account: z.string().optional(),
  payment_mobile_enabled: z.boolean().optional(),
  payment_mobile_account: z.string().optional(),
  cnps_employer_number: z.string().optional(),
  tax_office: z.string().optional(),
  logo_url: z.string().optional().nullable(),
});
