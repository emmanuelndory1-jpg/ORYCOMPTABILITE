import db from './server/db';
try {
  const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, discount, vat_rate, total, account_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // Need a valid invoice_id. Let's create one.
  const inv = db.prepare("INSERT INTO invoices (type, number, date, third_party_id) VALUES ('invoice', '12123', '2026-05-27', 1)").run();
  
  insertItem.run(inv.lastInsertRowid, "Test item", 1, 100, 0, 18, 100, '701');
  console.log("Success");
} catch(e) {
  console.error("error:", e);
}

