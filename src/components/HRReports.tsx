import { parseSafeJSON } from "../lib/utils";
import React, { useState, useEffect } from 'react';
import { Users, FileText, Download, Loader2, PieChart, TrendingUp, BarChart, Calendar } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, addPDFFooter } from '@/lib/exportUtils';
import { formatCurrencyPDF } from '@/lib/pdfUtils';

export function HRReports() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ departmentStats: any[]; employeeBonuses: any[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'departments' | 'bonuses' | 'absences'>('departments');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await apiFetch('/api/reports/hr');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!data) return;
    const doc = new jsPDF('l', 'mm', 'a4');
    let nextY = addPDFHeader(doc, { name: 'OryCompta' } as any, "Rapport RH", "Statistiques du personnel et rémunérations");

    if (activeTab === 'departments') {
      doc.setFontSize(14);
      doc.text("Salaires par Département", 14, nextY);
      nextY += 10;
      
      autoTable(doc, {
        startY: nextY,
        head: [['Département', 'Employés', 'Salaire de Base', 'Primes', 'Retenues', 'Salaire Net']],
        body: data.departmentStats.map((stat: any) => [
          stat.department || 'Non assigné',
          stat.employee_count.toString(),
          formatCurrencyPDF(stat.total_base_salary),
          formatCurrencyPDF(stat.total_bonuses),
          formatCurrencyPDF(stat.total_deductions),
          formatCurrencyPDF(stat.total_net_salary)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] }
      });
    } else if (activeTab === 'bonuses') {
      doc.setFontSize(14);
      doc.text("Historique des Primes & Heures Supplémentaires", 14, nextY);
      nextY += 10;

      autoTable(doc, {
        startY: nextY,
        head: [['Employé', 'Département', 'Période', 'Détails des Primes', 'Total Primes']],
        body: data.employeeBonuses.map((b: any) => {
          let detailsText = '';
          try {
            const parsed = parseSafeJSON(b.details);
            if (parsed.bonusDetails) {
              detailsText = parsed.bonusDetails.map((db: any) => `${db.label}: ${formatCurrencyPDF(db.amount)}`).join(', ');
            }
          } catch (e) {}

          return [
            `${b.first_name} ${b.last_name}`,
            b.department || '-',
            `${b.month}/${b.year}`,
            detailsText || 'Primes globales',
            formatCurrencyPDF(b.bonuses)
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] }
      });
    }

    addPDFFooter(doc);
    doc.save(`Rapport_RH_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Rapports RH & Paie</h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Analysez les salaires par département et l'historique des primes</p>
        </div>
        <button 
          onClick={handleExportPDF}
           className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20 self-start"
        >
          <Download size={18} />
          Exporter PDF
        </button>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'departments' ? 'border-brand-green text-brand-green' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Salaires par Département
        </button>
        <button
          onClick={() => setActiveTab('bonuses')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'bonuses' ? 'border-brand-green text-brand-green' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Suivi des Primes & H.S.
        </button>
        <button
          onClick={() => setActiveTab('absences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'absences' ? 'border-brand-green text-brand-green' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Historique des Absences
        </button>
      </div>

      {activeTab === 'departments' && data?.departmentStats && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Département</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employés</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Salaire Base</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Primes/HS</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Retenues</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Masse Nette</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.departmentStats.map((stat: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900 dark:text-white">{stat.department || 'Non-assigné'}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-brand-green/10 text-brand-green px-2.5 py-0.5 rounded-full text-xs font-medium">
                        {stat.employee_count} {stat.employee_count > 1 ? 'agents' : 'agent'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-600 dark:text-slate-400">
                      {formatCurrency(stat.total_base_salary)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-green-600 dark:text-green-400">
                      +{formatCurrency(stat.total_bonuses)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-red-600 dark:text-red-400">
                      -{formatCurrency(stat.total_deductions)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(stat.total_net_salary)}</span>
                    </td>
                  </tr>
                ))}
                {data.departmentStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Aucune donnée disponible.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'bonuses' && data?.employeeBonuses && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employé</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Période</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Détails</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.employeeBonuses.map((b: any, i: number) => {
                  let detailsList = [];
                  try {
                     const parsed = parseSafeJSON(b.details);
                     if (parsed.bonusDetails) detailsList = parsed.bonusDetails;
                  } catch(e) {}

                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">{b.first_name} {b.last_name}</div>
                        <div className="text-xs text-slate-500">{b.department || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {String(b.month).padStart(2, '0')}/{b.year}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {detailsList.length > 0 ? (
                          <div className="space-y-1">
                            {detailsList.map((db: any, idx: number) => (
                              <div key={idx} className="text-xs flex gap-2">
                                <span className="text-slate-500">{db.label}:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(db.amount)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">Primes globales non détaillées</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-brand-green">{formatCurrency(b.bonuses)}</span>
                      </td>
                    </tr>
                  )
                })}
                 {data.employeeBonuses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Aucune donnée de primes disponible.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'absences' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Historique des Absences</h3>
            <p className="text-slate-500 dark:text-slate-400">
              Le module de suivi interactif des absences (congés, arrêts maladie, congés sans solde) sera bientôt activé. Il vous permettra de déduire automatiquement le temps de travail non effectué.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
