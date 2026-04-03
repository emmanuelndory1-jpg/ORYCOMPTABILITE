import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('compta.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    class_code INTEGER NOT NULL,
    type TEXT CHECK(type IN ('actif', 'passif', 'charge', 'produit', 'capitaux')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS third_parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'client' or 'supplier'
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    tax_id TEXT,
    account_code TEXT NOT NULL UNIQUE,
    credit_limit REAL DEFAULT 0,
    payment_terms INTEGER DEFAULT 30, -- days
    is_occasional BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    reference TEXT,
    status TEXT DEFAULT 'draft', -- draft, validated
    third_party_id INTEGER,
    occasional_name TEXT,
    due_date TEXT,
    currency TEXT DEFAULT 'FCFA',
    exchange_rate REAL DEFAULT 1,
    recurring_transaction_id TEXT, -- Link to recurring transaction
    FOREIGN KEY(third_party_id) REFERENCES third_parties(id)
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    account_code TEXT NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(account_code) REFERENCES accounts(code)
  );

  CREATE INDEX IF NOT EXISTS idx_journal_entries_account_code ON journal_entries(account_code);
  CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction_id ON journal_entries(transaction_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'XOF',
    gl_account_code TEXT, -- Linked GL account (e.g., 5211)
    last_synced TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(gl_account_code) REFERENCES accounts(code)
  );

  CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    reference TEXT,
    status TEXT DEFAULT 'pending', -- pending, matched
    matched_gl_id INTEGER,
    FOREIGN KEY(bank_account_id) REFERENCES bank_accounts(id),
    FOREIGN KEY(matched_gl_id) REFERENCES journal_entries(id)
  );

  CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_id ON bank_transactions(bank_account_id);
  CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);

  CREATE TABLE IF NOT EXISTS custom_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    vat_account_debit TEXT,
    vat_account_credit TEXT,
    entries_template TEXT NOT NULL -- JSON string
  );

  CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    legal_form TEXT NOT NULL,
    activity TEXT,
    creation_date TEXT,
    fiscal_id TEXT, -- NIF
    rccm TEXT,
    tax_regime TEXT,
    vat_regime TEXT,
    vat_rate REAL DEFAULT 18,
    currency TEXT DEFAULT 'FCFA',
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Côte d''Ivoire',
    capital REAL,
    manager_name TEXT,
    phone TEXT,
    email TEXT,
    syscohada_system TEXT DEFAULT 'normal',
    fiscal_year_start TEXT,
    fiscal_year_duration INTEGER DEFAULT 12,
    invoice_reminder_enabled BOOLEAN DEFAULT 0,
    invoice_reminder_days INTEGER DEFAULT 7,
    invoice_reminder_email TEXT, -- Configurable notification email
    invoice_reminder_subject TEXT DEFAULT 'Rappel de facture impayée',
    invoice_reminder_template TEXT DEFAULT 'Bonjour, votre facture {number} d''un montant de {total} est échue depuis le {due_date}. Merci de régulariser votre situation.'
  );

  CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name TEXT NOT NULL,
    contribution_amount REAL NOT NULL,
    contribution_type TEXT NOT NULL, -- cash, kind
    description TEXT,
    FOREIGN KEY(company_id) REFERENCES company_settings(id)
  );

  CREATE TABLE IF NOT EXISTS company_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    module_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 0,
    FOREIGN KEY(company_id) REFERENCES company_settings(id)
  );

  CREATE TABLE IF NOT EXISTS fiscal_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, closed
    is_active BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- building, vehicle, it, furniture, industrial, software, land
    purchase_price REAL NOT NULL,
    vat_amount REAL DEFAULT 0,
    total_price REAL NOT NULL,
    acquisition_date TEXT NOT NULL,
    depreciation_duration INTEGER NOT NULL, -- in years
    account_code TEXT NOT NULL,
    transaction_id INTEGER,
    status TEXT DEFAULT 'active', -- active, sold, scrapped
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS depreciations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    transaction_id INTEGER NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT CHECK(type IN ('annual', 'monthly')) NOT NULL,
    FOREIGN KEY(asset_id) REFERENCES assets(id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    user TEXT NOT NULL,
    action TEXT NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN, EXPORT
    entity TEXT NOT NULL, -- Transaction, Company, Settings, Asset, etc.
    entity_id TEXT,
    details TEXT -- JSON string with changes
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    position TEXT,
    department TEXT,
    base_salary REAL NOT NULL,
    start_date TEXT NOT NULL,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS payroll_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, validated
    total_amount REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    payment_transaction_id INTEGER REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS payslips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    base_salary REAL NOT NULL,
    bonuses REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_salary REAL NOT NULL,
    details TEXT, -- JSON with breakdown
    transaction_id INTEGER,
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(period_id) REFERENCES payroll_periods(id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_name TEXT NOT NULL, -- 'pro', 'business'
    status TEXT DEFAULT 'active', -- active, expired, cancelled
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    max_users INTEGER DEFAULT 1,
    price_paid REAL NOT NULL,
    payment_reference TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT NOT NULL UNIQUE, -- ID sent to gateway
    gateway_reference TEXT, -- ID returned by gateway
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'XOF',
    status TEXT DEFAULT 'pending', -- pending, success, failed
    plan_name TEXT NOT NULL,
    payment_method TEXT, -- orange_money, mtn, wave, card
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'info', 'warning', 'success', 'error'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- admin, user, accountant
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS salary_advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, repaid
    payslip_id INTEGER,
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(payslip_id) REFERENCES payslips(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'invoice' or 'quote'
    number TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    due_date TEXT,
    third_party_id INTEGER NOT NULL,
    occasional_name TEXT,
    status TEXT DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled, accepted, rejected
    subtotal REAL DEFAULT 0,
    vat_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'FCFA',
    exchange_rate REAL DEFAULT 1,
    notes TEXT,
    terms TEXT,
    transaction_id INTEGER, -- Linked accounting transaction
    last_reminder_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(third_party_id) REFERENCES third_parties(id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    vat_rate REAL DEFAULT 18,
    total REAL DEFAULT 0,
    account_code TEXT, -- Revenue account for invoices
    FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    FOREIGN KEY(account_code) REFERENCES accounts(code)
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_third_party ON invoices(third_party_id);

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_code TEXT NOT NULL,
    amount REAL NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    UNIQUE(account_code, period_month, period_year),
    FOREIGN KEY(account_code) REFERENCES accounts(code)
  );

  CREATE TABLE IF NOT EXISTS recurring_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'invoice' or 'quote'
    third_party_id INTEGER NOT NULL,
    frequency TEXT NOT NULL, -- 'weekly', 'monthly', 'quarterly', 'annually'
    next_date TEXT NOT NULL,
    end_date TEXT,
    subtotal REAL DEFAULT 0,
    vat_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'FCFA',
    notes TEXT,
    terms TEXT,
    active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(third_party_id) REFERENCES third_parties(id)
  );

  CREATE TABLE IF NOT EXISTS recurring_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurring_invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    vat_rate REAL DEFAULT 18,
    total REAL DEFAULT 0,
    account_code TEXT,
    FOREIGN KEY(recurring_invoice_id) REFERENCES recurring_invoices(id)
  );

  CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    is_default BOOLEAN DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency)
  );
`);

// Migration to add VAT columns if they don't exist
try {
  db.prepare("ALTER TABLE custom_operations ADD COLUMN vat_account_debit TEXT").run();
  db.prepare("ALTER TABLE custom_operations ADD COLUMN vat_account_credit TEXT").run();
} catch (e) {
  // Columns likely already exist
}

// Migration to add payment_transaction_id to payroll_periods
try {
  db.prepare("ALTER TABLE payroll_periods ADD COLUMN payment_transaction_id INTEGER REFERENCES transactions(id)").run();
} catch (e) {
  // Column likely already exists
}

// Migration to add marital_status and children_count to employees
try {
  db.prepare("ALTER TABLE employees ADD COLUMN marital_status TEXT DEFAULT 'single'").run();
  db.prepare("ALTER TABLE employees ADD COLUMN children_count INTEGER DEFAULT 0").run();
} catch (e) {
  // Columns likely already exist
}

// Migration to add cnps_number to employees
try {
  db.prepare("ALTER TABLE employees ADD COLUMN cnps_number TEXT").run();
} catch (e) {
  // Column likely already exists
}

// Migration for company_settings new fields
const newCols = [
  ['rccm', 'TEXT'],
  ['phone', 'TEXT'],
  ['email', 'TEXT'],
  ['syscohada_system', 'TEXT DEFAULT "normal"'],
  ['fiscal_year_start', 'TEXT'],
  ['fiscal_year_duration', 'INTEGER DEFAULT 12'],
  ['vat_rate', 'REAL DEFAULT 18']
];

for (const [col, type] of newCols) {
  try {
    db.prepare(`ALTER TABLE company_settings ADD COLUMN ${col} ${type}`).run();
  } catch (e) {}
}

// Create Tax Rules Table
db.exec(`
  CREATE TABLE IF NOT EXISTS tax_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'employee_social', 'employee_tax', 'employer_social', 'employer_tax'
    rate REAL, -- Percentage (0.063 for 6.3%)
    fixed_amount REAL, -- Fixed amount if applicable
    ceiling REAL, -- Max base amount
    min_base REAL, -- Min base amount
    account_code TEXT, -- SYSCOHADA Account
    is_active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS vat_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate REAL NOT NULL,
    label TEXT NOT NULL,
    account_collected TEXT NOT NULL,
    account_deductible TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1
  );
`);

// Seed VAT settings
const checkVatSettings = db.prepare('SELECT COUNT(*) as count FROM vat_settings');
if (checkVatSettings.get().count === 0) {
  const vatSettings = [
    [18, 'Taux Standard (18%)', '4431', '4452'],
    [10, 'Taux Réduit (10%)', '4431', '4452'],
    [5, 'Taux Super Réduit (5%)', '4431', '4452'],
    [2, 'Taux Spécial (2%)', '4431', '4452'],
    [0, 'Exonéré (0%)', '4431', '4452']
  ];
  const insertVatSetting = db.prepare('INSERT INTO vat_settings (rate, label, account_collected, account_deductible) VALUES (?, ?, ?, ?)');
  const insertManyVatSettings = db.transaction((settings) => {
    for (const setting of settings) insertVatSetting.run(setting);
  });
  insertManyVatSettings(vatSettings);
}

// Seed Ivorian Tax Rules
const checkRules = db.prepare('SELECT COUNT(*) as count FROM tax_rules');
if (checkRules.get().count === 0) {
  const rules = [
    // Employee Social
    ['CNPS_RET_SAL', 'CNPS Retraite (Part Salariale)', 'employee_social', 0.063, null, 1647315, null, '431'],
    
    // Employee Tax (Simplified rates for MVP, usually progressive)
    ['IS', 'Impôt sur Salaire (IS)', 'employee_tax', 0.012, null, null, null, '447'],
    ['CN', 'Contribution Nationale (CN)', 'employee_tax', 0.015, null, null, null, '447'], // Simplified avg
    ['IGR', 'Impôt Général sur le Revenu (IGR)', 'employee_tax', 0, null, null, null, '447'], // Calculated dynamically
    
    // Employer Social
    ['CNPS_RET_PAT', 'CNPS Retraite (Part Patronale)', 'employer_social', 0.077, null, 1647315, null, '431'],
    ['PF', 'Prestations Familiales', 'employer_social', 0.0575, null, 70000, null, '431'],
    ['AT', 'Accidents du Travail', 'employer_social', 0.02, null, 70000, null, '431'],
    
    // Employer Tax
    ['FDFP_TPC', 'Taxe Apprentissage (FDFP)', 'employer_tax', 0.004, null, null, null, '6413'],
    ['FDFP_FPC', 'Formation Continue (FDFP)', 'employer_tax', 0.012, null, null, null, '6413']
  ];
  
  const insertRule = db.prepare('INSERT INTO tax_rules (code, name, type, rate, fixed_amount, ceiling, min_base, account_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertManyRules = db.transaction((rules) => {
    for (const rule of rules) insertRule.run(rule);
  });
  insertManyRules(rules);
}

// Seed initial fiscal year if none exists
const checkFiscalYear = db.prepare('SELECT COUNT(*) as count FROM fiscal_years');
if (checkFiscalYear.get().count === 0) {
  const currentYear = new Date().getFullYear();
  db.prepare(`
    INSERT INTO fiscal_years (name, start_date, end_date, status, is_active)
    VALUES (?, ?, ?, 'open', 1)
  `).run(`Exercice ${currentYear}`, `${currentYear}-01-01`, `${currentYear}-12-31`);
}

// Seed default admin user if none exists
const checkUsers = db.prepare('SELECT COUNT(*) as count FROM users');
const defaultHash = bcrypt.hashSync('admin123', 10);

if (checkUsers.get().count === 0) {
  db.prepare(`
    INSERT INTO users (email, password_hash, role, name)
    VALUES (?, ?, 'admin', 'Administrateur')
  `).run('admin@example.com', defaultHash);
} else {
  // Force update the admin password hash just in case it was wrong
  db.prepare(`
    UPDATE users SET password_hash = ? WHERE email = 'admin@example.com'
  `).run(defaultHash);
}

// Seed initial SYSCOHADA accounts (Comprehensive List)
const seedAccounts = db.prepare('INSERT OR IGNORE INTO accounts (code, name, class_code, type) VALUES (?, ?, ?, ?)');
const initialAccounts = [
  // CLASSE 1 : RESSOURCES DURABLES
  ['101', 'Capital social', 1, 'capitaux'],
  ['1011', 'Capital souscrit, non appelé', 1, 'capitaux'],
  ['1012', 'Capital souscrit, appelé, non versé', 1, 'capitaux'],
  ['1013', 'Capital souscrit, appelé, versé, non amorti', 1, 'capitaux'],
  ['1014', 'Capital souscrit, appelé, versé, amorti', 1, 'capitaux'],
  ['1018', 'Capital social, autres', 1, 'capitaux'],
  ['102', 'Capital par dotation', 1, 'capitaux'],
  ['103', 'Capital personnel', 1, 'capitaux'],
  ['104', 'Compte de l\'exploitant', 1, 'capitaux'],
  ['105', 'Primes liées au capital social', 1, 'capitaux'],
  ['106', 'Ecarts de réévaluation', 1, 'capitaux'],
  ['109', 'Actionnaires, capital souscrit, non appelé', 1, 'actif'],
  ['111', 'Réserves légales', 1, 'capitaux'],
  ['112', 'Réserves statutaires ou contractuelles', 1, 'capitaux'],
  ['113', 'Réserves réglementées', 1, 'capitaux'],
  ['118', 'Autres réserves', 1, 'capitaux'],
  ['121', 'Report à nouveau créditeur', 1, 'capitaux'],
  ['129', 'Report à nouveau débiteur', 1, 'capitaux'],
  ['131', 'Résultat net : Bénéfice', 1, 'capitaux'],
  ['139', 'Résultat net : Perte', 1, 'capitaux'],
  ['141', 'Subventions d\'investissement', 1, 'capitaux'],
  ['151', 'Provisions pour risques', 1, 'passif'],
  ['152', 'Provisions pour charges', 1, 'passif'],
  ['161', 'Emprunts obligataires', 1, 'passif'],
  ['162', 'Emprunts auprès des établissements de crédit', 1, 'passif'],
  ['163', 'Avances reçues en comptes courants bloqués', 1, 'passif'],
  ['164', 'Avances reçues de l\'Etat', 1, 'passif'],
  ['165', 'Dépôts et cautionnements reçus', 1, 'passif'],
  ['166', 'Intérêts courus sur emprunts', 1, 'passif'],
  ['171', 'Dettes de crédit-bail', 1, 'passif'],
  ['181', 'Dettes liées à des participations', 1, 'passif'],

  // CLASSE 2 : ACTIF IMMOBILISÉ
  ['201', 'Frais d\'établissement', 2, 'actif'],
  ['202', 'Charges à répartir sur plusieurs exercices', 2, 'actif'],
  ['205', 'Concessions, brevets, licences, logiciels', 2, 'actif'],
  ['211', 'Terrains', 2, 'actif'],
  ['212', 'Agencements et aménagements de terrains', 2, 'actif'],
  ['221', 'Bâtiments', 2, 'actif'],
  ['231', 'Bâtiments industriels', 2, 'actif'],
  ['241', 'Matériel et outillage industriel', 2, 'actif'],
  ['242', 'Matériel et outillage agricole', 2, 'actif'],
  ['243', 'Matériel d\'emballage récupérable et identifiable', 2, 'actif'],
  ['244', 'Matériel de bureau et informatique', 2, 'actif'],
  ['245', 'Matériel de transport', 2, 'actif'],
  ['246', 'Immobilisations animales et agricoles', 2, 'actif'],
  ['261', 'Titres de participation', 2, 'actif'],
  ['271', 'Prêts et créances', 2, 'actif'],
  ['275', 'Dépôts et cautionnements versés', 2, 'actif'],
  ['281', 'Amortissements des immobilisations incorporelles', 2, 'actif'],
  ['282', 'Amortissements des terrains', 2, 'actif'],
  ['283', 'Amortissements des bâtiments', 2, 'actif'],
  ['284', 'Amortissements du matériel', 2, 'actif'],
  ['291', 'Dépréciations des immobilisations', 2, 'actif'],

  // CLASSE 3 : STOCKS
  ['311', 'Marchandises A', 3, 'actif'],
  ['312', 'Marchandises B', 3, 'actif'],
  ['321', 'Matières premières', 3, 'actif'],
  ['322', 'Fournitures liées', 3, 'actif'],
  ['331', 'Autres approvisionnements', 3, 'actif'],
  ['341', 'Produits en cours', 3, 'actif'],
  ['351', 'Services en cours', 3, 'actif'],
  ['361', 'Produits finis', 3, 'actif'],
  ['371', 'Produits intermédiaires', 3, 'actif'],
  ['381', 'Stocks en cours de route', 3, 'actif'],
  ['391', 'Dépréciations des stocks', 3, 'actif'],

  // CLASSE 4 : TIERS
  ['401', 'Fournisseurs, dettes en compte', 4, 'passif'],
  ['402', 'Fournisseurs, effets à payer', 4, 'passif'],
  ['408', 'Fournisseurs, factures non parvenues', 4, 'passif'],
  ['409', 'Fournisseurs débiteurs', 4, 'actif'],
  ['411', 'Clients', 4, 'actif'],
  ['412', 'Clients, effets à recevoir', 4, 'actif'],
  ['416', 'Créances clients douteuses', 4, 'actif'],
  ['418', 'Clients, produits à recevoir', 4, 'actif'],
  ['419', 'Clients créditeurs', 4, 'passif'],
  ['421', 'Personnel, rémunérations dues', 4, 'passif'],
  ['422', 'Fonds sociaux', 4, 'passif'],
  ['425', 'Personnel - Avances et acomptes', 4, 'actif'],
  ['428', 'Personnel, charges à payer et produits à recevoir', 4, 'passif'],
  ['431', 'Sécurité sociale', 4, 'passif'],
  ['432', 'Autres organismes sociaux', 4, 'passif'],
  ['441', 'État, impôt sur les bénéfices', 4, 'passif'],
  ['442', 'État, autres impôts et taxes', 4, 'passif'],
  ['443', 'État, TVA facturée', 4, 'passif'],
  ['4431', 'État, TVA facturée sur ventes', 4, 'passif'],
  ['444', 'État, Impôts et taxes', 4, 'passif'],
  ['445', 'État, TVA récupérable', 4, 'actif'],
  ['4451', 'État, TVA récupérable sur immobilisations', 4, 'actif'],
  ['4452', 'État, TVA récupérable sur achats', 4, 'actif'],
  ['4453', 'État, TVA récupérable sur transport', 4, 'actif'],
  ['4454', 'État, TVA récupérable sur services', 4, 'actif'],
  ['4458', 'État, TVA à régulariser', 4, 'actif'],
  ['447', 'État, impôts retenus à la source', 4, 'passif'],
  ['448', 'État, charges à payer et produits à recevoir', 4, 'passif'],
  ['449', 'État, créances et dettes diverses', 4, 'actif'],
  ['451', 'Associés, comptes courants', 4, 'passif'],
  ['461', 'Débiteurs divers', 4, 'actif'],
  ['462', 'Créditeurs divers', 4, 'passif'],
  ['471', 'Comptes d\'attente débiteurs', 4, 'actif'],
  ['472', 'Comptes d\'attente créditeurs', 4, 'passif'],
  ['476', 'Charges constatées d\'avance', 4, 'actif'],
  ['477', 'Produits constatés d\'avance', 4, 'passif'],
  ['481', 'Fournisseurs d\'investissements', 4, 'passif'],
  ['491', 'Dépréciations des comptes de tiers', 4, 'actif'],

  // CLASSE 5 : TRÉSORERIE
  ['501', 'Titres de placement', 5, 'actif'],
  ['511', 'Valeurs à l\'encaissement', 5, 'actif'],
  ['521', 'Banques locales', 5, 'actif'],
  ['531', 'Chèques postaux', 5, 'actif'],
  ['561', 'Banques, crédits de trésorerie', 5, 'passif'],
  ['571', 'Caisse siège', 5, 'actif'],
  ['572', 'Caisse succursale', 5, 'actif'],
  ['581', 'Virements de fonds', 5, 'actif'],
  ['585', 'Mobile Money (Orange/MTN/Wave)', 5, 'actif'],
  ['591', 'Dépréciations des comptes de trésorerie', 5, 'actif'],

  // CLASSE 6 : CHARGES
  ['601', 'Achats de marchandises', 6, 'charge'],
  ['602', 'Achats de matières premières', 6, 'charge'],
  ['604', 'Achats stockés de matières et fournitures', 6, 'charge'],
  ['605', 'Autres achats', 6, 'charge'],
  ['608', 'Achats d\'emballages', 6, 'charge'],
  ['611', 'Transport sur achats', 6, 'charge'],
  ['612', 'Transport sur ventes', 6, 'charge'],
  ['613', 'Transport pour le compte de tiers', 6, 'charge'],
  ['614', 'Transport du personnel', 6, 'charge'],
  ['621', 'Sous-traitance générale', 6, 'charge'],
  ['622', 'Locations et charges locatives', 6, 'charge'],
  ['623', 'Redevances de crédit-bail', 6, 'charge'],
  ['624', 'Entretien, réparations et maintenance', 6, 'charge'],
  ['625', 'Primes d\'assurance', 6, 'charge'],
  ['626', 'Etudes, recherches et documentation', 6, 'charge'],
  ['627', 'Publicité, publications, relations publiques', 6, 'charge'],
  ['628', 'Frais de télécommunications', 6, 'charge'],
  ['631', 'Frais bancaires', 6, 'charge'],
  ['632', 'Rémunérations d\'intermédiaires et honoraires', 6, 'charge'],
  ['633', 'Frais de formation du personnel', 6, 'charge'],
  ['638', 'Autres charges externes', 6, 'charge'],
  ['641', 'Impôts et taxes directs', 6, 'charge'],
  ['6413', 'Taxes sur appt et salaires', 6, 'charge'],
  ['645', 'Autres impôts et taxes', 6, 'charge'],
  ['646', 'Droits d\'enregistrement', 6, 'charge'],
  ['651', 'Pertes sur créances clients', 6, 'charge'],
  ['654', 'Valeur comptable des cessions courantes', 6, 'charge'],
  ['658', 'Autres charges diverses', 6, 'charge'],
  ['661', 'Rémunération du personnel', 6, 'charge'],
  ['662', 'Charges sociales', 6, 'charge'],
  ['663', 'Indemnités et avantages divers', 6, 'charge'],
  ['664', 'Charges sociales', 6, 'charge'],
  ['671', 'Intérêts des emprunts', 6, 'charge'],
  ['676', 'Pertes de change', 6, 'charge'],
  ['681', 'Dotations aux amortissements', 6, 'charge'],
  ['691', 'Impôt sur les bénéfices', 6, 'charge'],
  ['697', 'Dotations aux provisions', 6, 'charge'],

  // CLASSE 7 : PRODUITS
  ['701', 'Ventes de marchandises', 7, 'produit'],
  ['702', 'Ventes de produits finis', 7, 'produit'],
  ['703', 'Ventes de produits intermédiaires', 7, 'produit'],
  ['704', 'Ventes de travaux', 7, 'produit'],
  ['705', 'Ventes d\'études', 7, 'produit'],
  ['706', 'Services vendus', 7, 'produit'],
  ['707', 'Produits accessoires', 7, 'produit'],
  ['711', 'Production stockée', 7, 'produit'],
  ['721', 'Production immobilisée', 7, 'produit'],
  ['731', 'Produits nets partiels sur opérations à long terme', 7, 'produit'],
  ['751', 'Subventions d\'exploitation', 7, 'produit'],
  ['754', 'Produits des cessions courantes', 7, 'produit'],
  ['758', 'Autres produits divers', 7, 'produit'],
  ['771', 'Intérêts de prêts', 7, 'produit'],
  ['776', 'Gains de change', 7, 'produit'],
  ['781', 'Reprises d\'amortissements', 7, 'produit'],
  ['791', 'Reprises de provisions', 7, 'produit'],
  ['798', 'Transferts de charges', 7, 'produit'],

  // CLASSE 8 : AUTRES CHARGES ET PRODUITS (Hors Activités Ordinaires)
  ['811', 'Valeurs comptables des cessions d\'immobilisations', 8, 'charge'],
  ['821', 'Produits des cessions d\'immobilisations', 8, 'produit'],
  ['831', 'Charges hors activités ordinaires', 8, 'charge'],
  ['841', 'Produits hors activités ordinaires', 8, 'produit'],
  ['851', 'Dotations hors activités ordinaires', 8, 'charge'],
  ['861', 'Reprises hors activités ordinaires', 8, 'produit'],
  ['871', 'Participation des travailleurs', 8, 'charge'],
  ['881', 'Impôt sur le résultat HAO', 8, 'charge'],

  // CLASSE 9 : COMPTABILITÉ ANALYTIQUE (Optionnel, structure de base)
  ['901', 'Comptes réfléchis', 9, 'charge'],
  ['921', 'Centres d\'analyse', 9, 'charge'],
  ['931', 'Coûts des produits', 9, 'charge']
];

const insertMany = db.transaction((accounts) => {
  for (const acc of accounts) seedAccounts.run(acc);
});

insertMany(initialAccounts);

// Migration for invoice reminder fields
const reminderCols = [
  ['invoice_reminder_enabled', 'BOOLEAN DEFAULT 0'],
  ['invoice_reminder_days', 'INTEGER DEFAULT 7'],
  ['invoice_reminder_email', 'TEXT'],
  ['invoice_reminder_subject', 'TEXT DEFAULT "Rappel de facture impayée"'],
  ['invoice_reminder_template', 'TEXT DEFAULT "Bonjour, votre facture {number} d\'un montant de {total} est échue depuis le {due_date}. Merci de régulariser votre situation."']
];

for (const [col, type] of reminderCols) {
  try {
    db.prepare(`ALTER TABLE company_settings ADD COLUMN ${col} ${type}`).run();
  } catch (e) {}
}

try {
  db.prepare("ALTER TABLE invoices ADD COLUMN last_reminder_date TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE invoices ADD COLUMN paid_amount REAL DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE invoices ADD COLUMN currency TEXT DEFAULT 'FCFA'").run();
  db.prepare("ALTER TABLE invoices ADD COLUMN exchange_rate REAL DEFAULT 1").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'FCFA'").run();
  db.prepare("ALTER TABLE transactions ADD COLUMN exchange_rate REAL DEFAULT 1").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE company_settings ADD COLUMN currency TEXT DEFAULT 'FCFA'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE third_parties ADD COLUMN is_occasional BOOLEAN DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE invoices ADD COLUMN occasional_name TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE transactions ADD COLUMN occasional_name TEXT").run();
} catch (e) {}

// Seed Company Settings if empty
const checkCompany = db.prepare('SELECT COUNT(*) as count FROM company_settings');
if (checkCompany.get().count === 0) {
  db.prepare(`
    INSERT INTO company_settings (name, legal_form, activity, creation_date, fiscal_id, rccm, tax_regime, vat_regime, vat_rate, currency, address, city, country, capital, manager_name, phone, email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'OryCompta SARL',
    'SARL',
    'Services Informatiques et Conseil',
    '2025-01-01',
    '0123456X',
    'CI-ABJ-2025-B-1234',
    'Réel Normal',
    'Mensuel',
    18,
    'FCFA',
    'Cocody Angré, 7ème Tranche',
    'Abidjan',
    'Côte d\'Ivoire',
    10000000,
    'Emmanuel Ndory',
    '+225 0102030405',
    'contact@orycompta.ci'
  );
}

// Seed Demo Data (Third Parties, Employees, Assets, Transactions)
const checkDemoData = db.prepare('SELECT COUNT(*) as count FROM third_parties');
if (checkDemoData.get().count === 0) {
  // 1. Third Parties
  const thirdParties = [
    ['client', 'SARL Distribution Ivoirienne', 'contact@sarl-di.ci', '+225 0102030405', 'Abidjan, Plateau', '1234567A', '411101'],
    ['client', 'ETS Kouassi & Fils', 'kouassi@gmail.com', '+225 0506070809', 'Yamoussoukro', '7654321B', '411102'],
    ['supplier', 'SOCIETE IVOIRIENNE DE BUREAUTIQUE', 'sales@sib.ci', '+225 0708091011', 'Abidjan, Marcory', '9876543C', '401101'],
    ['supplier', 'CIE (Compagnie Ivoirienne d\'Electricité)', 'info@cie.ci', '175', 'Abidjan', '0000000D', '401102']
  ];
  const insertTP = db.prepare('INSERT INTO third_parties (type, name, email, phone, address, tax_id, account_code) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const tp of thirdParties) insertTP.run(tp);

  // 2. Employees
  const employees = [
    ['Jean', 'Bakayoko', 'j.bakayoko@orycompta.ci', '0101010101', 'Comptable', 'Finance', 450000, '2025-01-01', 'married', 2],
    ['Awa', 'Koné', 'a.kone@orycompta.ci', '0202020202', 'Commerciale', 'Ventes', 350000, '2025-06-01', 'single', 0]
  ];
  const insertEmp = db.prepare('INSERT INTO employees (first_name, last_name, email, phone, position, department, base_salary, start_date, marital_status, children_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const emp of employees) insertEmp.run(emp);

  // 3. Assets
  const assets = [
    ['Ordinateur MacBook Pro', 'it', 1200000, 216000, 1416000, '2026-01-10', 3, '244'],
    ['Mobilier de bureau', 'furniture', 800000, 144000, 944000, '2026-01-15', 5, '244']
  ];
  const insertAsset = db.prepare('INSERT INTO assets (name, type, purchase_price, vat_amount, total_price, acquisition_date, depreciation_duration, account_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const asset of assets) insertAsset.run(asset);

  // 4. Initial Transactions (Capital, Rent, Stock)
  // Capital Contribution (10,000,000)
  const trans1 = db.prepare('INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, ?)').run('2026-01-01', 'Apport initial en capital', 'REF-001', 'validated');
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans1.lastInsertRowid, '521', 10000000, 0);
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans1.lastInsertRowid, '101', 0, 10000000);

  // Rent Payment (500,000)
  const trans2 = db.prepare('INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, ?)').run('2026-02-01', 'Paiement loyer Février 2026', 'LOY-2026-02', 'validated');
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans2.lastInsertRowid, '622', 500000, 0);
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans2.lastInsertRowid, '521', 0, 500000);

  // Stock Purchase (2,000,000 HT + 18% TVA)
  const trans3 = db.prepare('INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, ?)').run('2026-02-15', 'Achat marchandises stock', 'FAC-SIB-001', 'validated');
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans3.lastInsertRowid, '601', 2000000, 0);
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans3.lastInsertRowid, '4452', 360000, 0);
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans3.lastInsertRowid, '401', 0, 2360000);

  // Sale (3,500,000 HT + 18% TVA)
  const trans4 = db.prepare('INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, ?)').run('2026-03-10', 'Vente de marchandises', 'FAC-CLI-001', 'validated');
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans4.lastInsertRowid, '411', 4130000, 0);
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans4.lastInsertRowid, '701', 0, 3500000);
  db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)').run(trans4.lastInsertRowid, '4431', 0, 630000);
}

// Migration for company_settings bank details
const bankCols = [
  ['bank_name', 'TEXT'],
  ['bank_account_number', 'TEXT'],
  ['bank_iban', 'TEXT'],
  ['bank_swift', 'TEXT']
];

for (const [col, type] of bankCols) {
  try {
    db.prepare(`ALTER TABLE company_settings ADD COLUMN ${col} ${type}`).run();
  } catch (e) {}
}

try {
  db.prepare("ALTER TABLE transactions ADD COLUMN notes TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE transactions ADD COLUMN document_url TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE invoices ADD COLUMN payment_link TEXT").run();
} catch (e) {}

// Migration for company_settings payment modes
const paymentModeCols = [
  ['payment_bank_enabled', 'BOOLEAN DEFAULT 1'],
  ['payment_bank_account', 'TEXT DEFAULT \'521\''],
  ['payment_cash_enabled', 'BOOLEAN DEFAULT 1'],
  ['payment_cash_account', 'TEXT DEFAULT \'571\''],
  ['payment_mobile_enabled', 'BOOLEAN DEFAULT 1'],
  ['payment_mobile_account', 'TEXT DEFAULT \'585\'']
];

for (const [col, type] of paymentModeCols) {
  try {
    db.prepare(`ALTER TABLE company_settings ADD COLUMN ${col} ${type}`).run();
  } catch (e) {}
}

export default db;
