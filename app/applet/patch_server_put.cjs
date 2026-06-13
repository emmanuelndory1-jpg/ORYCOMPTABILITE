const fs = require('fs');

let path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

// Update destructuring
code = code.replace(
  'corporate_tax_rate, imf_rate, taxes_enabled',
  'corporate_tax_rate, imf_rate, taxes_enabled, taxDeadlines'
);

// Update query (UPDATE)
code = code.replace(
  'corporate_tax_rate = ?, imf_rate = ?',
  'corporate_tax_rate = ?, imf_rate = ?, tax_deadlines = ?'
);

// Update args
code = code.replace(
  /corporate_tax_rate === undefined \? existing\.corporate_tax_rate \: corporate_tax_rate,\s*imf_rate === undefined \? existing\.imf_rate \: imf_rate,\s*existing\.id/,
  'corporate_tax_rate === undefined ? existing.corporate_tax_rate : corporate_tax_rate,\n      imf_rate === undefined ? existing.imf_rate : imf_rate,\n      taxDeadlines === undefined ? existing.tax_deadlines : taxDeadlines,\n      existing.id'
);

// Update insert statement query
code = code.replace(
  'corporate_tax_rate, imf_rate\n      )',
  'corporate_tax_rate, imf_rate, tax_deadlines\n      )'
);
// Update insert statement values part
code = code.replace(
  '?, ?\n      )`);',
  '?, ?, ?\n      )`);'
);
// Update insert statement arguments
code = code.replace(
  /corporate_tax_rate === undefined \? 25 \: corporate_tax_rate,\s*imf_rate === undefined \? 0\.5 \: imf_rate\s*\);/,
  'corporate_tax_rate === undefined ? 25 : corporate_tax_rate,\n      imf_rate === undefined ? 0.5 : imf_rate,\n      taxDeadlines === undefined ? null : taxDeadlines\n    );'
);

fs.writeFileSync(path, code);
console.log('patched server.ts');
