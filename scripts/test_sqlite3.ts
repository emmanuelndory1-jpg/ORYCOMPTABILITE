import Database from 'better-sqlite3';
const db = new Database('compta.db');

try {
  const stmt1 = db.prepare("SELECT 1");
  stmt1.get(1);
} catch(e) {
  console.log("TEST 1", e.message);
}

try {
  const stmt2 = db.prepare("SELECT @a");
  stmt2.get({ a: 1, b: 2 });
} catch(e) {
  console.log("TEST 2", e.message);
}

try {
    const stmt3 = db.prepare("SELECT ?");
    stmt3.get([1, 2]);
} catch(e) {
    console.log("TEST 3", e.message);
}
