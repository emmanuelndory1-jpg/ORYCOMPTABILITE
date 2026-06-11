const fs = require('fs');

let text = fs.readFileSync('server.ts', 'utf8');

// 1. Third Party Balance
text = text.replace(/SELECT SUM\(je.debit\) as debit, SUM\(je.credit\) as credit\s*FROM journal_entries je\s*WHERE je.account_code = \?/g, 
  `SELECT SUM(je.debit) as debit, SUM(je.credit) as credit
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code = ? AND t.deleted_at IS NULL`);

// 2. Overdue Balance
text = text.replace(/WHERE je.account_code = \? AND t.date <= \?( *)\\n/g, 
  `WHERE je.account_code = ? AND t.date <= ? AND t.deleted_at IS NULL$1\n`);

text = text.replace(/WHERE je.account_code = \? AND t.date > \?( *)\\n/g, 
  `WHERE je.account_code = ? AND t.date > ? AND t.deleted_at IS NULL$1\n`);

// 3. Transactions List
text = text.replace(/WHERE je.account_code = \?\s*ORDER BY/g, 
  `WHERE je.account_code = ? AND t.deleted_at IS NULL
      ORDER BY`);

// 4. Trial balance etc
text = text.replace(/AND t.status = 'validated'\\n/g, 
  `AND t.status = 'validated' AND t.deleted_at IS NULL\n`);

// Treasury balance
text = text.replace(/SELECT COALESCE\(SUM\(debit\), 0\) - COALESCE\(SUM\(credit\), 0\) as balance\s*FROM journal_entries\s*WHERE account_code = \?/g,
  `SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code = ? AND t.deleted_at IS NULL`);

text = text.replace(/SELECT COALESCE\(SUM\(debit\), 0\) - COALESCE\(SUM\(credit\), 0\) FROM journal_entries WHERE account_code = a.code/g,
  `SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) FROM journal_entries je JOIN transactions t ON je.transaction_id = t.id WHERE je.account_code = a.code AND t.deleted_at IS NULL`);

text = text.replace(/SELECT a.code, \(COALESCE\(SUM\(debit\), 0\) - COALESCE\(SUM\(credit\), 0\)\) as balance/g,
  `SELECT a.code, (COALESCE(SUM(je.debit), 0) - COALESCE(SUM(je.credit), 0)) as balance`);

// Other places with SUM(debit)
text = text.replace(/SUM\(debit\) as debit, SUM\(credit\) as credit \s*FROM journal_entries/g,
  `SUM(je.debit) as debit, SUM(je.credit) as credit 
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id`);

text = text.replace(/WHERE account_code = \?/g, `WHERE je.account_code = ? AND t.deleted_at IS NULL`);

fs.writeFileSync('server.ts', text, 'utf8');
console.log('Fixed deleted_at missing in SQL queries');
