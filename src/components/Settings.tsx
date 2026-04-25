import React from 'react';
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
import { Settings as SettingsIcon, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useModules } from '@/context/ModuleContext';
import { Link } from 'react-router-dom';

export function Settings() {
  const { t } = useLanguage();
  const { isActive } = useModules();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="text-slate-800 dark:text-slate-200" />
          {t('nav.settings') || 'Paramètres'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          {t('settings.description') || 'Configuration générale de votre comptabilité.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <LanguageSettings />
          <SubscriptionManager />
          <ModuleManager />
          <CompanySettingsManager />
          <CurrencyManager />
          <InvoiceReminderSettings />
          {isActive('payroll') && <PayrollSettingsManager />}
          <VATSettingsManager />
          <FiscalYearManager />
        </div>
        <div className="space-y-8">
          <SystemHealthCheck />
        </div>
      </div>
      
      {/* Audit Trail Section */}
      {isActive('audit') && (
        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Aperçu du Journal d'Audit</h2>
              <p className="text-sm text-slate-500">Dernières activités enregistrées.</p>
            </div>
            <Link to="/audit" className="text-brand-green hover:underline text-sm font-bold flex items-center gap-1">
              Voir tout le journal <ChevronRight size={16} />
            </Link>
          </div>
          <AuditTrail />
        </div>
      )}
    </div>
  );
}
