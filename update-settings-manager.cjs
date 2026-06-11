const fs = require('fs');

let text = fs.readFileSync('src/components/CompanySettingsManager.tsx', 'utf8');

// Add taxes_enabled to interface
text = text.replace(
  'vat_regime: string;',
  'vat_regime: string;\n  taxes_enabled?: boolean | number;'
);

const newToggle = `
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                      <input
                        type="checkbox"
                        checked={settings.taxes_enabled !== false && Number(settings.taxes_enabled) !== 0}
                        onChange={e => setSettings({...settings, taxes_enabled: e.target.checked})}
                        className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-teal-500 bg-white"
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">Activer la gestion de la TVA, des impôts et des taxes</span>
                    </label>
                  </div>
`;

// Insert the toggle before tax_regime and vat_regime
text = text.replace(
  '<div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">',
  '<div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">\n' + newToggle
);

fs.writeFileSync('src/components/CompanySettingsManager.tsx', text, 'utf8');
console.log('Updated CompanySettingsManager.tsx');
