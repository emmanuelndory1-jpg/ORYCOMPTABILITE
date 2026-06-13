const sqlite3 = require('better-sqlite3');
const fs = require('fs');

const dbs = fs.readdirSync('.').filter(f => f.endsWith('.db'));
for (const dbName of dbs) {
  try {
    const db = new sqlite3(dbName);
    try {
      db.prepare('ALTER TABLE company_settings ADD COLUMN tax_deadlines TEXT;').run();
      console.log('Added tax_deadlines to', dbName);
    } catch(e) { 
      if (!e.message.includes('duplicate column')) {
        console.error(dbName, e.message);
      } else {
        console.log('tax_deadlines already exists in', dbName);
      }
    }
    db.close();
  } catch (e) {
    console.error('Could not open', dbName, e.message);
  }
}
