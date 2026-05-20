import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { Calendar, Check, Plus, Lock, Unlock, Archive, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDialog } from './DialogProvider';
import { useFiscalYear } from '@/context/FiscalYearContext';

interface FiscalYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed' | 'archived';
  is_active: number; // 0 or 1
}

export function FiscalYearManager() {
  const { alert: dialogAlert } = useDialog();
  const { confirm, alert } = useDialog();
  const { refreshActiveYear } = useFiscalYear();
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // New Year Form
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  useEffect(() => {
    fetchYears();
  }, []);

  const fetchYears = async () => {
    try {
      const res = await apiFetch('/api/fiscal-years');
      const data = await res.json();
      setYears(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      const res = await apiFetch(`/api/fiscal-years/${id}/activate`, { method: 'PUT' });
      if (res.ok) {
        await refreshActiveYear();
        fetchYears();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await apiFetch('/api/fiscal-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          start_date: newStartDate,
          end_date: newEndDate
        })
      });
      
      if (res.ok) {
        setIsCreating(false);
        setNewName('');
        setNewStartDate('');
        setNewEndDate('');
        fetchYears();
      } else {
        const error = await res.json();
        dialogAlert(error.error || "Une erreur est survenue lors de la création.");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur réseau.");
    }
  };

  const handleCloseYear = async (id: number) => {
    const confirmed = await confirm("Êtes-vous sûr de vouloir clôturer cet exercice ? Cette action est irréversible.");
    if (!confirmed) return;
    
    try {
      await apiFetch(`/api/fiscal-years/${id}/close`, { method: 'PUT' });
      fetchYears();
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchiveYear = async (year: FiscalYear) => {
    if (year.is_active) {
      dialogAlert("Impossible d'archiver un exercice actif. Veuillez d'abord activer un autre exercice.", "error");
      return;
    }
    const confirmed = await confirm(`Voulez-vous vraiment archiver l'exercice ${year.name} ? Cette action le masquera des vues par défaut.`);
    if (!confirmed) return;
    
    try {
      const res = await apiFetch(`/api/fiscal-years/${year.id}/archive`, { method: 'PUT' });
      if (res.ok) {
        fetchYears();
      } else {
        const errData = await res.json();
        dialogAlert(errData.error || "Une erreur est survenue", "error");
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleReopenYear = async (id: number) => {
    const confirmed = await confirm("Voulez-vous rouvrir cet exercice ?");
    if (!confirmed) return;
    
    try {
      await apiFetch(`/api/fiscal-years/${id}/reopen`, { method: 'PUT' });
      fetchYears();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="text-brand-green" />
            Exercices Comptables
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gérez vos périodes fiscales et clôtures.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20"
        >
          <Plus size={18} /> Nouvel Exercice
        </button>
      </div>

      {isCreating && (
        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6 transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Créer un nouvel exercice</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Nom</label>
              <input 
                type="text" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Exercice 2027"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Date Début</label>
              <input 
                type="date" 
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Date Fin</label>
              <input 
                type="date" 
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
            >
              Annuler
            </button>
            <button 
              onClick={handleCreate}
              disabled={!newName || !newStartDate || !newEndDate}
              className="bg-brand-green hover:bg-brand-green-dark disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium transition-colors"
            >
              Créer
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Exercice</th>
                <th className="px-6 py-4">Période</th>
                <th className="px-6 py-4 text-center">Statut</th>
                <th className="px-6 py-4 text-center">Actif</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-green" /></td></tr>
              ) : years.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">Aucun exercice trouvé.</td></tr>
              ) : (
                years.map((year) => (
                  <tr key={year.id} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors", year.is_active ? "bg-brand-green/5 dark:bg-brand-green/10" : "")}>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{year.name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm">
                      {new Date(year.start_date).toLocaleDateString()} - {new Date(year.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize",
                        year.status === 'open' 
                          ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40" 
                          : year.status === 'archived'
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                          : "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40"
                      )}>
                        {year.status === 'open' ? <Unlock size={12} className="mr-1" /> : year.status === 'archived' ? <Archive size={12} className="mr-1" /> : <Lock size={12} className="mr-1" />}
                        {year.status === 'open' ? 'Ouvert' : year.status === 'archived' ? 'Archivé' : 'Clôturé'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {year.is_active ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-brand-green/10 dark:bg-brand-green/20 text-brand-green rounded-full shadow-sm">
                          <Check size={16} />
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleActivate(year.id)}
                          disabled={year.status === 'archived'}
                          className="text-slate-400 dark:text-slate-500 hover:text-brand-green dark:hover:text-brand-green font-medium text-sm underline disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                        >
                          Activer
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {year.status === 'open' && (
                          <button 
                            onClick={() => handleCloseYear(year.id)}
                            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Lock size={14} /> Clôturer
                          </button>
                        )}
                        {(year.status === 'closed' || year.status === 'archived') && (
                          <button 
                            onClick={() => handleReopenYear(year.id)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Unlock size={14} /> Rouvrir
                          </button>
                        )}
                        {year.status !== 'archived' && !year.is_active && (
                          <button 
                            onClick={() => handleArchiveYear(year)}
                            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Archive size={14} /> Archiver
                          </button>
                        )}
                      </div>
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
}
