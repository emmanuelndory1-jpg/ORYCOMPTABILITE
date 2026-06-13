import Database from 'better-sqlite3';
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE journals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    is_active INTEGER,
    is_system INTEGER
  )
`);

const defaultJournals = [
    ['VEN', 'Journal des Ventes', 'sales', 'Enregistrement des factures clients', 1, 1],
];

try {
  const insertJournal = db.prepare('INSERT INTO journals (id, name, type, description, is_active, is_system) VALUES (?, ?, ?, ?, ?, ?)');
  insertJournal.run(defaultJournals[0]);
  console.log("SUCCESS");
} catch(e) {
  console.log("ERROR RUN:", e.message);
}
