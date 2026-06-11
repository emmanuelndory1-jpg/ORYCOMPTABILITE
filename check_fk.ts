import db from './server/db';
try {
  const tpInfo = db.prepare("INSERT INTO third_parties (type, name, is_occasional) VALUES ('client', 'Test Occasional', 1)").run();
  console.log("Third party:", tpInfo.lastInsertRowid);
  const invoiceInfo = db.prepare("INSERT INTO invoices (type, number, date, third_party_id) VALUES ('invoice', 'FA-001', '2026-05-27', ?)").run(tpInfo.lastInsertRowid);
  console.log("Invoice:", invoiceInfo.lastInsertRowid);
  
  // Now item
  db.prepare("INSERT INTO invoice_items (invoice_id, description, account_code) VALUES (?, 'Item', '701')").run(invoiceInfo.lastInsertRowid);
  console.log("Success");
} catch(e) {
  console.error("Error", e.message);
}
