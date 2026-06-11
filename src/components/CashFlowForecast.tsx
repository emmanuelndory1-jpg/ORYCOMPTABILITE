import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { generateCashFlowForecast } from '@/services/geminiService';
import { useCurrency } from '@/hooks/useCurrency';
import { Loader2, Plus, TrendingUp, AlertTriangle, Lightbulb, X, Calendar, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { useDialog } from './DialogProvider';

interface Scenario {
  name: string;
  type: 'sale' | 'delay' | 'expense';
  date: string;
  amount: number;
}

export function CashFlowForecast({ onClose }: { onClose: () => void }) {
  const { formatCurrency } = useCurrency();
  const { alert: showToast } = useDialog();
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<any>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [newScenario, setNewScenario] = useState<Scenario>({ name: '', type: 'sale', date: new Date().toISOString().split('T')[0], amount: 0 });

  const fetchAndGenerate = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/treasury/advanced-forecast', { method: 'POST' });
      const { data } = await res.json();
      
      const forecastResponse = await generateCashFlowForecast(data, scenarios);
      setForecast(forecastResponse);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la génération de prévisions : Trop de demandes à l'IA ou erreur interne.", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndGenerate();
  }, []); // Generate on mount, and then manually when scenarios are added

  const addScenario = () => {
    if (!newScenario.name || newScenario.amount <= 0) return;
    setScenarios([...scenarios, newScenario]);
    setIsAddingScenario(false);
    setNewScenario({ name: '', type: 'sale', date: new Date().toISOString().split('T')[0], amount: 0 });
  };

  const removeScenario = (index: number) => {
    setScenarios(scenarios.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/80 backdrop-blur-sm items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative border border-slate-200 dark:border-slate-800">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-50 dark:bg-slate-800 transition-colors">
          <X size={24} />
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 bg-brand-green/10 text-brand-green rounded-2xl">
            <Activity size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Prévisions de Trésorerie (IA)</h1>
            <p className="text-slate-500 font-medium mt-1">Analyse prédictive & Scénarios What-If par apprentissage sur vos données historiques</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Projection des soldes (90 jours)</h3>
                <button onClick={fetchAndGenerate} disabled={loading} className="px-4 py-2 bg-brand-green text-white text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
                  Actualiser
                </button>
              </div>

              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center text-brand-green">
                  <Loader2 size={40} className="animate-spin mb-4" />
                  <p className="font-bold animate-pulse">L'IA analyse vos tendances financières...</p>
                </div>
              ) : forecast && forecast.forecastPoints ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecast.forecastPoints}>
                      <defs>
                        <linearGradient id="colorBalanceA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => formatCurrency(val)} width={80} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', backgroundColor: '#0f172a', color: '#fff' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Area type="monotone" dataKey="solde" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBalanceA)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400 font-medium">Aucune donnée de prévision</div>
              )}
            </div>

            {forecast?.insights && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-800/50 flex gap-4">
                <Lightbulb size={24} className="text-blue-500 shrink-0 mt-1" />
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">Analyse Experte</h4>
                  <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{forecast.insights}</p>
                </div>
              </div>
            )}
            
            {forecast?.alerts?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-2">Alertes & Risques détectés</h3>
                {forecast.alerts.map((alert: any, idx: number) => (
                  <div key={idx} className={cn(
                    "p-4 rounded-2xl flex items-start gap-3 border",
                    alert.type === 'critical' ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800/50 dark:text-rose-300" :
                    alert.type === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300" :
                    "bg-brand-green/10 border-brand-green/20 text-brand-green"
                  )}>
                    <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">{alert.date} - {alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Scénarios What-If</h3>
                <button onClick={() => setIsAddingScenario(true)} className="p-2 bg-white dark:bg-slate-700 shadow-sm text-slate-600 dark:text-slate-300 rounded-xl hover:text-brand-green transition-colors">
                  <Plus size={18} />
                </button>
              </div>

              {isAddingScenario && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-4 space-y-3 shadow-lg">
                  <input
                    type="text" placeholder="Nom du scénario (ex: Gros contrat)"
                    value={newScenario.name} onChange={(e) => setNewScenario({...newScenario, name: e.target.value})}
                    className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-brand-green"
                  />
                  <div className="flex gap-2">
                    <select value={newScenario.type} onChange={(e) => setNewScenario({...newScenario, type: e.target.value as any})} className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-medium">
                      <option value="sale">Encaissement attendu</option>
                      <option value="delay">Retard de paiement</option>
                      <option value="expense">Dépense exceptionnelle</option>
                    </select>
                  </div>
                  <input
                    type="number" placeholder="Montant"
                    value={newScenario.amount || ''} onChange={(e) => setNewScenario({...newScenario, amount: Number(e.target.value)})}
                    className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-brand-green"
                  />
                  <input
                    type="date"
                    value={newScenario.date} onChange={(e) => setNewScenario({...newScenario, date: e.target.value})}
                    className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setIsAddingScenario(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Annuler</button>
                    <button onClick={addScenario} className="px-4 py-2 text-xs font-bold bg-brand-green text-white rounded-lg">Ajouter</button>
                  </div>
                </div>
              )}

              {scenarios.length === 0 ? (
                <p className="text-slate-400 text-sm font-medium text-center italic py-4">Ajoutez des scénarios pour voir leur impact sur la courbe.</p>
              ) : (
                <div className="space-y-3">
                  {scenarios.map((sc, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            sc.type === 'sale' ? "bg-brand-green" : sc.type === 'delay' ? "bg-amber-500" : "bg-rose-500"
                          )}></span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{sc.name}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Calendar size={12} /> {sc.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-sm">{formatCurrency(sc.amount)}</span>
                        <button onClick={() => removeScenario(idx)} className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button onClick={fetchAndGenerate} className="w-full py-3 mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-brand-green/20">
                    Appliquer et simuler
                  </button>
                </div>
              )}
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}
