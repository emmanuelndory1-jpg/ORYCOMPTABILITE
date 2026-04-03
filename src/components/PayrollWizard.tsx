import React, { useState, useEffect } from 'react';
import { 
  Calculator, Users, FileText, CheckCircle, 
  ArrowRight, ArrowLeft, Loader2, Plus, 
  Trash2, AlertCircle, Info, DollarSign,
  Calendar, Banknote
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';
import { motion, AnimatePresence } from 'motion/react';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  base_salary: number;
  status: string;
}

interface PayrollPeriod {
  id: number;
  month: number;
  year: number;
  status: 'draft' | 'validated' | 'paid';
  total_amount: number;
}

interface Payslip {
  id: number;
  employee_id: number;
  first_name: string;
  last_name: string;
  base_salary: number;
  bonuses: number;
  deductions: number;
  net_salary: number;
  details: string;
}

interface PayrollWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function PayrollWizard({ onComplete, onCancel }: PayrollWizardProps) {
  const { formatCurrency, currency } = useCurrency();
  const { alert, confirm } = useDialog();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Period
  const [period, setPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [createdPeriod, setCreatedPeriod] = useState<PayrollPeriod | null>(null);

  // Step 2: Employees & Variables
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [editingPayslip, setEditingPayslip] = useState<any>(null);
  const [pendingAdvances, setPendingAdvances] = useState<any[]>([]);

  // Step 4: Payment
  const [paymentAccount, setPaymentAccount] = useState('521');
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    fetchEmployees();
    fetchCompanySettings();
  }, []);

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

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      setEmployees(data.filter((e: any) => e.status === 'active'));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayslips = async (periodId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/periods/${periodId}/payslips`);
      const data = await res.json();
      setPayslips(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePeriod = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(period)
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedPeriod(data);
        // Automatically generate initial payslips
        await fetch(`/api/payroll/periods/${data.id}/generate`, { method: 'POST' });
        await fetchPayslips(data.id);
        setStep(2);
      } else {
        alert(data.error || "Erreur lors de la création de la période", 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayslip = async (payslipId: number, bonuses: number, deductions: number, bonusDetails: any[], deductionDetails: any[]) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payslips/${payslipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonuses, deductions, bonusDetails, deductionDetails })
      });
      if (res.ok) {
        if (createdPeriod) await fetchPayslips(createdPeriod.id);
        setEditingPayslip(null);
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePeriod = async () => {
    if (!createdPeriod) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/periods/${createdPeriod.id}/validate`, { method: 'POST' });
      if (res.ok) {
        setCreatedPeriod({ ...createdPeriod, status: 'validated' });
        setStep(4);
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayPeriod = async () => {
    if (!createdPeriod) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/periods/${createdPeriod.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentAccount })
      });
      if (res.ok) {
        alert("Paie traitée avec succès !", 'success');
        onComplete();
      } else {
        const data = await res.json();
        alert(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (m: number) => {
    return new Date(2000, m - 1).toLocaleString('fr-FR', { month: 'long' });
  };

  const steps = [
    { id: 1, title: 'Période', icon: Calendar, description: 'Choisir le mois de paie' },
    { id: 2, title: 'Variables', icon: Users, description: 'Primes et retenues' },
    { id: 3, title: 'Validation', icon: Calculator, description: 'Calcul et comptabilisation' },
    { id: 4, title: 'Paiement', icon: Banknote, description: 'Règlement des salaires' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl">
                <Calculator size={24} />
              </div>
              Assistant de Paie
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Suivez les étapes pour traiter la paie de vos salariés
            </p>
          </div>
          <button 
            onClick={async () => {
              const confirmed = await confirm("Voulez-vous vraiment annuler et fermer l'assistant ? Votre progression sera perdue.");
              if (confirmed) onCancel();
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
          >
            <Trash2 size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-8 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between max-w-3xl mx-auto relative">
            {/* Progress Line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-0 h-0.5 bg-brand-green -translate-y-1/2 z-0 transition-all duration-500" 
              style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            />

            {steps.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              
              return (
                <div key={s.id} className="relative z-10 flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                    isActive ? "bg-brand-green border-brand-green text-white shadow-lg shadow-brand-green/20 scale-110" :
                    isCompleted ? "bg-brand-green border-brand-green text-white" :
                    "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
                  )}>
                    {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase mt-2 tracking-wider",
                    isActive ? "text-brand-green" : "text-slate-400"
                  )}>
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto space-y-8"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calendar size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Définir la période</h3>
                  <p className="text-slate-500 dark:text-slate-400">Sélectionnez le mois et l'année pour lesquels vous souhaitez traiter la paie.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Mois</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-brand-green outline-none transition-all"
                      value={period.month}
                      onChange={e => setPeriod({...period, month: Number(e.target.value)})}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Année</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-brand-green outline-none transition-all"
                      value={period.year}
                      onChange={e => setPeriod({...period, year: Number(e.target.value)})}
                    >
                      {[2023, 2024, 2025, 2026].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl flex gap-3">
                  <Info className="text-amber-600 shrink-0" size={20} />
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    La création de la période générera automatiquement les bulletins de base pour tous les salariés actifs ({employees.length}).
                  </p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Saisie des Variables</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Ajoutez les primes, heures supplémentaires ou retenues pour chaque salarié.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase">Période</div>
                    <div className="text-sm font-bold text-brand-green capitalize">{getMonthName(period.month)} {period.year}</div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Salarié</th>
                        <th className="px-6 py-4 text-right">Salaire Base</th>
                        <th className="px-6 py-4 text-right">Primes</th>
                        <th className="px-6 py-4 text-right">Retenues</th>
                        <th className="px-6 py-4 text-right">Net Estimé</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {payslips.map((slip) => (
                        <tr key={slip.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 dark:text-white">{slip.last_name} {slip.first_name}</div>
                            <div className="text-xs text-slate-500">{employees.find(e => e.id === slip.employee_id)?.position}</div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(slip.base_salary)}</td>
                          <td className="px-6 py-4 text-right font-mono text-emerald-600 dark:text-emerald-400">+{formatCurrency(slip.bonuses)}</td>
                          <td className="px-6 py-4 text-right font-mono text-rose-600 dark:text-rose-400">-{formatCurrency(slip.deductions)}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(slip.net_salary)}</td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={async () => {
                                const details = JSON.parse(slip.details);
                                setEditingPayslip({
                                  id: slip.id,
                                  employee_id: slip.employee_id,
                                  name: `${slip.last_name} ${slip.first_name}`,
                                  bonuses: slip.bonuses,
                                  deductions: details.extraDeductions || 0,
                                  bonusDetails: details.bonusDetails || [],
                                  deductionDetails: details.deductionDetails || []
                                });
                                
                                // Fetch pending advances
                                try {
                                  const res = await fetch(`/api/employees/${slip.employee_id}/advances/pending`);
                                  const data = await res.json();
                                  setPendingAdvances(data);
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="p-2 hover:bg-brand-green/10 text-brand-green rounded-lg transition-colors"
                            >
                              <Plus size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calculator size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Validation de la Paie</h3>
                  <p className="text-slate-500 dark:text-slate-400">Vérifiez les totaux avant de valider. Cette action générera les écritures comptables.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Masse Salariale Brut</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(payslips.reduce((sum, p) => sum + p.base_salary + p.bonuses, 0))}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Charges Patronales</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(payslips.reduce((sum, p) => sum + (JSON.parse(p.details).employerCharges || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-brand-green/5 p-6 rounded-2xl border border-brand-green/20">
                    <p className="text-xs font-bold text-brand-green uppercase mb-2">Net à Payer Total</p>
                    <p className="text-2xl font-bold text-brand-green">
                      {formatCurrency(payslips.reduce((sum, p) => sum + p.net_salary, 0))}
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Info size={18} className="text-blue-500" />
                    Impact Comptable
                  </h4>
                  <div className="grid grid-cols-2 gap-8 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-500">
                        <span>Débit 661 (Salaires)</span>
                        <span className="font-mono">{formatCurrency(payslips.reduce((sum, p) => sum + p.base_salary + p.bonuses, 0))}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Débit 664 (Charges Soc.)</span>
                        <span className="font-mono">{formatCurrency(payslips.reduce((sum, p) => sum + (JSON.parse(p.details).employerCharges || 0), 0))}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-500">
                        <span>Crédit 422 (Personnel)</span>
                        <span className="font-mono">{formatCurrency(payslips.reduce((sum, p) => sum + p.net_salary, 0))}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Crédit 431/447 (Org. Soc/Etat)</span>
                        <span className="font-mono">{formatCurrency(payslips.reduce((sum, p) => sum + (JSON.parse(p.details).employerCharges || 0) + (payslips.reduce((sum, p) => sum + p.deductions, 0)), 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto space-y-8"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Banknote size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Paiement des Salaires</h3>
                  <p className="text-slate-500 dark:text-slate-400">Enregistrez le règlement des salaires pour clôturer la période.</p>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Montant à régler</p>
                    <p className="text-3xl font-bold text-brand-green">{formatCurrency(createdPeriod?.total_amount || 0)}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Compte de Paiement</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-brand-green outline-none transition-all"
                      value={paymentAccount}
                      onChange={e => setPaymentAccount(e.target.value)}
                    >
                      <option value={companySettings?.payment_bank_account || '521'}>Banque ({companySettings?.payment_bank_account || '521'})</option>
                      <option value={companySettings?.payment_cash_account || '571'}>Caisse ({companySettings?.payment_cash_account || '571'})</option>
                      <option value={companySettings?.payment_mobile_account || '585'}>Mobile Money ({companySettings?.payment_mobile_account || '585'})</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <button 
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1 || loading}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold disabled:opacity-30 transition-all"
          >
            <ArrowLeft size={20} /> Précédent
          </button>

          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              Annuler
            </button>
            
            {step === 1 && (
              <button 
                onClick={handleCreatePeriod}
                disabled={loading}
                className="bg-brand-green text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Suivant <ArrowRight size={20} /></>}
              </button>
            )}

            {step === 2 && (
              <button 
                onClick={() => setStep(3)}
                className="bg-brand-green text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/20"
              >
                Calculer les Totaux <ArrowRight size={20} />
              </button>
            )}

            {step === 3 && (
              <button 
                onClick={handleValidatePeriod}
                disabled={loading}
                className="bg-brand-green text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Valider la Paie <ArrowRight size={20} /></>}
              </button>
            )}

            {step === 4 && (
              <button 
                onClick={handlePayPeriod}
                disabled={loading}
                className="bg-brand-green text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Confirmer le Règlement <CheckCircle size={20} /></>}
              </button>
            )}
          </div>
        </div>

        {/* Sub-modal for editing variables */}
        {editingPayslip && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl"
            >
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Variables de Paie</h4>
              <p className="text-sm text-slate-500 mb-6">{editingPayslip.name}</p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Primes & Indemnités</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {editingPayslip.bonusDetails?.map((bonus: any, index: number) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          placeholder="Libellé"
                          className="flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          value={bonus.label}
                          onChange={e => {
                            const newDetails = [...editingPayslip.bonusDetails];
                            newDetails[index].label = e.target.value;
                            setEditingPayslip({...editingPayslip, bonusDetails: newDetails});
                          }}
                        />
                        <input 
                          type="number" 
                          placeholder="Montant"
                          className="w-24 px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          value={bonus.amount || ''}
                          onChange={e => {
                            const newDetails = [...editingPayslip.bonusDetails];
                            newDetails[index].amount = Number(e.target.value);
                            setEditingPayslip({...editingPayslip, bonusDetails: newDetails});
                          }}
                        />
                        <button 
                          onClick={async () => {
                            const confirmed = await confirm("Retirer cette prime ?");
                            if (confirmed) {
                              const newDetails = editingPayslip.bonusDetails.filter((_: any, i: number) => i !== index);
                              setEditingPayslip({...editingPayslip, bonusDetails: newDetails});
                            }
                          }}
                          className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setEditingPayslip({...editingPayslip, bonusDetails: [...(editingPayslip.bonusDetails || []), { label: '', amount: 0, type: 'taxable' }]})}
                    className="text-xs text-brand-green font-bold flex items-center gap-1 hover:bg-brand-green/10 px-3 py-2 rounded-lg"
                  >
                    <Plus size={14} /> Ajouter une prime
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Retenues Supplémentaires</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {editingPayslip.deductionDetails?.map((deduction: any, index: number) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          placeholder="Libellé"
                          className="flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          value={deduction.label}
                          onChange={e => {
                            const newDetails = [...editingPayslip.deductionDetails];
                            newDetails[index].label = e.target.value;
                            setEditingPayslip({...editingPayslip, deductionDetails: newDetails});
                          }}
                        />
                        <input 
                          type="number" 
                          placeholder="Montant"
                          className="w-24 px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          value={deduction.amount || ''}
                          onChange={e => {
                            const newDetails = [...editingPayslip.deductionDetails];
                            newDetails[index].amount = Number(e.target.value);
                            setEditingPayslip({...editingPayslip, deductionDetails: newDetails});
                          }}
                        />
                        <button 
                          onClick={async () => {
                            const confirmed = await confirm("Retirer cette retenue ?");
                            if (confirmed) {
                              const newDetails = editingPayslip.deductionDetails.filter((_: any, i: number) => i !== index);
                              setEditingPayslip({...editingPayslip, deductionDetails: newDetails});
                            }
                          }}
                          className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setEditingPayslip({...editingPayslip, deductionDetails: [...(editingPayslip.deductionDetails || []), { label: '', amount: 0 }]})}
                    className="text-xs text-brand-green font-bold flex items-center gap-1 hover:bg-brand-green/10 px-3 py-2 rounded-lg"
                  >
                    <Plus size={14} /> Ajouter une retenue
                  </button>
                </div>

                {pendingAdvances.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Avances en cours</label>
                    <div className="space-y-2">
                      {pendingAdvances.map((adv) => (
                        <div key={adv.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(adv.amount)}</div>
                            <div className="text-[10px] text-slate-500 uppercase">{new Date(adv.date).toLocaleDateString('fr-FR')}</div>
                          </div>
                          <button 
                            onClick={() => {
                              const alreadyAdded = editingPayslip.deductionDetails.some((d: any) => d.advance_id === adv.id);
                              if (alreadyAdded) return;
                              
                              const newDeductions = [...(editingPayslip.deductionDetails || []), { 
                                label: `Remb. Avance du ${new Date(adv.date).toLocaleDateString('fr-FR')}`, 
                                amount: adv.amount,
                                advance_id: adv.id 
                              }];
                              setEditingPayslip({...editingPayslip, deductionDetails: newDeductions});
                            }}
                            disabled={editingPayslip.deductionDetails.some((d: any) => d.advance_id === adv.id)}
                            className="px-3 py-1 bg-brand-green/10 text-brand-green text-xs font-bold rounded-lg hover:bg-brand-green/20 disabled:opacity-50 transition-all"
                          >
                            {editingPayslip.deductionDetails.some((d: any) => d.advance_id === adv.id) ? 'Ajouté' : 'Retenir'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setEditingPayslip(null)}
                  className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => {
                    const totalBonuses = editingPayslip.bonusDetails.reduce((sum: number, b: any) => sum + b.amount, 0);
                    const totalDeductions = editingPayslip.deductionDetails.reduce((sum: number, d: any) => sum + d.amount, 0);
                    handleUpdatePayslip(editingPayslip.id, totalBonuses, totalDeductions, editingPayslip.bonusDetails, editingPayslip.deductionDetails);
                  }}
                  className="flex-1 bg-brand-green text-white px-4 py-3 rounded-xl font-bold hover:bg-brand-green-dark transition-all"
                >
                  Appliquer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
