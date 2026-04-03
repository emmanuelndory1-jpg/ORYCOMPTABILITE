import React, { useState, useEffect } from 'react';
import { 
  Building, Check, Loader2, FileText, ArrowRight, 
  DollarSign, Briefcase, Calculator, Percent, User, 
  MapPin, Phone, Mail, Globe, Shield, Settings, 
  Layers, Plus, Trash2, AlertCircle, Info, Lightbulb, Rocket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useLanguage } from '@/context/LanguageContext';
import { useDialog } from './DialogProvider';
import { OnboardingData, PartnerContribution, TreasurySetup, UserSetup } from '@/types/onboarding';

import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend
} from 'recharts';

const LEGAL_FORMS = ['SARL', 'SA', 'SAS', 'SNC', 'EI', 'GIE', 'SCS', 'SC'];
const COUNTRIES = [
  { 
    name: "Côte d'Ivoire", 
    currency: 'FCFA', 
    zone: 'UEMOA', 
    vatRate: 18, 
    city: 'Abidjan',
    taxIdLabel: 'Numéro de Compte Contribuable (NCC)',
    rccmPlaceholder: 'CI-ABJ-2024-B-1234',
    taxIdPlaceholder: '2412345 A'
  },
  { 
    name: "Sénégal", 
    currency: 'FCFA', 
    zone: 'UEMOA', 
    vatRate: 18, 
    city: 'Dakar',
    taxIdLabel: 'Numéro d\'Identification Nationale (NINEA)',
    rccmPlaceholder: 'SN-DKR-2024-B-1234',
    taxIdPlaceholder: '1234567 2G3'
  },
  { 
    name: "Cameroun", 
    currency: 'FCFA', 
    zone: 'CEMAC', 
    vatRate: 19.25, 
    city: 'Douala',
    taxIdLabel: 'Numéro d\'Identifiant Unique (NIU)',
    rccmPlaceholder: 'RC/DLA/2024/B/1234',
    taxIdPlaceholder: 'M012345678901A'
  },
  { 
    name: "Gabon", 
    currency: 'FCFA', 
    zone: 'CEMAC', 
    vatRate: 18, 
    city: 'Libreville',
    taxIdLabel: 'Numéro d\'Identification Fiscale (NIF)',
    rccmPlaceholder: 'RG-LBV-2024-B-1234',
    taxIdPlaceholder: '123456 A'
  },
  { 
    name: "Mali", 
    currency: 'FCFA', 
    zone: 'UEMOA', 
    vatRate: 18, 
    city: 'Bamako',
    taxIdLabel: 'Numéro d\'Identification Fiscale (NIF)',
    rccmPlaceholder: 'ML-BKO-2024-B-1234',
    taxIdPlaceholder: '081234567A'
  },
  { 
    name: "Burkina Faso", 
    currency: 'FCFA', 
    zone: 'UEMOA', 
    vatRate: 18, 
    city: 'Ouagadougou',
    taxIdLabel: 'Identifiant Financier Unique (IFU)',
    rccmPlaceholder: 'BF-OUA-2024-B-1234',
    taxIdPlaceholder: '00123456A'
  },
  { 
    name: "Bénin", 
    currency: 'FCFA', 
    zone: 'UEMOA', 
    vatRate: 18, 
    city: 'Cotonou',
    taxIdLabel: 'Identifiant Fiscal Unique (IFU)',
    rccmPlaceholder: 'RB-COT-2024-B-1234',
    taxIdPlaceholder: '3202412345678'
  },
  { 
    name: "Togo", 
    currency: 'FCFA', 
    zone: 'UEMOA', 
    vatRate: 18, 
    city: 'Lomé',
    taxIdLabel: 'Numéro d\'Identification Fiscale (NIF)',
    rccmPlaceholder: 'TG-LOM-2024-B-1234',
    taxIdPlaceholder: '1234567890'
  },
  { 
    name: "Niger", 
    currency: 'FCFA', 
    zone: 'UEMOA', 
    vatRate: 19, 
    city: 'Niamey',
    taxIdLabel: 'Numéro d\'Identification Fiscale (NIF)',
    rccmPlaceholder: 'NI-NIA-2024-B-1234',
    taxIdPlaceholder: '12345/R'
  },
  { 
    name: "Guinée", 
    currency: 'GNF', 
    zone: 'AUTRE', 
    vatRate: 18, 
    city: 'Conakry',
    taxIdLabel: 'Numéro d\'Identification Fiscale (NIF)',
    rccmPlaceholder: 'GN-CKY-2024-B-1234',
    taxIdPlaceholder: '123456789'
  },
  { 
    name: "RDC", 
    currency: 'CDF', 
    zone: 'AUTRE', 
    vatRate: 16, 
    city: 'Kinshasa',
    taxIdLabel: 'Numéro d\'Impôt',
    rccmPlaceholder: 'CD-KIN-2024-B-1234',
    taxIdPlaceholder: 'A1234567B'
  },
  { 
    name: "Congo", 
    currency: 'FCFA', 
    zone: 'CEMAC', 
    vatRate: 18, 
    city: 'Brazzaville',
    taxIdLabel: 'Numéro d\'Identification Fiscale (NIF)',
    rccmPlaceholder: 'CG-BZV-2024-B-1234',
    taxIdPlaceholder: '123456789'
  },
  { 
    name: "Tchad", 
    currency: 'FCFA', 
    zone: 'CEMAC', 
    vatRate: 18, 
    city: "N'Djamena",
    taxIdLabel: 'Numéro d\'Identification Fiscale (NIF)',
    rccmPlaceholder: 'TD-NDJ-2024-B-1234',
    taxIdPlaceholder: '123456789'
  },
  { 
    name: "Centrafrique", 
    currency: 'FCFA', 
    zone: 'CEMAC', 
    vatRate: 19, 
    city: 'Bangui',
    taxIdLabel: 'Numéro d\'Identification Fiscale (NIF)',
    rccmPlaceholder: 'CF-BGF-2024-B-1234',
    taxIdPlaceholder: '123456789'
  },
];

const getTaxRegimes = (currency: string) => [
  { id: 'RNI', label: 'Réel Normal (RNI)', desc: `Chiffre d'affaires > 500M ${currency}` },
  { id: 'RSI', label: 'Réel Simplifié (RSI)', desc: `Chiffre d'affaires 50M - 500M ${currency}` },
  { id: 'CME', label: 'Micro-Entreprise (CME)', desc: `Chiffre d'affaires < 50M ${currency}` },
];

export function CompanyCreation({ onComplete }: { onComplete?: () => void }) {
  const { confirm, alert } = useDialog();
  const { getCurrencyIcon } = useCurrency();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Form State
  const [formData, setFormData] = useState<OnboardingData>(() => {
    const defaultCountry = COUNTRIES[0];
    return {
      name: '',
      legalForm: 'SARL',
      rccm: '',
      taxId: '',
      address: '',
      city: defaultCountry.city,
      country: defaultCountry.name,
      email: '',
      phone: '',
      managerName: '',
      syscohadaSystem: 'normal',
      currency: defaultCountry.currency,
      fiscalYearStart: `${new Date().getFullYear()}-01-01`,
      fiscalYearDuration: 12,
      taxRegime: 'RNI',
      vatSubject: true,
      vatRate: defaultCountry.vatRate,
      capitalAmount: 1000000,
      partners: [],
      constitutionCosts: 0,
      treasury: [
        { name: 'Caisse Principale', type: 'cash', initialBalance: 0 },
        { name: 'Compte Bancaire Principal', type: 'bank', initialBalance: 0 }
      ],
      users: [],
      modules: {
        accounting: true,
        invoicing: true,
        crm: true,
        vendors: true,
        payroll: false,
        vat: true,
        assets: true,
        bankRec: true
      }
    };
  });

  const currentCountryData = COUNTRIES.find(c => c.name === formData.country) || COUNTRIES[0];

  const updateFormData = (updates: Partial<OnboardingData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const addPartner = () => {
    const currentTotal = formData.partners.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, formData.capitalAmount - currentTotal);
    const newPartner: PartnerContribution = { 
      name: formData.partners.length === 0 ? formData.managerName : '', 
      amount: remaining, 
      type: 'cash' 
    };
    updateFormData({ partners: [...formData.partners, newPartner] });
  };

  const removePartner = async (index: number) => {
    const confirmed = await confirm("Voulez-vous vraiment retirer cet associé ?");
    if (confirmed) {
      updateFormData({ partners: formData.partners.filter((_, i) => i !== index) });
    }
  };

  const updatePartner = (index: number, updates: Partial<PartnerContribution>) => {
    const newPartners = [...formData.partners];
    newPartners[index] = { ...newPartners[index], ...updates };
    updateFormData({ partners: newPartners });
  };

  const addTreasury = () => {
    const newTreasury: TreasurySetup = { name: '', type: 'bank', initialBalance: 0 };
    updateFormData({ treasury: [...formData.treasury, newTreasury] });
  };

  const removeTreasury = async (index: number) => {
    const confirmed = await confirm("Voulez-vous vraiment retirer ce compte ?");
    if (confirmed) {
      updateFormData({ treasury: formData.treasury.filter((_, i) => i !== index) });
    }
  };

  const updateTreasury = (index: number, updates: Partial<TreasurySetup>) => {
    const newTreasury = [...formData.treasury];
    newTreasury[index] = { ...newTreasury[index], ...updates };
    updateFormData({ treasury: newTreasury });
  };

  const addUser = () => {
    const newUser: UserSetup = { name: '', email: '', role: 'accountant' };
    updateFormData({ users: [...formData.users, newUser] });
  };

  const removeUser = async (index: number) => {
    const confirmed = await confirm("Voulez-vous vraiment retirer cet utilisateur ?");
    if (confirmed) {
      updateFormData({ users: formData.users.filter((_, i) => i !== index) });
    }
  };

  const updateUser = (index: number, updates: Partial<UserSetup>) => {
    const newUsers = [...formData.users];
    newUsers[index] = { ...newUsers[index], ...updates };
    updateFormData({ users: newUsers });
  };

  const validateStep = (currentStep: number) => {
    const errors: Record<string, string> = {};
    
    if (currentStep === 1) {
      if (!formData.name.trim()) errors.name = t('onboarding.error_name_required');
      if (!formData.managerName.trim()) errors.managerName = t('onboarding.error_manager_required');
      if (!formData.email.trim()) {
        errors.email = t('onboarding.error_email_required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = t('onboarding.error_email_invalid');
      }
      if (!formData.city.trim()) errors.city = t('onboarding.error_city_required');
    }
    
    if (currentStep === 3) {
      const total = formData.partners.reduce((sum, p) => sum + p.amount, 0);
      // Use a small epsilon for floating point comparison
      if (Math.abs(total - formData.capitalAmount) > 0.01) {
        errors.capital = t('onboarding.error_capital_mismatch');
      }
      if (formData.partners.length === 0) {
        errors.partners = t('onboarding.error_partners_required');
      }
      if (formData.partners.some(p => !p.name.trim())) {
        errors.partners = t('onboarding.error_partner_name_required');
      }
    }

    if (currentStep === 4) {
      if (formData.treasury.length === 0) {
        errors.treasury = t('onboarding.error_treasury_required');
      }
      if (formData.treasury.some(t => !t.name.trim())) {
        errors.treasury = t('onboarding.error_treasury_name_required');
      }
    }

    if (currentStep === 5) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.users.some(u => !emailRegex.test(u.email))) {
        errors.users = t('onboarding.error_user_email_invalid');
      }
      if (formData.users.some(u => !u.name.trim())) {
        errors.users = t('onboarding.error_user_name_required');
      }
    }

    if (currentStep === 6) {
      if (!formData.modules.accounting) {
        errors.modules = t('onboarding.error_accounting_mandatory');
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 7));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert(t('onboarding.error_generic'), 'error');
    }
  };

  const STEPS = [
    { id: 1, label: t('onboarding.step_identity'), icon: <Building size={18} />, color: 'blue' },
    { id: 2, label: t('onboarding.step_tax'), icon: <Calculator size={18} />, color: 'emerald' },
    { id: 3, label: t('onboarding.step_capital'), icon: <Briefcase size={18} />, color: 'amber' },
    { id: 4, label: t('onboarding.step_treasury'), icon: <DollarSign size={18} />, color: 'brand-green' },
    { id: 5, label: t('onboarding.step_team'), icon: <User size={18} />, color: 'indigo' },
    { id: 6, label: t('onboarding.step_modules'), icon: <Layers size={18} />, color: 'orange' },
    { id: 7, label: t('onboarding.step_launch'), icon: <Rocket size={18} />, color: 'slate' },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleSubmit = async () => {
    setLoading(true);
    setLoadingStep(1);
    
    // Expert simulated progress
    const progressInterval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < 6) return prev + 1;
        return prev;
      });
    }, 1200);

    try {
      const res = await fetch('/api/company/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        clearInterval(progressInterval);
        setLoadingStep(7);
        // Wait a bit to show the 100% progress
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSuccess(true);
        setLoading(false); // Only stop loading when success is ready to show
        
        if (onComplete) {
          // Give user time to see the success message
          setTimeout(() => onComplete(), 3000);
        }
      } else {
        clearInterval(progressInterval);
        setLoading(false);
        const err = await res.json();
        alert(err.error || t('onboarding.error_generic'), 'error');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setLoading(false);
      console.error(err);
      alert(t('onboarding.error_generic'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-brand-green/20 blur-2xl rounded-full animate-pulse" />
              <div className="relative w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center mx-auto border border-slate-100 dark:border-slate-800">
                <Loader2 className="animate-spin text-brand-green w-10 h-10" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Configuration en cours
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Veuillez patienter pendant que nous préparons votre environnement expert.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                <div key={s} className="flex items-center gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500",
                    loadingStep > s ? "bg-brand-green text-white" : 
                    loadingStep === s ? "bg-brand-green/20 text-brand-green animate-pulse" : 
                    "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  )}>
                    {loadingStep > s ? <Check size={14} strokeWidth={3} /> : s}
                  </div>
                  <span className={cn(
                    "text-sm font-bold transition-all duration-500",
                    loadingStep >= s ? "text-slate-900 dark:text-white" : "text-slate-400"
                  )}>
                    {t(`onboarding.loading_step_${s}`)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-brand-green"
                  initial={{ width: "0%" }}
                  animate={{ width: `${(loadingStep / 7) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 p-12 rounded-[3rem] shadow-2xl shadow-brand-green/20 text-center border border-slate-100 dark:border-slate-800"
        >
          <div className="w-24 h-24 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <Check size={48} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">{t('onboarding.success_title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-10 leading-relaxed">
            {t('onboarding.success_message')}
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-3">
              <Loader2 className="animate-spin text-brand-green" size={18} />
              {t('onboarding.initializing')}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center space-y-12 py-12 animate-in fade-in zoom-in-95 duration-700">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-brand-green/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <div className="relative w-32 h-32 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl flex items-center justify-center mx-auto border border-slate-100 dark:border-slate-800">
            <Rocket className="text-brand-green w-16 h-16" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
            {t('onboarding.welcome_title')}
          </h1>
          <p className="text-xl md:text-2xl font-bold text-brand-green tracking-tight">
            {t('onboarding.welcome_subtitle')}
          </p>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
            {t('onboarding.welcome_description')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-3xl mx-auto">
          {[
            { icon: Shield, title: t('onboarding.feature_compliance'), desc: t('onboarding.feature_compliance_desc') },
            { icon: Calculator, title: t('onboarding.feature_precision'), desc: t('onboarding.feature_precision_desc') },
            { icon: Layers, title: t('onboarding.feature_modular'), desc: t('onboarding.feature_modular_desc') }
          ].map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + (idx * 0.1) }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
                <item.icon className="text-brand-green w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          onClick={() => setStep(1)}
          className="group relative inline-flex items-center gap-3 bg-brand-green text-white px-12 py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-brand-green/30 hover:bg-brand-green-light hover:scale-105 active:scale-95 transition-all"
        >
          {t('onboarding.start_button')}
          <ArrowRight className="group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-3 space-y-8">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 p-4 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 animate-in slide-in-from-top duration-300">
            <AlertCircle size={20} />
            <p className="text-sm font-bold">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
              <Plus className="rotate-45" size={20} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('nav.company')}</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('onboarding.welcome_description')}</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <div 
                  key={i} 
                  className={cn(
                    "w-8 h-8 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center text-[10px] font-bold transition-all duration-500",
                    step === i ? "bg-brand-green text-white scale-110 z-10 shadow-lg shadow-brand-green/20" : 
                    step > i ? "bg-brand-green/20 text-brand-green" : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500"
                  )}
                >
                  {step > i ? <Check size={14} /> : i}
                </div>
              ))}
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression</div>
              <div className="text-sm font-bold text-brand-green">{Math.round((step / 7) * 100)}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        {/* Step Labels */}
        <div className="hidden lg:grid grid-cols-7 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          {[
            { id: 1, label: t('onboarding.step_identity'), icon: Building },
            { id: 2, label: t('onboarding.step_tax'), icon: Calculator },
            { id: 3, label: t('onboarding.step_capital'), icon: Briefcase },
            { id: 4, label: t('onboarding.step_treasury'), icon: Shield },
            { id: 5, label: t('onboarding.step_team'), icon: User },
            { id: 6, label: t('onboarding.step_modules'), icon: Layers },
            { id: 7, label: t('onboarding.step_launch'), icon: Globe }
          ].map((s) => (
            <div 
              key={s.id}
              className={cn(
                "flex flex-col items-center py-4 px-2 gap-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0 transition-all",
                step === s.id ? "bg-white dark:bg-slate-900" : "opacity-40"
              )}
            >
              <s.icon size={14} className={step === s.id ? "text-brand-green" : "text-slate-400 dark:text-slate-500"} />
              <span className={cn(
                "text-[10px] font-black uppercase tracking-tighter",
                step === s.id ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
              )}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 w-full flex">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div 
              key={s}
              className={cn(
                "h-full transition-all duration-500 ease-out",
                s <= step ? "bg-brand-green" : "bg-transparent",
                s === 1 ? "rounded-l-full" : "",
                s === 7 ? "rounded-r-full" : ""
              )}
              style={{ width: `${100 / 7}%` }}
            />
          ))}
        </div>

        <div className="p-10">
          <AnimatePresence mode="wait">
            {/* STEP 1: Identité de l'entreprise */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl">
                    <Building size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('onboarding.step_identity')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('onboarding.step_identity_desc')}</p>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex gap-3">
                  <Info className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t('onboarding.tip_identity')}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('onboarding.company_name')}</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateFormData({ name: e.target.value })}
                    className={cn(
                      "w-full px-4 py-4 rounded-2xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all text-lg",
                      validationErrors.name ? "border-rose-500 ring-4 ring-rose-500/10" : "border-slate-200 dark:border-slate-700"
                    )}
                    placeholder="Ex: AFRIQUE TECH SOLUTIONS"
                  />
                  {validationErrors.name && <p className="mt-2 text-xs font-bold text-rose-500">{validationErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('onboarding.legal_form')}</label>
                  <select 
                    value={formData.legalForm}
                    onChange={(e) => updateFormData({ legalForm: e.target.value })}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                  >
                    {LEGAL_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('onboarding.manager_name')}</label>
                  <input 
                    type="text"
                    value={formData.managerName}
                    onChange={(e) => updateFormData({ managerName: e.target.value })}
                    className={cn(
                      "w-full px-4 py-4 rounded-2xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green",
                      validationErrors.managerName ? "border-rose-500 ring-4 ring-rose-500/10" : "border-slate-200 dark:border-slate-700"
                    )}
                    placeholder="Nom complet"
                  />
                  {validationErrors.managerName && <p className="mt-2 text-xs font-bold text-rose-500">{validationErrors.managerName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">RCCM</label>
                  <input 
                    type="text"
                    value={formData.rccm}
                    onChange={(e) => updateFormData({ rccm: e.target.value })}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                    placeholder={currentCountryData.rccmPlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{currentCountryData.taxIdLabel}</label>
                  <input 
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => updateFormData({ taxId: e.target.value })}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                    placeholder={currentCountryData.taxIdPlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('onboarding.country')}</label>
                  <select 
                    value={formData.country}
                    onChange={(e) => {
                      const country = COUNTRIES.find(c => c.name === e.target.value);
                      if (country) {
                        updateFormData({ 
                          country: country.name,
                          currency: country.currency,
                          vatRate: country.vatRate,
                          city: country.city
                        });
                      }
                    }}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                  >
                    {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('onboarding.city')}</label>
                  <input 
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateFormData({ city: e.target.value })}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                    placeholder={`Ex: ${currentCountryData.city}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('onboarding.email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData({ email: e.target.value })}
                      className={cn(
                        "w-full pl-12 pr-4 py-4 rounded-2xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green",
                        validationErrors.email ? "border-rose-500 ring-4 ring-rose-500/10" : "border-slate-200 dark:border-slate-700"
                      )}
                      placeholder="contact@entreprise.com"
                    />
                  </div>
                  {validationErrors.email && <p className="mt-2 text-xs font-bold text-rose-500">{validationErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('onboarding.phone')}</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      value={formData.phone}
                      onChange={(e) => updateFormData({ phone: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                      placeholder="+225 07 00 00 00 00"
                    />
                  </div>
                </div>
              </div>

                <div className="pt-8 flex justify-end">
                  <button 
                    onClick={nextStep}
                    className="bg-brand-green hover:bg-brand-green-light text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-brand-green/20 transition-all flex items-center gap-2"
                  >
                    {t('onboarding.next')} <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Paramètres Comptables & Fiscaux */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                    <Calculator size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('onboarding.step_tax')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('onboarding.step_tax_desc')}</p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800 flex gap-3">
                  <Lightbulb className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
                  <div className="text-sm text-amber-700 dark:text-amber-300">
                    {t('onboarding.tip_tax')}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Système SYSCOHADA</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => updateFormData({ syscohadaSystem: 'normal' })}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all",
                        formData.syscohadaSystem === 'normal' 
                          ? "bg-brand-green/10 border-brand-green ring-2 ring-brand-green/20" 
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-green/20"
                      )}
                    >
                      <div className="font-bold text-slate-900 dark:text-slate-100">Normal</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Complet (Bilan, Compte de résultat, TFT, Notes)</div>
                    </button>
                    <button
                      onClick={() => updateFormData({ syscohadaSystem: 'minimalist' })}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all",
                        formData.syscohadaSystem === 'minimalist' 
                          ? "bg-brand-green/10 border-brand-green ring-2 ring-brand-green/20" 
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-green/20"
                      )}
                    >
                      <div className="font-bold text-slate-900 dark:text-slate-100">SMT</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Système Minimal de Trésorerie</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Devise de tenue de compte</label>
                  <select 
                    value={formData.currency}
                    onChange={(e) => updateFormData({ currency: e.target.value })}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                  >
                    <option value="FCFA">FCFA (XOF/XAF)</option>
                    <option value="GNF">Franc Guinéen (GNF)</option>
                    <option value="CDF">Franc Congolais (CDF)</option>
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dollar ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Début de l'exercice fiscal</label>
                  <input 
                    type="date"
                    value={formData.fiscalYearStart}
                    onChange={(e) => updateFormData({ fiscalYearStart: e.target.value })}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Durée de l'exercice (mois)</label>
                  <input 
                    type="number"
                    value={isNaN(formData.fiscalYearDuration) ? '' : formData.fiscalYearDuration}
                    onChange={(e) => updateFormData({ fiscalYearDuration: parseInt(e.target.value) })}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Régime Fiscal</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {getTaxRegimes(formData.currency).map(r => (
                      <button
                        key={r.id}
                        onClick={() => updateFormData({ taxRegime: r.id })}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all",
                          formData.taxRegime === r.id 
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 ring-2 ring-blue-500/20" 
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-200"
                        )}
                      >
                        <div className="font-bold text-slate-900 dark:text-slate-100">{r.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">Assujettissement à la TVA</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">L'entreprise collecte et déduit la TVA</div>
                  </div>
                  <div className="flex items-center gap-4">
                    {formData.vatSubject && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Taux :</span>
                        <select 
                          value={formData.vatRate}
                          onChange={(e) => updateFormData({ vatRate: parseFloat(e.target.value) })}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        >
                          <option value={currentCountryData.vatRate}>{currentCountryData.vatRate}% (Standard {currentCountryData.name})</option>
                          {currentCountryData.vatRate !== 18 && <option value={18}>18% (Standard UEMOA)</option>}
                          <option value={10}>10% (Réduit)</option>
                          <option value={5}>5% (Super Réduit)</option>
                          <option value={0}>0% (Exonéré)</option>
                        </select>
                      </div>
                    )}
                    <button
                      onClick={() => updateFormData({ vatSubject: !formData.vatSubject })}
                      className={cn(
                        "w-14 h-8 rounded-full transition-all relative",
                        formData.vatSubject ? "bg-brand-green" : "bg-slate-300 dark:bg-slate-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm",
                        formData.vatSubject ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>

                <div className="pt-8 flex justify-between">
                  <button onClick={() => setStep(1)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold px-6 py-4">{t('onboarding.back')}</button>
                  <button 
                    onClick={nextStep}
                    className="bg-brand-green hover:bg-brand-green-light text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-brand-green/20 transition-all flex items-center gap-2"
                  >
                    {t('onboarding.next')} <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Capital & Associés */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('onboarding.step_capital')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('onboarding.step_capital_desc')}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex gap-3">
                  <Info className="text-slate-600 dark:text-slate-400 shrink-0" size={20} />
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {t('onboarding.tip_capital')}
                  </p>
                </div>

                <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-slate-900 dark:bg-slate-950 p-8 rounded-3xl text-white flex flex-col justify-between shadow-xl">
                    <div>
                      <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Capital Social Total</div>
                      <div className="text-4xl font-bold font-mono">
                        {formData.capitalAmount.toLocaleString()} <span className="text-xl text-slate-500">{formData.currency}</span>
                      </div>
                    </div>
                    <div className="mt-8">
                      <label className="text-xs text-slate-400 mb-2 block">Modifier le montant</label>
                      <input 
                        type="number"
                        value={isNaN(formData.capitalAmount) ? '' : formData.capitalAmount}
                        onChange={(e) => updateFormData({ capitalAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-brand-green"
                      />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 h-[250px]">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Répartition du Capital</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={formData.partners.length > 0 ? formData.partners : [{ name: 'Vide', amount: 1 }]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="amount"
                        >
                          {formData.partners.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]} />
                          ))}
                          {formData.partners.length === 0 && <Cell fill="#E2E8F0" />}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Liste des Associés</h3>
                    <button 
                      onClick={addPartner}
                      className="text-brand-green hover:text-brand-green-light font-bold text-sm flex items-center gap-1"
                    >
                      <Plus size={16} /> Ajouter un associé
                    </button>
                  </div>

                  {validationErrors.capital && (
                    <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800 flex items-center gap-3 text-rose-600 dark:text-rose-400">
                      <AlertCircle size={18} />
                      <p className="text-sm font-bold">{validationErrors.capital}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {formData.partners.map((p, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nom de l'associé</label>
                          <input 
                            type="text"
                            value={p.name}
                            onChange={(e) => updatePartner(i, { name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            placeholder="Nom complet"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Montant Apport</label>
                          <input 
                            type="number"
                            value={isNaN(p.amount) ? '' : p.amount}
                            onChange={(e) => updatePartner(i, { amount: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Type</label>
                          <select 
                            value={p.type}
                            onChange={(e) => updatePartner(i, { type: e.target.value as 'cash' | 'kind' })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          >
                            <option value="cash">Numéraire</option>
                            <option value="kind">Nature</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Part (%)</label>
                          <div className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-center">
                            {formData.capitalAmount > 0 ? ((p.amount / formData.capitalAmount) * 100).toFixed(1) : 0}%
                          </div>
                        </div>
                        <div className="md:col-span-1 flex justify-center">
                          <button onClick={() => removePartner(i)} className="text-rose-500 hover:text-rose-700 p-2">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {formData.partners.length === 0 && (
                      <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400">
                        Aucun associé ajouté. Cliquez sur "Ajouter un associé" pour commencer.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/20">
                  <label className="block text-sm font-bold text-rose-900 dark:text-rose-400 mb-2">Frais de Constitution (Notaire, Greffe...)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400">
                      {getCurrencyIcon(18)}
                    </div>
                    <input 
                      type="number"
                      value={isNaN(formData.constitutionCosts) ? '' : formData.constitutionCosts}
                      onChange={(e) => updateFormData({ constitutionCosts: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 font-mono"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                  <button onClick={() => setStep(2)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold px-6 py-4">{t('onboarding.back')}</button>
                  <button 
                    onClick={nextStep}
                    className="bg-brand-green hover:bg-brand-green-light text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-brand-green/20 transition-all flex items-center gap-2"
                  >
                    {t('onboarding.next')} <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Comptes Financiers */}
            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('onboarding.step_treasury')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('onboarding.step_treasury_desc')}</p>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex gap-3">
                  <Info className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t('onboarding.tip_treasury')}
                  </p>
                </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Comptes de Trésorerie</h3>
                  <button 
                    onClick={addTreasury}
                    className="text-brand-green hover:text-brand-green-light font-bold text-sm flex items-center gap-1"
                  >
                    <Plus size={16} /> Ajouter un compte
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {formData.treasury.map((t, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                      <div className="md:col-span-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nom du compte</label>
                        <input 
                          type="text"
                          value={t.name}
                          onChange={(e) => updateTreasury(i, { name: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          placeholder="Ex: BOA - Compte Courant"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Type</label>
                        <select 
                          value={t.type}
                          onChange={(e) => updateTreasury(i, { type: e.target.value as any })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        >
                          <option value="bank">Banque</option>
                          <option value="cash">Caisse</option>
                          <option value="mobile">Mobile Money</option>
                        </select>
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Solde Initial (Libération)</label>
                        <input 
                          type="number"
                          value={isNaN(t.initialBalance) ? '' : t.initialBalance}
                          onChange={(e) => updateTreasury(i, { initialBalance: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-center">
                        <button onClick={() => removeTreasury(i)} className="text-rose-500 hover:text-rose-700 p-2">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

                <div className="pt-8 flex justify-between">
                  <button onClick={() => setStep(3)} className="text-slate-500 hover:text-slate-700 font-bold px-6 py-4">{t('onboarding.back')}</button>
                  <button 
                    onClick={() => setStep(5)}
                    className="bg-brand-green hover:bg-brand-green-light text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-brand-green/20 transition-all flex items-center gap-2"
                  >
                    {t('onboarding.next')} <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5: Utilisateurs & Rôles */}
            {step === 5 && (
              <motion.div 
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('onboarding.step_team')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('onboarding.step_team_desc')}</p>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex gap-3">
                  <Info className="text-indigo-600 dark:text-indigo-400 shrink-0" size={20} />
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    {t('onboarding.tip_team')}
                  </p>
                </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Collaborateurs</h3>
                  <button 
                    onClick={addUser}
                    className="text-brand-green hover:text-brand-green-light font-bold text-sm flex items-center gap-1"
                  >
                    <Plus size={16} /> Ajouter un utilisateur
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {formData.users.map((u, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                      <div className="md:col-span-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nom complet</label>
                        <input 
                          type="text"
                          value={u.name}
                          onChange={(e) => updateUser(i, { name: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Email</label>
                        <input 
                          type="email"
                          value={u.email}
                          onChange={(e) => updateUser(i, { email: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Rôle</label>
                        <select 
                          value={u.role}
                          onChange={(e) => updateUser(i, { role: e.target.value as any })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        >
                          <option value="admin">Administrateur</option>
                          <option value="accountant">Comptable</option>
                          <option value="manager">Gestionnaire</option>
                          <option value="viewer">Consultant</option>
                        </select>
                      </div>
                      <div className="md:col-span-1 flex justify-center">
                        <button onClick={() => removeUser(i)} className="text-rose-500 hover:text-rose-700 p-2">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {formData.users.length === 0 && (
                    <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400">
                      Vous êtes le seul utilisateur pour le moment.
                    </div>
                  )}
                </div>
              </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                  <button onClick={() => setStep(4)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold px-6 py-4">{t('onboarding.back')}</button>
                  <button 
                    onClick={() => setStep(6)}
                    className="bg-brand-green hover:bg-brand-green-light text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-brand-green/20 transition-all flex items-center gap-2"
                  >
                    {t('onboarding.next')} <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 6: Activation des Modules */}
            {step === 6 && (
              <motion.div 
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl">
                    <Layers size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('onboarding.step_modules')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('onboarding.step_modules_desc')}</p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800 flex gap-3">
                  <Lightbulb className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t('onboarding.tip_modules')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'accounting', label: t('onboarding.module_accounting'), icon: <Calculator size={20} />, desc: t('onboarding.module_accounting_desc') },
                  { key: 'invoicing', label: t('onboarding.module_invoicing'), icon: <FileText size={20} />, desc: t('onboarding.module_invoicing_desc') },
                  { key: 'crm', label: t('onboarding.module_crm'), icon: <User size={20} />, desc: t('onboarding.module_crm_desc') },
                  { key: 'vendors', label: t('onboarding.module_vendors'), icon: <Briefcase size={20} />, desc: t('onboarding.module_vendors_desc') },
                  { key: 'payroll', label: t('onboarding.module_payroll'), icon: <User size={20} />, desc: t('onboarding.module_payroll_desc') },
                  { key: 'vat', label: t('onboarding.module_vat'), icon: <Percent size={20} />, desc: t('onboarding.module_vat_desc') },
                  { key: 'assets', label: t('onboarding.module_assets'), icon: <Building size={20} />, desc: t('onboarding.module_assets_desc') },
                  { key: 'bankRec', label: t('onboarding.module_bankrec'), icon: <Shield size={20} />, desc: t('onboarding.module_bankrec_desc') },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => updateFormData({ modules: { ...formData.modules, [m.key]: !formData.modules[m.key as keyof typeof formData.modules] } })}
                    className={cn(
                      "p-6 rounded-3xl border text-left transition-all relative group",
                      formData.modules[m.key as keyof typeof formData.modules]
                        ? "bg-brand-green/10 border-brand-green ring-2 ring-brand-green/10"
                        : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-brand-green/20"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-2xl mb-4 inline-flex",
                      formData.modules[m.key as keyof typeof formData.modules] ? "bg-brand-green/10 text-brand-green" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}>
                      {m.icon}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 mb-1">{m.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{m.desc}</div>
                    
                    <div className={cn(
                      "absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all",
                      formData.modules[m.key as keyof typeof formData.modules] ? "bg-brand-green text-white" : "bg-slate-100 dark:bg-slate-800 text-transparent"
                    )}>
                      <Check size={14} />
                    </div>
                  </button>
                ))}
              </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                  <button onClick={() => setStep(5)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold px-6 py-4">{t('onboarding.back')}</button>
                  <button 
                    onClick={nextStep}
                    className="bg-brand-green hover:bg-brand-green-light text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-brand-green/20 transition-all flex items-center gap-2"
                  >
                    {t('onboarding.next')} <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 7: Résumé & Validation */}
            {step === 7 && (
              <motion.div 
                key="step7"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="p-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl">
                    <Check size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('onboarding.step_launch')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('onboarding.step_launch_desc')}</p>
                  </div>
                </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 relative group">
                      <button onClick={() => setStep(1)} className="absolute top-4 right-4 text-[10px] font-bold text-brand-green opacity-0 group-hover:opacity-100 transition-opacity">Modifier</button>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('onboarding.summary_identity')}</div>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 shrink-0">
                          <Building className="text-brand-green" size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight">{formData.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{formData.legalForm} • {formData.city}, {formData.country}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 relative group">
                      <button onClick={() => setStep(3)} className="absolute top-4 right-4 text-[10px] font-bold text-brand-green opacity-0 group-hover:opacity-100 transition-opacity">Modifier</button>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('onboarding.summary_capital')}</div>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 shrink-0">
                          <Briefcase className="text-amber-500" size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight">{formData.capitalAmount.toLocaleString()} {formData.currency}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{formData.partners.length} {t('onboarding.summary_partners')} • {formData.constitutionCosts.toLocaleString()} {t('onboarding.summary_costs')}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 relative group">
                      <button onClick={() => setStep(2)} className="absolute top-4 right-4 text-[10px] font-bold text-brand-green opacity-0 group-hover:opacity-100 transition-opacity">Modifier</button>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('onboarding.summary_tax')}</div>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 shrink-0">
                          <Calculator className="text-blue-500" size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{formData.taxRegime}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{formData.vatSubject ? `TVA ${formData.vatRate}%` : t('onboarding.summary_vat_exempt')}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 relative group">
                      <button onClick={() => setStep(2)} className="absolute top-4 right-4 text-[10px] font-bold text-brand-green opacity-0 group-hover:opacity-100 transition-opacity">Modifier</button>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('onboarding.summary_accounting')}</div>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 shrink-0">
                          <Settings className="text-slate-500" size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">SYSCOHADA {formData.syscohadaSystem === 'normal' ? 'Normal' : 'SMT'}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{t('onboarding.summary_fiscal_start')} : {formData.fiscalYearStart}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('onboarding.summary_treasury')}</div>
                    <div className="flex flex-wrap gap-3">
                      {formData.treasury.map((t, i) => (
                        <div key={i} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-3 shadow-sm">
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            t.type === 'bank' ? "bg-blue-500" : t.type === 'cash' ? "bg-brand-green" : "bg-orange-500"
                          )} />
                          {t.name}
                          <span className="text-slate-400 dark:text-slate-500 font-mono">{t.initialBalance.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30 flex gap-4">
                    <Info className="text-blue-600 dark:text-blue-400 shrink-0" size={24} />
                    <div>
                      <div className="font-bold text-blue-900 dark:text-blue-100 mb-1">{t('onboarding.summary_auto_config')}</div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                        {t('onboarding.tip_launch')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4">{t('onboarding.summary_modules')}</h4>
                    <div className="space-y-2">
                      {Object.entries(formData.modules).filter(([_, active]) => active).map(([key]) => (
                        <div key={key} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Check size={14} className="text-brand-green" />
                          {key === 'accounting' ? t('onboarding.module_accounting') : 
                           key === 'invoicing' ? t('onboarding.module_invoicing') : 
                           key === 'crm' ? t('onboarding.module_crm') : 
                           key === 'vendors' ? t('onboarding.module_vendors') : 
                           key === 'payroll' ? t('onboarding.module_payroll') : 
                           key === 'vat' ? t('onboarding.module_vat') : 
                           key === 'assets' ? t('onboarding.module_assets') : t('onboarding.module_bankrec')}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-brand-green p-6 rounded-3xl text-white shadow-xl shadow-brand-green/20">
                    <div className="text-xs font-bold text-white/50 uppercase mb-4">{t('onboarding.summary_ready')}</div>
                    <button 
                      onClick={handleSubmit}
                      disabled={loading}
                      className="w-full bg-white text-brand-green py-4 rounded-2xl font-bold hover:bg-brand-green/90 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <Globe size={20} />}
                      {t('onboarding.finish')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-start">
                <button onClick={() => setStep(6)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold px-6 py-4">{t('onboarding.back')}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
      
      {/* Sidebar */}
      <div className="hidden lg:block space-y-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 sticky top-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl">
              <Lightbulb size={20} />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t('onboarding.sidebar_title')}</h3>
          </div>
          
          <div className="space-y-6">
            {[
              { id: 1, text: t('onboarding.sidebar_tip_1') },
              { id: 2, text: t('onboarding.sidebar_tip_2') },
              { id: 3, text: t('onboarding.sidebar_tip_3') }
            ].map(tip => (
              <div key={tip.id} className="flex gap-4">
                <div className="w-6 h-6 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 border border-slate-100 dark:border-slate-700">
                  {tip.id}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {tip.text}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Besoin d'aide ?</div>
            <button className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center gap-2">
              <Phone size={14} />
              Contacter le support
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
