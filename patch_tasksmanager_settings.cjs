const fs = require('fs');

let path = 'src/components/TasksManager.tsx';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('const [companySettings')) {
  code = code.replace(
    /const \[search, setSearch\] = useState\(''\);/,
    "const [companySettings, setCompanySettings] = useState<any>(null);\n  const [search, setSearch] = useState('');"
  );
}

// Add to Promise.all
if (!code.includes('apiFetch(\)')) {
  code = code.replace(
    /apiFetch\('\/api\/assets'\),\s*apiFetch\('\/api\/advances'\)/,
    "apiFetch('/api/assets'),\n        apiFetch('/api/advances'),\n        apiFetch('/api/company/settings')"
  );
  code = code.replace(
    /const \[tasksRes, invRes, fyRes, recTxRes, recInvRes, payrollRes, txRes, assetsRes, advRes\] = await Promise\.all\(\[/,
    "const [tasksRes, invRes, fyRes, recTxRes, recInvRes, payrollRes, txRes, assetsRes, advRes, settingsRes] = await Promise.all(["
  );
  code = code.replace(
    /if \(advRes\.ok\) setAdvances\(await advRes\.json\(\)\);/,
    "if (advRes.ok) setAdvances(await advRes.json());\n      if (settingsRes && settingsRes.ok) setCompanySettings(await settingsRes.json());"
  );
}

// Map deadlines
const deadlinesBlock = `
    ...(companySettings && companySettings.tax_deadlines ? 
        Array.from({length: 12}).flatMap((_, i) => {
           let dls = [];
           try { dls = JSON.parse(companySettings.tax_deadlines); } catch(e){}
           const year = new Date().getFullYear();
           return dls.map(dl => {
             const date = new Date(year, i, dl.day);
             return { id: \, originalId: dl.id, type: 'task', title: dl.name, date: date.toISOString(), status: date < new Date() ? 'completed' : 'pending', priority: 'high', searchStr: dl.name.toLowerCase() }
           });
        }) : []),`;

code = code.replace(
  /...fiscalYears.flatMap\(fy => \[/,
  deadlinesBlock + "\n    ...fiscalYears.flatMap(fy => ["
);

fs.writeFileSync(path, code);
console.log('patched');
