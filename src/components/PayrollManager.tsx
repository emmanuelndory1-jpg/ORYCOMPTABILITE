import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, FileText, Download, Plus, Calendar, CheckCircle, AlertCircle, ChevronRight, ArrowLeft, Calculator, Loader2, Trash2, Pencil, Printer, Coins, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { useDialog } from './DialogProvider';
import { useLanguage } from '@/context/LanguageContext';
import { PayrollWizard } from './PayrollWizard';
import { PayrollSettingsManager } from './PayrollSettingsManager';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  base_salary: number;
  start_date: string;
  status: string;
  marital_status: string;
  children_count: number;
  cnps_number?: string;
}

interface PayrollPeriod {
  id: number;
  month: number;
  year: number;
  status: 'draft' | 'validated' | 'paid';
  total_amount: number;
  created_at: string;
  payment_account_name?: string;
  payment_account_code?: string;
  details?: any;
}

interface Payslip {
  id: number;
  employee_id: number;
  first_name: string;
  last_name: string;
  position: string;
  base_salary: number;
  bonuses: number;
  deductions: number;
  net_salary: number;
  details: string; // JSON
}

interface SalaryAdvance {
  id: number;
  employee_id: number;
  first_name: string;
  last_name: string;
  amount: number;
  date: string;
  description: string;
  status: 'pending' | 'repaid';
  payslip_id?: number;
  month?: number;
  year?: number;
}

export function PayrollManager() {
  const [searchParams] = useSearchParams();
  const { formatCurrency, currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const { alert, confirm } = useDialog();
  const { t } = useLanguage();
  
  const initialView = (searchParams.get('view') as any) || 'dashboard';
  const [activeView, setActiveView] = useState<'dashboard' | 'employees' | 'periods' | 'period_details' | 'declarations' | 'advances' | 'settings'>(initialView);

  useEffect(() => {
    const view = searchParams.get('view');
    if (view && ['dashboard', 'employees', 'periods', 'period_details', 'declarations', 'advances', 'settings'].includes(view)) {
      setActiveView(view as any);
    }
  }, [searchParams]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingAdvanceId, setEditingAdvanceId] = useState<number | null>(null);
  const [paymentAccount, setPaymentAccount] = useState('521'); // Default to Bank
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Payslip Edit Modal
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState<{
    id: number;
    name: string;
    bonuses: number;
    deductions: number;
    bonusDetails: Array<{ label: string, amount: number, type: 'taxable' | 'non_taxable' }>;
    deductionDetails: Array<{ label: string, amount: number }>;
  } | null>(null);

  const printPayslip = (slip: Payslip) => {
    if (!selectedPeriod) return;
    
    const doc = new jsPDF();
    const details = JSON.parse(slip.details);
    
    // Header
    doc.setFontSize(18);
    doc.text("BULLETIN DE PAIE", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Période: ${getMonthName(selectedPeriod.month)} ${selectedPeriod.year}`, 105, 30, { align: "center" });

    // Employee Info
    autoTable(doc, {
        startY: 40,
        head: [['Employé', 'Matricule', 'Fonction']],
        body: [[`${slip.first_name} ${slip.last_name}`, slip.employee_id, slip.position]],
        theme: 'plain',
        styles: { fontSize: 10 }
    });

    // Body
    const body = [
        ['Salaire de base', formatCurrency(slip.base_salary)],
    ];

    // Bonuses
    if (details.bonusDetails && details.bonusDetails.length > 0) {
        details.bonusDetails.forEach((b: any) => {
             body.push([`${b.label} (${b.type === 'taxable' ? 'Imposable' : 'Non Imposable'})`, formatCurrency(b.amount)]);
        });
    } else if (slip.bonuses > 0) {
        body.push(['Primes', formatCurrency(slip.bonuses)]);
    }

    body.push(['Salaire Brut Imposable', formatCurrency(details.grossTaxable || details.gross)]);
    body.push(['Salaire Brut Total', formatCurrency(details.grossTotal || details.gross)]);

    // Deductions
    body.push(['--- Retenues ---', '']);
    body.push(['CNPS (Retraite)', `-${formatCurrency(details.cnpsEmployee)}`]);
    body.push(['Impôt sur Salaire (IS)', `-${formatCurrency(details.taxes.is)}`]);
    body.push(['Contribution Nationale (CN)', `-${formatCurrency(details.taxes.cn)}`]);
    body.push(['Impôt Général sur le Revenu (IGR)', `-${formatCurrency(details.taxes.igr)}`]);
    
    if (details.deductionDetails && details.deductionDetails.length > 0) {
        details.deductionDetails.forEach((d: any) => {
             body.push([d.label, `-${formatCurrency(d.amount)}`]);
        });
    } else if (details.extraDeductions > 0) {
        body.push(['Autres Retenues (Avances, Prêts)', `-${formatCurrency(details.extraDeductions)}`]);
    }

    body.push(['--- Total Retenues ---', `-${formatCurrency((details.grossTotal || details.gross) - slip.net_salary)}`]);

    // Net
    body.push(['NET À PAYER', formatCurrency(slip.net_salary)]);

    autoTable(doc, {
        startY: ((doc as any).lastAutoTable?.finalY || 40) + 10,
        head: [['Rubrique', 'Montant']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`Bulletin_${slip.last_name}_${selectedPeriod.month}_${selectedPeriod.year}.pdf`);
  };

  // Forms
  const [newEmployee, setNewEmployee] = useState({
    firstName: '', 
    lastName: '', 
    email: '', 
    phone: '', 
    position: '', 
    department: '', 
    baseSalary: 0, 
    startDate: '',
    maritalStatus: 'single',
    childrenCount: 0,
    cnpsNumber: '',
    status: 'active'
  });
  const [newPeriod, setNewPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const [newAdvance, setNewAdvance] = useState({
    employee_id: 0,
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => {
    fetchEmployees();
    fetchPeriods();
    fetchAdvances();
    fetchCompanySettings();
  }, [activeYear?.id]);

  const fetchCompanySettings = async () => {
    try {
      const res = await fetch('/api/company/settings');
      if (res.ok) {
        const data = await res.json();
        setCompanySettings(data);
        if (data.payment_bank_account) {
          setPaymentAccount(data.payment_bank_account);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedPeriod) {
      fetchPayslips(selectedPeriod.id);
    }
  }, [selectedPeriod]);

  const [advanceFilter, setAdvanceFilter] = useState({ employeeId: 0, status: 'all' });

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPeriods = async () => {
    try {
      const res = await fetch('/api/payroll/periods');
      const data = await res.json();
      setPeriods(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdvances = async () => {
    try {
      const res = await fetch('/api/advances');
      const data = await res.json();
      setAdvances(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdvance.employee_id === 0 || newAdvance.amount <= 0) {
      alert("Veuillez remplir tous les champs obligatoires.", 'error');
      return;
    }

    try {
      const url = editingAdvanceId ? `/api/advances/${editingAdvanceId}` : '/api/advances';
      const method = editingAdvanceId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdvance)
      });

      if (res.ok) {
        fetchAdvances();
        setIsAdvanceModalOpen(false);
        setEditingAdvanceId(null);
        setNewAdvance({
          employee_id: 0,
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          description: ''
        });
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue.", 'error');
    }
  };

  const handleEditAdvance = (adv: SalaryAdvance) => {
    setEditingAdvanceId(adv.id);
    setNewAdvance({
      employee_id: adv.employee_id,
      amount: adv.amount,
      date: adv.date,
      description: adv.description || ''
    });
    setIsAdvanceModalOpen(true);
  };

  const handleDeleteAdvance = async (id: number) => {
    const confirmed = await confirm(t('common.confirm_delete'));
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/advances/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAdvances();
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue.", 'error');
    }
  };

  const fetchPayslips = async (periodId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/periods/${periodId}/payslips`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayslips(data);
      } else {
        console.error("Payslips data is not an array:", data);
        setPayslips([]);
      }
    } catch (err) {
      console.error(err);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async () => {
    try {
      const url = editingEmployeeId ? `/api/employees/${editingEmployeeId}` : '/api/employees';
      const method = editingEmployeeId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee)
      });
      if (res.ok) {
        setIsEmployeeModalOpen(false);
        setEditingEmployeeId(null);
        fetchEmployees();
        setNewEmployee({ 
          firstName: '', 
          lastName: '', 
          email: '', 
          phone: '', 
          position: '', 
          department: '', 
          baseSalary: 0, 
          startDate: '',
          maritalStatus: 'single',
          childrenCount: 0,
          cnpsNumber: '',
          status: 'active'
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setNewEmployee({
      firstName: emp.first_name,
      lastName: emp.last_name,
      email: emp.email || '',
      phone: emp.phone || '',
      position: emp.position || '',
      department: emp.department || '',
      baseSalary: emp.base_salary,
      startDate: emp.start_date,
      maritalStatus: emp.marital_status || 'single',
      childrenCount: emp.children_count || 0,
      cnpsNumber: emp.cnps_number || '',
      status: emp.status || 'active'
    });
    setIsEmployeeModalOpen(true);
  };

  const handleUpdatePayslip = async () => {
    if (!editingPayslip) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payslips/${editingPayslip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bonuses: editingPayslip.bonuses,
          deductions: editingPayslip.deductions,
          bonusDetails: editingPayslip.bonusDetails,
          deductionDetails: editingPayslip.deductionDetails
        })
      });

      if (res.ok) {
        setIsPayslipModalOpen(false);
        setEditingPayslip(null);
        if (selectedPeriod) {
          fetchPayslips(selectedPeriod.id);
          fetchPeriods(); // Update total amount
        }
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur inattendue est survenue.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePeriod = async () => {
    try {
      const res = await fetch('/api/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPeriod)
      });
      if (res.ok) {
        setIsPeriodModalOpen(false);
        fetchPeriods();
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur inattendue est survenue.", 'error');
    }
  };

  const handleGeneratePayslips = async () => {
    if (!selectedPeriod) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/periods/${selectedPeriod.id}/generate`, { method: 'POST' });
      if (res.ok) {
        fetchPayslips(selectedPeriod.id);
        fetchPeriods(); // Update total amount
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePeriod = async () => {
    if (!selectedPeriod) return;
    const confirmed = await confirm("Valider cette période générera les écritures comptables irréversibles. Continuer ?");
    if (!confirmed) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/periods/${selectedPeriod.id}/validate`, { method: 'POST' });
      if (res.ok) {
        alert("Période validée et écritures comptables générées !", 'success');
        setSelectedPeriod({ ...selectedPeriod, status: 'validated' });
        fetchPeriods();
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur inattendue est survenue.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePayPeriod = async () => {
    if (!selectedPeriod) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/periods/${selectedPeriod.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentAccount })
      });
      if (res.ok) {
        alert("Paiement enregistré avec succès !", 'success');
        setSelectedPeriod({ ...selectedPeriod, status: 'paid' });
        fetchPeriods();
        setIsPaymentModalOpen(false);
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur inattendue est survenue.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePeriod = async (period: PayrollPeriod, e: React.MouseEvent) => {
    e.stopPropagation();
    const message = period.status === 'draft' 
      ? t('common.confirm_delete')
      : "ATTENTION : Supprimer cette période annulera toutes les écritures comptables associées. Continuer ?";
    
    const confirmed = await confirm(message);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/payroll/periods/${period.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPeriods();
        if (selectedPeriod?.id === period.id) setSelectedPeriod(null);
        if (activeView === 'period_details') setActiveView('periods');
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur inattendue est survenue.", 'error');
    }
  };

  const handleDeleteEmployee = async (employeeId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm(t('common.confirm_delete'));
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/employees/${employeeId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEmployees();
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur inattendue est survenue.", 'error');
    }
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleString('fr-FR', { month: 'long' });
  };

  // --- Views ---

  const exportDeclarationsPDF = () => {
    if (!selectedPeriod) return;
    const doc = new jsPDF();
    const periodName = `${new Date(2000, selectedPeriod.month - 1).toLocaleString('fr-FR', { month: 'long' })} ${selectedPeriod.year}`;
    
    doc.setFontSize(18);
    doc.text(`Déclarations Sociales & Fiscales - ${periodName}`, 14, 20);
    
    const details = selectedPeriod.details;
    const data = [
      ['CNPS (Part Salariale)', formatCurrency(details.cnpsEmployee)],
      ['CNPS (Part Patronale)', formatCurrency(details.cnpsEmployer)],
      ['Total CNPS', formatCurrency(details.cnpsEmployee + details.cnpsEmployer)],
      ['', ''],
      ['Impôt sur le Revenu (ITS)', formatCurrency(details.totalTaxes)],
      ['FDFP (Formation)', formatCurrency(details.fdfp)],
      ['', ''],
      ['TOTAL À PAYER', formatCurrency(details.cnpsEmployee + details.cnpsEmployer + details.totalTaxes + details.fdfp)]
    ];

    autoTable(doc, {
      startY: 30,
      head: [['Rubrique', 'Montant']],
      body: data,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`declarations_${selectedPeriod.month}_${selectedPeriod.year}.pdf`);
  };

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Quick Stats & Settings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-brand-green transition-all" onClick={() => setActiveView('employees')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Effectif</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{employees.length}</p>
          <p className="text-xs text-slate-500 mt-1">Salariés actifs</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-brand-green transition-all" onClick={() => setActiveView('periods')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Banknote size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Masse Salariale</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(employees.reduce((sum, e) => sum + e.base_salary, 0))}</p>
          <p className="text-xs text-slate-500 mt-1">Salaire de base mensuel</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-brand-green transition-all" onClick={() => setActiveView('advances')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
              <Coins size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avances</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {advances.filter(a => a.status === 'pending').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">En attente de remboursement</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-brand-green transition-all" onClick={() => setActiveView('settings')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
              <Plus size={20} className="rotate-45" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configuration</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-brand-green w-[100%]" />
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">100%</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Taux CNPS & Taxes actifs</p>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-inner">
        <div className="max-w-xl mx-auto">
          <div className="w-20 h-20 bg-brand-green/10 text-brand-green rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Calculator size={40} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">Prêt pour la paie de ce mois ?</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg leading-relaxed">
            Gérez vos employés, générez les bulletins de salaire et comptabilisez automatiquement les charges sociales et fiscales selon les normes locales.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={() => setIsWizardOpen(true)} 
              className="bg-brand-green hover:bg-brand-green-dark text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-brand-green/20 flex items-center justify-center gap-3 scale-105 hover:scale-110 active:scale-95"
            >
              <Calculator size={24} /> Lancer l'Assistant de Paie
            </button>
            <button 
              onClick={() => setActiveView('employees')} 
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <Users size={20} /> Gérer les Salariés
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvances = () => {
    const filteredAdvances = advances.filter(adv => {
      const matchEmp = advanceFilter.employeeId === 0 || adv.employee_id === advanceFilter.employeeId;
      const matchStatus = advanceFilter.status === 'all' || adv.status === advanceFilter.status;
      return matchEmp && matchStatus;
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Avances sur Salaire</h2>
          <button 
            onClick={() => {
              setEditingAdvanceId(null);
              setNewAdvance({
                employee_id: 0,
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                description: ''
              });
              setIsAdvanceModalOpen(true);
            }}
            className="bg-brand-green text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-brand-green-dark transition-colors shadow-sm"
          >
            <Plus size={20} /> Nouvelle Avance
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-end shadow-sm">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Filtrer par Employé</label>
            <select 
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={advanceFilter.employeeId}
              onChange={e => setAdvanceFilter({...advanceFilter, employeeId: Number(e.target.value)})}
            >
              <option value={0}>Tous les employés</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.last_name} {emp.first_name}</option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Statut</label>
            <select 
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={advanceFilter.status}
              onChange={e => setAdvanceFilter({...advanceFilter, status: e.target.value as any})}
            >
              <option value="all">Tous</option>
              <option value="pending">En attente</option>
              <option value="repaid">Remboursées</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Employé</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Montant</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Description</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Statut</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      Aucune avance trouvée.
                    </td>
                  </tr>
                ) : (
                  filteredAdvances.map((adv) => (
                    <tr key={adv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {new Date(adv.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{adv.last_name} {adv.first_name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(adv.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                        {adv.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          adv.status === 'pending' 
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        )}>
                          {adv.status === 'pending' ? 'En attente' : 'Remboursée'}
                        </span>
                        {adv.status === 'repaid' && adv.month && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(2000, adv.month - 1).toLocaleString('fr-FR', { month: 'short' })} {adv.year}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {adv.status === 'pending' && (
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleEditAdvance(adv)}
                              className="text-slate-400 hover:text-brand-green p-1 rounded-md hover:bg-brand-green/10 transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteAdvance(adv.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderEmployees = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Liste des Salariés</h2>
        <button 
          onClick={() => setIsEmployeeModalOpen(true)}
          className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} /> Nouveau Salarié
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Nom & Prénom</th>
              <th className="px-6 py-4">Poste</th>
              <th className="px-6 py-4">Département</th>
              <th className="px-6 py-4">Famille</th>
              <th className="px-6 py-4 text-right">Salaire Base</th>
              <th className="px-6 py-4 text-center">Statut</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {employees.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">Aucun salarié enregistré.</td></tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 group">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                    {emp.last_name} {emp.first_name}
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">{emp.email}</div>
                    {(emp as any).cnps_number && <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">CNPS: {(emp as any).cnps_number}</div>}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{emp.position}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{emp.department}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    <div className="text-sm capitalize">{emp.marital_status === 'single' ? 'Célibataire' : emp.marital_status === 'married' ? 'Marié(e)' : emp.marital_status}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-500">{emp.children_count || 0} enfant(s)</div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-900 dark:text-white">{formatCurrency(emp.base_salary)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-green/10 text-brand-green-dark dark:text-emerald-400 capitalize">
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleEditEmployee(emp)}
                        className="text-slate-400 hover:text-brand-green p-1 rounded-md hover:bg-brand-green/10 transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteEmployee(emp.id, e)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        title="Supprimer le salarié"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPeriods = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Périodes de Paie</h2>
        <button 
          onClick={() => setIsPeriodModalOpen(true)}
          className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} /> Nouvelle Période
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Période</th>
              <th className="px-6 py-4 text-right">Net à Payer</th>
              <th className="px-6 py-4 text-center">Statut</th>
              <th className="px-6 py-4">Paiement</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {periods.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400">Aucune période de paie créée. Commencez par en créer une.</td></tr>
            ) : (
              periods.map((period) => (
                <tr 
                  key={period.id} 
                  onClick={() => { setSelectedPeriod(period); setActiveView('period_details'); }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 group-hover:bg-brand-green/10 group-hover:text-brand-green transition-colors">
                        <Calendar size={18} />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white capitalize">{getMonthName(period.month)} {period.year}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(period.total_amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "text-xs font-medium px-2.5 py-0.5 rounded-full capitalize",
                      period.status === 'validated' ? "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" : 
                      period.status === 'paid' ? "bg-brand-green/10 text-brand-green-dark border border-brand-green/20 dark:text-emerald-400 dark:border-emerald-800" : 
                      "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                    )}>
                      {period.status === 'validated' ? 'Validé' : period.status === 'paid' ? 'Payé' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {period.status === 'paid' ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{period.payment_account_name || 'Compte inconnu'}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{period.payment_account_code}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500 italic">En attente</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={(e) => handleDeletePeriod(period, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                        title="Supprimer la période"
                      >
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-brand-green" />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPeriodDetails = () => {
    if (!selectedPeriod) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveView('periods')}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize flex items-center gap-2">
                Paie {getMonthName(selectedPeriod.month)} {selectedPeriod.year}
                {selectedPeriod.status === 'validated' && <CheckCircle size={18} className="text-amber-500" />}
                {selectedPeriod.status === 'paid' && <CheckCircle size={18} className="text-brand-green" />}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Gestion des bulletins et validation</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {selectedPeriod.status === 'draft' && (
              <>
                <button 
                  onClick={handleGeneratePayslips}
                  disabled={loading}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Calculator size={18} />}
                  Générer les Bulletins
                </button>
                <button 
                  onClick={handleValidatePeriod}
                  disabled={loading || payslips.length === 0}
                  className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                  <CheckCircle size={18} />
                  Valider & Comptabiliser
                </button>
              </>
            )}
            {selectedPeriod.status === 'validated' && (
               <button 
                 onClick={() => setIsPaymentModalOpen(true)}
                 className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
               >
                 <CheckCircle size={18} /> Payer les Salaires
               </button>
            )}
            {selectedPeriod.status === 'paid' && (
               <button className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 px-4 py-2 rounded-xl font-medium flex items-center gap-2 cursor-not-allowed">
                 <CheckCircle size={18} /> Payé
               </button>
            )}
            <button 
              onClick={() => setActiveView('declarations')}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <FileText size={18} /> Déclarations
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Masse Salariale (Brut)</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {formatCurrency(payslips.reduce((sum, p) => sum + p.base_salary + p.bonuses, 0))}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Total Charges (Patronales)</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {formatCurrency(payslips.reduce((sum, p) => sum + (JSON.parse(p.details).employerCharges || 0), 0))}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Net à Payer</p>
            <p className="text-lg font-bold text-brand-green dark:text-emerald-400">
              {formatCurrency(selectedPeriod.total_amount)}
            </p>
          </div>
        </div>

        {/* Payslips Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Salarié</th>
                <th className="px-6 py-4 text-right">Salaire Base</th>
                <th className="px-6 py-4 text-right">Primes</th>
                <th className="px-6 py-4 text-right">Retenues (Salarié)</th>
                <th className="px-6 py-4 text-right">Net à Payer</th>
                <th className="px-6 py-4 text-right">Charges Patronales</th>
                {selectedPeriod.status === 'draft' && <th className="px-6 py-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {payslips.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucun bulletin généré pour cette période.</td></tr>
              ) : (
                payslips.map((slip) => {
                  const details = JSON.parse(slip.details);
                  const employerTotal = details.employerDetails 
                    ? Object.values(details.employerDetails).reduce((a: any, b: any) => a + b, 0) as number
                    : details.employerCharges;

                  return (
                    <tr key={slip.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {slip.last_name} {slip.first_name}
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">{slip.position}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">Parts: {details.parts || 1}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(slip.base_salary)}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(slip.bonuses)}</td>
                      <td className="px-6 py-4 text-right font-mono text-rose-600 dark:text-rose-400">
                        <div>-{formatCurrency(slip.deductions)}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          CNPS: {formatCurrency(details.cnpsEmployee)}<br/>
                          IS: {formatCurrency(details.taxes.is)}<br/>
                          CN: {formatCurrency(details.taxes.cn)}<br/>
                          IGR: {formatCurrency(details.taxes.igr)}
                          {details.extraDeductions > 0 && (
                            <>
                              <br/>Avances: {formatCurrency(details.extraDeductions)}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-brand-green dark:text-emerald-400">{formatCurrency(slip.net_salary)}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-400 dark:text-slate-500">
                        <div>{formatCurrency(employerTotal)}</div>
                        {details.employerDetails && (
                          <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                            CNPS: {formatCurrency(details.employerDetails.CNPS_RET_PAT)}<br/>
                            FDFP: {formatCurrency((details.employerDetails.FDFP_TPC || 0) + (details.employerDetails.FDFP_FPC || 0))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {selectedPeriod.status === 'draft' && (
                            <button 
                              onClick={() => {
                                const details = JSON.parse(slip.details);
                                setEditingPayslip({
                                  id: slip.id,
                                  name: `${slip.last_name} ${slip.first_name}`,
                                  bonuses: slip.bonuses,
                                  deductions: details.extraDeductions || 0,
                                  bonusDetails: details.bonusDetails || [],
                                  deductionDetails: details.deductionDetails || []
                                });
                                setIsPayslipModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-brand-green p-1 rounded-md hover:bg-brand-green/10 transition-colors"
                              title="Modifier Primes/Retenues"
                            >
                              <Pencil size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => printPayslip(slip)}
                            className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 transition-colors"
                            title="Imprimer Bulletin"
                          >
                            <Printer size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDeclarations = () => {
    if (!selectedPeriod) return (
      <div className="text-center p-12 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
        Veuillez sélectionner une période de paie pour voir les déclarations.
        <br />
        <button 
          onClick={() => setActiveView('periods')}
          className="mt-4 text-brand-green font-medium hover:underline"
        >
          Aller aux Périodes
        </button>
      </div>
    );

    // Calculate Totals
    let totalGross = 0;
    let totalCnpsEmployee = 0;
    let totalCnpsEmployer = 0;
    let totalPF = 0;
    let totalAT = 0;
    let totalIS = 0;
    let totalCN = 0;
    let totalIGR = 0;
    let totalFDFP_TPC = 0;
    let totalFDFP_FPC = 0;

    payslips.forEach(p => {
      const details = JSON.parse(p.details);
      totalGross += (p.base_salary + p.bonuses);
      totalCnpsEmployee += details.cnpsEmployee;
      totalIS += details.taxes.is;
      totalCN += details.taxes.cn;
      totalIGR += details.taxes.igr;

      if (details.employerDetails) {
        totalCnpsEmployer += (details.employerDetails.CNPS_RET_PAT || 0);
        totalPF += (details.employerDetails.PF || 0);
        totalAT += (details.employerDetails.AT || 0);
        totalFDFP_TPC += (details.employerDetails.FDFP_TPC || 0);
        totalFDFP_FPC += (details.employerDetails.FDFP_FPC || 0);
      } else {
        // Fallback logic if detailed breakdown missing
        totalCnpsEmployer += (details.employerCharges * 0.45); // Approx
        totalPF += (details.employerCharges * 0.35); // Approx
        totalAT += (details.employerCharges * 0.20); // Approx
      }
    });

    const totalCnpsGlobal = totalCnpsEmployee + totalCnpsEmployer + totalPF + totalAT;
    const totalImpots = totalIS + totalCN + totalIGR;
    const totalFDFP = totalFDFP_TPC + totalFDFP_FPC;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveView('periods')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Déclarations Sociales & Fiscales</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Période : {getMonthName(selectedPeriod.month)} {selectedPeriod.year}
              </p>
            </div>
          </div>
          <button 
            onClick={() => exportDeclarationsPDF()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download size={18} /> Exporter PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CNPS Declaration */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                CNPS (Caisse Nationale de Prévoyance Sociale)
              </h3>
              <span className="text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">Mensuel</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Retraite (Part Salariale)</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{formatCurrency(totalCnpsEmployee)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Retraite (Part Patronale)</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{formatCurrency(totalCnpsEmployer)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Prestations Familiales (PF)</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{formatCurrency(totalPF)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Accidents du Travail (AT)</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{formatCurrency(totalAT)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 mt-2">
                <span className="font-bold text-slate-900 dark:text-white">TOTAL À PAYER CNPS</span>
                <span className="font-mono font-bold text-xl text-orange-600 dark:text-orange-400">{formatCurrency(totalCnpsGlobal)}</span>
              </div>
            </div>
          </div>

          {/* Tax Declaration */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                Impôts sur Salaires (DGI)
              </h3>
              <span className="text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">Mensuel</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Impôt sur Salaire (IS)</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{formatCurrency(totalIS)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Contribution Nationale (CN)</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{formatCurrency(totalCN)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Impôt Général sur le Revenu (IGR)</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{formatCurrency(totalIGR)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 mt-2">
                <span className="font-bold text-slate-900 dark:text-white">TOTAL À PAYER IMPÔTS</span>
                <span className="font-mono font-bold text-xl text-blue-600 dark:text-blue-400">{formatCurrency(totalImpots)}</span>
              </div>
            </div>
          </div>

          {/* FDFP Declaration */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden lg:col-span-2">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                FDFP (Formation Professionnelle)
              </h3>
              <span className="text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">Mensuel / Trimestriel</span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400 uppercase font-semibold">Taxe d'Apprentissage (0.4%)</p>
                <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(totalFDFP_TPC)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400 uppercase font-semibold">Formation Continue (1.2%)</p>
                <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(totalFDFP_FPC)}</p>
              </div>
              <div className="space-y-2 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                <p className="text-sm text-purple-700 dark:text-purple-400 uppercase font-bold">Total FDFP À Payer</p>
                <p className="text-2xl font-mono font-bold text-purple-700 dark:text-purple-400">{formatCurrency(totalFDFP)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-green/10 text-brand-green rounded-xl">
            <Calculator size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Gestion de la Paie</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Salaires & Charges Sociales</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Tableau de bord', icon: <Calculator size={16} /> },
            { id: 'employees', label: 'Salariés', icon: <Users size={16} /> },
            { id: 'periods', label: 'Périodes', icon: <Calendar size={16} /> },
            { id: 'advances', label: 'Avances', icon: <Coins size={16} /> },
            { id: 'settings', label: 'Paramètres', icon: <Plus size={16} className="rotate-45" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeView === tab.id 
                  ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeView === 'dashboard' && renderDashboard()}
      {activeView === 'employees' && renderEmployees()}
      {activeView === 'periods' && renderPeriods()}
      {activeView === 'period_details' && renderPeriodDetails()}
      {activeView === 'declarations' && renderDeclarations()}
      {activeView === 'advances' && renderAdvances()}
      {activeView === 'settings' && <PayrollSettingsManager />}

      {/* Payroll Wizard */}
      {isWizardOpen && (
        <PayrollWizard 
          onComplete={() => {
            setIsWizardOpen(false);
            fetchPeriods();
            setActiveView('periods');
          }}
          onCancel={() => setIsWizardOpen(false)}
        />
      )}

      {/* Salary Advance Modal */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editingAdvanceId ? 'Modifier l\'avance' : 'Nouvelle Avance sur Salaire'}
            </h2>
            <form onSubmit={handleCreateAdvance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Employé</label>
                <select 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:opacity-50"
                  value={newAdvance.employee_id}
                  onChange={e => setNewAdvance({...newAdvance, employee_id: Number(e.target.value)})}
                  required
                  disabled={!!editingAdvanceId}
                >
                  <option value={0}>Sélectionner un employé</option>
                  {employees.filter(e => e.status === 'active').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.last_name} {emp.first_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Montant ({currency})</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={newAdvance.amount || ''}
                  onChange={e => setNewAdvance({...newAdvance, amount: Number(e.target.value)})}
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={newAdvance.date}
                  onChange={e => setNewAdvance({...newAdvance, date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Description (Optionnel)</label>
                <textarea 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={newAdvance.description}
                  onChange={e => setNewAdvance({...newAdvance, description: e.target.value})}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAdvanceModalOpen(false);
                    setEditingAdvanceId(null);
                    setNewAdvance({
                      employee_id: 0,
                      amount: 0,
                      date: new Date().toISOString().split('T')[0],
                      description: ''
                    });
                  }} 
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Annuler
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green-dark">
                  {editingAdvanceId ? 'Mettre à jour' : 'Enregistrer l\'avance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editingEmployeeId ? 'Modifier le Salarié' : 'Nouveau Salarié'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Prénom</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={newEmployee.firstName ?? ''} onChange={e => setNewEmployee({...newEmployee, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Nom</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={newEmployee.lastName ?? ''} onChange={e => setNewEmployee({...newEmployee, lastName: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={newEmployee.email ?? ''} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Téléphone</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={newEmployee.phone ?? ''} onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Poste</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={newEmployee.position ?? ''} onChange={e => setNewEmployee({...newEmployee, position: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Département</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={newEmployee.department ?? ''} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Salaire Base ({currency})</label>
                  <input type="number" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={isNaN(newEmployee.baseSalary) ? '' : newEmployee.baseSalary} onChange={e => setNewEmployee({...newEmployee, baseSalary: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Date d'embauche</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={newEmployee.startDate ?? ''} onChange={e => setNewEmployee({...newEmployee, startDate: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Situation Matrimoniale</label>
                  <select 
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" 
                    value={newEmployee.maritalStatus ?? 'single'} 
                    onChange={e => setNewEmployee({...newEmployee, maritalStatus: e.target.value})}
                  >
                    <option value="single">Célibataire</option>
                    <option value="married">Marié(e)</option>
                    <option value="divorced">Divorcé(e)</option>
                    <option value="widowed">Veuf/Veuve</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Nombre d'enfants</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" 
                    value={isNaN(newEmployee.childrenCount) ? '' : newEmployee.childrenCount} 
                    onChange={e => setNewEmployee({...newEmployee, childrenCount: Number(e.target.value)})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Numéro CNPS</label>
                  <input 
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" 
                    value={newEmployee.cnpsNumber ?? ''} 
                    onChange={e => setNewEmployee({...newEmployee, cnpsNumber: e.target.value})} 
                    placeholder="Ex: 12345678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Statut</label>
                  <select 
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white" 
                    value={newEmployee.status ?? 'active'} 
                    onChange={e => setNewEmployee({...newEmployee, status: e.target.value})}
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    <option value="terminated">Terminé</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setIsEmployeeModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Annuler</button>
                <button onClick={handleCreateEmployee} className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green-dark">
                  {editingEmployeeId ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Edit Modal */}
      {isPayslipModalOpen && editingPayslip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Modifier le Bulletin</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{editingPayslip.name}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Primes & Indemnités</label>
                <div className="space-y-2 mb-2">
                    {editingPayslip.bonusDetails?.map((bonus, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <input 
                                type="text" 
                                placeholder="Libellé"
                                className="flex-1 px-2 py-1 text-sm border rounded dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                value={bonus.label ?? ''}
                                onChange={e => {
                                    const newDetails = [...(editingPayslip.bonusDetails || [])];
                                    newDetails[index].label = e.target.value;
                                    setEditingPayslip({...editingPayslip, bonusDetails: newDetails});
                                }}
                            />
                            <input 
                                type="number" 
                                placeholder="Montant"
                                className="w-24 px-2 py-1 text-sm border rounded dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                value={isNaN(bonus.amount) ? '' : bonus.amount}
                                onChange={e => {
                                    const newDetails = [...(editingPayslip.bonusDetails || [])];
                                    newDetails[index].amount = Number(e.target.value);
                                    setEditingPayslip({...editingPayslip, bonusDetails: newDetails});
                                }}
                            />
                            <select
                                className="w-28 px-2 py-1 text-xs border rounded dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                value={bonus.type}
                                onChange={e => {
                                    const newDetails = [...(editingPayslip.bonusDetails || [])];
                                    newDetails[index].type = e.target.value as 'taxable' | 'non_taxable';
                                    setEditingPayslip({...editingPayslip, bonusDetails: newDetails});
                                }}
                            >
                                <option value="taxable">Imposable</option>
                                <option value="non_taxable">Non Imp.</option>
                            </select>
                            <button 
                                onClick={async () => {
                                    const confirmed = await confirm("Retirer cette prime ?");
                                    if (confirmed) {
                                        const newDetails = editingPayslip.bonusDetails.filter((_, i) => i !== index);
                                        setEditingPayslip({...editingPayslip, bonusDetails: newDetails});
                                    }
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                <button 
                    onClick={() => {
                        const currentDetails = editingPayslip.bonusDetails || [];
                        setEditingPayslip({
                            ...editingPayslip, 
                            bonusDetails: [...currentDetails, { label: '', amount: 0, type: 'taxable' }]
                        });
                    }}
                    className="text-xs text-brand-green font-medium flex items-center gap-1 hover:bg-brand-green/10 px-2 py-1 rounded"
                >
                    <Plus size={14} /> Ajouter une prime
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Retenues Supplémentaires</label>
                <div className="space-y-2 mb-2">
                    {editingPayslip.deductionDetails?.map((deduction, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <input 
                                type="text" 
                                placeholder="Libellé (ex: Prêt, Avance)"
                                className="flex-1 px-2 py-1 text-sm border rounded dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                value={deduction.label ?? ''}
                                onChange={e => {
                                    const newDetails = [...(editingPayslip.deductionDetails || [])];
                                    newDetails[index].label = e.target.value;
                                    setEditingPayslip({...editingPayslip, deductionDetails: newDetails});
                                }}
                            />
                            <input 
                                type="number" 
                                placeholder="Montant"
                                className="w-24 px-2 py-1 text-sm border rounded dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                value={isNaN(deduction.amount) ? '' : deduction.amount}
                                onChange={e => {
                                    const newDetails = [...(editingPayslip.deductionDetails || [])];
                                    newDetails[index].amount = Number(e.target.value);
                                    setEditingPayslip({...editingPayslip, deductionDetails: newDetails});
                                }}
                            />
                            <button 
                                onClick={async () => {
                                    const confirmed = await confirm("Retirer cette retenue ?");
                                    if (confirmed) {
                                        const newDetails = editingPayslip.deductionDetails.filter((_, i) => i !== index);
                                        setEditingPayslip({...editingPayslip, deductionDetails: newDetails});
                                    }
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                <button 
                    onClick={() => {
                        const currentDetails = editingPayslip.deductionDetails || [];
                        setEditingPayslip({
                            ...editingPayslip, 
                            deductionDetails: [...currentDetails, { label: '', amount: 0 }]
                        });
                    }}
                    className="text-xs text-brand-green font-medium flex items-center gap-1 hover:bg-brand-green/10 px-2 py-1 rounded"
                >
                    <Plus size={14} /> Ajouter une retenue
                </button>

                {(() => {
                  const empId = payslips.find(p => p.id === editingPayslip.id)?.employee_id;
                  const empAdvances = advances.filter(a => a.employee_id === empId && a.status === 'pending');
                  const totalPending = empAdvances.reduce((sum, a) => sum + a.amount, 0);
                  
                  return totalPending > 0 ? (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg">
                      <div className="flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                        <span>Avances en attente :</span>
                        <span>{formatCurrency(totalPending)}</span>
                      </div>
                      <button 
                        onClick={() => {
                            const currentDetails = editingPayslip.deductionDetails || [];
                            setEditingPayslip({
                                ...editingPayslip, 
                                deductionDetails: [...currentDetails, { label: 'Remboursement Avance', amount: totalPending }]
                            });
                        }}
                        className="text-[10px] text-brand-green hover:underline mt-1"
                      >
                        Appliquer comme retenue
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Aucune avance en attente pour ce salarié.</p>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setIsPayslipModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Annuler</button>
                <button 
                  onClick={handleUpdatePayslip} 
                  className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green-dark flex items-center gap-2"
                  disabled={loading}
                >
                  {loading && <Loader2 className="animate-spin" size={16} />}
                  Recalculer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period Modal */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Nouvelle Période</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Mois</label>
                <select 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={newPeriod.month ?? 1}
                  onChange={e => setNewPeriod({...newPeriod, month: Number(e.target.value)})}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('fr-FR', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Année</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={isNaN(newPeriod.year) ? '' : newPeriod.year}
                  onChange={e => setNewPeriod({...newPeriod, year: Number(e.target.value)})}
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setIsPeriodModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Annuler</button>
                <button onClick={handleCreatePeriod} className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green-dark">Créer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPeriod && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Paiement des Salaires</h2>
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Vous allez enregistrer le paiement des salaires pour la période de <span className="font-bold">{getMonthName(selectedPeriod.month)} {selectedPeriod.year}</span>.
              </p>
              
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Total Net à Payer</p>
                <p className="text-2xl font-bold text-brand-green dark:text-emerald-400">{formatCurrency(selectedPeriod.total_amount)}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Compte de trésorerie</label>
                <select 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={paymentAccount ?? '521'}
                  onChange={e => setPaymentAccount(e.target.value)}
                >
                  <option value={companySettings?.payment_bank_account || '521'}>Banque ({companySettings?.payment_bank_account || '521'})</option>
                  <option value={companySettings?.payment_cash_account || '571'}>Caisse ({companySettings?.payment_cash_account || '571'})</option>
                  <option value={companySettings?.payment_mobile_account || '585'}>Mobile Money ({companySettings?.payment_mobile_account || '585'})</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button 
                  onClick={() => setIsPaymentModalOpen(false)} 
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button 
                  onClick={handlePayPeriod} 
                  className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green-dark flex items-center gap-2"
                  disabled={loading}
                >
                  {loading && <Loader2 className="animate-spin" size={16} />}
                  Confirmer le Paiement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
