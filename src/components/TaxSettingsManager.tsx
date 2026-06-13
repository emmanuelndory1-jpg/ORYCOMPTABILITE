import React, { useState, useEffect } from 'react';
import { Percent, Building2, Users, Save, ShieldCheck, CalendarDays, Trash2 } from 'lucide-react';
import { VATSettingsManager } from './VATSettingsManager';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useDialog } from './DialogProvider';

export function TaxSettingsManager() {
  const [activeSubTab, setActiveSubTab] = useState<'vat' | 'corporate' | 'payroll' | 'deadlines'>('vat');
  const [corporateTaxRate, setCorporateTaxRate] = useState(25);
  const [imfRate, setImfRate] = useState(0.5);
  const [companySettings, setCompanySettings] = useState<any>(null);

  const [cnpsSal, setCnpsSal] = useState(6.3);
  const [cnpsPat, setCnpsPat] = useState(7.7);
  const [cnRate, setCnRate] = useState(1.5);
  const [taxApprentissage, setTaxApprentissage] = useState(0.4);
  const [deadlines, setDeadlines] = useState<any[]>([{ id: '1', name: 'Déclaration TVA', day: 15 }, { id: '2', name: 'Déclaration CNPS', day: 15  }, { id: '3', name: 'Impôts sur Salaires (ITS)', day: 15 }]);

  const { alert } = useDialog();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/company/settings');
      if (res.ok) {
        const data = await res.json();
        setCompanySettings(data);
        if (data.corporate_tax_rate !== undefined) setCorporateTaxRate(data.corporate_tax_rate);
        if (data.imf_rate !== undefined) setImfRate(data.imf_rate);
        if (data.tax_deadlines) { try { setDeadlines(JSON.parse(data.tax_deadlines)); } catch(e) {} }
      }

      const rulesRes = await apiFetch('/api/tax-rules');
      if (rulesRes.ok) {
        const rules = await rulesRes.json();
        const cnpsSalRule = rules.find((r: any) => r.code === 'CNPS_RET_SAL');
        const cnpsPatRule = rules.find((r: any) => r.code === 'CNPS_RET_PAT');
        const cnRule = rules.find((r: any) => r.code === 'CN');
        const fdfpRule = rules.find((r: any) => r.code === 'FDFP_TPC');

        if (cnpsSalRule) setCnpsSal(cnpsSalRule.rate * 100);
        if (cnpsPatRule) setCnpsPat(cnpsPatRule.rate * 100);
        if (cnRule) setCnRate(cnRule.rate * 100);
        if (fdfpRule) setTaxApprentissage(fdfpRule.rate * 100);
      }
    } catch(e) {
      console.error(e);
    }
  };

  
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

  const handleSaveCorporate = async () => {
    try {
      const payload = { ...companySettings, corporate_tax_rate: corporateTaxRate, imf_rate: imfRate };
      const res = await apiFetch('/api/company/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Paramètres Impôt Société enregistrés avec succès.");
      }
    } catch(e) {
      alert("Erreur lors de l'enregistrement.");
      console.error(e);
    }
  };

  const handleSavePayroll = async () => {
    try {
      const updates = [
        apiFetch('/api/tax-rules/CNPS_RET_SAL', { method: 'PUT', body: JSON.stringify({ rate: cnpsSal / 100, is_active: 1 }) }),
        apiFetch('/api/tax-rules/CNPS_RET_PAT', { method: 'PUT', body: JSON.stringify({ rate: cnpsPat / 100, is_active: 1 }) }),
        apiFetch('/api/tax-rules/CN', { method: 'PUT', body: JSON.stringify({ rate: cnRate / 100, is_active: 1 }) }),
        apiFetch('/api/tax-rules/FDFP_TPC', { method: 'PUT', body: JSON.stringify({ rate: taxApprentissage / 100, is_active: 1 }) })
      ];
      await Promise.all(updates);
      alert("Paramètres sociaux enregistrés avec succès.");
    } catch(e) {
      alert("Erreur lors de l'enregistrement des règles sociales.");
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="w-full min-w-0 overflow-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-max sm:w-fit min-w-full sm:min-w-0">
        <button
          onClick={() => setActiveSubTab('vat')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeSubTab === 'vat' 
              ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          TVA
        </button>
        <button
          onClick={() => setActiveSubTab('corporate')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeSubTab === 'corporate' 
              ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Impôt Société
        </button>
        <button
          onClick={() => setActiveSubTab('payroll')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeSubTab === 'payroll' 
              ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Social & Salaires
        </button>
        <button
          onClick={() => setActiveSubTab('deadlines')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeSubTab === 'deadlines' 
              ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Calendrier Fiscal
        </button>
      </div>
      </div>

      {activeSubTab === 'vat' && <VATSettingsManager />}

      {activeSubTab === 'deadlines' && (
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
      )}

      {activeSubTab === 'corporate' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                <Building2 className="text-brand-gold" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Paramètres Impôt Société</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Configuration des taux d'IS et IMF</p>
              </div>
            </div>
            <button onClick={handleSaveCorporate} className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
              <Save size={16} /> Enregistrer
            </button>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Taux d'imposition</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Taux IS Standard (%)</label>
                  <input type="number" value={corporateTaxRate} onChange={e => setCorporateTaxRate(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Minimum Forfaitaire (IMF) (%)</label>
                  <input type="number" value={imfRate} onChange={e => setImfRate(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-brand-gold mb-3">
                <ShieldCheck size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Note de Conformité</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Les taux par défaut sont configurés selon la loi de finances en vigueur pour la zone OHADA. Toute modification doit être justifiée par un régime fiscal spécifique (ex: Zone Franche).
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'payroll' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
                <Users className="text-brand-green" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Charges Sociales & Patronales</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Configuration des cotisations (CNPS, IGR, etc.)</p>
              </div>
            </div>
            <button onClick={handleSavePayroll} className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
              <Save size={16} /> Enregistrer
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Cotisations Sociales</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Part Salariale (CNPS)</span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={cnpsSal} onChange={e => setCnpsSal(Number(e.target.value))} className="w-16 px-2 py-1 text-right rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Part Patronale (CNPS)</span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={cnpsPat} onChange={e => setCnpsPat(Number(e.target.value))} className="w-16 px-2 py-1 text-right rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Impôts sur Salaires</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Contribution Nationale</span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={cnRate} onChange={e => setCnRate(Number(e.target.value))} className="w-16 px-2 py-1 text-right rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Taxe d'Apprentissage</span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={taxApprentissage} onChange={e => setTaxApprentissage(Number(e.target.value))} className="w-16 px-2 py-1 text-right rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
