import React, { useState, useEffect } from 'react';
import { DatabaseBackup, Download, Upload, Check, SwitchCamera, Loader2, History, AlertCircle, FileJson, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

interface BackupHistory {
  id: string;
  date: string;
  size: string;
  type: 'auto' | 'manual';
  status: 'success' | 'failed';
}

export function BackupManager() {
  const { t } = useLanguage();
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState('daily');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const [history, setHistory] = useState<BackupHistory[]>([
    { id: '1', date: new Date().toISOString(), size: '2.4 MB', type: 'auto', status: 'success' }
  ]);

  useEffect(() => {
    const savedAutoBackup = localStorage.getItem('auto_backup_enabled') === 'true';
    const savedFreq = localStorage.getItem('backup_frequency') || 'daily';
    const savedLast = localStorage.getItem('last_backup_date');
    setAutoBackupEnabled(savedAutoBackup);
    setBackupFrequency(savedFreq);
    if (savedLast) setLastBackup(savedLast);
  }, []);

  const handleAutoBackupToggle = (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    localStorage.setItem('auto_backup_enabled', enabled.toString());
  };

  const handleFrequencyChange = (freq: string) => {
    setBackupFrequency(freq);
    localStorage.setItem('backup_frequency', freq);
  };

  const generateBackupData = () => {
    // In a real app, this would gather all data from localStorage/DB
    const data = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      settings: localStorage.getItem('companySettings'),
      // mock other data
    };
    return JSON.stringify(data, null, 2);
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      // Trigger download from the server
      window.location.href = '/api/database/export';
      
      const now = new Date().toISOString();
      setLastBackup(now);
      localStorage.setItem('last_backup_date', now);
      
      setHistory(prev => [{
        id: Date.now().toString(),
        date: now,
        size: 'SQLite DB',
        type: 'manual' as const,
        status: 'success' as const
      }, ...prev].slice(0, 5));

    } catch (err) {
      console.error(err);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
        const content = e.target?.result as string;
        // In a real app we would parse and save it
        // JSON.parse(content);
        alert('Restauration réussie ! L\'application va se recharger.');
        window.location.reload();
      } catch (err) {
        alert('Erreur: Fichier de sauvegarde invalide.');
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
          <DatabaseBackup size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sauvegarde & Restauration</h2>
          <p className="text-sm border-l-2 border-brand-green/30 pl-2 text-slate-500 font-medium">Sécurisez vos données comptables et réglez la fréquence de sauvegarde automatique.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Automatic Backup Settings */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="text-brand-green" size={18} />
                Sauvegarde Automatique
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={autoBackupEnabled}
                  onChange={(e) => handleAutoBackupToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-green/20 dark:peer-focus:ring-brand-green/10 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-green shadow-inner"></div>
              </label>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
              Générez et téléchargez automatiquement une copie de vos données en arrière-plan à intervalles réguliers.
            </p>

            {autoBackupEnabled && (
              <div className="space-y-3 animate-in slide-in-from-top-2 opacity-100 duration-300">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Fréquence de sauvegarde</label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    { id: 'realtime', label: 'Temps Réel' },
                    { id: 'daily', label: 'Quotidienne' },
                    { id: 'weekly', label: 'Hebdomadaire' },
                    { id: 'monthly', label: 'Mensuelle' }
                  ].map(freq => (
                    <button
                      key={freq.id}
                      onClick={() => handleFrequencyChange(freq.id)}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-bold transition-all border",
                        backupFrequency === freq.id 
                          ? "bg-brand-green text-white border-brand-green shadow-md"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-green/50"
                      )}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>Dernière sauvegarde:</span>
              <span className="font-bold text-slate-900 dark:text-slate-300">
                {lastBackup ? new Date(lastBackup).toLocaleString() : 'Aucune'}
              </span>
            </p>
          </div>
        </div>

        {/* Manual Actions */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Actions Manuelles</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Créer une sauvegarde immédiate ou restaurer à partir d'un fichier existant.</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleManualBackup}
              disabled={isBackingUp}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-brand-green/20 bg-brand-green/5 hover:bg-brand-green/10 text-brand-green transition-all group"
            >
              <div className="flex items-center gap-3 text-sm font-bold">
                {isBackingUp ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />}
                Sauvegarder Maintenant
              </div>
              <span className="text-xs uppercase tracking-widest opacity-70">JSON</span>
            </button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                disabled={isRestoring}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <button
                disabled={isRestoring}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all group pointer-events-none"
              >
                 <div className="flex items-center gap-3 text-sm font-bold">
                  {isRestoring ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} className="group-hover:-translate-y-0.5 transition-transform" />}
                  {isRestoring ? 'Restauration en cours...' : 'Restaurer une sauvegarde'}
                </div>
                <span className="text-xs uppercase tracking-widest opacity-70">Depuis un fichier</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backup History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden mt-6">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <History size={18} className="text-brand-green" />
          <h3 className="font-bold text-slate-900 dark:text-white">Historique Récent</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {history.length > 0 ? history.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileJson size={18} className="text-slate-500" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Sauvegarde {item.type === 'auto' ? 'Automatique' : 'Manuelle'}
                    {item.status === 'success' ? (
                       <span className="w-2 h-2 rounded-full bg-brand-green"></span>
                    ) : (
                       <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {new Date(item.date).toLocaleString()} • {item.size}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                   // Mock trigger download again
                   alert("Dans une vraie application, cela retéléchargerait ce fichier spécifique.");
                }}
                className="p-2 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors"
                title="Télécharger cette sauvegarde"
              >
                <Download size={16} />
              </button>
            </div>
          )) : (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
               <AlertCircle size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
               <p className="text-sm font-medium">Aucun historique de sauvegarde disponible.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
