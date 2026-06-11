import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { apiFetch } from '@/lib/api';

export interface ThirdParty {
  id: number;
  type: 'client' | 'supplier';
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  account_code: string;
  credit_limit: number;
  payment_terms: number;
  is_occasional: boolean;
  balance?: number;
}

export interface ThirdPartyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'client' | 'supplier';
  editingParty?: ThirdParty | null;
  onSuccess: (newParty: ThirdParty) => void;
}

export function ThirdPartyFormModal({ isOpen, onClose, type, editingParty, onSuccess }: ThirdPartyFormModalProps) {
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    credit_limit: 0,
    payment_terms: 30,
    is_occasional: false
  });

  useEffect(() => {
    if (editingParty) {
      setFormData({
        name: editingParty.name || '',
        email: editingParty.email || '',
        phone: editingParty.phone || '',
        address: editingParty.address || '',
        tax_id: editingParty.tax_id || '',
        credit_limit: editingParty.credit_limit || 0,
        payment_terms: editingParty.payment_terms || 0,
        is_occasional: editingParty.is_occasional || false
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        tax_id: '',
        credit_limit: 0,
        payment_terms: 30,
        is_occasional: false
      });
    }
  }, [editingParty, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const url = editingParty 
        ? `/api/third-parties/${editingParty.id}`
        : '/api/third-parties';
        
      const res = await apiFetch(url, {
        method: editingParty ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, type })
      });

      if (res.ok) {
        const data = await res.json();
        onSuccess(data);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex justify-center z-[100] p-4 backdrop-blur-xl items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              {editingParty ? 'Modifier' : 'Nouveau'} {type === 'client' ? 'Client' : 'Fournisseur'}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fiche d'identification</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-100 dark:border-slate-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Raison Sociale / Nom</label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Téléphone</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adresse Complète</label>
            <textarea
              value={formData.address || ''}
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NCC (Contribuable) / NIF</label>
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={e => setFormData({...formData, tax_id: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Délai (jours)</label>
              <input
                type="number"
                value={formData.payment_terms || 0}
                onChange={e => setFormData({...formData, payment_terms: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plafond de crédit ({currency})</label>
            <input
              type="number"
              value={formData.credit_limit || 0}
              onChange={e => setFormData({...formData, credit_limit: parseFloat(e.target.value) || 0})}
              className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-lg font-black font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <input
              type="checkbox"
              id="is_occasional"
              checked={formData.is_occasional}
              onChange={e => setFormData({...formData, is_occasional: e.target.checked})}
              className="w-5 h-5 rounded-lg border-slate-300 text-brand-green focus:ring-brand-green"
            />
            <label htmlFor="is_occasional" className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest cursor-pointer">
              Tiers Occasionnel
            </label>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 bg-slate-900 dark:bg-brand-green text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 dark:hover:bg-brand-green-light transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
