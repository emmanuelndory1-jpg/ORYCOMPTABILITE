import db from './server/db';

console.log("Acc 701:", db.prepare("SELECT * FROM accounts WHERE code = '701'").get());

try {
  let res = db.prepare(`INSERT INTO invoices (type, number, date, third_party_id) VALUES ('invoice', 'TEST-01', '2026-05-27', 1)`).run();
  console.log("Invoice 1 saved", res.lastInsertRowid);
  db.prepare(`INSERT INTO invoice_items (invoice_id, description, account_code) VALUES (?, 'Test', '701')`).run(res.lastInsertRowid);
  console.log("Item 1 saved");
} catch(e) {
  console.error("Test 1 error:", e);
}
