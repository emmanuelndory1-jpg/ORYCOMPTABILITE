const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceEditor.tsx', 'utf8');

const replacement1 = `
  const taxesEnabled = companySettings?.taxes_enabled !== false && Number(companySettings?.taxes_enabled) !== 0;

  // Calculs auto
`;

code = code.replace(
  "  // Calculs auto",
  replacement1
);

const columnHeader = `{taxesEnabled && <div className="col-span-1 text-center">TVA</div>}`;
code = code.replace(
  /<div className="col-span-1 text-center">TVA<\/div>/g,
  columnHeader
);

const itemInput = `{taxesEnabled && <div className="col-span-2 md:col-span-1 md:col-start-11">\\n                      <label className="md:hidden block text-[10px] font-black text-slate-400 uppercase mb-1">TVA</label>\\n                      <select\\n                        value={item.vat_rate}\\n                        onChange={(e) => updateItem(index, 'vat_rate', Number(e.target.value))}\\n                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-green/20 outline-none"\\n                        disabled={type === 'proforma'}\\n                      >\\n                        <option value={18}>18%</option>\\n                        <option value={9}>9%</option>\\n                        <option value={0}>0%</option>\\n                      </select>\\n                    </div>}`;
code = code.replace(
  /<div className="col-span-2 md:col-span-1 md:col-start-11">[\s\S]*?<label.*?TVA<\/label>[\s\S]*?<select[\s\S]*?<\/select>\s*<\/div>/g,
  itemInput
);

// To fix grid spacing when TVA hides:
// For the row headers:
// <div className="hidden md:grid grid-cols-12 gap-2 
// We should use dynamic or remove col-span-1 for TVA and increase others, but Tailwind doesn't allow easy dynamic spans like that unless we use template literals.
// But it's fine, let's leave the space or make it col-span-1 for Delete button? 
// 6 (desc) + 2 (qty) + 2 (prix) + 1 (tva) + 1 (action) = 12.
// If TVA goes, either desc=7 or actions=2.
// For now, let's just use `taxesEnabled` to conditionally render. Let's see the CSS.

// Also hide TVA in the totals summary:
const summaryTva = `{taxesEnabled && <div className="flex justify-between items-center text-xs">\\n                <span className="text-slate-400">TVA Totale</span>\\n                <span className="font-bold text-slate-700 dark:text-slate-300">\\n                  {formatCurrency(totalVAT, currency)}\\n                </span>\\n              </div>}`;
code = code.replace(
  /<div className="flex justify-between items-center text-xs">\s*<span className="text-slate-400">TVA Totale<\/span>[\s\S]*?<\/div>/g,
  summaryTva
);

fs.writeFileSync('src/components/InvoiceEditor.tsx', code, 'utf8');
console.log('Fixed InvoiceEditor.tsx VAT toggles');
