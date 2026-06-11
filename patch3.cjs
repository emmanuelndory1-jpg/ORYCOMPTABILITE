const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const searchStr = `app.post("/api/invoices/check-reminders", (req, res) => {
  checkAndSendReminders();
  res.json({ success: true, message: "Vérification des rappels lancée." });
});`;

const replaceStr = searchStr + `

app.post("/api/invoices/:id/remind", (req, res) => {
  const { id } = req.params;
  try {
    const invoice = db.prepare(\`
      SELECT i.*, tp.name as client_name, tp.email as client_email
      FROM invoices i
      JOIN third_parties tp ON i.third_party_id = tp.id
      WHERE i.id = ?
    \`).get(id) as any;

    if (!invoice) return res.status(404).json({ error: "Facture non trouvée" });

    const settings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get() as any;
    
    const subject = (settings?.invoice_reminder_subject || 'Rappel de facture impayée').replace('{number}', invoice.number);
    const body = (settings?.invoice_reminder_template || "Bonjour {client_name}, votre facture {number} est en retard.")
      .replace('{number}', invoice.number)
      .replace('{total}', invoice.total_amount.toLocaleString())
      .replace('{due_date}', invoice.due_date || '-')
      .replace('{client_name}', invoice.client_name);

    console.log('[EMAIL REMINDER] To:', invoice.client_email);
    console.log('Subject:', subject);
    console.log('Body:', body);

    const todayStr = new Date().toISOString().split('T')[0];
    db.prepare("UPDATE invoices SET last_reminder_date = ? WHERE id = ?").run(todayStr, invoice.id);
    
    // Si c'est juste un rappel manuel, on met à jour le statut en overdue si c'est sent
    if (invoice.status === 'sent') {
       db.prepare("UPDATE invoices SET status = 'overdue' WHERE id = ?").run(invoice.id);
    }
    
    res.json({ success: true, message: "Rappel envoyé avec succès." });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});`;

if (code.includes(searchStr)) {
  code = code.replace(searchStr, replaceStr);
  fs.writeFileSync('server.ts', code);
  console.log("Patched server.ts successfully");
} else {
  console.error("Could not find string in server.ts");
}
