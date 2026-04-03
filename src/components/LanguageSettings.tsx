import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LanguageSettings() {
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ] as const;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
          <Globe size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('settings.language_title') || 'Langue'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('settings.language_description') || 'Choisissez votre langue préférée.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
              language === lang.code
                ? "bg-brand-green/5 border-brand-green ring-1 ring-brand-green shadow-sm"
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{lang.flag}</span>
              <span className={cn(
                "font-semibold text-sm",
                language === lang.code ? "text-brand-green" : "text-slate-700 dark:text-slate-300"
              )}>
                {lang.name}
              </span>
            </div>
            {language === lang.code && (
              <div className="w-5 h-5 rounded-full bg-brand-green flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
