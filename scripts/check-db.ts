
import Database from 'better-sqlite3';
const dbPath = process.env.DB_PATH || 'emma@123';
try {
  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => (t as any).name).join(', '));
  const ratesCount = db.prepare("SELECT COUNT(*) as count FROM exchange_rates").get();
  console.log('Exchange Rates Count:', (ratesCount as any).count);
} catch (err) {
  console.error('Check failed:', err);
}
