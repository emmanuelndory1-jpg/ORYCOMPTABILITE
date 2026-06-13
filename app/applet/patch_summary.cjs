const fs = require('fs');

let path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

const match = /const deadlines = \[\s*\{ name: "Déclaration TVA",[\s\S]*?\];/;
const replacement = `let deadlines = [];
    const settings = db.prepare("SELECT tax_deadlines FROM company_settings ORDER BY id DESC LIMIT 1").get();
    if (settings && settings.tax_deadlines) {
      try {
        const dls = JSON.parse(settings.tax_deadlines);
        deadlines = dls.map(dl => {
          const nextMonthDate = new Date(Number(year), Number(month), dl.day);
          return {
            name: dl.name,
            date: nextMonthDate.toISOString().split('T')[0],
            status: 'upcoming'
          };
        });
      } catch(e) {}
    } else {
      deadlines = [
        { name: "Déclaration TVA", date: \`\${year}-\${String(Number(month) + 1).padStart(2, '0')}-15\`, status: 'upcoming' },
        { name: "Déclaration CNPS", date: \`\${year}-\${String(Number(month) + 1).padStart(2, '0')}-15\`, status: 'upcoming' },
        { name: "Impôts sur Salaires (ITS)", date: \`\${year}-\${String(Number(month) + 1).padStart(2, '0')}-15\`, status: 'upcoming' }
      ];
    }`;

if (match.test(code)) {
    code = code.replace(match, replacement);
    fs.writeFileSync(path, code);
    console.log('patched `/api/tax/summary` in server.ts');
} else {
    console.log('could not find match');
}
