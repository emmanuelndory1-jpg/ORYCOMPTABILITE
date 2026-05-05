import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Brain, CheckCircle2, AlertCircle, ArrowRight, Image as ImageIcon, Database, Zap, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

interface OCRFeedback {
  id: string;
  userId: string;
  imageHash: string;
  aiPrediction: any;
  userCorrection: any;
  region: string;
  timestamp: string;
}

export function AiTrainingDashboard() {
  const { t } = useLanguage();
  const [feedbacks, setFeedbacks] = useState<OCRFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, accuracy: 0, uemoa: 0, cemac: 0 });

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const q = query(collection(db, 'ocr_feedback'), orderBy('timestamp', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OCRFeedback));
      setFeedbacks(data);
      
      // Basic stats calculation
      const total = data.length;
      const uemoa = data.filter(f => f.region === 'UEMOA').length;
      const cemac = data.filter(f => f.region === 'CEMAC').length;
      
      setStats({ total, accuracy: 85, uemoa, cemac }); // Accuracy is placeholder for now
    } catch (error) {
      console.error("Error fetching OCR feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDiffCount = (ai: any, user: any) => {
    let diffs = 0;
    const keys = ['amount_ht', 'amount_ttc', 'date', 'third_party', 'invoice_number'];
    keys.forEach(k => {
      if (ai[k] !== user[k]) diffs++;
    });
    return diffs;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
            <Brain size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Apprentissage Continu OCR</h1>
            <p className="text-slate-500 dark:text-slate-400">Stratégie d'amélioration du modèle OHADA/UEMOA/CEMAC</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-bold flex items-center gap-2">
            <ShieldCheck size={16} /> Mode Entraînement Actif
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Exemples Collectés', value: stats.total, icon: Database, color: 'text-blue-500' },
          { label: 'Précision de Base', value: `${stats.accuracy}%`, icon: Zap, color: 'text-yellow-500' },
          { label: 'Documents UEMOA', value: stats.uemoa, icon: CheckCircle2, color: 'text-green-500' },
          { label: 'Documents CEMAC', value: stats.cemac, icon: AlertCircle, color: 'text-purple-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
              <stat.icon className={stat.color} size={20} />
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Database size={20} className="text-brand-green" />
              Historique des Feedback Humains
            </h2>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Zap className="animate-pulse text-slate-300" size={48} />
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center p-12 bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-300 dark:border-white/10">
                <p className="text-slate-500">Aucune donnée d'entraînement collectée pour le moment. Analysez des factures pour commencer.</p>
              </div>
            ) : (
              feedbacks.map((fb) => (
                <div key={fb.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-brand-green/30 transition-all group shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                        <ImageIcon size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">Document #{fb.imageHash.substring(0, 8)}</div>
                        <div className="text-[10px] text-slate-500">{new Date(fb.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {fb.region}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-red-50 dark:bg-red-500/5 rounded-2xl border border-red-100 dark:border-red-500/10">
                      <div className="text-[8px] font-extrabold uppercase text-red-500 mb-1">IA (Prédiction)</div>
                      <div className="text-xs font-bold truncate">{fb.aiPrediction.third_party}</div>
                      <div className="text-[10px] text-red-700 dark:text-red-400">{fb.aiPrediction.amount_ttc} CFA</div>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-500/5 rounded-2xl border border-green-100 dark:border-green-500/10 relative overflow-hidden">
                      <div className="text-[8px] font-extrabold uppercase text-green-500 mb-1">Humain (Correction)</div>
                      <div className="text-xs font-bold truncate">{fb.userCorrection.third_party}</div>
                      <div className="text-[10px] text-green-700 dark:text-green-400">{fb.userCorrection.amount_ttc} CFA</div>
                      <CheckCircle2 size={12} className="absolute bottom-2 right-2 text-green-500" />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      {calculateDiffCount(fb.aiPrediction, fb.userCorrection)} champ(s) corrigé(s)
                    </span>
                    <button className="text-[10px] font-bold text-brand-green hover:underline flex items-center gap-1">
                      Détails de l'exemple <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 border border-white/5 p-8 rounded-3xl text-white">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <ShieldCheck className="text-brand-green" />
              Stratégie Continuous-ML
            </h3>
            
            <div className="space-y-6">
              {[
                { 
                  title: 'Collecte de Delta', 
                  desc: 'Chaque correction manuelle est enregistrée avec son contexte fiscal régional.',
                  icon: Database
                },
                { 
                  title: 'Validation de Masque', 
                  desc: 'Les logos, tampons et signatures sont extraits pour améliorer la suppression du bruit.',
                  icon: ShieldCheck
                },
                { 
                  title: 'Réentraînement Mensuel', 
                  desc: 'Les données sont compilées pour le fine-tuning du modèle Gemini Flash.',
                  icon: Zap
                }
              ].map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                    <step.icon size={18} className="text-brand-green" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{step.title}</h4>
                    <p className="text-xs text-white/50 leading-relaxed mt-1">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-white/10">
              <button className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold transition-all">
                Générer Rapport d'Entraînement
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Conformité OHADA</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Mentions Légales</span>
                <span className="font-bold text-green-500">92%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[92%]" />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed italic">
                "Le modèle est particulièrement performant sur les factures du Sénégal (NINEA) et de Côte d'Ivoire (IFU)."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
