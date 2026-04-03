import React, { useState, useEffect } from 'react';
import { Calculator, Calendar, Download, FileText, Printer, ArrowLeft, FileDown } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import { PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings, formatCurrencyPDF } from '@/lib/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface VATData {
  period: { month: string; year: string };
  collected: {
    total: number;
    details: Array<{ account_code: string; amount: number }>;
  };
  deductible: {
    total: number;
    details: Array<{ account_code: string; amount: number }>;
  };
  netVat: number;
}

export const VATDeclaration = ({ onBack }: { onBack: () => void }) => {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VATData | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [period, setPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const fetchVATData = async () => {
    setLoading(true);
    try {
      const [vatRes, companyRes] = await Promise.all([
        fetch(`/api/vat/declaration?month=${period.month}&year=${period.year}`),
        fetch('/api/company/settings')
      ]);

      if (vatRes.ok) {
        const result = await vatRes.json();
        setData(result);
      }

      if (companyRes.ok) {
        const settings = await companyRes.json();
        setCompanySettings(settings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVATData();
  }, [period]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    if (!data) return;

    try {
      const doc = new jsPDF();
      const settings = companySettings || { name: PDF_CONFIG.companyName };
      const monthName = getMonthName(period.month);
      const subtitle = `Période : ${monthName} ${period.year}`;

      addPDFHeader(doc, settings, "DÉCLARATION DE TVA", subtitle);

      // Résumé
      let currentY = 70;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("RÉSUMÉ DE LA PÉRIODE", 14, currentY);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        body: [
          ["TVA Collectée (Ventes)", formatCurrencyPDF(data.collected.total)],
          ["TVA Déductible (Achats)", formatCurrencyPDF(data.deductible.total)],
          [
            data.netVat > 0 ? "TVA À PAYER" : "CRÉDIT DE TVA", 
            formatCurrencyPDF(Math.abs(data.netVat))
          ]
        ],
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 100 },
          1: { halign: 'right', cellWidth: 50 }
        }
      });

      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 15;

      // Détails
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DÉTAIL DES OPÉRATIONS", 14, currentY);
      currentY += 10;

      // Table TVA Collectée
      autoTable(doc, {
        startY: currentY,
        head: [['Compte (TVA Collectée)', 'Montant']],
        body: [
          ...data.collected.details.map(d => [d.account_code, formatCurrencyPDF(d.amount)]),
          [{ content: 'Total Collecté', styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(data.collected.total), styles: { fontStyle: 'bold', halign: 'right' } }]
        ],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105] },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { right: 107 } // Side by side if possible? No, let's do one after another for clarity
      });

      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 10;

      // Table TVA Déductible
      autoTable(doc, {
        startY: currentY,
        head: [['Compte (TVA Déductible)', 'Montant']],
        body: [
          ...data.deductible.details.map(d => [d.account_code, formatCurrencyPDF(d.amount)]),
          [{ content: 'Total Déductible', styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(data.deductible.total), styles: { fontStyle: 'bold', halign: 'right' } }]
        ],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105] },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { right: 107 }
      });

      addPDFFooter(doc);
      doc.save(`Declaration_TVA_${monthName}_${period.year}.pdf`);

    } catch (err) {
      console.error("PDF Export failed", err);
      alert("Erreur lors de la génération du PDF");
    }
  };

  const getMonthName = (m: number) => new Date(2000, m - 1).toLocaleString('fr-FR', { month: 'long' });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Déclaration de TVA</h1>
          <p className="text-slate-500">Calcul et édition de la déclaration mensuelle</p>
        </div>
        <button 
          onClick={onBack}
          className="text-slate-500 hover:text-slate-700 flex items-center gap-2 text-sm font-medium"
        >
          <ArrowLeft size={16} /> Retour
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <Calendar className="text-slate-400" size={20} />
          <select 
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
            value={period.month}
            onChange={(e) => setPeriod({ ...period, month: parseInt(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{getMonthName(m)}</option>
            ))}
          </select>
          <select 
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
            value={period.year}
            onChange={(e) => setPeriod({ ...period, year: parseInt(e.target.value) })}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        <button 
          onClick={handleExportPDF}
          className="bg-brand-green hover:bg-brand-green-light text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <FileDown size={18} /> PDF
        </button>

        <button 
          onClick={handlePrint}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Printer size={18} /> Imprimer
        </button>
      </div>

      {/* Report Document */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
        {/* Document Header */}
        <div className="bg-slate-50 border-b border-slate-200 p-8 text-center print:bg-white print:border-b-2 print:border-black">
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide mb-2">État de Déclaration de la Taxe sur la Valeur Ajoutée</h2>
          <p className="text-slate-600">Période : {getMonthName(period.month)} {period.year}</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Chargement...</div>
        ) : data ? (
          <div className="p-8 space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 print:border print:border-slate-300">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">TVA Collectée (Ventes)</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(data.collected.total)}</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 print:border print:border-slate-300">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">TVA Déductible (Achats)</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(data.deductible.total)}</p>
              </div>
              <div className={cn(
                "p-6 rounded-xl border print:border print:border-slate-300",
                data.netVat > 0 ? "bg-rose-50 border-rose-200" : "bg-brand-green/5 border-brand-green/20"
              )}>
                <p className={cn(
                  "text-xs uppercase font-semibold mb-1",
                  data.netVat > 0 ? "text-rose-600" : "text-brand-green"
                )}>
                  {data.netVat > 0 ? "TVA à Payer" : "Crédit de TVA"}
                </p>
                <p className={cn(
                  "text-2xl font-bold",
                  data.netVat > 0 ? "text-rose-700" : "text-brand-green"
                )}>
                  {formatCurrency(Math.abs(data.netVat))}
                </p>
              </div>
            </div>

            {/* Detailed Table */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Détail des Opérations</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
                {/* Collected VAT */}
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    TVA Collectée
                  </h4>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2 text-left">Compte</th>
                        <th className="px-4 py-2 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.collected.details.length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-3 text-center text-slate-400 italic">Aucune opération</td></tr>
                      ) : (
                        data.collected.details.map((item, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-slate-600">{item.account_code}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))
                      )}
                      <tr className="bg-slate-50 font-bold">
                        <td className="px-4 py-2 text-slate-900">Total</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(data.collected.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Deductible VAT */}
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    TVA Déductible
                  </h4>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2 text-left">Compte</th>
                        <th className="px-4 py-2 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.deductible.details.length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-3 text-center text-slate-400 italic">Aucune opération</td></tr>
                      ) : (
                        data.deductible.details.map((item, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-slate-600">{item.account_code}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))
                      )}
                      <tr className="bg-slate-50 font-bold">
                        <td className="px-4 py-2 text-slate-900">Total</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(data.deductible.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Signature Section (Print Only) */}
            <div className="hidden print:block mt-12 pt-12 border-t border-slate-200">
              <div className="flex justify-between">
                <div className="text-center">
                  <p className="font-semibold mb-12">Le Comptable</p>
                  <div className="w-32 border-b border-slate-300 mx-auto"></div>
                </div>
                <div className="text-center">
                  <p className="font-semibold mb-12">Le Directeur Financier</p>
                  <div className="w-32 border-b border-slate-300 mx-auto"></div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
