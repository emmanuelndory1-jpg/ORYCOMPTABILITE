import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  Trash2,
  Play,
  Pause,
  Calendar,
  User,
  DollarSign,
  FileText
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';
import { useLanguage } from '@/context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { InvoiceEditor } from './InvoiceEditor';

interface RecurringInvoice {
  id: number;
  type: 'invoice' | 'quote';
  third_party_id: number;
  third_party_name: string;
  frequency: string;
  next_date: string;
  end_date: string | null;
  total_amount: number;
  currency: string;
  active: boolean;
  created_at: string;
}

export function RecurringInvoiceManager() {
  const { confirm, alert } = useDialog();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [recurring, setRecurring] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetchRecurring();
  }, []);

  const fetchRecurring = async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/recurring-invoices').then(res => res.json());
      setRecurring(data);
    } catch (err) {
      console.error("Failed to fetch recurring invoices", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (ri: RecurringInvoice) => {
    try {
      await fetch(`/api/recurring-invoices/${ri.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...ri, active: !ri.active })
      });
      fetchRecurring();
    } catch (err) {
      alert("Erreur lors de la modification du statut.");
    }
  };

  const deleteRecurring = async (id: number) => {
    if (await confirm("Êtes-vous sûr de vouloir supprimer ce modèle récurrent ?")) {
      try {
        await fetch(`/api/recurring-invoices/${id}`, { method: 'DELETE' });
        fetchRecurring();
      } catch (err) {
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const filtered = recurring.filter(ri => 
    ri.third_party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ri.frequency.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par client ou fréquence..."
            className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => {
            setSelectedId(null);
            setShowEditor(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau modèle récurrent
        </button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-bottom">
                <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Client</th>
                <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Fréquence</th>
                <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Prochaine date</th>
                <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Montant</th>
                <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Statut</th>
                <th className="px-6 py-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    Aucun modèle récurrent trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((ri) => (
                  <tr key={ri.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{ri.third_party_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        ri.type === 'invoice' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {ri.type === 'invoice' ? 'Facture' : 'Devis'}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize">{ri.frequency}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(ri.next_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(ri.total_amount, ri.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                        ri.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      )}>
                        {ri.active ? (
                          <><CheckCircle2 className="h-3 w-3" /> Actif</>
                        ) : (
                          <><Pause className="h-3 w-3" /> Suspendu</>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleActive(ri)}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            ri.active ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"
                          )}
                          title={ri.active ? "Suspendre" : "Activer"}
                        >
                          {ri.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedId(ri.id);
                            setShowEditor(true);
                          }}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteRecurring(ri.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card border rounded-xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {selectedId ? "Modifier le modèle récurrent" : "Nouveau modèle récurrent"}
                </h2>
                <button
                  onClick={() => setShowEditor(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </button>
              </div>

              <RecurringInvoiceEditor 
                id={selectedId} 
                onClose={() => {
                  setShowEditor(false);
                  fetchRecurring();
                }} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecurringInvoiceEditor({ id, onClose }: { id: number | null, onClose: () => void }) {
  const { alert } = useDialog();
  const [loading, setLoading] = useState(id !== null);
  const [saving, setSaving] = useState(false);
  const [thirdParties, setThirdParties] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({
    type: 'invoice',
    third_party_id: '',
    frequency: 'monthly',
    next_date: new Date().toISOString().split('T')[0],
    end_date: '',
    currency: 'FCFA',
    notes: '',
    terms: '',
    items: [{ description: '', quantity: 1, unit_price: 0, vat_rate: 18, total: 0 }]
  });

  useEffect(() => {
    fetch('/api/third-parties').then(res => res.json()).then(setThirdParties);
    if (id) {
      fetch(`/api/recurring-invoices/${id}`)
        .then(res => res.json())
        .then(data => {
          setFormData(data);
          setLoading(false);
        });
    }
  }, [id]);

  const calculateTotals = (items: any[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const vat_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * (item.vat_rate / 100)), 0);
    return { subtotal, vat_amount, total_amount: subtotal + vat_amount };
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unit_price: 0, vat_rate: 18, total: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_: any, i: number) => i !== index)
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const totals = calculateTotals(formData.items);
    const payload = { ...formData, ...totals };

    try {
      const url = id ? `/api/recurring-invoices/${id}` : '/api/recurring-invoices';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      onClose();
    } catch (err) {
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-12 text-center">Chargement...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Client</label>
          <select
            required
            className="w-full p-2 bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            value={formData.third_party_id}
            onChange={(e) => setFormData({ ...formData, third_party_id: e.target.value })}
          >
            <option value="">Sélectionner un client</option>
            {thirdParties.map(tp => (
              <option key={tp.id} value={tp.id}>{tp.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select
            className="w-full p-2 bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option value="invoice">Facture</option>
            <option value="quote">Devis</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Fréquence</label>
          <select
            className="w-full p-2 bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
          >
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuel</option>
            <option value="quarterly">Trimestriel</option>
            <option value="annually">Annuel</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Prochaine date</label>
          <input
            type="date"
            required
            className="w-full p-2 bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            value={formData.next_date}
            onChange={(e) => setFormData({ ...formData, next_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Date de fin (optionnel)</label>
          <input
            type="date"
            className="w-full p-2 bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            value={formData.end_date || ''}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Devise</label>
          <select
            className="w-full p-2 bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
          >
            <option value="FCFA">FCFA</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Articles</h3>
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> Ajouter un article
          </button>
        </div>
        <div className="space-y-3">
          {formData.items.map((item: any, index: number) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-start bg-muted/30 p-3 rounded-lg border">
              <div className="col-span-12 md:col-span-5 space-y-1">
                <input
                  placeholder="Description"
                  className="w-full p-2 bg-background border rounded-lg text-sm outline-none"
                  value={item.description}
                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  required
                />
              </div>
              <div className="col-span-4 md:col-span-2 space-y-1">
                <input
                  type="number"
                  placeholder="Qté"
                  className="w-full p-2 bg-background border rounded-lg text-sm outline-none"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                  required
                />
              </div>
              <div className="col-span-4 md:col-span-2 space-y-1">
                <input
                  type="number"
                  placeholder="Prix"
                  className="w-full p-2 bg-background border rounded-lg text-sm outline-none"
                  value={item.unit_price}
                  onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                  required
                />
              </div>
              <div className="col-span-3 md:col-span-2 space-y-1">
                <div className="p-2 text-sm font-medium text-right">
                  {(item.quantity * item.unit_price).toLocaleString()}
                </div>
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-top">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer le modèle"}
        </button>
      </div>
    </form>
  );
}
