import Database from 'better-sqlite3';

const db = new Database('compta.db');
try {
const fiscalYear = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get() as any;
const startDateObj = new Date(fiscalYear.start_date);
const endDateObj = new Date(fiscalYear.end_date);
const year = startDateObj.getFullYear();
const month = (startDateObj.getMonth() + 1).toString().padStart(2, '0');
const monthEnd = `${year}-${month}-31`;

const cashStmt = db.prepare(`
    SELECT SUM(je.debit) - SUM(je.credit) as total
    FROM journal_entries je
    JOIN transactions t ON je.transaction_id = t.id
    WHERE je.account_code LIKE '5%' AND t.date <= ? AND t.status = 'validated' AND t.deleted_at IS NULL
`);
console.log(cashStmt.get(monthEnd));

const getRatios = () => {
    const revenueStmt = db.prepare(`
    SELECT SUM(je.credit - je.debit) as total 
    FROM journal_entries je
    JOIN transactions t ON je.transaction_id = t.id
    WHERE je.account_code LIKE '7%' AND t.date >= ? AND t.date <= ? AND t.status = 'validated' AND t.deleted_at IS NULL
  `);
  console.log(revenueStmt.get(fiscalYear.start_date, fiscalYear.end_date));
};
getRatios();
} catch (e) {
  console.log("Error:", e);
}
