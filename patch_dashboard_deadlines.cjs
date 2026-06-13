const fs = require('fs');

let path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

const match = /res\.json\(\{ tasks, invoices \}\);\s*\}\)\);/;
const replacement = `
  const settings = db.prepare("SELECT tax_deadlines FROM company_settings ORDER BY id DESC LIMIT 1").get();
  let customDeadlines = [];
  if (settings && settings.tax_deadlines) {
    try {
      const dls = JSON.parse(settings.tax_deadlines);
      const today = new Date();
      // add deadlines for current month and next month
      for (let offset = 0; offset <= 1; offset++) {
         const y = today.getFullYear();
         const m = today.getMonth() + offset;
         dls.forEach(dl => {
            const date = new Date(y, m, dl.day);
            customDeadlines.push({
               id: 'dl-' + dl.id + '-' + offset,
               title: dl.name,
               date: date.toISOString().split('T')[0],
               type: 'task'
            });
         });
      }
      // block past deadlines unless overdue, but for simplicity let's just pick upcoming
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + daysAhead);
      
      customDeadlines = customDeadlines.filter(d => {
         const dDate = new Date(d.date);
         return dDate >= today && dDate <= maxDate;
      });
      tasks.push(...customDeadlines);
    } catch(e) {}
  }

  res.json({ tasks, invoices });
}));`;

if (match.test(code)) {
    code = code.replace(match, replacement);
    fs.writeFileSync(path, code);
    console.log('patched `/api/dashboard/deadlines` in server.ts');
} else {
    console.log('could not find match');
}
