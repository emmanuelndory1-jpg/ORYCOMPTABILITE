import React, { useState, useEffect } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, Smartphone, Loader2, ArrowRightLeft, X, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { apiFetch as fetch } from '@/lib/api';

interface TreasuryAccount {
  name: string;
  type: 'bank' | 'cash' | 'mobile';
  balance: number;
  number: string;
  code: string;
}

interface TreasuryTransaction {
  label: string;
  amount: number;
  type: 'in' | 'out';
  date: string;
  method: string;
}

interface ForecastPoint {
  day: string;
  solde: number;
}

export function Treasury() {
  const { formatCurrency, currency, getCurrencyIcon } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [loading, setLoading] = useState(true);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    fromAccount: '',
    toAccount: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<{
    summary: {
      totalCash: number;
      monthlyVariation: number;
      variationPercentage: number;
      lastMonthBalance: number;
    };
    accounts: TreasuryAccount[];
    recentTransactions: TreasuryTransaction[];
    forecastData: ForecastPoint[];
  }>({
    summary: {
      totalCash: 0,
      monthlyVariation: 0,
      variationPercentage: 0,
      lastMonthBalance: 0
    },
    accounts: [],
    recentTransactions: [],
    forecastData: []
  });
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [activeChart, setActiveChart] = useState<'historical' | 'forecast'>('historical');

  useEffect(() => {
    fetchTreasuryData();
    fetchForecastData();
  }, [activeYear?.id]);

  const fetchTreasuryData = async () => {
    try {
      const response = await fetch('/api/treasury');
      if (!response.ok) throw new Error('Failed to fetch treasury data');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching treasury data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchForecastData = async () => {
    try {
      const response = await fetch('/api/dashboard/cashflow-forecast');
      if (response.ok) {
        const result = await response.json();
        setForecastData(result);
      }
    } catch (error) {
      console.error('Error fetching forecast data:', error);
    }
  };

  const getAccountIcon = (type: string, size: number) => {
    if (type === 'bank') return <CreditCard size={size} />;
    if (type === 'mobile') return <Smartphone size={size} />;
    return getCurrencyIcon(size);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferData.fromAccount || !transferData.toAccount || !transferData.amount) {
      setTransferError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (transferData.fromAccount === transferData.toAccount) {
      setTransferError("Les comptes source et destination doivent être différents");
      return;
    }

    setIsSubmitting(true);
    setTransferError(null);

    try {
      const response = await fetch('/api/treasury/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transferData,
          amount: parseFloat(transferData.amount)
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur lors du transfert');
      }

      setIsTransferModalOpen(false);
      setTransferData({
        fromAccount: '',
        toAccount: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchTreasuryData();
    } catch (error: any) {
      setTransferError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Trésorerie & Liquidités</h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Suivi en temps réel et prévisions de flux</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
          >
            <ArrowRightLeft size={18} /> Virement Interne
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-slate-900 text-white p-4 sm:p-6 rounded-3xl shadow-xl shadow-slate-900/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet size={80} />
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Trésorerie Totale</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-4">{formatCurrency(data.summary.totalCash)}</h2>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${data.summary.monthlyVariation >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {data.summary.monthlyVariation >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
              {Math.abs(data.summary.variationPercentage).toFixed(1)}%
            </span>
            <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">vs mois dernier</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Variation Mensuelle</p>
          <h2 className={`text-2xl sm:text-3xl font-black tracking-tight mb-4 ${data.summary.monthlyVariation >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {data.summary.monthlyVariation >= 0 ? '+' : ''}{formatCurrency(data.summary.monthlyVariation)}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Flux net de trésorerie</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 sm:col-span-2 lg:col-span-1">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Solde Prévu (30j)</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-4">
            {formatCurrency(forecastData.length > 0 ? forecastData[forecastData.length - 1].balance : data.summary.totalCash)}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Basé sur factures & échéances</span>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.accounts.map((acc, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-brand-green/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${
                acc.type === 'bank' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 
                acc.type === 'mobile' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 
                'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
              }`}>
                {getAccountIcon(acc.type, 18)}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{acc.code}</span>
            </div>
            
            <div className="space-y-1">
              <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">{acc.name}</div>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white tracking-tighter">
                {formatCurrency(acc.balance)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Analyse des Flux</h3>
              <p className="text-[10px] sm:text-xs text-slate-500">Historique vs Prévisions</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
              <button 
                onClick={() => setActiveChart('historical')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${activeChart === 'historical' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Historique
              </button>
              <button 
                onClick={() => setActiveChart('forecast')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${activeChart === 'forecast' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Prévisions
              </button>
            </div>
          </div>
          
          <div className="h-[250px] sm:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeChart === 'historical' ? data.forecastData : forecastData}>
                <defs>
                  <linearGradient id="colorSolde" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeChart === 'historical' ? "var(--color-brand-green)" : "#3b82f6"} stopOpacity={0.1}/>
                    <stop offset="95%" stopColor={activeChart === 'historical' ? "var(--color-brand-green)" : "#3b82f6"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                <XAxis 
                  dataKey={activeChart === 'historical' ? "day" : "label"} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'currentColor', fontSize: 10}} 
                  className="text-slate-400 dark:text-slate-500" 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'currentColor', fontSize: 10}} 
                  className="text-slate-400 dark:text-slate-500"
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    color: '#fff'
                  }}
                  itemStyle={{ color: activeChart === 'historical' ? 'var(--color-brand-green)' : '#60a5fa' }}
                  formatter={(value: number) => [formatCurrency(value), 'Solde']}
                />
                <Area 
                  type="monotone" 
                  dataKey={activeChart === 'historical' ? "solde" : "balance"} 
                  stroke={activeChart === 'historical' ? "var(--color-brand-green)" : "#3b82f6"} 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorSolde)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Mouvements Récents</h3>
            <p className="text-xs text-slate-500">Dernières opérations de trésorerie</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-slate-50 dark:divide-slate-800">
            {data.recentTransactions.map((item, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${item.type === 'in' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'}`}>
                    {item.type === 'in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{item.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{item.date} • {item.method}</div>
                  </div>
                </div>
                <div className={`font-mono font-black text-sm tracking-tighter ${item.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                  {item.type === 'in' ? '+' : '-'}{formatCurrency(item.amount)}
                </div>
              </div>
            ))}
            {data.recentTransactions.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <AlertCircle size={24} />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucun mouvement</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Virement Interne</h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              {transferError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm flex items-center gap-2 border border-rose-100 dark:border-rose-900/40">
                  <AlertCircle size={16} />
                  {transferError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Compte Source</label>
                <select 
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-slate-900 dark:text-slate-100"
                  value={transferData.fromAccount}
                  onChange={(e) => setTransferData({ ...transferData, fromAccount: e.target.value })}
                >
                  <option value="">Sélectionner un compte</option>
                  {data.accounts.map(acc => (
                    <option key={acc.code} value={acc.code}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Compte Destination</label>
                <select 
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-slate-900 dark:text-slate-100"
                  value={transferData.toAccount}
                  onChange={(e) => setTransferData({ ...transferData, toAccount: e.target.value })}
                >
                  <option value="">Sélectionner un compte</option>
                  {data.accounts.map(acc => (
                    <option key={acc.code} value={acc.code}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Montant ({currency})</label>
                <input 
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all font-mono text-slate-900 dark:text-slate-100"
                  placeholder="0.00"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Description (Optionnel)</label>
                <input 
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-slate-900 dark:text-slate-100"
                  placeholder="Ex: Approvisionnement caisse"
                  value={transferData.description}
                  onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</label>
                <input 
                  type="date"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-slate-900 dark:text-slate-100"
                  value={transferData.date}
                  onChange={(e) => setTransferData({ ...transferData, date: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-brand-green hover:bg-brand-green-light disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Confirmer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
