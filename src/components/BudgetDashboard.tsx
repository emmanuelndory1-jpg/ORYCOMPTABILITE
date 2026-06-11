import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';
import { Loader2, AlertCircle, Info, Sparkles, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CategoryData {
  id: number;
  name: string;
  color: string;
  type: string;
  budget: number;
  engaged: number;
  actual: number;
  available: number;
}

interface Insight {
  type: 'recurring' | 'anomaly';
  title: string;
  description: string;
  priority: 'high' | 'medium';
}

export function BudgetDashboard({ year, month }: { year: number; month: number }) {
  const { formatCurrency } = useCurrency();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [year, month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catsRes, statRes, insightsRes] = await Promise.all([
        apiFetch('/api/budgets/categories'),
        apiFetch(`/api/budgets/status?year=${year}&month=${month}`),
        apiFetch(`/api/budgets/insights?year=${year}&month=${month}`)
      ]);
      const catsList = await catsRes.json();
      const statusList = await statRes.json();
      const insightsList = await insightsRes.json();

      const combined: CategoryData[] = catsList.map((c: any) => {
        const catStats = statusList.filter((s: any) => c.accounts.includes(s.account_code));
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          type: c.type,
          budget: catStats.reduce((sum: number, s: any) => sum + s.budget, 0),
          engaged: catStats.reduce((sum: number, s: any) => sum + s.engaged, 0),
          actual: catStats.reduce((sum: number, s: any) => sum + s.actual, 0),
          available: catStats.reduce((sum: number, s: any) => sum + s.available, 0)
        };
      }).filter((c: CategoryData) => c.budget > 0 || c.actual > 0 || c.engaged > 0);

      setCategories(combined);
      setInsights(insightsList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-green" /></div>;

  const totalBudget = categories.reduce((sum, c) => sum + c.budget, 0);
  const totalActual = categories.reduce((sum, c) => sum + c.actual, 0);
  const totalEngaged = categories.reduce((sum, c) => sum + c.engaged, 0);
  const totalAvailable = totalBudget - totalActual - totalEngaged;

  const pieData = categories.filter(c => c.actual > 0).map(c => ({ name: c.name, value: c.actual, color: c.color }));
  
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Rapport Budgétaire - ${month}/${year}`, 14, 22);
    
    // Add Summary
    doc.setFontSize(12);
    doc.text(`Budget Total: ${formatCurrency(totalBudget)}`, 14, 32);
    doc.text(`Réalisé: ${formatCurrency(totalActual)}`, 14, 40);
    doc.text(`Engagé: ${formatCurrency(totalEngaged)}`, 14, 48);
    doc.text(`Disponible: ${formatCurrency(totalAvailable)}`, 14, 56);

    const tableData = categories.map(c => [
      c.name,
      formatCurrency(c.budget),
      formatCurrency(c.actual),
      formatCurrency(c.engaged),
      formatCurrency(c.available),
      c.budget > 0 ? `${(((c.actual + c.engaged) / c.budget) * 100).toFixed(1)}%` : '-'
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Catégorie', 'Budget', 'Réalisé', 'Engagé', 'Dipo.', '% Utilisé']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    if (insights.length > 0) {
      let finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text("Insights et Alertes", 14, finalY);
      doc.setFontSize(10);
      finalY += 8;
      insights.forEach(insight => {
        doc.text(`- ${insight.title} : ${insight.description}`, 14, finalY, { maxWidth: 180 });
        finalY += 8;
      });
    }

    doc.save(`Rapport_Budget_${year}_${month}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
         <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Vue d'ensemble - Période {month}/{year}</h2>
         </div>
         <button 
           onClick={handleExportPDF}
           className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
         >
           <Download size={18} />
           Exporter Rapport PDF
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="text-sm font-medium text-slate-500 mb-2">Budget Total ({month}/{year})</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(totalBudget)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="text-sm font-medium text-slate-500 mb-2">Réalisé</div>
          <div className="text-2xl font-bold text-rose-500">{formatCurrency(totalActual)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="text-sm font-medium text-slate-500 mb-2">Engagé Non Réalisé</div>
          <div className="text-2xl font-bold text-amber-500">{formatCurrency(totalEngaged)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="text-sm font-medium text-slate-500 mb-2">Reste à Dépenser</div>
          <div className="text-2xl font-bold text-emerald-500">{formatCurrency(totalAvailable)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       {/* Consommation par Catégorie */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 h-96">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Répartition des Dépenses</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
             <div className="flex items-center justify-center h-full text-slate-500">Aucune dépense à afficher</div>
          )}
        </div>

        {/* BarChart Budget vs Actual */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 h-96">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Budget vs Réalisé</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: 'transparent' }} />
              <Legend />
              <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[0, 4, 4, 0]} />
              <Bar dataKey="actual" name="Réalisé" fill="#f43f5e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alertes et Dépassements */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
         <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Alertes Budgétaires
         </h3>
         <div className="space-y-4">
            {categories.map(c => {
               const percent = c.budget > 0 ? ((c.actual + c.engaged) / c.budget) * 100 : 0;
               if (percent < 80) return null;
               
               return (
                 <div key={c.id} className={`p-4 rounded-xl border ${percent >= 100 ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-800/50' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50'} flex items-start gap-4`}>
                    <Info className={`w-5 h-5 mt-0.5 ${percent >= 100 ? 'text-rose-500' : 'text-amber-500'}`} />
                    <div>
                       <div className={`font-semibold ${percent >= 100 ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                          {percent >= 100 ? 'Dépassement de budget' : 'Seuil critique atteint'} : {c.name}
                       </div>
                       <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                          {percent.toFixed(1)}% consommé. Budget: {formatCurrency(c.budget)} | Réalisé+Engagé: {formatCurrency(c.actual + c.engaged)}
                       </div>
                    </div>
                 </div>
               );
            })}
            {categories.filter(c => (c.budget > 0 && ((c.actual + c.engaged) / c.budget) * 100 >= 80)).length === 0 && (
               <div className="text-slate-500 italic text-center p-4">Aucune alerte pour cette période.</div>
            )}
         </div>
      </div>

      {/* Automatique Insights / Notifications */}
      {insights && insights.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 p-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
             <Sparkles className="w-24 h-24 text-indigo-500" />
           </div>
           <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-400 mb-6 flex items-center gap-2 relative z-10">
              <Sparkles className="w-5 h-5" />
              Notifications & Insights Intelligents
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {insights.map((insight, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex gap-4">
                  <div className={`mt-1 ${insight.type === 'anomaly' ? 'text-rose-500' : 'text-blue-500'}`}>
                    {insight.type === 'anomaly' ? <AlertCircle size={20} /> : <Info size={20} />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white mb-1">{insight.title}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{insight.description}</div>
                  </div>
                </div>
              ))}
           </div>
        </div>
      )}

    </div>
  );
}
