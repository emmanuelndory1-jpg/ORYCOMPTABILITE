import React, { useState } from 'react';
import { ShieldCheck, Key, Smartphone, History, Save, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function SecuritySettings() {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleSavePassword = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setPasswords({ current: '', new: '', confirm: '' });
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sécurité du Compte</h2>
          <p className="text-sm border-l-2 border-brand-green/30 pl-2 text-slate-500 font-medium">Gérez vos accès et sécurisez votre espace de travail.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Password Management */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-6 space-y-6">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="text-brand-green" size={18} />
            Modifier le Mot de Passe
          </h3>
          
          <div className="space-y-4 text-sm font-medium">
            <div>
              <label className="block text-slate-500 mb-1.5 ml-1">Mot de passe actuel</label>
              <input 
                type="password" 
                value={passwords.current}
                onChange={e => setPasswords({...passwords, current: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green/50 transition-all text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1.5 ml-1">Nouveau mot de passe</label>
              <input 
                type="password" 
                value={passwords.new}
                onChange={e => setPasswords({...passwords, new: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green/50 transition-all text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1.5 ml-1">Confirmer le nouveau mot de passe</label>
              <input 
                type="password" 
                value={passwords.confirm}
                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green/50 transition-all text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <button
            onClick={handleSavePassword}
            disabled={!passwords.current || !passwords.new || passwords.new !== passwords.confirm || isSaving}
            className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
            ) : saved ? (
              <><Check size={18} /> Mot de passe mis à jour</>
            ) : (
              <><Save size={18} /> Mettre à jour</>
            )}
          </button>
        </div>

        <div className="space-y-6">
          {/* Two-Factor Authentication */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="text-brand-green" size={18} />
                  Authentification à Deux Facteurs (2FA)
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={tfaEnabled} 
                    onChange={e => setTfaEnabled(e.target.checked)} 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-green/20 dark:peer-focus:ring-brand-green/10 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-green shadow-inner"></div>
                </label>
              </div>
              <p className="text-sm text-slate-500 font-medium mt-2">
                Ajoutez une couche de sécurité supplémentaire. Une application comme Google Authenticator sera nécessaire pour vous connecter.
              </p>
            </div>
            {tfaEnabled && (
              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-start gap-3">
                <ShieldCheck className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-amber-800 dark:text-amber-400 font-bold">Veuillez configurer votre application d'authentification en scannant le QR code qui vous a été fourni par l'administrateur système.</p>
              </div>
            )}
          </div>

          {/* Active Sessions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
             <div className="p-5 border-b border-slate-100 dark:border-slate-800/60">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="text-slate-400" size={18} />
                Sessions Actives
              </h3>
             </div>
             <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Cette session (Mac OS, Chrome)</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Abidjan, CI • IP: 197.xxx.xxx.xxx</p>
                  </div>
                  <span className="px-2 py-1 bg-brand-green/10 text-brand-green text-[10px] font-black uppercase tracking-wider rounded-md">Actuelle</span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Windows 11, Edge</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Il y a 2 jours • Abidjan, CI</p>
                  </div>
                  <button className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-widest px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg">Déconnecter</button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
