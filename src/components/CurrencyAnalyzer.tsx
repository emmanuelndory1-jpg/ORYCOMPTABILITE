import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Loader2, Globe, Clock, Save } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { apiFetch as fetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

interface MarketRate {
  from: string;
  to: string;
  rate: number;
  source: string;
}

interface AnalysisResult {
  currency: string;
  systemRate: number;
  marketRate: number;
  difference: number;
  status: 'up-to-date' | 'outdated' | 'missing';
}

export function CurrencyAnalyzer() {
  const { currency: baseCurrency, exchangeRates } = useCurrency();
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [updating, setUpdating] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

  const currenciesToAnalyze = ['USD', 'EUR', 'GBP', 'GNF', 'CDF', 'XOF', 'XAF'];

  const analyzeCurrencies = async () => {
    setAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Filter out base currency from analysis
      const targets = currenciesToAnalyze.filter(c => c !== baseCurrency);
      
      const prompt = `Provide the current exchange rates for the following currencies relative to ${baseCurrency}: ${targets.join(', ')}. 
      Return the data as a JSON array of objects with "from", "to", and "rate" (number) properties. 
      Example: [{"from": "USD", "to": "${baseCurrency}", "rate": 605.50}].
      Only return the JSON array, no other text.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        },
      });

      const marketRates: MarketRate[] = JSON.parse(response.text || "[]");
      
      const analysisResults: AnalysisResult[] = marketRates.map(mr => {
        const systemRate = exchangeRates.find(r => r.from_currency === mr.from && r.to_currency === mr.to)?.rate || 0;
        const diff = systemRate > 0 ? ((mr.rate - systemRate) / systemRate) * 100 : 0;
        
        return {
          currency: mr.from,
          systemRate,
          marketRate: mr.rate,
          difference: diff,
          status: systemRate === 0 ? 'missing' : Math.abs(diff) < 0.5 ? 'up-to-date' : 'outdated'
        };
      });

      setResults(analysisResults);
      setLastAnalysis(new Date());
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const updateAllRates = async () => {
    setUpdating(true);
    try {
      for (const res of results) {
        await fetch('/api/exchange-rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_currency: res.currency,
            to_currency: baseCurrency,
            rate: res.marketRate,
            is_default: true
          })
        });
      }
      // Refresh the page or trigger a reload of rates
      window.location.reload();
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="premium-card overflow-hidden transition-colors duration-300 mt-6">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl shadow-sm">
            <Globe size={24} />
          </div>
          <div>
            <h2 className="font-black text-slate-900 dark:text-slate-100 text-xl tracking-tight">Analyseur de Devises</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Comparez vos taux avec les valeurs actuelles du marché via IA</p>
          </div>
        </div>
        <button 
          onClick={analyzeCurrencies}
          disabled={analyzing}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 active:scale-95"
        >
          {analyzing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
          {results.length > 0 ? "Ré-analyser" : "Lancer l'analyse"}
        </button>
      </div>

      <div className="p-8">
        {results.length === 0 ? (
          <div className="text-center py-16 space-y-6">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400 shadow-inner">
              <Globe size={40} />
            </div>
            <div className="max-w-sm mx-auto space-y-2">
              <p className="text-slate-900 dark:text-white font-black text-lg tracking-tight">Prêt pour l'analyse ?</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium">L'IA va récupérer les taux de change en temps réel pour vous aider à ajuster vos factures multi-devises.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((res) => (
                <div key={res.currency} className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">{res.currency}</span>
                      <span className="text-xs text-slate-400 font-black uppercase tracking-widest">/ {baseCurrency}</span>
                    </div>
                    <div className={cn(
                      "p-1.5 rounded-lg",
                      res.status === 'up-to-date' ? "bg-emerald-50 text-emerald-500" :
                      res.status === 'outdated' ? "bg-amber-50 text-amber-500" :
                      "bg-rose-50 text-rose-500"
                    )}>
                      {res.status === 'up-to-date' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Système</p>
                      <p className="text-lg font-black text-slate-600 dark:text-slate-300 font-display">{res.systemRate || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Marché</p>
                      <p className="text-lg font-black text-blue-600 dark:text-blue-400 font-display">{res.marketRate}</p>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "p-1 rounded-full",
                        res.difference > 0 ? "bg-emerald-100 text-emerald-600" : res.difference < 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-400"
                      )}>
                        {res.difference > 0 ? <TrendingUp size={12} /> : res.difference < 0 ? <TrendingDown size={12} /> : <RefreshCw size={12} />}
                      </div>
                      <span className={cn(
                        "text-xs font-black tracking-tight",
                        res.difference > 0 ? "text-emerald-500" : res.difference < 0 ? "text-rose-500" : "text-slate-400"
                      )}>
                        {res.difference === 0 ? "Stable" : `${res.difference > 0 ? '+' : ''}${res.difference.toFixed(2)}%`}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                      res.status === 'up-to-date' ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50" :
                      res.status === 'outdated' ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50" :
                      "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50"
                    )}>
                      {res.status === 'up-to-date' ? "À jour" : res.status === 'outdated' ? "Obsolète" : "Manquant"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-8 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest">
                <Clock size={14} />
                Dernière analyse : {lastAnalysis ? lastAnalysis.toLocaleTimeString() : 'Jamais'}
              </div>
              <button 
                onClick={updateAllRates}
                disabled={updating}
                className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50 active:scale-95"
              >
                {updating ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Synchroniser tous les taux
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
