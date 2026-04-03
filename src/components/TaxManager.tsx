import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  AlertCircle, 
  FileText, 
  Download, 
  TrendingUp, 
  Users, 
  Building2, 
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Printer,
  ChevronRight,
  Percent,
  ShieldCheck,
  FileDown,
  Sparkles
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { TaxSettingsManager } from './TaxSettingsManager';
import { VATDeclaration } from './VATDeclaration';
import { VATSettingsManager } from './VATSettingsManager';
import { motion, AnimatePresence } from 'framer-motion';
import { PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings, formatCurrencyPDF } from '@/lib/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type TabType = 'dashboard' | 'vat' | 'payroll' | 'corporate' | 'optimization' | 'settings';

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

export function TaxManager() {
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    fetchTaxSummary();
    fetchCompanySettings();
  }, [selectedMonth, selectedYear]);

  const fetchTaxSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax/summary?month=${selectedMonth}&year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const res = await fetch('/api/company/settings');
      if (res.ok) {
        const data = await res.json();
        setCompanySettings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPDF = () => {
    if (!summary) return;

    try {
      const doc = new jsPDF();
      const settings = companySettings || { name: PDF_CONFIG.companyName };
      const monthName = months[selectedMonth - 1];
      const subtitle = `Rapport Fiscal - ${monthName} ${selectedYear}`;

      addPDFHeader(doc, settings, "SYNTHÈSE FISCALE MENSUELLE", subtitle);

      let currentY = 70;

      // 1. VAT Section
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("1. TAXE SUR LA VALEUR AJOUTÉE (TVA)", 14, currentY);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        body: [
          ["TVA Collectée", formatCurrencyPDF(summary.vat.collected)],
          ["TVA Déductible", formatCurrencyPDF(summary.vat.deductible)],
          [summary.vat.net > 0 ? "TVA NETTE À PAYER" : "CRÉDIT DE TVA", formatCurrencyPDF(Math.abs(summary.vat.net))]
        ],
        theme: 'striped',
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' } }
      });

      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 15;

      // 2. Payroll Taxes
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("2. CHARGES SOCIALES ET FISCALES SUR SALAIRES", 14, currentY);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        body: [
          ["CNPS (Part Salariale)", formatCurrencyPDF(summary.payroll.cnps_sal)],
          ["CNPS (Part Patronale)", formatCurrencyPDF(summary.payroll.cnps_pat)],
          ["Impôt sur Salaire (IS)", formatCurrencyPDF(summary.payroll.is_its)],
          ["Contribution Nationale (CN)", formatCurrencyPDF(summary.payroll.cn)],
          ["IGR", formatCurrencyPDF(summary.payroll.igr)],
          [{ content: "TOTAL À REVERSER", styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(summary.payroll.total), styles: { fontStyle: 'bold', halign: 'right' } }]
        ],
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' } }
      });

      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 15;

      // 3. Corporate Tax
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("3. IMPÔT SUR LES SOCIÉTÉS (ESTIMATION)", 14, currentY);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        body: [
          ["Bénéfice Fiscal Estimé", formatCurrencyPDF(summary.corporate.profit)],
          ["Taux d'imposition", "25%"],
          [{ content: "IMPÔT ESTIMÉ", styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(summary.corporate.estimatedTax), styles: { fontStyle: 'bold', halign: 'right' } }]
        ],
        theme: 'plain',
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' } }
      });

      addPDFFooter(doc);
      doc.save(`Synthese_Fiscale_${monthName}_${selectedYear}.pdf`);

    } catch (err) {
      console.error("PDF Export failed", err);
      alert("Erreur lors de la génération du rapport PDF");
    }
  };

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (activeTab === 'vat' && summary) {
    return <VATDeclaration onBack={() => setActiveTab('dashboard')} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Centre de Fiscalité</h1>
          <p className="text-slate-500 dark:text-slate-400">Suivi des obligations fiscales et déclarations</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={!summary || loading}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <FileDown size={18} />
            Exporter Rapport
          </button>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-medium focus:ring-0 px-3 py-1.5"
            >
              {months.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-medium focus:ring-0 px-3 py-1.5"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
        {[
          { id: 'dashboard', label: 'Vue d\'ensemble', icon: TrendingUp },
          { id: 'vat', label: 'TVA', icon: Percent },
          { id: 'payroll', label: 'Charges Sociales', icon: Users },
          { id: 'corporate', label: 'Impôt Société', icon: Building2 },
          { id: 'optimization', label: 'Optimisation', icon: Sparkles },
          { id: 'settings', label: 'Paramètres', icon: Calculator },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id 
                ? "bg-white dark:bg-slate-800 text-brand-green shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
                        <Calculator className="text-brand-green" size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TVA Nette</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(summary.vat.net)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">À déclarer ce mois</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
                        <Building2 className="text-brand-green" size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IS Estimé</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(summary.corporate.estimatedTax)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Provision exercice N</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                        <TrendingUp className="text-brand-gold" size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pression Fiscale</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {summary.corporate.profit > 0 ? ((summary.corporate.estimatedTax / (summary.corporate.profit + 1000000)) * 100).toFixed(1) : 0}%
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Ratio Impôts / CA</p>
                  </div>
                </div>

                {/* AI Assistant Promo */}
                <div className="premium-card p-8 bg-brand-green/5 border border-brand-green/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/10 blur-3xl rounded-full -mr-32 -mt-32 group-hover:bg-brand-green/20 transition-all duration-700" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl border border-brand-green/20">
                      <ShieldCheck className="text-brand-green" size={40} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Audit Fiscal par Intelligence Artificielle</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                        Laissez notre IA analyser vos écritures comptables pour détecter d'éventuelles anomalies fiscales avant votre déclaration officielle.
                      </p>
                      <button className="bg-brand-green text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-green-light transition-all shadow-lg shadow-brand-green/20">
                        Lancer l'audit maintenant
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detailed Deadlines */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="text-slate-400" size={18} />
                      Calendrier Fiscal
                    </h3>
                    <button className="text-xs font-bold text-brand-green hover:underline">Voir tout le calendrier</button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.deadlines.map((deadline, i) => (
                      <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex flex-col items-center justify-center border",
                            deadline.status === 'overdue' 
                              ? "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20" 
                              : "bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700"
                          )}>
                            <span className="text-[10px] font-black uppercase">{new Date(deadline.date).toLocaleString('fr-FR', { month: 'short' })}</span>
                            <span className="text-lg font-black leading-none">{new Date(deadline.date).getDate()}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{deadline.name}</div>
                            <div className="text-xs text-slate-500">Date limite : {new Date(deadline.date).toLocaleDateString('fr-FR')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            deadline.status === 'upcoming' ? "bg-blue-100 text-blue-600" : 
                            deadline.status === 'overdue' ? "bg-rose-100 text-rose-600" : "bg-brand-green/10 text-brand-green"
                          )}>
                            {deadline.status === 'upcoming' ? 'À venir' : deadline.status === 'overdue' ? 'En retard' : 'Payé'}
                          </span>
                          <button className="p-2 text-slate-400 hover:text-brand-green transition-colors">
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar / Quick Actions */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Actions Fiscales</h3>
                  <div className="space-y-2">
                    <button className="w-full p-3 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-brand-green/10 hover:text-brand-green rounded-xl transition-all text-sm font-bold text-slate-700 dark:text-slate-300">
                      <FileText size={18} />
                      Éditer liasse fiscale
                    </button>
                    <button className="w-full p-3 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-brand-green/10 hover:text-brand-green rounded-xl transition-all text-sm font-bold text-slate-700 dark:text-slate-300">
                      <Download size={18} />
                      Télécharger CERFA
                    </button>
                    <button className="w-full p-3 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-brand-green/10 hover:text-brand-green rounded-xl transition-all text-sm font-bold text-slate-700 dark:text-slate-300">
                      <Printer size={18} />
                      Imprimer quittance
                    </button>
                  </div>
                </div>

                <div className="bg-brand-gold/5 p-6 rounded-2xl border border-brand-gold/20 shadow-sm">
                  <div className="flex items-center gap-2 text-brand-gold mb-3">
                    <AlertCircle size={20} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Conseil Fiscal</h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Votre CA a augmenté de 15% ce trimestre. Pensez à ajuster vos acomptes d'IS pour éviter une régularisation trop importante en fin d'année.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white">Récapitulatif des Charges Sociales</h3>
                <button className="p-2 text-slate-400 hover:text-brand-green transition-colors">
                  <Printer size={20} />
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Part Salariale (Retenues)</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-sm text-slate-600 dark:text-slate-400">CNPS Retraite</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(summary.payroll.cnps_sal)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Impôt sur Salaire (IS)</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(summary.payroll.is_its)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Contribution Nationale (CN)</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(summary.payroll.cn)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-sm text-slate-600 dark:text-slate-400">IGR</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(summary.payroll.igr)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Part Patronale</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-sm text-slate-600 dark:text-slate-400">CNPS Patronale</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(summary.payroll.cnps_pat)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Prestations Familiales</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(0)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Accidents du Travail</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">Total à reverser</span>
                  <span className="text-2xl font-black text-brand-green">{formatCurrency(summary.payroll.total)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'corporate' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white">Détermination de l'Impôt sur les Sociétés (IS)</h3>
                <div className="px-3 py-1 bg-brand-green/10 text-brand-green text-[10px] font-black uppercase tracking-widest rounded-full">Estimation OHADA</div>
              </div>
              <div className="p-6">
                <div className="max-w-4xl mx-auto space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Résultat Comptable</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary.corporate.profit)}</div>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/20">
                      <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Réintégrations (+)</div>
                      <div className="text-xl font-bold text-rose-600">{formatCurrency(summary.corporate.profit * 0.15)}</div>
                    </div>
                    <div className="p-4 bg-brand-green/5 rounded-xl border border-brand-green/10">
                      <div className="text-[10px] font-black text-brand-green uppercase tracking-widest mb-1">Déductions (-)</div>
                      <div className="text-xl font-bold text-brand-green">{formatCurrency(summary.corporate.profit * 0.05)}</div>
                    </div>
                  </div>

                  <div className="premium-card p-8 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Base Imposable (Bénéfice Fiscal)</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(summary.corporate.profit * 1.1)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-slate-500">Taux d'imposition standard</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">25%</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-slate-500">Minimum Forfaitaire de Perception (IMF)</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">0.5% du CA</span>
                      </div>
                      <div className="pt-6 flex justify-between items-center border-t-2 border-brand-green/20">
                        <div>
                          <div className="text-xs font-black text-brand-green uppercase tracking-widest mb-1">Impôt Net à Payer</div>
                          <div className="text-sm text-slate-400 italic">Retenu : le plus élevé entre IS et IMF</div>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-black text-brand-green font-display">{formatCurrency(summary.corporate.estimatedTax)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Acomptes Provisionnels</h4>
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Acompte N°{i}</span>
                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(summary.corporate.estimatedTax / 3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-brand-gold/5 p-5 rounded-2xl border border-brand-gold/20 shadow-sm">
                      <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest mb-4">Optimisation Possible</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                        En investissant dans des équipements de production avant la fin de l'exercice, vous pourriez bénéficier d'un amortissement accéléré réduisant votre base imposable.
                      </p>
                      <button className="text-[10px] font-black text-brand-gold uppercase tracking-widest hover:underline flex items-center gap-1">
                        Consulter l'expert IA <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'optimization' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-brand-gold/20 transition-all" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center mb-6">
                      <TrendingUp className="text-brand-gold" size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Crédits d'Impôt Recherche</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                      Vos dépenses en innovation et développement technique peuvent être éligibles à un crédit d'impôt significatif. Nous estimons votre éligibilité à 65%.
                    </p>
                    <div className="flex items-center justify-between p-4 bg-brand-gold/5 rounded-2xl border border-brand-gold/10">
                      <span className="text-xs font-bold text-brand-gold uppercase tracking-widest">Économie Potentielle</span>
                      <span className="text-lg font-black text-brand-gold">{formatCurrency(2500000)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-brand-green/20 transition-all" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center mb-6">
                      <ShieldCheck className="text-brand-green" size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Amortissements Accélérés</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                      L'acquisition de nouveaux serveurs ou équipements informatiques avant la fin du trimestre permet de réduire votre base imposable via l'amortissement dégressif.
                    </p>
                    <div className="flex items-center justify-between p-4 bg-brand-green/5 rounded-2xl border border-brand-green/10">
                      <span className="text-xs font-bold text-brand-green uppercase tracking-widest">Impact sur l'IS</span>
                      <span className="text-lg font-black text-brand-green">-12.5%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 dark:bg-black p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 via-transparent to-brand-green/10 opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">Stratégie Fiscale Personnalisée</h3>
                    <p className="text-slate-400 leading-relaxed mb-8">
                      Notre IA a analysé votre structure de coûts et identifié 4 leviers d'optimisation non exploités. Souhaitez-vous générer un rapport détaillé pour votre expert-comptable ?
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <button className="bg-brand-gold text-black px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-gold-light transition-all shadow-xl shadow-brand-gold/20">
                        Générer le Rapport Expert
                      </button>
                      <button className="bg-white/10 text-white border border-white/20 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                        Simuler un Scénario
                      </button>
                    </div>
                  </div>
                  <div className="w-full md:w-64 aspect-square bg-white/5 rounded-3xl border border-white/10 flex flex-col items-center justify-center p-6 text-center">
                    <div className="text-4xl font-black text-brand-gold mb-2 font-display">8.4M</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Économie Totale<br/>Identifiée (FCFA)</div>
                    <div className="mt-6 w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="w-3/4 h-full bg-brand-gold" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
             <TaxSettingsManager />
          )}
        </div>
      ) : (
        <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Aucune donnée disponible</h3>
          <p className="text-slate-500 dark:text-slate-400">Essayez de sélectionner une autre période.</p>
        </div>
      )}
    </div>
  );
}
