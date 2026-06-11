const fs = require('fs');

let text = fs.readFileSync('src/components/CompanyCreation.tsx', 'utf8');

text = text.replace(
  "taxRegime: 'RNI',",
  "taxRegime: 'RNI',\n      taxesEnabled: true,"
);

text = text.replace(
  "vatSubject: true,",
  "vatSubject: true," // do nothing
);

const newToggle = `
                <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">Activer la gestion de la TVA, impôts et taxes</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Si désactivé, les champs de TVA et taxes seront masqués partout.</div>
                  </div>
                  <button
                    onClick={() => updateFormData({ taxesEnabled: !formData.taxesEnabled })}
                    className={cn(
                      "w-14 h-8 rounded-full transition-all relative shrink-0",
                      formData.taxesEnabled ? "bg-brand-green" : "bg-slate-300 dark:bg-slate-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm",
                      formData.taxesEnabled ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
`;

// Insert the new toggle next to vatSubject in the Step 3 render
text = text.replace(
  '<h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">',
  newToggle + '\n\n                {formData.taxesEnabled && (<>\n                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">'
);

// End the condition block after vatSubject row
text = text.replace(
  /<div className={cn\([\s\S]*?"absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm"[\s\S]*?formData.vatSubject \? "left-7" : "left-1"[\s\S]*?\)} \/>\s*<\/button>\s*<\/div>\s*<\/div>/,
  `$&
                </>)}`
);

// Also add it to the final Payload parsing for the API call 
// `taxRegime: formData.taxRegime, vatSubject: formData.vatSubject` ... we should add `taxes_enabled: formData.taxesEnabled`
// It sends `...formData` directly? Let's check how the final request is done.
// `body: JSON.stringify(formData)`... so we just map it.
// Oh wait, Company_Creation uses /api/company ? Oh I see /api/setup/company
text = text.replace(
  "taxRegime: formData.taxRegime,",
  "taxRegime: formData.taxRegime,\n            taxes_enabled: formData.taxesEnabled,"
);

fs.writeFileSync('src/components/CompanyCreation.tsx', text, 'utf8');
console.log('Updated CompanyCreation.tsx');
