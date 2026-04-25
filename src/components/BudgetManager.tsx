import React, { useState, useEffect } from 'react';
import { Target, Save, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

interface ExpenseAccount {
  code: string;
  name: string;
}

interface Budget {
  account_code: string;
  amount: number;
  account_name: string;
}

export function BudgetManager() {
  const { formatCurrency, currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [accounts, setAccounts] = useState<ExpenseAccount[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [currentYear, setCurrentYear] = useState(activeYear ? parseInt(activeYear.start_date.split('-')[0]) : new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (activeYear) {
      setCurrentYear(parseInt(activeYear.start_date.split('-')[0]));
    }
  }, [activeYear?.id]);

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  useEffect(() => {
    fetchData();
  }, [currentYear, currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accRes, budRes] = await Promise.all([
        fetch('/api/accounts/expenses'),
        fetch(`/api/budgets?year=${currentYear}&month=${currentMonth}`)
      ]);
      
      const accData = await accRes.json();
      const budData = await budRes.json();
      
      setAccounts(accData);
      
      const budMap: Record<string, number> = {};
      budData.forEach((b: Budget) => {
        budMap[b.account_code] = b.amount;
      });
      setBudgets(budMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (code: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setBudgets(prev => ({ ...prev, [code]: numValue }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const promises = Object.entries(budgets).map(([code, amount]) => 
        fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_code: code,
            amount,
            period_month: currentMonth,
            period_year: currentYear
          })
        })
      );
      
      await Promise.all(promises);
      setMessage({ type: 'success', text: 'Budgets enregistrés avec succès !' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement des budgets.' });
    } finally {
      setSaving(false);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="text-brand-green" />
            Gestion des Budgets
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Définissez vos objectifs de dépenses mensuels par catégorie.</p>
        </div>

        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-[140px] text-center font-medium text-slate-900 dark:text-white">
            {months[currentMonth - 1]} {currentYear}
          </div>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {message && (
        <div className={cn(
          "p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2",
          message.type === 'success' ? "bg-brand-green/10 text-brand-green border border-brand-green/20" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800"
        )}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Catégorie de Charge</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Budget Mensuel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-12" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-48" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    Aucun compte de charge trouvé.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">{acc.code}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{acc.name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          value={budgets[acc.code] || ''}
                          onChange={(e) => handleInputChange(acc.code, e.target.value)}
                          placeholder="0"
                          className="w-32 px-3 py-2 text-right text-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                        />
                        <span className="text-xs text-slate-400 font-medium">{currency}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="flex items-center gap-2 bg-brand-green hover:bg-brand-green-light text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {saving ? 'Enregistrement...' : 'Enregistrer les Budgets'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-brand-green/10 border border-brand-green/20 p-6 rounded-2xl">
          <h3 className="text-brand-green font-bold mb-2">Pourquoi budgétiser ?</h3>
          <p className="text-sm text-brand-green leading-relaxed">
            La budgétisation vous permet de contrôler vos coûts fixes et variables, d'anticiper les besoins de trésorerie et d'améliorer votre rentabilité nette.
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-6 rounded-2xl">
          <h3 className="text-blue-900 dark:text-blue-400 font-bold mb-2">Analyse Écart</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
            Une fois vos budgets définis, le tableau de bord affichera automatiquement les écarts entre vos prévisions et vos dépenses réelles.
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-6 rounded-2xl">
          <h3 className="text-amber-900 dark:text-amber-400 font-bold mb-2">Conseil Expert</h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
            Pour les charges variables (60, 61), basez vos budgets sur la moyenne des 3 derniers mois majorée de 5% pour plus de sécurité.
          </p>
        </div>
      </div>
    </div>
  );
}
