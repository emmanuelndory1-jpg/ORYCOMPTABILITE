import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { 
  BookOpen, Plus, Trash2, Edit2, Check, X, Shield, 
  Info, AlertCircle, Save, Loader2, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialog } from './DialogProvider';

interface Journal {
  id: string;
  name: string;
  type: 'sales' | 'purchase' | 'bank' | 'cash' | 'general';
  description: string;
  is_active: boolean;
  is_system: boolean;
}

export function JournalSettingsManager() {
  const { confirm, alert: dialogAlert } = useDialog();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    type: 'general' as Journal['type'],
    description: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJournals();
  }, []);

  const fetchJournals = async () => {
    try {
      const res = await apiFetch('/api/journals');
      if (res.ok) {
        const data = await res.json();
        setJournals(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/journals/${editingId}` : '/api/journals';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchJournals();
        setIsEditing(false);
        setEditingId(null);
        setFormData({ id: '', name: '', type: 'general', description: '', is_active: true });
        dialogAlert("Journal enregistré avec succès", "success");
      } else {
        const data = await res.json();
        dialogAlert(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      dialogAlert("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (journal: Journal) => {
    setEditingId(journal.id);
    setFormData({
      id: journal.id,
      name: journal.name,
      type: journal.type,
      description: journal.description,
      is_active: journal.is_active
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm("Voulez-vous vraiment supprimer ce journal ?");
    if (!confirmed) return;

    try {
      const res = await apiFetch(`/api/journals/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchJournals();
        dialogAlert("Journal supprimé", "success");
      } else {
        const data = await res.json();
        dialogAlert(data.error || "Impossible de supprimer ce journal");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getJournalTypeLabel = (type: string) => {
    switch (type) {
      case 'sales': return 'Ventes';
      case 'purchase': return 'Achats';
      case 'bank': return 'Banque';
      case 'cash': return 'Caisse';
      default: return 'Général / OD';
    }
  };

  if (loading) return (
    <div className="p-12 flex justify-center">
      <Loader2 className="animate-spin text-brand-green" />
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="text-brand-green" size={20} />
            Gestion des Journaux
          </h3>
          <p className="text-sm text-slate-500">Configurez vos types de journaux comptables.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ id: '', name: '', type: 'general', description: '', is_active: true });
            setIsEditing(true);
          }}
          className="bg-brand-green/10 text-brand-green px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-green/20 transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Nouveau
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {journals.map(journal => (
          <div key={journal.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                journal.type === 'sales' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                journal.type === 'purchase' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                journal.type === 'bank' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" :
                journal.type === 'cash' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              )}>
                <Database size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{journal.name}</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter">
                    {journal.id}
                  </span>
                  {!journal.is_active && (
                    <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Inactif</span>
                  )}
                  {journal.is_system && (
                    <Shield size={12} className="text-slate-400" />
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="font-medium text-brand-green/80 uppercase tracking-widest">{getJournalTypeLabel(journal.type)}</span>
                  <span>•</span>
                  <span>{journal.description}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(journal)}
                className="p-2 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-lg transition-all"
                title="Modifier"
              >
                <Edit2 size={18} />
              </button>
              {!journal.is_system && (
                <button
                  onClick={() => handleDelete(journal.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                  title="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white italic">
                {editingId ? 'Modifier Journal' : 'Nouveau Journal'}
              </h4>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Code du Journal</label>
                <input
                  required
                  disabled={!!editingId}
                  value={formData.id}
                  onChange={e => setFormData({ ...formData, id: e.target.value.toUpperCase().slice(0, 5) })}
                  placeholder="EX: VENTES"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-3 text-slate-900 dark:text-white font-bold outline-none focus:border-brand-green transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Libellé</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Journal des Ventes"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-3 text-slate-900 dark:text-white font-bold outline-none focus:border-brand-green transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Type de Journal</label>
                <select
                  disabled={!!editingId && journals.find(j => j.id === editingId)?.is_system}
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as Journal['type'] })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-3 text-slate-900 dark:text-white font-bold outline-none focus:border-brand-green transition-all appearance-none"
                >
                  <option value="sales">Ventes</option>
                  <option value="purchase">Achats</option>
                  <option value="bank">Banque</option>
                  <option value="cash">Caisse</option>
                  <option value="general">Général / OD</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notes sur l'usage de ce journal..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-3 text-slate-900 dark:text-white font-medium outline-none focus:border-brand-green transition-all resize-none h-24"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center h-5">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-brand-green border-slate-300 rounded focus:ring-brand-green dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <label htmlFor="is_active" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Journal Actif
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-8 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand-green text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-green/20 hover:bg-brand-green-dark transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
