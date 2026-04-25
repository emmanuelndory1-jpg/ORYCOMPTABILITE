import React, { useState, useEffect } from 'react';
import { Settings, Check, X, Loader2, AlertCircle, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Module {
  id: number;
  module_key: string;
  is_active: number;
}

const MODULE_LABELS: Record<string, { label: string, description: string }> = {
  'accounting': { label: 'Comptabilité', description: 'Journal, Grand Livre, Balance et États Financiers conformes SYSCOHADA.' },
  'invoicing': { label: 'Facturation & Devis', description: 'Gérez vos ventes, suivez vos créances et relancez vos clients facilement.' },
  'third_parties': { label: 'Tiers (CRM)', description: 'Répertoire centralisé de vos clients et fournisseurs avec historique complet.' },
  'treasury': { label: 'Trésorerie', description: 'Suivi des flux de trésorerie, gestion des caisses et des comptes bancaires.' },
  'assets': { label: 'Immobilisations', description: 'Gestion du registre des actifs et calcul automatique des amortissements.' },
  'payroll': { label: 'Paie', description: 'Débloquez la gestion des salariés, les périodes de paie et la génération des bulletins.' },
  'budget': { label: 'Budgets & Prévisions', description: 'Définissez vos objectifs budgétaires et suivez les écarts de réalisation.' },
  'vat': { label: 'Fiscalité (TVA)', description: 'Calcul automatique de la TVA et préparation des déclarations fiscales.' },
  'bankRec': { label: 'Rapprochement', description: 'Pointez vos opérations bancaires avec votre comptabilité en toute simplicité.' },
  'analytics': { label: 'Analyses Avancées', description: 'Tableaux de bord graphiques et analyses détaillées de votre performance.' },
  'audit': { label: 'Module Audit', description: 'Enregistrement complet des actions utilisateur (création, modification, suppression) pour une traçabilité totale.' }
};

export function ModuleManager() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/company/modules');
      if (!res.ok) throw new Error('Failed to fetch modules');
      const data = await res.json();
      setModules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = async (key: string, currentStatus: number) => {
    setUpdating(key);
    try {
      const res = await fetch(`/api/company/modules/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: currentStatus ? 0 : 1 })
      });

      if (!res.ok) throw new Error('Failed to update module');
      
      setModules(prev => prev.map(m => m.module_key === key ? { ...m, is_active: currentStatus ? 0 : 1 } : m));
      
      // We might need to reload the page or update a global context if the sidebar depends on this
      // For now, we'll just update the local state and suggest a refresh if needed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return (
    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <Loader2 className="w-8 h-8 animate-spin text-brand-green mx-auto mb-4" />
      <p className="text-slate-500 dark:text-slate-400">Chargement des modules...</p>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="text-brand-green" size={20} />
            Activation des Modules
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Activez ou désactivez les fonctionnalités selon vos besoins.</p>
        </div>
        <button 
          onClick={fetchModules}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-green dark:hover:text-brand-green hover:bg-brand-green/10 dark:hover:bg-brand-green/20 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2 border-b border-rose-100 dark:border-rose-900/40">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {modules.map((module) => {
          const info = MODULE_LABELS[module.module_key] || { label: module.module_key, description: 'Module système' };
          return (
            <div key={module.module_key} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex-1 pr-8">
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">{info.label}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{info.description}</p>
              </div>
              <div className="flex items-center gap-4">
                {updating === module.module_key ? (
                  <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
                ) : (
                  <button
                    onClick={() => toggleModule(module.module_key, module.is_active)}
                    className={cn(
                      "p-1 rounded-full transition-colors",
                      module.is_active ? "text-brand-green" : "text-slate-300 dark:text-slate-600"
                    )}
                  >
                    {module.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="p-4 bg-brand-green/5 text-[10px] font-bold text-brand-green uppercase tracking-widest border-t border-brand-green/10 text-center">
        Certaines modifications peuvent nécessiter un rafraîchissement de la page pour mettre à jour la navigation.
      </div>
    </div>
  );
}
