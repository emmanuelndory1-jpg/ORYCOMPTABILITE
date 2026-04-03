import React, { useState, useEffect } from 'react';
import { Percent, Plus, Save, Trash2, Edit2, X } from 'lucide-react';
import { useDialog } from './DialogProvider';
import { cn } from '@/lib/utils';

interface VATSetting {
  id: number;
  rate: number;
  label: string;
  account_collected: string;
  account_deductible: string;
  is_active: boolean;
}

export function VATSettingsManager() {
  const { confirm } = useDialog();
  const [settings, setSettings] = useState<VATSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<VATSetting>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/vat-settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const isNew = editingId === -1;
      const url = isNew ? '/api/vat-settings' : `/api/vat-settings/${editingId}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchSettings();
        setEditingId(null);
        setFormData({});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm('Êtes-vous sûr de vouloir supprimer ce taux de TVA ?');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/vat-settings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSettings();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (setting: VATSetting) => {
    setEditingId(setting.id);
    setFormData(setting);
  };

  const startNew = () => {
    setEditingId(-1);
    setFormData({
      rate: 0,
      label: '',
      account_collected: '4431',
      account_deductible: '4452',
      is_active: true
    });
  };

  if (loading) return <div className="animate-pulse h-32 bg-slate-100 rounded-xl"></div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
            <Percent className="text-brand-green" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Taux de TVA</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configuration des taux et comptes associés</p>
          </div>
        </div>
        <button
          onClick={startNew}
          disabled={editingId !== null}
          className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Plus size={16} />
          Nouveau Taux
        </button>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {settings.map((setting) => (
            <div key={setting.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition-all hover:border-brand-green/30">
              {editingId === setting.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Libellé</label>
                    <input
                      type="text"
                      value={formData.label || ''}
                      onChange={e => setFormData({ ...formData, label: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                      placeholder="Ex: Taux Normal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Taux (%)</label>
                    <input
                      type="number"
                      value={formData.rate || 0}
                      onChange={e => setFormData({ ...formData, rate: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Compte TVA Collectée</label>
                    <input
                      type="text"
                      value={formData.account_collected || ''}
                      onChange={e => setFormData({ ...formData, account_collected: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Compte TVA Déductible</label>
                    <input
                      type="text"
                      value={formData.account_deductible || ''}
                      onChange={e => setFormData({ ...formData, account_deductible: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2 flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active ?? true}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-slate-300 dark:border-slate-700 text-brand-green focus:ring-brand-green dark:bg-slate-950"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Actif</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSave}
                        className="px-3 py-1.5 text-sm font-medium bg-brand-green text-white hover:bg-brand-green-dark rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Save size={14} /> Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-700">
                      <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{setting.rate}%</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        {setting.label}
                        {!setting.is_active && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Inactif</span>
                        )}
                      </h3>
                      <div className="flex gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>Collectée: <strong className="text-slate-700 dark:text-slate-300">{setting.account_collected}</strong></span>
                        <span>Déductible: <strong className="text-slate-700 dark:text-slate-300">{setting.account_deductible}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(setting)}
                      className="p-2 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(setting.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {editingId === -1 && (
            <div className="border border-brand-green/30 bg-brand-green/5 dark:bg-brand-green/5 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Libellé</label>
                  <input
                    type="text"
                    value={formData.label || ''}
                    onChange={e => setFormData({ ...formData, label: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    placeholder="Ex: Taux Normal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Taux (%)</label>
                  <input
                    type="number"
                    value={formData.rate || 0}
                    onChange={e => setFormData({ ...formData, rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Compte TVA Collectée</label>
                  <input
                    type="text"
                    value={formData.account_collected || ''}
                    onChange={e => setFormData({ ...formData, account_collected: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Compte TVA Déductible</label>
                  <input
                    type="text"
                    value={formData.account_deductible || ''}
                    onChange={e => setFormData({ ...formData, account_deductible: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  />
                </div>
                <div className="col-span-1 md:col-span-2 flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active ?? true}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-700 text-brand-green focus:ring-brand-green dark:bg-slate-950"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Actif</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1.5 text-sm font-medium bg-brand-green text-white hover:bg-brand-green-dark rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Save size={14} /> Créer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
