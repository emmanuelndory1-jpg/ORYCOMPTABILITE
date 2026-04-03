import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, ShieldCheck, PieChart, BarChart3, ArrowRight, Loader2, Zap, Target, Activity, Info, Download } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { generateAudit as aiGenerateAudit } from '../services/geminiService';

interface AuditReport {
  summary: string;
  healthScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: {
    title: string;
    description: string;
    impact: 'Haut' | 'Moyen' | 'Bas';
  }[];
  ratios: {
    name: string;
    value: number;
  }[];
}

export function FinancialAuditor() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch audit data from backend
      const dataRes = await fetch('/api/ai/audit-data');
      if (!dataRes.ok) throw new Error("Erreur lors de la récupération des données d'audit");
      const auditData = await dataRes.json();

      // 2. Call AI service on frontend
      const auditReport = await aiGenerateAudit(auditData);
      if (!auditReport) throw new Error("Erreur lors de la génération de l'audit par l'IA");
      
      setReport(auditReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'Haut': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Moyen': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Bas': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center shadow-inner">
              <ShieldCheck className="text-brand-green" size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Audit Financier IA</h1>
                <span className="px-2 py-0.5 bg-brand-green/10 text-brand-green text-[10px] font-black uppercase tracking-widest rounded-full">Intelligence OHADA</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Analyse stratégique et conformité en temps réel</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
            <Download size={18} />
            Exporter PDF
          </button>
          <button 
            onClick={generateAudit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-brand-green text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-green-light transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
            Nouvel Audit
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!report && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl p-12 text-center"
          >
            <div className="w-20 h-20 bg-brand-green/10 rounded-3xl flex items-center justify-center mb-6">
              <ShieldCheck className="text-brand-green" size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight uppercase">Prêt pour l'Audit ?</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium mb-8">
              Lancez une analyse complète de vos données financières pour obtenir des recommandations stratégiques basées sur l'IA.
            </p>
            <button 
              onClick={generateAudit}
              className="flex items-center gap-2 px-8 py-4 bg-brand-green text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-green-light transition-all shadow-lg shadow-brand-green/20"
            >
              <Zap size={20} />
              Démarrer l'Audit IA
            </button>
          </motion.div>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl p-12 text-center"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-brand-green/20 border-t-brand-green rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="text-brand-green animate-pulse" size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight uppercase">Analyse en cours...</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
              Ory parcourt vos journaux, balance et grands livres pour générer un rapport de conformité SYSCOHADA détaillé.
            </p>
            <div className="mt-8 flex gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </motion.div>
        )}

        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Main Score & Summary */}
            <div className="lg:col-span-8 space-y-8">
              <div className="premium-card p-8 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-brand-green/10 transition-colors" />
                
                <div className="flex flex-col md:flex-row gap-10 items-center relative z-10">
                  <div className="relative flex-shrink-0">
                    <svg className="w-48 h-48 transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-slate-100 dark:text-slate-800"
                      />
                      <motion.circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={552.92}
                        initial={{ strokeDashoffset: 552.92 }}
                        animate={{ strokeDashoffset: 552.92 - (552.92 * report.healthScore) / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={cn(
                          report.healthScore >= 80 ? "text-brand-green" : 
                          report.healthScore >= 60 ? "text-amber-500" : "text-rose-500"
                        )}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{report.healthScore}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Santé</span>
                    </div>
                  </div>

                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                      <Activity size={18} className="text-brand-green" />
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Résumé de l'Audit</h2>
                    </div>
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      <ReactMarkdown>{report.summary}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-950 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                      <CheckCircle2 size={22} />
                    </div>
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Points Forts</h3>
                  </div>
                  <ul className="space-y-4">
                    {report.strengths.map((s, i) => (
                      <li key={i} className="flex gap-3 group">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:scale-150 transition-transform" />
                        <span className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-950 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
                      <AlertCircle size={22} />
                    </div>
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Points de Vigilance</h3>
                  </div>
                  <ul className="space-y-4">
                    {report.weaknesses.map((w, i) => (
                      <li key={i} className="flex gap-3 group">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 group-hover:scale-150 transition-transform" />
                        <span className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-slate-900 dark:bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Target size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                      <Zap className="text-brand-green" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Actions Recommandées</h3>
                      <p className="text-slate-400 text-xs font-medium">Optimisation Prioritaire</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.recommendations.map((r, i) => (
                      <div key={i} className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors flex gap-4 items-start">
                        <div className="w-6 h-6 rounded-full bg-brand-green text-slate-900 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                          0{i + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm mb-1">{r.title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">{r.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Analysis */}
            <div className="lg:col-span-4 space-y-8">
              {/* Radar Chart */}
              <div className="bg-white dark:bg-slate-950 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Profil de Risque</h3>
                  <Info size={16} className="text-slate-400" />
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={report.ratios}>
                      <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
                      <Radar
                        name="Score"
                        dataKey="value"
                        stroke="var(--color-brand-green)"
                        fill="var(--color-brand-green)"
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6 space-y-3">
                  {report.ratios.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{r.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-green transition-all duration-1000" 
                            style={{ width: `${r.value}%` }} 
                          />
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white">{r.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insight Card */}
              <div className="bg-brand-green p-8 rounded-[2.5rem] text-slate-900 relative overflow-hidden group">
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ory Insight</span>
                  </div>
                  <p className="text-lg font-black leading-tight mb-4 tracking-tight">
                    "Votre structure de coûts est saine, mais la rotation des stocks pourrait être optimisée de 15%."
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60">
                    <TrendingUp size={12} />
                    Potentiel de croissance élevé
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
