import React, { useState, useEffect } from 'react';
import { Banknote, Plus, Trash2, Save, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { CurrencyAnalyzer } from './CurrencyAnalyzer';

interface ExchangeRate {
  id?: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  is_default: boolean;
  updated_at?: string;
}

export function CurrencyManager() {
  const { currency: baseCurrency } = useCurrency();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newRate, setNewRate] = useState<ExchangeRate>({
    from_currency: 'USD',
    to_currency: baseCurrency || 'FCFA',
    rate: 600,
    is_default: true
  });

  useEffect(() => {
    fetchRates();
  }, []);

  useEffect(() => {
    setNewRate(prev => ({ ...prev, to_currency: baseCurrency }));
  }, [baseCurrency]);

  const fetchRates = async () => {
    try {
      const res = await fetch('/api/exchange-rates');
      if (res.ok) {
        const data = await res.json();
        setRates(data);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des taux de change.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRate)
      });

      if (res.ok) {
        setSuccess("Taux de change ajouté/mis à jour.");
        fetchRates();
      } else {
        const data = await res.json();
        setError(data.error || "Erreur lors de l'ajout.");
      }
    } catch (err) {
      setError("Erreur de connexion.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRate = async (id: number) => {
    if (!confirm("Supprimer ce taux de change ?")) return;
    
    try {
      const res = await fetch(`/api/exchange-rates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRates(rates.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-green" /></div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
            <Banknote size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Gestion des Devises</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configurez vos taux de change par défaut</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-brand-green/10 dark:bg-brand-green/20 text-brand-green-dark dark:text-brand-green-light rounded-lg text-sm border border-brand-green/20 dark:border-brand-green/30">
            {success}
          </div>
        )}

        <form onSubmit={handleAddRate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">De (Devise étrangère)</label>
            <select 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={newRate.from_currency}
              onChange={e => setNewRate({...newRate, from_currency: e.target.value})}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="GNF">GNF</option>
              <option value="CDF">CDF</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Vers (Devise de base: {baseCurrency})</label>
            <input 
              type="text" 
              readOnly
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 outline-none"
              value={baseCurrency}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Taux (1 {newRate.from_currency} = ? {baseCurrency})</label>
            <input 
              type="number" 
              step="0.000001"
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={newRate.rate}
              onChange={e => setNewRate({...newRate, rate: parseFloat(e.target.value)})}
            />
          </div>
          <button 
            type="submit" 
            disabled={saving}
            className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 h-[42px]"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Ajouter
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 font-medium">De</th>
                <th className="px-4 py-3 font-medium">Vers</th>
                <th className="px-4 py-3 font-medium">Taux</th>
                <th className="px-4 py-3 font-medium">Dernière mise à jour</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">Aucun taux de change configuré.</td>
                </tr>
              ) : (
                rates.map((rate) => (
                  <tr key={rate.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{rate.from_currency}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{rate.to_currency}</td>
                    <td className="px-4 py-3 font-mono text-brand-green font-medium">1 {rate.from_currency} = {rate.rate} {rate.to_currency}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {rate.updated_at ? new Date(rate.updated_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => rate.id && handleDeleteRate(rate.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <CurrencyAnalyzer />
    </div>
  );
}
