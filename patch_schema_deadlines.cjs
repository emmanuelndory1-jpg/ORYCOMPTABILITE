const fs = require('fs');

let path = 'src/db/schema.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /vatRate: real\('vat_rate'\),\s*taxesEnabled: boolean\('taxes_enabled'\),/,
  "vatRate: real('vat_rate'),\n  taxDeadlines: text('tax_deadlines'),\n  taxesEnabled: boolean('taxes_enabled'),"
);

fs.writeFileSync(path, code);
console.log('patched schema.ts');
