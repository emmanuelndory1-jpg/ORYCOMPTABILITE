const fs = require('fs');

let text = fs.readFileSync('server.ts', 'utf8');

text = text.replace(
  "taxRegime, vatSubject, vatRate,",
  "taxRegime, vatSubject, vatRate, taxes_enabled,"
);

text = text.replace(
  "vatSubject ? 'assujetti' : 'exonéré', vatRate, req.body.taxes_enabled !== undefined ? (req.body.taxes_enabled ? 1 : 0) : 1, capitalAmount, today, logoUrl",
  "vatSubject ? 'assujetti' : 'exonéré', vatRate, taxes_enabled !== undefined ? (taxes_enabled ? 1 : 0) : 1, capitalAmount, today, logoUrl"
);

fs.writeFileSync('server.ts', text, 'utf8');
console.log('Fixed undefined req.body.taxes_enabled in server.ts');
