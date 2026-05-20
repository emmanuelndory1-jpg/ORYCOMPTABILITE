import { BudgetDashboard } from './BudgetDashboard';
import { BudgetCategoriesSetup } from './BudgetCategoriesSetup';
import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { PageHeader } from './ui/PageHeader';
import { Target, Save, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, History, BarChart3, Plus, FileText, Trash2, LayoutDashboard, Settings2, Upload, Download } from 'lucide-react';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


interface ExpenseAccount {
  code: string;
  name: string;
}

interface BudgetStatus {
  account_code: string;
  account_name: string;
  budget: number;
  engaged: number;
  actual: number;
  available: number;
}

interface Engagement {
  id: number;
  account_code: string;
  account_name: string;
  amount: number;
  description: string;
  engagement_date: string;
  status: string;
  reference: string;
}

interface Revision {
  id: number;
  account_code: string;
  old_amount: number;
  new_amount: number;
  revision_date: string;
  reason: string;
  user_email: string;
}

export function BudgetManager() {
  const { formatCurrency, currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'categories' | 'elaboration' | 'monitoring' | 'engagements' | 'reporting'>('dashboard');

  const [accounts, setAccounts] = useState<ExpenseAccount[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [showRevisions, setShowRevisions] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [showEngagementForm, setShowEngagementForm] = useState(false);
  const [newEngagement, setNewEngagement] = useState({
    account_code: '',
    amount: 0,
    description: '',
    reference: ''
  });

  const [currentYear, setCurrentYear] = useState(activeYear ? parseInt(activeYear.start_date.split('-')[0]) : new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (activeYear) {
      setCurrentYear(parseInt(activeYear.start_date.split('-')[0]));
    }
  }, [activeYear?.id]);

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  useEffect(() => {
    fetchData();
  }, [currentYear, currentMonth, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'elaboration' || activeTab === 'monitoring') {
        const [accRes, statRes] = await Promise.all([
          apiFetch('/api/accounts/expenses'),
          apiFetch(`/api/budgets/status?year=${currentYear}&month=${currentMonth}`)
        ]);
        setAccounts(await accRes.json());
        setBudgetStatus(await statRes.json());
      } else if (activeTab === 'engagements') {
        const res = await apiFetch(`/api/budgets/engagements?year=${currentYear}&month=${currentMonth}`);
        setEngagements(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevisions = async (code: string) => {
    try {
      const res = await apiFetch(`/api/budgets/revisions?account_code=${code}`);
      if (res.ok) {
        setRevisions(await res.json());
        setShowRevisions(code);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBudgetChange = async (code: string, amount: number) => {
    try {
      const res = await apiFetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_code: code,
          amount,
          period_month: currentMonth,
          period_year: currentYear,
          reason: 'Mise à jour directe'
        })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateEngagement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch('/api/budgets/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEngagement,
          period_month: currentMonth,
          period_year: currentYear
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'engagement');
      
      setMessage({ type: 'success', text: 'Engagement créé avec succès !' });
      setShowEngagementForm(false);
      setNewEngagement({ account_code: '', amount: 0, description: '', reference: '' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleDeleteEngagement = async (id: number) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cet engagement ? Cette action est irréversible.")) return;
    try {
      const res = await apiFetch(`/api/budgets/engagements/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
        setMessage({ type: 'success', text: 'Engagement supprimé avec succès.' });
      } else {
        const errorData = await res.json();
        setMessage({ type: 'error', text: errorData.error || 'Erreur lors de la suppression.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erreur réseau.' });
    }
  };

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const entries = results.data.map((row: any) => ({
            account_code: row['Compte'] || row['compte'] || row['Account'],
            category: row['Catégorie'] || row['Categorie'] || row['Category'],
            amount: parseFloat(row['Montant'] || row['montant'] || row['Amount']) || 0
          })).filter(entry => (entry.account_code || entry.category) && entry.amount > 0);

          if (entries.length === 0) {
            setMessage({ type: 'error', text: 'Aucune donnée valide trouvée dans le fichier. Veuillez vérifier que les colonnes soient "Compte" (ou "Catégorie") et "Montant".' });
            return;
          }

          const res = await apiFetch('/api/budgets/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries, period_month: currentMonth, period_year: currentYear })
          });

          if (res.ok) {
            const data = await res.json();
            setMessage({ type: 'success', text: `${data.count} budgets importés avec succès.` });
            if (activeTab === 'dashboard') {
              // Dashboard reloads via its own effect, but let's toggle active tab to force a reload if needed or assume it's there
            } else {
              fetchData();
            }
          } else {
            setMessage({ type: 'error', text: 'Erreur lors de l\'import.' });
          }
        } catch (err) {
          console.error(err);
          setMessage({ type: 'error', text: 'Une erreur est survenue.' });
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Suivi Budgétaire - ${months[currentMonth - 1]} ${currentYear}`, 14, 22);
    
    const tableData = budgetStatus.map(s => [
      s.account_code,
      s.account_name,
      formatCurrency(s.budget),
      formatCurrency(s.engaged),
      formatCurrency(s.actual),
      formatCurrency(s.available)
    ]);

    (doc as any).autoTable({
      startY: 30,
      head: [['Compte', 'Description', 'Budget', 'Engagé', 'Réalisé', 'Disponible']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`budget_${currentYear}_${currentMonth}.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion Budgétaire"
        subtitle="Contrôle de l'engagement, suivi réalisé vs prévisionnel."
        icon={<Target size={24} />}
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
              <div className="min-w-[140px] text-center font-bold text-xs uppercase tracking-widest px-2">{months[currentMonth - 1]} {currentYear}</div>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronRight size={20} /></button>
            </div>
            
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImportCSV} 
            />
            
            {activeTab === 'elaboration' && (
              <>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  <Upload size={18} />
                  Importer CSV
                </button>
                <button 
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8,Catégorie,Compte,Montant\nAchats & Approvisionnements,601000,150000\nServices Extérieurs,,20000";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "modele_budget.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-xl"
                  title="Télécharger le modèle CSV"
                >
                  <Download size={18} />
                </button>
              </>
            )}

            {(activeTab === 'monitoring' || activeTab === 'elaboration') && (
              <button 
                onClick={handleExportPDF}
                className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <Download size={18} />
                Exporter PDF
              </button>
            )}

            {activeTab === 'engagements' && (
              <button 
                onClick={() => setShowEngagementForm(true)}
                className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-brand-green/20 hover:scale-105 transition-all active:scale-95"
              >
                <Plus size={18} />
                Nouvel Engagement
              </button>
            )}
          </div>
        }
      />

      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit flex-wrap">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2", 
            activeTab === 'dashboard' ? "bg-white dark:bg-slate-900 shadow-sm text-brand-green" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <LayoutDashboard size={16} />
          Tableau de Bord
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2", 
            activeTab === 'categories' ? "bg-white dark:bg-slate-900 shadow-sm text-brand-green" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Settings2 size={16} />
          Catégories
        </button>
        <button 
          onClick={() => setActiveTab('monitoring')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2", 
            activeTab === 'monitoring' ? "bg-white dark:bg-slate-900 shadow-sm text-brand-green" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <BarChart3 size={16} />
          Suivi Détaillé (Comptes)
        </button>
        <button 
          onClick={() => setActiveTab('elaboration')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2", 
            activeTab === 'elaboration' ? "bg-white dark:bg-slate-900 shadow-sm text-brand-green" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <History size={16} />
          Élaboration / Révisions
        </button>
        <button 
          onClick={() => setActiveTab('engagements')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2", 
            activeTab === 'engagements' ? "bg-white dark:bg-slate-900 shadow-sm text-brand-green" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Target size={16} />
          Engagements
        </button>
        <button 
          onClick={() => setActiveTab('reporting')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2", 
            activeTab === 'reporting' ? "bg-white dark:bg-slate-900 shadow-sm text-brand-green" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <FileText size={16} />
          Reporting
        </button>
      </div>

      {message && (
        <div className={cn("p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2", 
          message.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
        )}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <BudgetDashboard year={currentYear} month={currentMonth} />
      )}

      {activeTab === 'categories' && (
        <BudgetCategoriesSetup />
      )}

      {activeTab === 'monitoring' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Compte</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Budget</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Engagé</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Réalisé</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Disponible</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Consommation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                   Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-48" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-20 ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-20 ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-20 ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-20 ml-auto" /></td>
                      <td className="px-6 py-4 text-center"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-24 mx-auto" /></td>
                    </tr>
                  ))
                ) : budgetStatus.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">Aucune donnée budgétaire pour cette période.</td></tr>
                ) : budgetStatus.map((s) => {
                  const consumption = s.budget > 0 ? ((s.engaged + s.actual) / s.budget) * 100 : 0;
                  return (
                    <tr key={s.account_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">{s.account_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{s.account_code}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">{formatCurrency(s.budget)}</td>
                      <td className="px-6 py-4 text-right text-sm text-amber-600 font-medium">{formatCurrency(s.engaged)}</td>
                      <td className="px-6 py-4 text-right text-sm text-blue-600 font-medium">{formatCurrency(s.actual)}</td>
                      <td className={cn("px-6 py-4 text-right text-sm font-bold", s.available < 0 ? "text-rose-600" : "text-slate-900 dark:text-white")}>
                        {formatCurrency(s.available)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 min-w-[120px]">
                          <div 
                            className={cn("h-2 rounded-full transition-all duration-500", 
                              consumption >= 100 ? "bg-rose-500" : 
                              consumption > 80 ? "bg-amber-500" : "bg-brand-green"
                            )}
                            style={{ width: `${Math.min(consumption, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 px-1">
                           <span className={cn("text-[10px] font-bold", consumption > 90 ? "text-rose-600" : "text-slate-500")}>
                             {consumption.toFixed(1)}%
                           </span>
                           {consumption > 100 && <AlertCircle size={10} className="text-rose-500 animate-pulse" />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'elaboration' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Compte de Charge</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Montant Actuel</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Nouvelle Valeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {budgetStatus.map((s) => (
                <tr key={s.account_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium">{s.account_name}</span>
                    <div className="text-[10px] font-mono text-slate-400">{s.account_code}</div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-500">{formatCurrency(s.budget)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={() => fetchRevisions(s.account_code)}
                        className="p-1 px-2 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 rounded hover:bg-slate-200 transition-colors flex items-center gap-1"
                        title="Historique des révisions"
                      >
                        <History size={12} />
                        Historique
                      </button>
                      <input 
                        type="number"
                        className="w-32 px-3 py-1.5 text-right border dark:border-slate-800 dark:bg-slate-950 rounded-lg text-sm focus:ring-2 focus:ring-brand-green/20 outline-none"
                        defaultValue={s.budget}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val !== s.budget) {
                            handleBudgetChange(s.account_code, val);
                          }
                        }}
                      />
                      <span className="text-xs text-slate-400">{currency}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'engagements' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Compte</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Montant</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Statut</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" /></td>
                  </tr>
                ))
              ) : engagements.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">Aucun engagement enregistré.</td></tr>
              ) : engagements.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(e.engagement_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{e.description}</div>
                    {e.reference && <div className="text-[10px] text-slate-500">Ref: {e.reference}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{e.account_name}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold">{formatCurrency(e.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", 
                      e.status === 'pending' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : 
                      e.status === 'approved' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : 
                      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteEngagement(e.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                      title="Supprimer l'engagement"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reporting' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 uppercase tracking-tight">Top 5 Dépenses Engagées</h3>
            <div className="space-y-6">
              {budgetStatus
                .sort((a, b) => (b.engaged + b.actual) - (a.engaged + a.actual))
                .slice(0, 5)
                .map((s, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                      <span>{s.account_name}</span>
                      <span>{formatCurrency(s.engaged + s.actual)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-green" 
                        style={{ width: `${Math.min(((s.engaged + s.actual) / (s.budget || 1)) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-slate-900 text-white p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/10 blur-[100px] rounded-full -mr-32 -mt-32" />
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 uppercase tracking-tight relative z-10">Synthèse Globale</h3>
            <div className="grid grid-cols-2 gap-8 relative z-10">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">Budget Total</p>
                <p className="text-2xl font-black">{formatCurrency(budgetStatus.reduce((sum, s) => sum + s.budget, 0))}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">Total Engagé</p>
                <p className="text-2xl font-black text-amber-400">{formatCurrency(budgetStatus.reduce((sum, s) => sum + s.engaged, 0))}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">Réalisé (Comptabilité)</p>
                <p className="text-2xl font-black text-blue-400">{formatCurrency(budgetStatus.reduce((sum, s) => sum + s.actual, 0))}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">Solde Disponible</p>
                <p className="text-2xl font-black text-brand-green">{formatCurrency(budgetStatus.reduce((sum, s) => sum + s.available, 0))}</p>
              </div>
            </div>
            
            <div className="mt-12 pt-8 border-t border-white/5 relative z-10">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Taux de Consommation Global</span>
                 <span className="text-sm font-bold">
                    {((budgetStatus.reduce((sum, s) => sum + s.engaged + s.actual, 0) / (budgetStatus.reduce((sum, s) => sum + s.budget, 0) || 1)) * 100).toFixed(1)}%
                 </span>
               </div>
               <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                 <div 
                  className="h-full bg-brand-green rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                  style={{ width: `${Math.min((budgetStatus.reduce((sum, s) => sum + s.engaged + s.actual, 0) / (budgetStatus.reduce((sum, s) => sum + s.budget, 0) || 1)) * 100, 100)}%` }}
                 />
               </div>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="bg-brand-green/10 border border-brand-green/20 p-6 rounded-2xl">
          <h3 className="text-brand-green font-bold mb-2 flex items-center gap-2">
            <Target size={18} />
            Budget vs Engagements
          </h3>
          <p className="text-sm text-brand-green/80 leading-relaxed">
            Le budget engagé représente les dépenses futures sécurisées par un bon de commande ou un devis signé.
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-6 rounded-2xl">
          <h3 className="text-blue-900 dark:text-blue-400 font-bold mb-2 flex items-center gap-2">
            <BarChart3 size={18} />
            Disponibilité réelle
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
            Le montant disponible est calculé après déduction des engagements et des écritures comptables déjà passées.
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-6 rounded-2xl">
          <h3 className="text-amber-900 dark:text-amber-400 font-bold mb-2 flex items-center gap-2">
            <AlertCircle size={18} />
            Contrôle à l'engagement
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
            Le système bloque automatiquement tout nouvel engagement dépassant le budget mensuel alloué.
          </p>
        </div>
      </div>

      {showRevisions && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="text-brand-green" />
                Historique des Révisions - {showRevisions}
              </h2>
              <button 
                onClick={() => setShowRevisions(null)} 
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >✕</button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="py-2">Date</th>
                    <th className="py-2 text-right">Ancien</th>
                    <th className="py-2 text-right">Nouveau</th>
                    <th className="py-2">Raison</th>
                    <th className="py-2">Utilisateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {revisions.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-500 italic">Aucune révision pour ce compte.</td></tr>
                  ) : revisions.map(rev => (
                    <tr key={rev.id} className="text-sm">
                      <td className="py-3 text-slate-500">{new Date(rev.revision_date).toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-slate-400">{formatCurrency(rev.old_amount)}</td>
                      <td className="py-3 text-right font-mono font-bold text-brand-green">{formatCurrency(rev.new_amount)}</td>
                      <td className="py-3 italic text-slate-600 dark:text-slate-300 mx-2">{rev.reason}</td>
                      <td className="py-3 text-xs text-slate-400">{rev.user_email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showEngagementForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="text-brand-green" />
                Nouvel Engagement
              </h2>
              <button 
                onClick={() => setShowEngagementForm(false)} 
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >✕</button>
            </div>
            <form onSubmit={handleCreateEngagement} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-widest leading-none">Compte de Charge</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all"
                  required
                  value={newEngagement.account_code}
                  onChange={(e) => setNewEngagement(prev => ({ ...prev, account_code: e.target.value }))}
                >
                  <option value="">Sélectionner un compte</option>
                  {accounts.map(acc => (
                    <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-widest leading-none">Montant</label>
                  <div className="relative">
                    <input 
                      type="number"
                      className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-bold"
                      required
                      min="1"
                      value={newEngagement.amount || ''}
                      onChange={(e) => setNewEngagement(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{currency}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-widest leading-none">Référence</label>
                  <input 
                    type="text"
                    placeholder="ex: BC-2024-001"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all"
                    value={newEngagement.reference}
                    onChange={(e) => setNewEngagement(prev => ({ ...prev, reference: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-widest leading-none">Description / Objet</label>
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all resize-none h-24"
                  required
                  placeholder="Justification de la dépense..."
                  value={newEngagement.description}
                  onChange={(e) => setNewEngagement(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="pt-2 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowEngagementForm(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand-green text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-green-light shadow-lg shadow-brand-green/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? 'Enregistrement...' : 'Confirmer l\'Engagement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
