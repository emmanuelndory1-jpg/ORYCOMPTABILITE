const fs = require('fs');
let text = fs.readFileSync('server.ts', 'utf8');

text = text.replace(
  "vatSubject ? 'assujetti' : 'exonéré', vatRate, capitalAmount, today, logoUrl",
  "vatSubject ? 'assujetti' : 'exonéré', vatRate, req.body.taxes_enabled !== undefined ? (req.body.taxes_enabled ? 1 : 0) : 1, capitalAmount, today, logoUrl"
);

text = text.replace(
  "vat_regime, vat_rate, currency, address",
  "vat_regime, vat_rate, taxes_enabled, currency, address"
);

text = text.replace(
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

text = text.replace(
  "vatRegime ?? null, vat_rate || 18, currency ?? null",
  "vatRegime ?? null, vat_rate || 18, req.body.taxes_enabled !== undefined ? (req.body.taxes_enabled ? 1 : 0) : 1, currency ?? null"
);

fs.writeFileSync('server.ts', text, 'utf8');
console.log('Done');
