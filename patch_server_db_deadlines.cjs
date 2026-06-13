const fs = require('fs');

let path = 'server/db.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /vat_rate REAL DEFAULT 18,\s*taxes_enabled BOOLEAN DEFAULT 1,/,
  "vat_rate REAL DEFAULT 18,\n    tax_deadlines TEXT,\n    taxes_enabled BOOLEAN DEFAULT 1,"
);

fs.writeFileSync(path, code);
console.log('patched db.ts');
