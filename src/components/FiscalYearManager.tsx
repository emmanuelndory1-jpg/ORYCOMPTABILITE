import React, { useState, useEffect } from 'react';
import { Calendar, Check, Plus, Lock, Unlock, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDialog } from './DialogProvider';
import { useFiscalYear } from '@/context/FiscalYearContext';

interface FiscalYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  is_active: number; // 0 or 1
}

export function FiscalYearManager() {
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
      const res = await fetch('/api/fiscal-years');
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
      const res = await fetch(`/api/fiscal-years/${id}/activate`, { method: 'PUT' });
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
      const res = await fetch('/api/fiscal-years', {
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
        alert(error.error || "Une erreur est survenue lors de la création.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur réseau.");
    }
  };

  const handleCloseYear = async (id: number) => {
    const confirmed = await confirm("Êtes-vous sûr de vouloir clôturer cet exercice ? Cette action est irréversible.");
    if (!confirmed) return;
    
    try {
      await fetch(`/api/fiscal-years/${id}/close`, { method: 'PUT' });
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
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                      )}>
                        {year.status === 'open' ? <Unlock size={12} className="mr-1" /> : <Lock size={12} className="mr-1" />}
                        {year.status === 'open' ? 'Ouvert' : 'Clôturé'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {year.is_active ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-brand-green/10 dark:bg-brand-green/20 text-brand-green rounded-full">
                          <Check size={16} />
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleActivate(year.id)}
                          className="text-slate-400 dark:text-slate-500 hover:text-brand-green dark:hover:text-brand-green font-medium text-sm underline"
                        >
                          Activer
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {year.status === 'open' && (
                        <button 
                          onClick={() => handleCloseYear(year.id)}
                          className="text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 px-3 py-1 rounded-lg transition-colors"
                        >
                          Clôturer
                        </button>
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
}
