import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const api = `
app.get("/api/dashboard/liquidity-history", asyncHandler((req, res) => {
  const fiscalYear = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get();
  if (!fiscalYear) return res.json([]);

  const startDateObj = new Date(fiscalYear.start_date);
  const endDateObj = new Date(fiscalYear.end_date);
  
  const historyData = [];
  let current = new Date(startDateObj);
  current.setDate(1);

  while (current <= endDateObj) {
    const year = current.getFullYear();
    const month = (current.getMonth() + 1).toString().padStart(2, '0');
    const monthName = current.toLocaleString('fr-FR', { month: 'short' });
    
    const monthStart = \`\${year}-\${month}-01\`;
    const monthEnd = \`\${year}-\${month}-31\`;

    const cashStmt = db.prepare(\`
      SELECT SUM(je.debit) - SUM(je.credit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '5%' AND t.date <= ? AND t.status = 'validated' AND t.deleted_at IS NULL
    \`);
    const cash = cashStmt.get(monthEnd).total || 0;

    const caStmt = db.prepare(\`
      SELECT SUM(je.debit - je.credit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE (je.account_code LIKE '3%' OR je.account_code LIKE '4%' OR je.account_code LIKE '5%') AND t.date <= ? AND t.status = 'validated' AND t.deleted_at IS NULL
    \`);
    const currentAssets = caStmt.get(monthEnd).total || 0;

    const clStmt = db.prepare(\`
      SELECT SUM(je.credit - je.debit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '4%' AND t.date <= ? AND t.status = 'validated' AND t.deleted_at IS NULL
    \`);
    const currentLiabilities = clStmt.get(monthEnd).total || 0;

    const ratio = currentLiabilities !== 0 ? Math.max(0, currentAssets / currentLiabilities) : (currentAssets > 0 ? 3 : 0);

    historyData.push({
      name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      cash: parseFloat((cash).toFixed(2)),
      ratio: parseFloat((ratio).toFixed(2))
    });

    current.setMonth(current.getMonth() + 1);
  }

  res.json(historyData);
}));
`;

content = content.replace('// Get dashboard expense breakdown', api + '\n// Get dashboard expense breakdown');
fs.writeFileSync('server.ts', content);
