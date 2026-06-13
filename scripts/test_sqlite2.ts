import Database from 'better-sqlite3';

const db = new Database('compta.db');
const fiscalYear = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get() as any;
const startDate = fiscalYear.start_date;
const endDate = fiscalYear.end_date;

console.log("Testing dashboard queries...");

try {
  // test stats
  const revenueStmt = db.prepare(`SELECT SUM(je.credit - je.debit) as total FROM journal_entries je JOIN transactions t ON je.transaction_id = t.id WHERE je.account_code LIKE '7%' AND t.date >= ? AND t.date <= ?`);
  revenueStmt.get(startDate, endDate);
} catch (e) { console.log("Stats rev error:", e); }

try {
  const breakdownStmt = db.prepare(`
    SELECT bc.name as category, bc.color, SUM(je.debit - je.credit) as total
    FROM journal_entries je
    JOIN transactions t ON je.transaction_id = t.id
    JOIN budget_category_accounts bca ON je.account_code = bca.account_code
    JOIN budget_categories bc ON bca.category_id = bc.id
    WHERE je.account_code LIKE '6%' AND t.date >= ? AND t.date <= ? AND t.status = 'validated' AND t.deleted_at IS NULL
    GROUP BY bc.id
    ORDER BY total DESC
  `);
  breakdownStmt.all(startDate, endDate);
} catch (e) { console.log("Breakdown error:", e); }

try {
  const recentStmt = db.prepare(`
    SELECT t.*, je.account_code, je.debit, je.credit 
    FROM transactions t
    JOIN journal_entries je ON t.id = je.transaction_id
    WHERE t.date >= ? AND t.date <= ? AND t.deleted_at IS NULL
    ORDER BY t.date DESC, t.id DESC LIMIT 10
  `);
  recentStmt.all(startDate, endDate);
} catch (e) { console.log("Recent error:", e); }

try {
  const assetStatsRes = db.prepare("SELECT COUNT(*) as count FROM assets").get();
} catch(e) {}

try {
    const deadlinesStmt = db.prepare(`
    SELECT id, number, due_date, total_amount, type, status 
    FROM invoices 
    WHERE status IN ('sent', 'overdue', 'draft') 
    AND due_date IS NOT NULL 
    AND due_date <= date('now', '+' || ? || ' days')
    ORDER BY due_date ASC
  `);
  deadlinesStmt.all(7);
} catch(e) { console.log("Deadlines error:", e); }

try {
  const budgetVsActualStmt = db.prepare(`
    SELECT 
      bc.name as category,
      SUM(b.amount) as budgeted,
      (
        SELECT SUM(je.debit - je.credit)
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN budget_category_accounts bca ON je.account_code = bca.account_code
        WHERE bca.category_id = bc.id AND t.status = 'validated' AND t.deleted_at IS NULL AND t.date >= ? AND t.date <= ?
      ) as actual
    FROM budget_categories bc
    JOIN budget_category_accounts bca ON bc.id = bca.category_id
    JOIN budgets b ON bca.account_code = b.account_code
    WHERE b.period_year = strftime('%Y', ?)
    GROUP BY bc.id
  `);
  budgetVsActualStmt.all(startDate, endDate, startDate);
} catch(e) { console.log("BudgetVsActual error:", e); }

