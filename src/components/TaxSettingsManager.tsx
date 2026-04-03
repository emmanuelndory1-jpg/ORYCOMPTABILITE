import React, { useState } from 'react';
import { Percent, Building2, Users, Save, ShieldCheck } from 'lucide-react';
import { VATSettingsManager } from './VATSettingsManager';
import { cn } from '@/lib/utils';

export function TaxSettingsManager() {
  const [activeSubTab, setActiveSubTab] = useState<'vat' | 'corporate' | 'payroll'>('vat');

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
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
      </div>

      {activeSubTab === 'vat' && <VATSettingsManager />}

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
            <button className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
              <Save size={16} /> Enregistrer
            </button>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Taux d'imposition</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Taux IS Standard (%)</label>
                  <input type="number" defaultValue={25} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Minimum Forfaitaire (IMF) (%)</label>
                  <input type="number" defaultValue={0.5} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
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
            <button className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
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
                        <input type="number" defaultValue={6.3} className="w-16 px-2 py-1 text-right rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Part Patronale (CNPS)</span>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={7.7} className="w-16 px-2 py-1 text-right rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
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
                        <input type="number" defaultValue={1.5} className="w-16 px-2 py-1 text-right rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Taxe d'Apprentissage</span>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={0.4} className="w-16 px-2 py-1 text-right rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950" />
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
