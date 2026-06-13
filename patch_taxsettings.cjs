const fs = require('fs');

let path = 'src/components/TaxSettingsManager.tsx';
let code = fs.readFileSync(path, 'utf8');

// Update state type
code = code.replace(
  /useState<'vat' \| 'corporate' \| 'payroll'>/,
  "useState<'vat' | 'corporate' | 'payroll' | 'deadlines'>"
);

// Add state for custom deadlines
if (!code.includes('const [deadlines, setDeadlines]')) {
  code = code.replace(
    /const \[taxApprentissage, setTaxApprentissage\] = useState\(0\.4\);/,
    "const [taxApprentissage, setTaxApprentissage] = useState(0.4);\n  const [deadlines, setDeadlines] = useState<any[]>([{ id: '1', name: 'Déclaration TVA', day: 15 }, { id: '2', name: 'Déclaration CNPS', day: 15  }, { id: '3', name: 'Impôts sur Salaires (ITS)', day: 15 }]);"
  );
}

// Update fetch to populate deadlines from companySettings
if (!code.includes('if (data.taxDeadlines)')) {
  code = code.replace(
    /if \(data\.imf_rate !== undefined\) setImfRate\(data\.imf_rate\);/,
    "if (data.imf_rate !== undefined) setImfRate(data.imf_rate);\n        if (data.tax_deadlines) { try { setDeadlines(JSON.parse(data.tax_deadlines)); } catch(e) {} }"
  );
}

// Add tab button
const tabPayload = `        <button
          onClick={() => setActiveSubTab('deadlines')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeSubTab === 'deadlines' 
              ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Calendrier Fiscal
        </button>`;

code = code.replace(
  /Social & Salaires\n        <\/button>\n      <\/div>/,
  "Social & Salaires\n        </button>\n" + tabPayload + "\n      </div>"
);

// Helper methods for deadlines
const methods = `
  const handleSaveDeadlines = async () => {
    try {
      const res = await apiFetch('/api/company/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxDeadlines: JSON.stringify(deadlines) })
      });
      if (res.ok) alert('Calendrier sauvegardé', 'success');
      else alert('Erreur lors de la sauvegarde', 'error');
    } catch {
      alert('Erreur', 'error');
    }
  };

  const addDeadline = () => {
    setDeadlines([...deadlines, { id: Math.random().toString(), name: 'Nouvelle déclaration', day: 15 }]);
  };
`;

code = code.replace(/const handleSaveCorporate = async \(\) => \{/, methods + "\n  const handleSaveCorporate = async () => {");


// Add Tab content
const tabContent = `      {activeSubTab === 'deadlines' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
                <CalendarDays className="text-brand-green" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Calendrier Fiscal</h3>
                <p className="text-xs text-slate-500 mt-1">Personnalisez les dates de vos déclarations (intégrées au calendrier principal)</p>
              </div>
            </div>
            <button onClick={handleSaveDeadlines} className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-bold shadow-sm hover:bg-brand-green-light transition-colors">
              <Save size={16} /> Sauvegarder
            </button>
          </div>
          <div className="p-6 space-y-6">
            {deadlines.map((dl, idx) => (
              <div key={dl.id} className="flex items-center gap-4">
                <div className="flex-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nom de l'échéance</label>
                   <input 
                     type="text" 
                     value={dl.name}
                     onChange={(e) => {
                       const newDls = [...deadlines];
                       newDls[idx].name = e.target.value;
                       setDeadlines(newDls);
                     }}
                     className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 outline-none"
                   />
                </div>
                <div className="w-24">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Jour</label>
                   <input 
                     type="number" 
                     min="1" max="31"
                     value={dl.day}
                     onChange={(e) => {
                       const newDls = [...deadlines];
                       newDls[idx].day = Number(e.target.value);
                       setDeadlines(newDls);
                     }}
                     className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 outline-none"
                   />
                </div>
                <div className="pt-5">
                   <button onClick={() => setDeadlines(deadlines.filter((_, i) => i !== idx))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl dark:hover:bg-rose-500/10 transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
            <button onClick={addDeadline} className="flex items-center gap-2 mt-4 text-[11px] font-black text-brand-green uppercase tracking-widest hover:underline">+ Ajouter une échéance</button>
          </div>
        </div>
      )}`;

code = code.replace(/\{activeSubTab === 'vat' && <VATSettingsManager \/>\}/, "{activeSubTab === 'vat' && <VATSettingsManager />}\n\n" + tabContent);

if (!code.includes('CalendarDays')) {
    code = code.replace(/Save, ShieldCheck/, "Save, ShieldCheck, CalendarDays, Trash2");
}

fs.writeFileSync(path, code);
console.log('patched');
