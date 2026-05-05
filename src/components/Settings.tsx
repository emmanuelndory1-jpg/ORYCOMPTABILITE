import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  ChevronRight, 
  Building2, 
  Calculator, 
  Package, 
  Palette, 
  Bell, 
  ShieldCheck, 
  Cpu,
  ArrowLeft,
  Sun,
  Moon,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FiscalYearManager } from './FiscalYearManager';
import { SystemHealthCheck } from './SystemHealthCheck';
import { AuditTrail } from './AuditTrail';
import { CompanySettingsManager } from './CompanySettingsManager';
import { CurrencyManager } from './CurrencyManager';
import { InvoiceReminderSettings } from './InvoiceReminderSettings';
import { PayrollSettingsManager } from './PayrollSettingsManager';
import { SubscriptionManager } from './SubscriptionManager';
import { VATSettingsManager } from './VATSettingsManager';
import { LanguageSettings } from './LanguageSettings';
import { ModuleManager } from './ModuleManager';
import { JournalSettingsManager } from './JournalSettingsManager';
import { useLanguage } from '@/context/LanguageContext';
import { useModules } from '@/context/ModuleContext';
import { useTheme } from '@/context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Settings() {
  const { t } = useLanguage();
  const { isActive } = useModules();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company');

  const tabs = [
    { id: 'company', label: t('settings.tabs.company') || 'Entreprise', icon: <Building2 size={18} /> },
    { id: 'accounting', label: t('settings.tabs.accounting') || 'Comptabilité', icon: <Calculator size={18} /> },
    { id: 'modules', label: t('settings.tabs.modules') || 'Modules', icon: <Package size={18} /> },
    { id: 'appearance', label: t('settings.tabs.appearance') || 'Apparence', icon: <Palette size={18} /> },
    { id: 'notifications', label: t('settings.tabs.notifications') || 'Notifications', icon: <Bell size={18} /> },
    { id: 'security', label: t('settings.tabs.security') || 'Sécurité', icon: <ShieldCheck size={18} /> },
    { id: 'system', label: t('settings.tabs.system') || 'Système', icon: <Cpu size={18} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'company':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CompanySettingsManager />
            <CurrencyManager />
            <SubscriptionManager />
          </div>
        );
      case 'accounting':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <FiscalYearManager />
            <JournalSettingsManager />
            <VATSettingsManager />
            <InvoiceReminderSettings />
            {isActive('payroll') && <PayrollSettingsManager />}
          </div>
        );
      case 'modules':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ModuleManager />
          </div>
        );
      case 'appearance':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <LanguageSettings />
            
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3 mb-8">
                <div className="w-1.5 h-4 bg-brand-green rounded-full" />
                Thème de l'interface
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: 'light', label: 'Clair', icon: Sun, desc: 'Interface lumineuse et épurée' },
                  { id: 'dark', label: 'Sombre', icon: Moon, desc: 'Réduit la fatigue visuelle' },
                  { id: 'system', label: 'Système', icon: Cpu, desc: 'Suit les paramètres de votre appareil' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTheme(item.id as any)}
                    className={cn(
                      "flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all group overflow-hidden relative",
                      theme === item.id 
                        ? "border-brand-green bg-brand-green/5 ring-4 ring-brand-green/5" 
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                      theme === item.id ? "bg-brand-green text-white shadow-lg" : "bg-white dark:bg-slate-900 text-slate-400 group-hover:scale-110"
                    )}>
                      <item.icon size={24} />
                    </div>
                    <div className="text-center">
                      <div className={cn("text-xs font-black uppercase tracking-widest mb-1", theme === item.id ? "text-brand-green" : "text-slate-900 dark:text-white")}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {item.desc}
                      </div>
                    </div>
                    {theme === item.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="text-brand-green" size={14} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <Palette className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium text-sm">D'autres options de personnalisation colorimétrique arrivent bientôt.</p>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <Bell className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Alertes & Notifications</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">Configurez vos préférences de réception pour les échéances fiscales et les relances clients.</p>
          </div>
        );
      case 'security':
        return (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <ShieldCheck className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sécurité du Compte</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">Gérez vos identifiants, activez la double authentification et consultez l'historique des connexions.</p>
          </div>
        );
      case 'system':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SystemHealthCheck />
            {isActive('audit') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-xs flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-brand-green rounded-full" />
                    Journal d'Audit
                  </h3>
                  <Link to="/audit" className="text-[10px] font-black text-brand-green uppercase tracking-widest hover:underline flex items-center gap-1">
                    Voir tout <ChevronRight size={14} />
                  </Link>
                </div>
                <AuditTrail />
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-1">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-brand-green transition-colors text-sm font-bold mb-4 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            {t('common.back')}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
              <SettingsIcon size={28} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">Configuration</h1>
          </div>
          <p className="text-slate-500 font-medium text-sm sm:text-base ml-2 border-l-2 border-brand-green/20 pl-4 italic">
            Personnalisez l'intégralité de votre environnement OryCompta
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest",
                  activeTab === tab.id 
                    ? "bg-brand-green text-white shadow-xl shadow-brand-green/20 scale-[1.02]" 
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1"
                )}
              >
                <span className={cn(
                  "transition-transform",
                  activeTab === tab.id ? "scale-110" : ""
                )}>
                  {tab.icon}
                </span>
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTabIndicator" 
                    className="ml-auto"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  </motion.div>
                )}
              </button>
            ))}
            
            <div className="mt-8 p-6 rounded-2xl bg-slate-900 text-white overflow-hidden relative group">
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-green mb-2">Statut du Plan</p>
                <p className="text-lg font-black mb-4 italic">PREMIUM ENTERPRISE</p>
                <div className="w-full bg-white/10 h-1.5 rounded-full mb-2">
                  <div className="w-3/4 h-full bg-brand-green rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                </div>
                <p className="text-[10px] font-bold text-slate-400">Prochain renouvellement : 12/05/2026</p>
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-brand-green/10 rounded-full blur-2xl group-hover:bg-brand-green/20 transition-all" />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

