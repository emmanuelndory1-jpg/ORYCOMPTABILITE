const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "logoUrl={companySettings?.logo_url}",
  "logoUrl={companySettings?.logo_url}\n        taxesEnabled={companySettings?.taxes_enabled !== false && Number(companySettings?.taxes_enabled) !== 0}"
);

fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log('Fixed Sidebar props in App.tsx');
