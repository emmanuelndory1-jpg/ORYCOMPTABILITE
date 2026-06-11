import Database from 'better-sqlite3';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Ensure you have a serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS
let app;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp();
  } else if (fs.existsSync('./serviceAccountKey.json')) {
    const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    app = initializeApp({ credential: cert(serviceAccount) });
  } else {
    app = initializeApp(); // fallback to default
  }
} catch (e) {
  console.log('Firebase Admin initialization error. Are credentials set?', e);
  process.exit(1);
}

const firestore = getFirestore(app);

const tables = [
  'accounts', 'third_parties', 'transactions', 'journal_entries', 'crm_deals',
  'bank_accounts', 'bank_transactions', 'custom_operations', 'company_settings',
  'partners', 'company_modules', 'tasks', 'fiscal_years', 'assets', 'depreciations',
  'audit_logs', 'employees', 'payroll_periods', 'payslips', 'subscriptions',
  'payment_transactions', 'notifications', 'messages', 'users', 'journals',
  'salary_advances', 'invoices', 'invoice_items', 'budgets', 'budget_revisions',
  'budget_categories', 'budget_category_accounts', 'budget_alerts', 'budget_engagements',
  'recurring_invoices', 'recurring_invoice_items', 'transaction_attachments',
  'exchange_rates', 'inventory_items', 'tax_rules', 'payroll_tax_brackets',
  'payroll_tax_reductions', 'payroll_rules', 'vat_settings', 'mobile_money_transactions',
  'recurring_transactions', 'recurring_transaction_lines'
];

async function migrateDatabase(dbPath: string, tenantId?: string) {
  if (!fs.existsSync(dbPath)) {
    console.log(`Database file not found: ${dbPath}`);
    return;
  }

  console.log(`Migrating database: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });

  for (const table of tables) {
    try {
      // Check if table exists
      const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      if (!tableExists) continue;

      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      if (rows.length === 0) continue;

      console.log(`- Migrating ${rows.length} rows from table '${table}'...`);

      const BATCH_SIZE = 400;
      let batch = firestore.batch();
      let count = 0;

      for (const row of rows) {
        // Prepare collection reference
        let colRef;
        if (tenantId) {
          // If multi-tenant, namespace by tenantId
          colRef = firestore.collection(`tenants/${tenantId}/${table}`);
        } else {
          // Global or user schema
          colRef = firestore.collection(table);
        }

        const docRef = (row as any).id 
          ? colRef.doc(String((row as any).id)) 
          : colRef.doc(); // Auto ID if no ID

        batch.set(docRef, row);
        count++;

        if (count % BATCH_SIZE === 0) {
          await batch.commit();
          batch = firestore.batch();
          console.log(`  Committed ${count} items from ${table}`);
        }
      }

      // Commit remaining
      if (count % BATCH_SIZE !== 0) {
        await batch.commit();
        console.log(`  Committed remaining from ${table}`);
      }

    } catch (e) {
      console.error(`Error migrating table ${table}:`, e);
    }
  }

  db.close();
  console.log(`Database ${dbPath} migration complete.`);
}

async function run() {
  console.log('Starting SQLite to Firebase migration...');
  
  // Migrate default defaultDb
  await migrateDatabase('compta.db');

  // Find all user-specific databases
  const files = fs.readdirSync('.');
  const userDbs = files.filter(f => f.startsWith('user_') && f.endsWith('.db') || f.startsWith('empty_user_') && f.endsWith('.db'));
  
  for (const f of userDbs) {
    // Determine a tenantId from the file name, e.g. "user_4.db" -> "user_4"
    const tenantId = f.replace('.db', '');
    await migrateDatabase(f, tenantId);
  }

  console.log('All migrations finished.');
}

run().catch(console.error);
