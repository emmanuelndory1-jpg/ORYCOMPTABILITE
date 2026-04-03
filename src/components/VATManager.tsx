import React, { useState, useEffect } from 'react';
import { Calculator, AlertCircle, FileText, Download } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { VATDeclaration } from './VATDeclaration';

export function VATManager() {
  const { formatCurrency } = useCurrency();
  const [view, setView] = useState<'dashboard' | 'declaration'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [vatData, setVatData] = useState({
    collected: 0,
    deductible: 0,
    payable: 0,
    credit: 0
  });

  useEffect(() => {
    if (view === 'dashboard') {
      fetchVATData();
    }
  }, [view]);

  const fetchVATData = async () => {
    setLoading(true);
    try {
      // Fetch current month data for dashboard
      const date = new Date();
      const res = await fetch(`/api/vat/declaration?month=${date.getMonth() + 1}&year=${date.getFullYear()}`);
      if (res.ok) {
        const data = await res.json();
        const net = data.netVat;
        setVatData({
          collected: data.collected.total,
          deductible: data.deductible.total,
          payable: net > 0 ? net : 0,
          credit: net < 0 ? Math.abs(net) : 0
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (view === 'declaration') {
    return <VATDeclaration onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion de la TVA</h1>
          <p className="text-slate-500 dark:text-slate-400">Suivi de la TVA collectée, déductible et à payer</p>
        </div>
        <button 
          onClick={() => setView('declaration')}
          className="bg-brand-green hover:bg-brand-green-light text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20"
        >
          <FileText size={18} />
          Nouvelle Déclaration
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">TVA Collectée (Mois en cours)</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(vatData.collected)}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Comptes 443</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">TVA Déductible (Mois en cours)</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(vatData.deductible)}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Comptes 445</div>
        </div>
        <div className={cn(
          "p-6 rounded-xl border shadow-sm",
          vatData.payable > 0 ? "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">TVA à Payer (Estimé)</div>
          <div className={cn("text-2xl font-bold", vatData.payable > 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-900 dark:text-white")}>
            {formatCurrency(vatData.payable)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Solde net à décaisser</div>
        </div>
        <div className={cn(
          "p-6 rounded-xl border shadow-sm",
          vatData.credit > 0 ? "bg-brand-green/5 border-brand-green/20" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Crédit de TVA (Estimé)</div>
          <div className={cn("text-2xl font-bold", vatData.credit > 0 ? "text-brand-green" : "text-slate-900 dark:text-white")}>
            {formatCurrency(vatData.credit)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">À reporter</div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
        <div className="max-w-md mx-auto">
          <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Déclarations Mensuelles</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Générez votre déclaration de TVA mensuelle avec le détail des opérations de vente et d'achat.
          </p>
          <button 
            onClick={() => setView('declaration')}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Accéder aux déclarations
          </button>
        </div>
      </div>
    </div>
  );
}
