import db from '../server/db';

async function resetDB() {
  console.log("Resetting Database...");
  
  db.exec("DELETE FROM journal_entries");
  db.exec("DELETE FROM assets");
  db.exec("DELETE FROM transactions");
  db.exec("DELETE FROM company_settings");
  
  // Reset sequences
  db.exec("DELETE FROM sqlite_sequence WHERE name='journal_entries'");
  db.exec("DELETE FROM sqlite_sequence WHERE name='transactions'");
  db.exec("DELETE FROM sqlite_sequence WHERE name='company_settings'");
  db.exec("DELETE FROM sqlite_sequence WHERE name='assets'");

  console.log("Database reset complete.");
}

resetDB().catch(console.error);
