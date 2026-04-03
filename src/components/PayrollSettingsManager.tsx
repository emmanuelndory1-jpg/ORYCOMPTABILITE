import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertCircle, Percent, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

interface TaxRule {
  id: number;
  code: string;
  name: string;
  type: 'employee_social' | 'employee_tax' | 'employer_social' | 'employer_tax';
  rate: number | null;
  fixed_amount: number | null;
  ceiling: number | null;
  min_base: number | null;
  account_code: string | null;
  is_active: number;
}

export function PayrollSettingsManager() {
  const { formatCurrency, currency } = useCurrency();
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tax-rules');
      if (!res.ok) throw new Error('Failed to fetch tax rules');
      const data = await res.json();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (rule: TaxRule) => {
    setSaving(rule.code);
    try {
      const res = await fetch(`/api/tax-rules/${rule.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate: rule.rate,
          ceiling: rule.ceiling,
          fixed_amount: rule.fixed_amount,
          is_active: rule.is_active
        })
      });

      if (!res.ok) throw new Error('Failed to update rule');
      
      // Show success feedback briefly?
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  const handleChange = (code: string, field: keyof TaxRule, value: any) => {
    setRules(prev => prev.map(r => r.code === code ? { ...r, [field]: value } : r));
  };

  const groupRules = (typePrefix: string) => {
    return rules.filter(r => r.type.startsWith(typePrefix));
  };

  const renderRuleRow = (rule: TaxRule) => (
    <tr key={rule.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-6 py-4">
        <div className="font-medium text-slate-900 dark:text-slate-100">{rule.name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{rule.code}</div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.001"
            value={rule.rate ? (rule.rate * 100).toFixed(3) : ''}
            onChange={(e) => handleChange(rule.code, 'rate', parseFloat(e.target.value) / 100)}
            placeholder="-"
            className="w-20 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
          />
          <span className="text-slate-400 dark:text-slate-500 text-sm">%</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={rule.ceiling || ''}
            onChange={(e) => handleChange(rule.code, 'ceiling', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="Illimité"
            className="w-28 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
          />
          <span className="text-slate-400 dark:text-slate-500 text-xs">{currency}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <button
          onClick={() => handleChange(rule.code, 'is_active', rule.is_active ? 0 : 1)}
          className={cn(
            "p-1 rounded-full transition-colors",
            rule.is_active ? "text-brand-green hover:bg-brand-green/10 dark:hover:bg-brand-green/20" : "text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          {rule.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => handleUpdate(rule)}
          disabled={saving === rule.code}
          className="text-brand-green hover:text-brand-green-dark p-2 rounded-lg hover:bg-brand-green/10 dark:hover:bg-brand-green/20 transition-colors disabled:opacity-50"
        >
          {saving === rule.code ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        </button>
      </td>
    </tr>
  );

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Chargement des paramètres...</div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Paramètres de Paie</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Configuration des taux de cotisations sociales et fiscales</p>
        </div>
        <button 
          onClick={fetchRules}
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
        {/* Employee Part */}
        <div>
          <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Part Salariale (Retenues Employé)
          </div>
          <table className="w-full text-left">
            <thead className="bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-xs uppercase font-medium border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 w-1/3">Libellé</th>
                <th className="px-6 py-3">Taux</th>
                <th className="px-6 py-3">Plafond</th>
                <th className="px-6 py-3 text-center">Actif</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {groupRules('employee').map(renderRuleRow)}
            </tbody>
          </table>
        </div>

        {/* Employer Part */}
        <div>
          <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-t border-slate-100 dark:border-slate-800">
            Part Patronale (Charges Employeur)
          </div>
          <table className="w-full text-left">
            <thead className="bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-xs uppercase font-medium border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 w-1/3">Libellé</th>
                <th className="px-6 py-3">Taux</th>
                <th className="px-6 py-3">Plafond</th>
                <th className="px-6 py-3 text-center">Actif</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {groupRules('employer').map(renderRuleRow)}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 transition-colors">
        <p>Note : Les modifications de taux s'appliqueront uniquement aux futures fiches de paie générées. Les fiches déjà validées ne seront pas affectées.</p>
      </div>
    </div>
  );
}
