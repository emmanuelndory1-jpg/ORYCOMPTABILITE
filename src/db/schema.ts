import { relations } from 'drizzle-orm';
import { pgTable, serial, text, integer, real, boolean, timestamp } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  classCode: integer('class_code').notNull(),
  type: text('type').notNull(),
});

export const third_parties = pgTable('third_parties', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  accountCode: text('account_code').notNull().unique(),
  creditLimit: real('credit_limit'),
  paymentTerms: integer('payment_terms'),
  isOccasional: boolean('is_occasional'),
  createdAt: text('created_at'),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  reference: text('reference'),
  status: text('status'),
  thirdPartyId: integer('third_party_id'),
  occasionalName: text('occasional_name'),
  dueDate: text('due_date'),
  currency: text('currency'),
  exchangeRate: real('exchange_rate'),
  recurringTransactionId: text('recurring_transaction_id'),
  operationType: text('operation_type'),
  amountHt: real('amount_ht'),
  vatRate: real('vat_rate'),
  paymentMode: text('payment_mode'),
  treasuryAccount: text('treasury_account'),
  creationMode: text('creation_mode'),
  notes: text('notes'),
  documentUrl: text('document_url'),
  deletedAt: text('deleted_at'),
});

export const journal_entries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').notNull(),
  accountCode: text('account_code').notNull(),
  debit: real('debit'),
  credit: real('credit'),
  description: text('description'),
});

export const crm_deals = pgTable('crm_deals', {
  id: serial('id').primaryKey(),
  thirdPartyId: integer('third_party_id').notNull(),
  title: text('title').notNull(),
  value: real('value'),
  probability: integer('probability'),
  stage: text('stage'),
  expectedCloseDate: text('expected_close_date'),
  department: text('department'),
  createdAt: text('created_at'),
});

export const bank_accounts = pgTable('bank_accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  accountNumber: text('account_number').notNull(),
  bankName: text('bank_name').notNull(),
  balance: real('balance'),
  currency: text('currency'),
  glAccountCode: text('gl_account_code'),
  lastSynced: text('last_synced'),
  createdAt: text('created_at'),
});

export const bank_transactions = pgTable('bank_transactions', {
  id: serial('id').primaryKey(),
  bankAccountId: integer('bank_account_id').notNull(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  reference: text('reference'),
  status: text('status'),
  matchedGlId: integer('matched_gl_id'),
});

export const custom_operations = pgTable('custom_operations', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  icon: text('icon').notNull(),
  vatAccountDebit: text('vat_account_debit'),
  vatAccountCredit: text('vat_account_credit'),
  entriesTemplate: text('entries_template').notNull(),
});

export const company_settings = pgTable('company_settings', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  legalForm: text('legal_form').notNull(),
  activity: text('activity'),
  creationDate: text('creation_date'),
  fiscalId: text('fiscal_id'),
  rccm: text('rccm'),
  taxRegime: text('tax_regime'),
  vatRegime: text('vat_regime'),
  vatRate: real('vat_rate'),
  taxDeadlines: text('tax_deadlines'),
  taxesEnabled: boolean('taxes_enabled'),
  currency: text('currency'),
  address: text('address'),
  city: text('city'),
  country: text('country'),
  capital: real('capital'),
  managerName: text('manager_name'),
  phone: text('phone'),
  email: text('email'),
  syscohadaSystem: text('syscohada_system'),
  fiscalYearStart: text('fiscal_year_start'),
  fiscalYearDuration: integer('fiscal_year_duration'),
  invoiceReminderEnabled: boolean('invoice_reminder_enabled'),
  invoiceReminderDays: integer('invoice_reminder_days'),
  invoiceReminderEmail: text('invoice_reminder_email'),
  invoiceReminderSubject: text('invoice_reminder_subject'),
  invoiceReminderTemplate: text('invoice_reminder_template'),
  logoUrl: text('logo_url'),
});

export const partners = pgTable('partners', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id'),
  name: text('name').notNull(),
  contributionAmount: real('contribution_amount').notNull(),
  contributionType: text('contribution_type').notNull(),
  description: text('description'),
});

export const company_modules = pgTable('company_modules', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id'),
  moduleKey: text('module_key').notNull(),
  isActive: boolean('is_active'),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status'),
  priority: text('priority'),
  category: text('category'),
  createdAt: text('created_at'),
  completedAt: text('completed_at'),
});

export const fiscal_years = pgTable('fiscal_years', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status'),
  isActive: boolean('is_active'),
});

export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  purchasePrice: real('purchase_price').notNull(),
  vatAmount: real('vat_amount'),
  totalPrice: real('total_price').notNull(),
  acquisitionDate: text('acquisition_date').notNull(),
  depreciationDuration: integer('depreciation_duration').notNull(),
  depreciationMethod: text('depreciation_method'),
  decliningCoefficient: real('declining_coefficient'),
  prorataTemporis: boolean('prorata_temporis'),
  accountCode: text('account_code').notNull(),
  transactionId: integer('transaction_id'),
  status: text('status'),
});

export const depreciations = pgTable('depreciations', {
  id: serial('id').primaryKey(),
  assetId: integer('asset_id').notNull(),
  transactionId: integer('transaction_id').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  amount: real('amount').notNull(),
  type: text('type').notNull(),
});

export const audit_logs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  user: text('user').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  position: text('position'),
  department: text('department'),
  baseSalary: real('base_salary').notNull(),
  startDate: text('start_date').notNull(),
  status: text('status'),
});

export const payroll_periods = pgTable('payroll_periods', {
  id: serial('id').primaryKey(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  status: text('status'),
  totalAmount: real('total_amount'),
  createdAt: text('created_at'),
  paymentTransactionId: integer('payment_transaction_id'),
});

export const payslips = pgTable('payslips', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  periodId: integer('period_id').notNull(),
  baseSalary: real('base_salary').notNull(),
  bonuses: real('bonuses'),
  deductions: real('deductions'),
  netSalary: real('net_salary').notNull(),
  details: text('details'),
  transactionId: integer('transaction_id'),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  planName: text('plan_name').notNull(),
  status: text('status'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  maxUsers: integer('max_users'),
  pricePaid: real('price_paid').notNull(),
  paymentReference: text('payment_reference'),
  createdAt: text('created_at'),
});

export const payment_transactions = pgTable('payment_transactions', {
  id: serial('id').primaryKey(),
  transactionId: text('transaction_id').notNull().unique(),
  gatewayReference: text('gateway_reference'),
  amount: real('amount').notNull(),
  currency: text('currency'),
  status: text('status'),
  planName: text('plan_name').notNull(),
  paymentMethod: text('payment_method'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  link: text('link'),
  isRead: boolean('is_read'),
  createdAt: text('created_at'),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  recipientEmail: text('recipient_email').notNull(),
  recipientName: text('recipient_name'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status'),
  attachmentUrl: text('attachment_url'),
  relatedInvoiceId: text('related_invoice_id'),
  createdAt: text('created_at'),
});

export const users = pgTable('users', {
  uid: text('uid').unique(), // Firebase Auth UID
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role'),
  permissions: text('permissions'),
  name: text('name'),
  createdAt: text('created_at'),
});

export const journals = pgTable('journals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  isActive: boolean('is_active'),
  isSystem: boolean('is_system'),
});

export const salary_advances = pgTable('salary_advances', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  description: text('description'),
  status: text('status'),
  payslipId: integer('payslip_id'),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  number: text('number').notNull().unique(),
  date: text('date').notNull(),
  dueDate: text('due_date'),
  thirdPartyId: integer('third_party_id').notNull(),
  occasionalName: text('occasional_name'),
  status: text('status'),
  subtotal: real('subtotal'),
  vatAmount: real('vat_amount'),
  totalAmount: real('total_amount'),
  paidAmount: real('paid_amount'),
  currency: text('currency'),
  exchangeRate: real('exchange_rate'),
  notes: text('notes'),
  terms: text('terms'),
  transactionId: integer('transaction_id'),
  lastReminderDate: text('last_reminder_date'),
  createdAt: text('created_at'),
});

export const invoice_items = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull(),
  inventoryItemId: integer('inventory_item_id'),
  description: text('description').notNull(),
  quantity: real('quantity'),
  unitPrice: real('unit_price'),
  vatRate: real('vat_rate'),
  discount: real('discount'),
  total: real('total'),
  accountCode: text('account_code'),
});

export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  accountCode: text('account_code').notNull(),
  amount: real('amount').notNull(),
  periodMonth: integer('period_month').notNull(),
  periodYear: integer('period_year').notNull(),
  lastRevisedAt: text('last_revised_at'),
});

export const budget_revisions = pgTable('budget_revisions', {
  id: serial('id').primaryKey(),
  budgetId: integer('budget_id').notNull(),
  oldAmount: real('old_amount').notNull(),
  newAmount: real('new_amount').notNull(),
  revisionDate: text('revision_date'),
  reason: text('reason'),
  revisedBy: text('revised_by'),
});

export const budget_categories = pgTable('budget_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  parentId: integer('parent_id'),
  type: text('type'),
});

export const budget_category_accounts = pgTable('budget_category_accounts', {
  categoryId: integer('category_id').notNull(),
  accountCode: text('account_code').notNull(),
});

export const budget_alerts = pgTable('budget_alerts', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id'),
  accountCode: text('account_code'),
  threshold: real('threshold').notNull(),
  isActive: integer('is_active'),
  lastTriggeredAt: text('last_triggered_at'),
});

export const budget_engagements = pgTable('budget_engagements', {
  id: serial('id').primaryKey(),
  accountCode: text('account_code').notNull(),
  amount: real('amount').notNull(),
  description: text('description'),
  engagementDate: text('engagement_date'),
  status: text('status'),
  reference: text('reference'),
  periodMonth: integer('period_month').notNull(),
  periodYear: integer('period_year').notNull(),
  createdBy: text('created_by'),
});

export const recurring_invoices = pgTable('recurring_invoices', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  thirdPartyId: integer('third_party_id').notNull(),
  frequency: text('frequency').notNull(),
  nextDate: text('next_date').notNull(),
  endDate: text('end_date'),
  subtotal: real('subtotal'),
  vatAmount: real('vat_amount'),
  totalAmount: real('total_amount'),
  currency: text('currency'),
  notes: text('notes'),
  terms: text('terms'),
  active: boolean('active'),
  createdAt: text('created_at'),
});

export const recurring_invoice_items = pgTable('recurring_invoice_items', {
  id: serial('id').primaryKey(),
  recurringInvoiceId: integer('recurring_invoice_id').notNull(),
  description: text('description').notNull(),
  quantity: real('quantity'),
  unitPrice: real('unit_price'),
  vatRate: real('vat_rate'),
  total: real('total'),
  accountCode: text('account_code'),
});

export const transaction_attachments = pgTable('transaction_attachments', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileType: text('file_type'),
  fileSize: integer('file_size'),
  createdAt: text('created_at'),
});

export const exchange_rates = pgTable('exchange_rates', {
  id: serial('id').primaryKey(),
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').notNull(),
  rate: real('rate').notNull(),
  isDefault: boolean('is_default'),
  updatedAt: text('updated_at'),
});

export const inventory_items = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  reference: text('reference').unique(),
  name: text('name').notNull(),
  category: text('category'),
  unit: text('unit'),
  quantity: integer('quantity'),
  minQuantity: integer('min_quantity'),
  unitPrice: real('unit_price'),
  updatedAt: text('updated_at'),
});

export const tax_rules = pgTable('tax_rules', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rate: real('rate'),
  fixedAmount: real('fixed_amount'),
  ceiling: real('ceiling'),
  minBase: real('min_base'),
  accountCode: text('account_code'),
  isActive: boolean('is_active'),
});

export const payroll_tax_brackets = pgTable('payroll_tax_brackets', {
  id: serial('id').primaryKey(),
  taxCode: text('tax_code').notNull(),
  minValue: real('min_value').notNull(),
  maxValue: real('max_value'),
  rate: real('rate').notNull(),
  deduction: real('deduction'),
});

export const payroll_tax_reductions = pgTable('payroll_tax_reductions', {
  id: serial('id').primaryKey(),
  maritalStatus: text('marital_status').notNull(),
  childrenCount: integer('children_count').notNull(),
  parts: real('parts').notNull(),
});

export const payroll_rules = pgTable('payroll_rules', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  formula: text('formula'),
  isTaxable: boolean('is_taxable'),
  isSocialTaxable: boolean('is_social_taxable'),
  isActive: boolean('is_active'),
});

export const vat_settings = pgTable('vat_settings', {
  id: serial('id').primaryKey(),
  rate: real('rate').notNull(),
  label: text('label').notNull(),
  accountCollected: text('account_collected').notNull(),
  accountDeductible: text('account_deductible').notNull(),
  isActive: boolean('is_active'),
});

export const mobile_money_transactions = pgTable('mobile_money_transactions', {
  id: serial('id').primaryKey(),
  gatewayId: text('gateway_id'),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency'),
  status: text('status'),
  network: text('network'),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  reference: text('reference'),
  invoiceId: integer('invoice_id'),
  createdAt: text('created_at'),
});

export const recurring_transactions = pgTable('recurring_transactions', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  frequency: text('frequency').notNull(),
  nextDate: text('next_date').notNull(),
  endDate: text('end_date'),
  maxOccurrences: integer('max_occurrences'),
  currentOccurrences: integer('current_occurrences'),
  lastProcessed: text('last_processed'),
  debitAccount: text('debit_account'),
  creditAccount: text('credit_account'),
  category: text('category'),
  active: integer('active'),
  autoProcess: integer('auto_process'),
  createdAt: text('created_at'),
});

export const recurring_transaction_lines = pgTable('recurring_transaction_lines', {
  id: serial('id').primaryKey(),
  recurringTransactionId: text('recurring_transaction_id').notNull(),
  accountCode: text('account_code').notNull(),
  debit: real('debit'),
  credit: real('credit'),
  description: text('description'),
});

