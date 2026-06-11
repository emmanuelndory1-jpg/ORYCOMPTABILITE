import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  ChevronRight, 
  Calculator, 
  Building2, 
  Users, 
  Percent,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PDF_CONFIG, 
  addPDFHeader, 
  addPDFFooter, 
  addOHADAComplianceSignature,
  CompanySettings, 
  formatCurrencyPDF,
  exportToCSV
} from '@/lib/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TaxSummary {
  period: { month: number; year: number };
  vat: {
    collected: number;
    deductible: number;
    net: number;
  };
  payroll: {
    cnps_sal: number;
    cnps_pat: number;
    is_its: number;
    cn: number;
    igr: number;
    total: number;
  };
  corporate: {
    profit: number;
    estimatedTax: number;
  };
  deadlines: {
    name: string;
    date: string;
    status: 'upcoming' | 'overdue' | 'completed';
  }[];
}

export function TaxSummaryReport() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, settingsRes] = await Promise.all([
        apiFetch(`/api/tax/summary?month=${selectedMonth}&year=${selectedYear}`),
        apiFetch('/api/company/settings')
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (settingsRes.ok) {
        setCompanySettings(await settingsRes.json());
      }
    } catch (err) {
      console.error("Failed to fetch tax data:", err);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const handleExportPDF = () => {
    if (!summary) return;

    try {
      const doc = new jsPDF();
      const settings = companySettings || { name: PDF_CONFIG.companyName };
      const monthName = months[selectedMonth - 1];
      const subtitle = `Synthèse Fiscale Détaillée - ${monthName} ${selectedYear}`;

      addPDFHeader(doc, settings, "RAPPORT DE SYNTHÈSE FISCALE", subtitle);

      let currentY = 70;

      // 1. TVA section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129); // Brand Green
      doc.text("1. TAXE SUR LA VALEUR AJOUTÉE (TVA)", 14, currentY);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        head: [['Désignation', 'Montant (FCFA)']],
        body: [
          ['TVA Collectée (Ventes/Produits)', formatCurrencyPDF(summary.vat.collected)],
          ['TVA Déductible (Achats/Charges)', formatCurrencyPDF(summary.vat.deductible)],
          [{ content: summary.vat.net >= 0 ? "SOLDE TVA À PAYER" : "CRÉDIT DE TVA REPORTABLE", styles: { fontStyle: 'bold' } }, 
           { content: formatCurrencyPDF(Math.abs(summary.vat.net)), styles: { fontStyle: 'bold', halign: 'right' } }]
        ],
        theme: 'striped',
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' } },
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // 2. Charges Sociales et Patronales
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("2. CHARGES SOCIALES ET FISCALITÉ SALARIALE", 14, currentY);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        head: [['Nature de la Charge', 'Quote-part Salariale', 'Quote-part Patronale', 'Total']],
        body: [
          ['CNPS (Retraite)', formatCurrencyPDF(summary.payroll.cnps_sal), formatCurrencyPDF(summary.payroll.cnps_pat), formatCurrencyPDF(summary.payroll.cnps_sal + summary.payroll.cnps_pat)],
          ['Impôt sur Salaire (IS/ITS)', formatCurrencyPDF(summary.payroll.is_its), '-', formatCurrencyPDF(summary.payroll.is_its)],
          ['Contribution Nationale (CN)', formatCurrencyPDF(summary.payroll.cn), '-', formatCurrencyPDF(summary.payroll.cn)],
          ['Impôt Gén. sur Revenu (IGR)', formatCurrencyPDF(summary.payroll.igr), '-', formatCurrencyPDF(summary.payroll.igr)],
          [{ content: 'TOTAL CHARGES SOCIALES', styles: { fontStyle: 'bold' } }, '', '', { content: formatCurrencyPDF(summary.payroll.total), styles: { fontStyle: 'bold', halign: 'right' } }]
        ],
        theme: 'grid',
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // 3. Corporate Tax
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("3. ESTIMATION DE L'IMPÔT SUR LES SOCIÉTÉS (IS)", 14, currentY);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        body: [
          ['Résultat Comptable Provisoire', formatCurrencyPDF(summary.corporate.profit)],
          ['Taux d\'Impôts en vigueur', '25%'],
          [{ content: 'ESTIMATION DE L\'IS À PROVISIONNER', styles: { fontStyle: 'bold', fillColor: [16, 185, 129], textColor: [255, 255, 255] } }, 
           { content: formatCurrencyPDF(summary.corporate.estimatedTax), styles: { fontStyle: 'bold', halign: 'right', fillColor: [16, 185, 129], textColor: [255, 255, 255] } }]
        ],
        theme: 'plain',
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' } }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      addOHADAComplianceSignature(doc, finalY + 20, settings.manager_name || "L'Administrateur");

      addPDFFooter(doc);
      doc.save(`Rapport_Fiscal_${monthName}_${selectedYear}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Rapport de Synthèse Fiscale</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Vue consolidée de vos obligations fiscales mensuelles</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-bold focus:ring-0 px-4 py-2 appearance-none cursor-pointer"
            >
              {months.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-bold focus:ring-0 px-4 py-2 appearance-none cursor-pointer"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleExportPDF}
            disabled={loading || !summary}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50 active:scale-95"
          >
            <Download size={18} />
            Exporter PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 animate-pulse shadow-sm" />
          ))}
        </div>
      ) : summary ? (
        <div className="space-y-8">
          {/* Main Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-brand-green/30 transition-all"
            >
              <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center text-brand-green mb-6 group-hover:scale-110 transition-transform">
                <Percent size={24} />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TVA Nette (Période)</h3>
              <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {formatCurrency(summary.vat.net)}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold">
                <span className={cn(
                  "px-2 py-0.5 rounded-full",
                  summary.vat.net >= 0 ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
                )}>
                  {summary.vat.net >= 0 ? "À Reverser" : "Crédit reporté"}
                </span>
                <span className="text-slate-400 text-[9px]">Calculé sur facturation h.t.</span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-brand-gold/30 transition-all"
            >
              <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center text-brand-gold mb-6 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Charges Sociales</h3>
              <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {formatCurrency(summary.payroll.total)}
              </div>
              <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                CNPS + ITS + CN + IGR
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/10 blur-3xl rounded-full -mr-16 -mt-16" />
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-brand-green-light mb-6 group-hover:scale-110 transition-transform">
                  <Building2 size={24} />
                </div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Impôt sur Sociétés (IS)</h3>
                <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
                  {formatCurrency(summary.corporate.estimatedTax)}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[10px] font-black text-brand-green uppercase tracking-widest">Taux: 25%</span>
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Provision estimée</span>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Detailed VAT Table */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800/50 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Calculator className="text-brand-green" size={20} />
                    Détails des Calculs de TVA
                  </h3>
                </div>
                <div className="w-full min-w-0 overflow-auto p-0 ">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <th className="px-6 py-4 text-left">Désignation</th>
                        <th className="px-6 py-4 text-right">Base H.T. (Est.)</th>
                        <th className="px-6 py-4 text-right">Montant TVA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">TVA Facturée (Collectée)</td>
                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency((summary.vat?.collected || 0) / 0.18)}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(summary.vat?.collected || 0)}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">TVA Récupérable (Déductible)</td>
                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency((summary.vat?.deductible || 0) / 0.18)}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(summary.vat?.deductible || 0)}</td>
                      </tr>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                        <td className="px-6 py-4 font-black text-slate-900 dark:text-white uppercase">Solde Net de la Période</td>
                        <td className="px-6 py-4"></td>
                        <td className={cn(
                          "px-6 py-4 text-right text-lg font-black",
                          (summary.vat?.net ?? 0) >= 0 ? "text-rose-500" : "text-emerald-500"
                        )}>
                          {formatCurrency(summary.vat?.net ?? 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Profit & Corporate Tax Detailed Breakdown */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Détermination du Bénéfice Imposable</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Base de calcul pour l'Impôt sur les Sociétés</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">Résultat Comptable (Période)</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Produits (Classe 7) - Charges (Classe 6)</p>
                    </div>
                    <span className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(summary.corporate?.profit || 0)}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Réintégrations Fiscales</h4>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Amortissements excédentaires</span>
                        <span className="font-bold text-rose-500">{formatCurrency((summary.corporate?.profit || 0) * 0.05)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Dépenses non déductibles</span>
                        <span className="font-bold text-rose-500">{formatCurrency((summary.corporate?.profit || 0) * 0.02)}</span>
                      </div>
                    </div>
                    <div className="p-5 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Déductions Fiscales</h4>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Produits non imposables</span>
                        <span className="font-bold text-emerald-500">{formatCurrency((summary.corporate?.profit || 0) * 0.03)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Reports déficitaires</span>
                        <span className="font-bold text-emerald-500">{formatCurrency(0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-6 bg-brand-green/5 border-2 border-brand-green/20 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h4 className="text-xs font-black text-brand-green uppercase tracking-widest mb-1">Base Imposable Finale</h4>
                      <p className="text-3xl font-black text-slate-900 dark:text-white">{formatCurrency((summary.corporate?.profit || 0) * 1.04)}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taux OHADA</h4>
                        <p className="text-xl font-black text-slate-900 dark:text-white">25%</p>
                      </div>
                      <div className="h-12 w-px bg-brand-green/20" />
                      <div className="text-right">
                        <h4 className="text-[10px] font-black text-brand-green uppercase tracking-widest mb-1">Estimation IS</h4>
                        <p className="text-2xl font-black text-brand-green">{formatCurrency(summary.corporate?.estimatedTax || 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Fiscal Calendar Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800/50 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Échéance à Venir</h3>
                  <Clock className="text-slate-300" size={18} />
                </div>
                <div className="p-6 space-y-4">
                  {(summary.deadlines || []).map((deadline, idx) => (
                    <div key={idx} className="flex items-center gap-4 group cursor-pointer">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex flex-col items-center justify-center border transition-colors",
                        deadline.status === 'overdue' 
                          ? "bg-rose-50 border-rose-100 text-rose-600" 
                          : "bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-brand-green/10 group-hover:border-brand-green/20 group-hover:text-brand-green"
                      )}>
                        <span className="text-[9px] font-black uppercase leading-none">{new Date(deadline.date).toLocaleString('fr-Fr', { month: 'short' })}</span>
                        <span className="text-lg font-black leading-none">{new Date(deadline.date).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{deadline.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                          {deadline.status === 'upcoming' ? 'Préparation requise' : 'Action immédiate'}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-slate-300 group-hover:text-brand-green group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 text-center">
                  <button className="text-[10px] font-black text-brand-green uppercase tracking-widest hover:underline">Accéder au centre de paiement</button>
                </div>
              </div>

              {/* Tips / Optimization Card */}
              <div className="bg-brand-gold/5 border border-brand-gold/20 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-brand-gold uppercase tracking-widest text-[10px] font-black">
                  <AlertCircle size={16} />
                  Optimisation Fiscale
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic">
                  "Votre crédit de TVA cumulé peut être utilisé pour compenser d'autres impôts locaux via un certificat de compensation d'impôts."
                </p>
                <button className="text-[10px] font-black text-brand-gold uppercase tracking-widest flex items-center gap-1 group">
                  En savoir plus <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Quick Summary Sidebar Card */}
               <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Résumé des décaissements</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">TVA à décaisser</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(Math.max(0, summary.vat.net))}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Taxes sur salaires</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(summary.payroll.total)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Acompte IS provisionné</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(summary.corporate.estimatedTax)}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="font-black text-slate-900 dark:text-white uppercase text-xs">Total Fiscal</span>
                    <span className="text-lg font-black text-brand-green">
                      {formatCurrency(Math.max(0, summary.vat.net) + summary.payroll.total + summary.corporate.estimatedTax)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-300 dark:border-slate-700">
           <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-6" />
           <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Aucune donnée fiscale trouvée</h3>
           <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">Nous n'avons pas trouvé d'écritures comptables pour la période {months[selectedMonth - 1]} {selectedYear}.</p>
        </div>
      )}
    </div>
  );
}
