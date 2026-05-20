import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  FilePlus, 
  ClipboardCheck, 
  PackageCheck, 
  ArrowRight, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  FileText,
  User,
  Building,
  X,
  Loader2,
  Camera,
  Download,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './DialogProvider';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { analyzeInvoice, logOcrFeedback, InvoiceAnalysis, getP2PAdvice } from '../services/geminiService';
import { apiFetch } from '../lib/api';
import { cn } from '../lib/utils';

import { PageHeader } from './ui/PageHeader';

type P2PStep = 'requisition' | 'rfq' | 'purchase_order' | 'goods_receipt' | 'invoice_matching' | 'payment';

interface Requisition {
  id: string;
  reference: string;
  description: string;
  requester: string;
  department: string;
  amount: number;
  status: 'draft' | 'pending' | 'approved_mgr' | 'approved_fin' | 'approved' | 'rejected' | 'ordered';
  date: string;
  institutionType?: string;
  institutionName?: string;
  budgetLine?: string;
  projectCode?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    accountCode?: string;
  }>;
  attachments?: string[];
  createdAt: string;
  userId: string;
}

interface RFQ {
  id: string;
  reference: string;
  requisitionId: string;
  status: 'sent' | 'received' | 'closed';
  date: string;
  supplier_ids: string[];
  attachments?: string[];
  userId: string;
}

interface P2PPayment {
  id: string;
  reference: string;
  invoice_reference: string;
  supplier_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: 'scheduled' | 'paid' | 'cancelled';
  attachments?: string[];
  priority_score?: number;
  userId: string;
}

interface Supplier {
  id: string;
  name: string;
  tax_id?: string;
  account_code?: string;
  category: string;
  reliability_score: number;
  total_volume: number;
  average_lead_time: number;
}

interface PurchaseOrder {
  id: string;
  reference: string;
  requisitionId: string;
  supplier_name: string;
  supplier_id?: string;
  amount: number;
  vat_amount?: number;
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  date: string;
  expected_delivery: string;
  items?: Requisition['items'];
  attachments?: string[];
  userId: string;
}

interface GoodsReceipt {
  id: string;
  reference: string;
  poId: string;
  po_reference: string;
  supplier_name: string;
  date: string;
  status: 'received' | 'pending_inspection';
  attachments?: string[];
  userId: string;
}

interface InvoiceMatching {
  id: string;
  reference: string;
  po_reference: string;
  receipt_reference: string;
  supplier_name: string;
  amount_invoice: number;
  amount_po?: number;
  vat_invoice?: number;
  vat_po?: number;
  discrepancies?: string[];
  anomalies?: string[];
  status: 'matched' | 'discrepancy' | 'pending' | 'accounted';
  entries?: Array<{
    account_code: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    account_suggestion?: string;
  }>;
  accounting_entry_id?: string;
  date: string;
  attachments?: string[];
  userId: string;
}

export function ProcureToPay() {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const { confirm, alert: dialogAlert } = useDialog();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState<P2PStep>('requisition');
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [matchedInvoices, setMatchedInvoices] = useState<InvoiceMatching[]>([]);
  const [payments, setPayments] = useState<P2PPayment[]>([]);
  const [vatSettings, setVatSettings] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    { id: '1', name: 'BURO-TEC', account_code: '401100', category: 'Fournitures', reliability_score: 95, total_volume: 5000000, average_lead_time: 2 },
    { id: '2', name: 'AFRI-LOG', account_code: '401200', category: 'Logistique', reliability_score: 82, total_volume: 12000000, average_lead_time: 5 },
    { id: '3', name: 'OFFIX CI', account_code: '401300', category: 'Informatique', reliability_score: 89, total_volume: 8500000, average_lead_time: 3 },
  ]);
  
  const [copilotInsights, setCopilotInsights] = useState<string[]>([]);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    const fetchInsights = async () => {
      // Don't fetch if no data yet to save on API calls
      if (purchaseOrders.length === 0 && requisitions.length === 0 && matchedInvoices.length === 0) return;
      
      setInsightLoading(true);
      try {
        const poTotal = purchaseOrders.reduce((sum, p) => sum + p.amount, 0);
        const discrepanciesCount = matchedInvoices.filter(i => i.status === 'discrepancy').length;
        const avgReliability = suppliers.length > 0 
          ? Math.round(suppliers.reduce((sum, s) => sum + (s.reliability_score || 0), 0) / suppliers.length) 
          : 0;

        const advices = await getP2PAdvice({
          requisitions,
          purchaseOrders,
          poTotal,
          discrepanciesCount,
          avgReliability
        });
        if (advices && advices.length > 0) {
          setCopilotInsights(advices);
        }
      } catch (e) {
        console.error("P2P Insight Error:", e);
      } finally {
        setInsightLoading(false);
      }
    };

    const timer = setTimeout(fetchInsights, 2000); 
    return () => clearTimeout(timer);
  }, [purchaseOrders.length, requisitions.length, matchedInvoices.length]);

  // Modal states
  const [showReqModal, setShowReqModal] = useState(false);
  const [showRFQModal, setShowRFQModal] = useState<Requisition | null>(null);
  const [showPOModal, setShowPOModal] = useState<any>(null); // Can be Req or RFQ
  const [showMatchingModal, setShowMatchingModal] = useState<GoodsReceipt | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<InvoiceMatching | null>(null);

  // Form states
  const [reqDesc, setReqDesc] = useState('');
  const [reqDept, setReqDept] = useState('');
  const [reqAmount, setReqAmount] = useState('');
  const [reqInstType, setReqInstType] = useState('Ministère');
  const [reqInstName, setReqInstName] = useState('');
  const [reqBudgetLine, setReqBudgetLine] = useState('');
  const [reqProjectCode, setReqProjectCode] = useState('');
  const [reqItems, setReqItems] = useState<Array<{ description: string; quantity: number; unitPrice: number; total: number; accountCode: string }>>([]);

  const addReqItem = () => {
    setReqItems([...reqItems, { description: '', quantity: 1, unitPrice: 0, total: 0, accountCode: '601' }]);
  };

  const updateReqItem = (index: number, field: string, value: any) => {
    const newItems = [...reqItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    setReqItems(newItems);
    
    // Update total amount
    const total = newItems.reduce((sum, item) => sum + item.total, 0);
    setReqAmount(total.toString());
  };

  const removeReqItem = (index: number) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cet article ? Cette action est irréversible.")) return;
    const newItems = reqItems.filter((_, i) => i !== index);
    setReqItems(newItems);
    const total = newItems.reduce((sum, item) => sum + item.total, 0);
    setReqAmount(total.toString());
  };

  const [poSupplierId, setPoSupplierId] = useState('');
  const [poDelivery, setPoDelivery] = useState('');

  useEffect(() => {
    const fetchVat = async () => {
      try {
        const res = await apiFetch('/api/vat-settings');
        if (res.ok) setVatSettings(await res.json());
      } catch (e) { console.error(e); }
    };
    const fetchSuppliers = async () => {
      try {
        const res = await apiFetch('/api/third-parties?type=supplier');
        if (res.ok) setSuppliers(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchVat();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const reqQ = query(collection(db, 'p2p_requisitions'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubReq = onSnapshot(reqQ, (snapshot) => {
      setRequisitions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Requisition)));
    }, error => handleFirestoreError(error, OperationType.GET, 'p2p_requisitions'));

    const rfqQ = query(collection(db, 'p2p_rfqs'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubRfq = onSnapshot(rfqQ, (snapshot) => {
      setRfqs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RFQ)));
    }, error => handleFirestoreError(error, OperationType.GET, 'p2p_rfqs'));

    const poQ = query(collection(db, 'p2p_purchase_orders'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubPo = onSnapshot(poQ, (snapshot) => {
      setPurchaseOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    }, error => handleFirestoreError(error, OperationType.GET, 'p2p_purchase_orders'));

    const grQ = query(collection(db, 'p2p_goods_receipts'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubGr = onSnapshot(grQ, (snapshot) => {
      setReceipts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GoodsReceipt)));
    }, error => handleFirestoreError(error, OperationType.GET, 'p2p_goods_receipts'));

    const imQ = query(collection(db, 'p2p_invoice_matching'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubIm = onSnapshot(imQ, (snapshot) => {
      setMatchedInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceMatching)));
    }, error => handleFirestoreError(error, OperationType.GET, 'p2p_invoice_matching'));

    const payQ = query(collection(db, 'p2p_payments'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubPay = onSnapshot(payQ, (snapshot) => {
      setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as P2PPayment)));
    }, error => handleFirestoreError(error, OperationType.GET, 'p2p_payments'));

    return () => { unsubReq(); unsubRfq(); unsubPo(); unsubGr(); unsubIm(); unsubPay(); };
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, receipt: GoodsReceipt) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setOcrLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        // 1. Advanced OCR Analysis specialized for African context
        const analysis = await analyzeInvoice(base64, 'achat', vatSettings);
        
        if (analysis) {
          const po = purchaseOrders.find(p => p.id === receipt.poId);
          const discrepancy = po ? Math.abs(analysis.amount_ttc - po.amount) > 1 : false;
          
          const anomalies = [];
          if (analysis.third_party && po && analysis.third_party.toUpperCase() !== po.supplier_name.toUpperCase()) {
            anomalies.push("Le nom du fournisseur sur la facture ne correspond pas au Bon de Commande.");
          }
          if (analysis.amount_ttc > 1000000 && !analysis.third_party_id) {
            anomalies.push("NIF/NINEA manquant sur une facture de montant élevé.");
          }

          // 2. Log OCR Feedback for continuous ML improvement (African region)
          await logOcrFeedback(base64, analysis, analysis, 'UEMOA');

          // 3. Create Matching Document
          const newMatching = {
            userId: user.uid,
            reference: analysis.invoice_number || `FA-${Date.now()}`,
            po_reference: receipt.po_reference,
            receipt_reference: receipt.reference,
            supplier_name: analysis.third_party || receipt.supplier_name,
            amount_invoice: analysis.amount_ttc,
            amount_po: po?.amount || 0,
            vat_invoice: analysis.amount_tva || 0,
            vat_po: (po?.amount || 0) * 0.18,
            entries: analysis.entries,
            items: analysis.items || [],
            anomalies: anomalies,
            status: (discrepancy || anomalies.length > 0) ? 'discrepancy' : 'matched',
            date: analysis.date || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          };
          
          await addDoc(collection(db, 'p2p_invoice_matching'), newMatching);

          // 4. If matched, create Accountant Transaction automatically
          if (!discrepancy) {
            await apiFetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                date: analysis.date,
                description: `P2P Cycle Match: ${analysis.invoice_number} - ${analysis.third_party}`,
                reference: analysis.invoice_number,
                entries: analysis.entries,
                creation_mode: 'p2p_matching'
              })
            });
            dialogAlert("Facture rapprochée et comptabilisée automatiquement.", "success");
          } else {
            dialogAlert(`Écart détecté entre le Bon de Commande ${po?.amount} et la Facture ${analysis.amount_ttc}.`, "error");
          }
          setActiveStep('invoice_matching');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("OCR P2P Error:", err);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, collectionName: string, docId: string) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        // In a real app we'd use Firebase Storage, here we store the base64 or a reference
        // We'll update the document's attachments array
        // We fetch the current doc first to be safe or use arrayUnion
        await updateDoc(doc(db, collectionName, docId), {
          attachments: [base64] // Simplifying for now, replace/append base64
        });
        dialogAlert("Pièce jointe ajoutée avec succès.", "success");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${docId}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let fileName = `P2P_Export_${activeStep}_${new Date().toISOString().split('T')[0]}.csv`;

    switch (activeStep) {
      case 'requisition':
        headers = ['Reference', 'Date', 'Description', 'Demandeur', 'Département', 'Montant', 'Status', 'Ligne Budget'];
        rows = requisitions.map(r => [r.reference, r.date, r.description, r.requester, r.department, r.amount, r.status, r.budgetLine || '']);
        break;
      case 'purchase_order':
        headers = ['Reference', 'Date', 'Fournisseur', 'Montant', 'Status', 'Livraison Prevue'];
        rows = purchaseOrders.map(p => [p.reference, p.date, p.supplier_name, p.amount, p.status, p.expected_delivery]);
        break;
      case 'goods_receipt':
        headers = ['Reference', 'Date', 'PO Reference', 'Fournisseur', 'Status'];
        rows = receipts.map(r => [r.reference, r.date, r.po_reference, r.supplier_name, r.status]);
        break;
      case 'invoice_matching':
        headers = ['Reference', 'Date', 'Fournisseur', 'Montant Invoice', 'Montant PO', 'Status'];
        rows = matchedInvoices.map(i => [i.reference, i.date, i.supplier_name, i.amount_invoice, i.amount_po, i.status]);
        break;
      case 'payment':
        headers = ['Reference', 'Date', 'Beneficiaire', 'Montant', 'Methode', 'Status'];
        rows = payments.map(p => [p.reference, p.payment_date, p.supplier_name, p.amount, p.payment_method, p.status]);
        break;
      default:
        return;
    }

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const newReq = {
        userId: user.uid,
        reference: `DA-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        description: reqDesc,
        requester: user.email || 'Utilisateur',
        department: reqDept,
        amount: parseFloat(reqAmount),
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        institutionType: reqInstType,
        institutionName: reqInstName,
        budgetLine: reqBudgetLine,
        projectCode: reqProjectCode,
        items: reqItems,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'p2p_requisitions'), newReq);
      setShowReqModal(false);
      setReqDesc(''); setReqDept(''); setReqAmount('');
      setReqInstName(''); setReqBudgetLine(''); setReqProjectCode('');
      setReqItems([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'p2p_requisitions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRFQ = async (req: Requisition) => {
    if (!user) return;
    setLoading(true);
    try {
      const newRFQ = {
        userId: user.uid,
        reference: `DP-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        requisitionId: req.id,
        status: 'sent',
        date: new Date().toISOString().split('T')[0],
        supplier_ids: [], // To be populated
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'p2p_rfqs'), newRFQ);
      await updateDoc(doc(db, 'p2p_requisitions', req.id), { status: 'approved' });
      setActiveStep('rfq');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'p2p_rfqs');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePayment = async (matching: InvoiceMatching) => {
    if (!user) return;
    setLoading(true);
    try {
      // Logic decision: Recommend payment priority based on amount and status
      const priority = matching.amount_invoice > 1000000 ? 9 : matching.status === 'discrepancy' ? 3 : 5;
      
      const newPayment = {
        userId: user.uid,
        reference: `PAY-${Date.now()}`,
        invoice_reference: matching.reference,
        supplier_name: matching.supplier_name,
        amount: matching.amount_invoice,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'virement',
        status: 'scheduled',
        priority_score: priority,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'p2p_payments'), newPayment);
      await updateDoc(doc(db, 'p2p_invoice_matching', matching.id), { status: 'matched' });
      setActiveStep('payment');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'p2p_payments');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReq = async (req: Requisition, targetStatus: Requisition['status']) => {
    try {
      await updateDoc(doc(db, 'p2p_requisitions', req.id), { 
        status: targetStatus,
        updatedAt: serverTimestamp() 
      });
      
      if (targetStatus === 'approved') {
        setShowPOModal(req);
      } else {
        dialogAlert(`Demande passée au statut: ${targetStatus}`, "info");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `p2p_requisitions/${req.id}`);
    }
  };

  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !showPOModal) return;
    
    const supplier = suppliers.find(s => s.id.toString() === poSupplierId);
    if (!supplier) {
      dialogAlert("Veuillez sélectionner un fournisseur", "error");
      return;
    }

    setLoading(true);
    try {
      // --- Integrated Budget Control ---
      // We'll use account 601 (Achat de marchandises) or the one from the requisition items
      const mainAccount = (showPOModal.items && showPOModal.items.length > 0) 
        ? showPOModal.items[0].accountCode 
        : (showPOModal.budgetLine || '601');

      const budgetCheckRes = await apiFetch('/api/budgets/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_code: mainAccount,
          amount: showPOModal.amount,
          description: `Engagement P2P (PO): ${showPOModal.description}`,
          reference: `PO-REQUISITION-${showPOModal.reference}`,
          period_month: new Date().getMonth() + 1,
          period_year: new Date().getFullYear()
        })
      });

      if (!budgetCheckRes.ok) {
        const errData = await budgetCheckRes.json();
        throw new Error(errData.error || "Dépassement de budget détecté. Engagement impossible.");
      }
      // ---------------------------------

      const newPO = {
        userId: user.uid,
        requisitionId: showPOModal.id,
        reference: `BC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        amount: showPOModal.amount,
        status: 'sent',
        date: new Date().toISOString().split('T')[0],
        expected_delivery: poDelivery,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'p2p_purchase_orders'), newPO);
      await updateDoc(doc(db, 'p2p_requisitions', showPOModal.id), { status: 'ordered' });
      setShowPOModal(null);
      setPoSupplierId(''); setPoDelivery('');
      setActiveStep('purchase_order');
      dialogAlert("Bon de Commande créé et budget engagé.", "success");
    } catch (err: any) {
      console.error(err);
      dialogAlert(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReceivePO = async (po: PurchaseOrder) => {
    if (!user) return;
    try {
      const newReceipt = {
        userId: user.uid,
        reference: `BR-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        poId: po.id,
        po_reference: po.reference,
        supplier_name: po.supplier_name,
        date: new Date().toISOString().split('T')[0],
        status: 'received',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'p2p_goods_receipts'), newReceipt);
      await updateDoc(doc(db, 'p2p_purchase_orders', po.id), { status: 'received' });
      setActiveStep('goods_receipt');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'p2p_goods_receipts');
    }
  };

  const handleMatchInvoice = async (receipt: GoodsReceipt) => {
    if (!user) return;
    const po = purchaseOrders.find(p => p.id === receipt.poId);
    if (!po) return;
    try {
      const invAmountStr = prompt("Entrez le montant de la facture fournisseur HT:", po.amount.toString());
      if (invAmountStr === null) return;
      const amountInvoice = parseFloat(invAmountStr);
      
      const discrepancies = [];
      if (Math.abs(amountInvoice - po.amount) > 1) {
        discrepancies.push(`Écart de montant: Facture ${amountInvoice} vs Bon de Commande ${po.amount}`);
      }

      const newMatching = {
        userId: user.uid,
        reference: `FA-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        po_reference: receipt.po_reference,
        receipt_reference: receipt.reference,
        supplier_name: receipt.supplier_name,
        amount_invoice: amountInvoice,
        amount_po: po.amount,
        vat_invoice: amountInvoice * 0.18, // 18% UEMOA standard
        vat_po: po.amount * 0.18,
        discrepancies: discrepancies,
        anomalies: amountInvoice > 2000000 ? ["Montant exceptionnel nécessitant validation DG."] : [],
        status: (discrepancies.length > 0 || amountInvoice > 2000000) ? 'discrepancy' : 'matched',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'p2p_invoice_matching'), newMatching);
      setActiveStep('invoice_matching');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'p2p_invoice_matching');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': case 'received': case 'ordered': case 'matched': case 'paid': case 'accounted':
        return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';
      case 'approved_mgr': case 'approved_fin':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400';
      case 'pending': case 'sent': case 'draft': case 'pending_inspection': case 'scheduled':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
      case 'rejected': case 'cancelled': case 'discrepancy':
        return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-400';
    }
  };

  const steps = [
    { id: 'requisition', label: 'Demande d\'Achat', icon: FilePlus, color: 'text-blue-500' },
    { id: 'rfq', label: 'Consultation', icon: Filter, color: 'text-indigo-500' },
    { id: 'purchase_order', label: 'Bon de Commande', icon: ShoppingBag, color: 'text-brand-green' },
    { id: 'goods_receipt', label: 'Bon de Réception', icon: PackageCheck, color: 'text-amber-500' },
    { id: 'invoice_matching', label: 'Rapprochement', icon: ClipboardCheck, color: 'text-purple-500' },
    { id: 'payment', label: 'Paiement', icon: CheckCircle2, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procure-to-Pay Intégré"
        subtitle="Cycle d'achat automatisé, rapprochement 3-way et intelligence comptable SYSCOHADA"
        icon={<ShoppingBag size={24} />}
        actions={
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-2xl font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
            >
              <Download size={20} /> <span className="hidden sm:inline">Exporter</span>
            </button>
            {activeStep === 'requisition' && (
              <button 
                onClick={() => setShowReqModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-brand-green hover:bg-brand-green-dark text-white rounded-2xl font-bold shadow-lg shadow-brand-green/20 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus size={20} /> <span className="hidden sm:inline">Nouvelle Demande</span><span className="sm:hidden">Nouveau</span>
              </button>
            )}
          </div>
        }
      />

      {/* P2P Dashboard Mini */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-sm">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Engagements (PO)</div>
          <div className="text-xl font-black text-brand-green">{formatCurrency(purchaseOrders.reduce((sum, p) => sum + p.amount, 0))}</div>
          <div className="text-[8px] text-slate-500 mt-1">{purchaseOrders.length} bons de commande actifs</div>
        </div>
        <div className="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-sm">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Dettes Fournisseurs</div>
          <div className="text-xl font-black text-amber-500">{formatCurrency(matchedInvoices.filter(i => i.status === 'matched').reduce((sum, i) => sum + (i.amount_invoice || 0), 0))}</div>
          <div className="text-[8px] text-slate-500 mt-1">Factures validées</div>
        </div>
        <div className="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-sm">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Payé</div>
          <div className="text-xl font-black text-emerald-500">{formatCurrency(payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0))}</div>
          <div className="text-[8px] text-slate-500 mt-1">Décaissements effectués</div>
        </div>
        <div className="p-4 bg-indigo-500 dark:bg-indigo-600 rounded-[2rem] shadow-lg shadow-indigo-500/20 text-white relative overflow-hidden group">
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase text-indigo-100 tracking-widest mb-1">Indice de Précision</div>
            <div className="text-xl font-black">98.5%</div>
            <div className="text-[8px] text-indigo-100 mt-1">Faible taux d'écarts</div>
          </div>
          <Clock className="absolute -right-2 -bottom-2 text-white/10 w-16 h-16 group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* P2P Process Pipeline */}
      <div className="flex flex-col lg:flex-row gap-4 p-2 bg-slate-100 dark:bg-white/5 rounded-[2rem]">
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-6 gap-4">
          {steps.map((step) => {
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id as P2PStep)}
                className={cn(
                  "flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 relative overflow-hidden group",
                  isActive 
                    ? "bg-white dark:bg-slate-900 shadow-md translate-y-[-2px]" 
                    : "hover:bg-white/50 dark:hover:bg-white/5"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isActive ? "bg-brand-green/10 " + step.color : "bg-slate-200 dark:bg-white/10 text-slate-400"
                )}>
                  <step.icon size={20} />
                </div>
                <div className="text-left">
                  <div className={cn("text-[10px] font-black uppercase tracking-widest", isActive ? "text-slate-400" : "text-slate-400")}>Étape {steps.indexOf(step) + 1}</div>
                  <div className={cn("text-xs font-bold whitespace-nowrap", isActive ? "text-slate-900 dark:text-white" : "text-slate-500")}>{step.label}</div>
                </div>
                {isActive && <motion.div layoutId="p2p-active" className="absolute bottom-0 left-0 right-0 h-1 bg-brand-green" />}
              </button>
            );
          })}
        </div>
        <button 
          onClick={() => setIsCopilotOpen(!isCopilotOpen)}
          className={cn(
            "flex items-center gap-3 px-6 py-4 rounded-2xl transition-all duration-300",
            isCopilotOpen ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-white dark:bg-slate-900 text-indigo-500 shadow-sm border border-slate-200 dark:border-white/10"
          )}
        >
          <Clock size={20} className={isCopilotOpen ? "animate-pulse" : ""} />
          <div className="text-left">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-70">Copilote IA</div>
            <div className="text-xs font-bold whitespace-nowrap">{isCopilotOpen ? "Masquer" : "Conseils"}</div>
          </div>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">

      {/* Main View Area */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm p-4 sm:p-8 min-h-[500px]">
        <AnimatePresence mode="wait">
          {activeStep === 'requisition' && (
            <motion.div
              key="requisition"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* AI Insight Card */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-3xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
                  <Clock size={24} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-1">IA : Suggestion d'Achat</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Basé sur l'historique, vous commandez généralement des fournitures de bureau en début de mois. Souhaitez-vous préparer un BC ?</div>
                </div>
                <button 
                  onClick={() => setShowReqModal(true)}
                  className="px-4 py-2 bg-white dark:bg-slate-800 text-indigo-500 text-xs font-bold rounded-xl border border-indigo-100 dark:border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all active:scale-95 shadow-sm"
                >
                  Préparer
                </button>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <FileText size={20} className="text-blue-500" />
                  Demandes d'Achat (DA)
                </h3>
              </div>

              {requisitions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Aucune demande trouvée.</div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="text-left border-b border-slate-100 dark:border-white/5">
                        <th className="pb-4 px-4 text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-wider">Référence</th>
                        <th className="pb-4 px-4 text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-wider">Objet / Demandeur</th>
                        <th className="pb-4 px-4 text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-wider text-right">Montant</th>
                        <th className="pb-4 px-4 text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-wider">Status</th>
                        <th className="pb-4 px-4 text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {requisitions.map((req) => (
                        <tr key={req.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4">
                            <span className="text-sm font-bold text-brand-green font-mono">{req.reference}</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">{req.date}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{req.description}</div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><User size={10} /> {req.requester}</span>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-1"><Building size={10} /> {req.department}</span>
                              {req.institutionName && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-brand-green font-medium">{req.institutionType}: {req.institutionName}</span>
                                </>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              {req.budgetLine && (
                                <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-tight bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded inline-block">
                                  Ligne: {req.budgetLine}
                                </div>
                              )}
                              <div className="text-[8px] text-slate-400 italic">
                                Audit: Créé par {req.requester} le {new Date(req.createdAt).toLocaleString()}
                                {req.status.includes('approved') && " • Validé par Contrôleur"}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="text-sm font-bold">{formatCurrency(req.amount)}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", getStatusColor(req.status))}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              {req.attachments && req.attachments.length > 0 && (
                                <button 
                                  className="p-2 text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg transition-all" 
                                  title="Voir Pièces Jointes"
                                  onClick={() => dialogAlert(`Nombre de pièces jointes: ${req.attachments?.length}`, "info")}
                                >
                                  <Paperclip size={16} />
                                </button>
                              )}
                              <div className="relative">
                                <input 
                                  type="file" 
                                  className="absolute inset-0 opacity-0 cursor-pointer" 
                                  accept="image/*,application/pdf"
                                  onChange={(e) => handleDocumentUpload(e, 'p2p_requisitions', req.id)}
                                />
                                <button 
                                  className="p-2 text-slate-400 hover:text-brand-green hover:bg-brand-green/5 rounded-lg transition-all" 
                                  title="Joindre Document"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                              {req.status === 'pending' && (
                                <button 
                                  onClick={() => handleApproveReq(req, 'approved_mgr')}
                                  className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-lg transition-all" 
                                  title="Validation Manager"
                                >
                                  <User size={16} />
                                </button>
                              )}
                              {req.status === 'approved_mgr' && (
                                <button 
                                  onClick={() => handleApproveReq(req, 'approved_fin')}
                                  className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-lg transition-all" 
                                  title="Validation Finance"
                                >
                                  <Building size={16} />
                                </button>
                              )}
                              {req.status === 'approved_fin' && (
                                <button 
                                  onClick={() => handleApproveReq(req, 'approved')}
                                  className="p-2 text-slate-400 hover:text-brand-green hover:bg-brand-green/5 rounded-lg transition-all" 
                                  title="Validation Direction & Commander"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                              )}
                              {(req.status === 'pending' || req.status === 'draft') && (
                                <button 
                                  onClick={() => handleCreateRFQ(req)}
                                  className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-lg transition-all" 
                                  title="Initier Consultation (RFQ)"
                                >
                                  <Filter size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeStep === 'rfq' && (
            <motion.div
              key="rfq"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Filter size={20} className="text-indigo-500" />
                  Demandes de Prototypage / Devis (DP)
                </h3>
              </div>

              {rfqs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Aucune consultation en cours.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rfqs.map((rfq) => {
                    const req = requisitions.find(r => r.id === rfq.requisitionId);
                    return (
                      <div key={rfq.id} className="p-6 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl group hover:border-indigo-500/50 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-black uppercase text-indigo-500 font-mono">{rfq.reference}</span>
                          <div className="flex items-center gap-2">
                            {rfq.attachments && rfq.attachments.length > 0 && (
                              <Paperclip size={14} className="text-indigo-400" />
                            )}
                            <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest", getStatusColor(rfq.status))}>
                              {rfq.status}
                            </span>
                          </div>
                        </div>
                        <div className="mb-4">
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Besoin Associé</div>
                          <div className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{req?.description || 'N/A'}</div>
                          <div className="text-[10px] text-brand-green font-mono">{req?.reference}</div>
                        </div>
                        <div className="flex items-center gap-4 mb-6 pt-4 border-t border-slate-100 dark:border-white/5">
                          <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-indigo-500">
                                S{i}
                              </div>
                            ))}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">3 fournisseurs contactés</div>
                        </div>
                        <button 
                          onClick={() => setShowPOModal(req || null)}
                          className="w-full py-3 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <ChevronRight size={14} /> Analyser les devis et commander
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeStep === 'purchase_order' && (
            <motion.div
              key="purchase_order"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShoppingBag size={20} className="text-brand-green" />
                  Bons de Commande (BC)
                </h3>
              </div>

              {purchaseOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Aucun bon de commande.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {purchaseOrders.map((po) => (
                    <div key={po.id} className="p-6 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl group hover:border-brand-green/50 transition-all shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black uppercase text-brand-green font-mono">{po.reference}</span>
                        <div className="flex items-center gap-2">
                          {po.attachments && po.attachments.length > 0 && (
                            <Paperclip size={14} className="text-brand-green/50" />
                          )}
                          <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest", getStatusColor(po.status))}>
                            {po.status}
                          </span>
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Fournisseur</div>
                        <div className="flex items-center justify-between">
                          <div className="text-base font-black text-slate-900 dark:text-white capitalize">{po.supplier_name}</div>
                          <div className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black",
                            (suppliers.find(s => s.name === po.supplier_name)?.reliability_score || 0) > 90 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            Fiabilité: {suppliers.find(s => s.name === po.supplier_name)?.reliability_score || 'N/A'}%
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                          <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">Montant PO</div>
                          <div className="text-sm font-bold">{formatCurrency(po.amount)}</div>
                        </div>
                        <div>
                          <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">Livraison prévue</div>
                          <div className="text-sm font-bold flex items-center gap-1.5">
                            <Clock size={12} className="text-amber-500" />
                            {po.expected_delivery}
                          </div>
                        </div>
                      </div>
                      {po.status === 'sent' && (
                        <button 
                          onClick={() => handleReceivePO(po)}
                          className="w-full py-3 bg-brand-green/5 group-hover:bg-brand-green text-brand-green group-hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Truck size={14} /> Recevoir la marchandise
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeStep === 'goods_receipt' && (
            <motion.div
              key="goods_receipt"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <PackageCheck size={20} className="text-amber-500" />
                  Bons de Réception (BR)
                </h3>
              </div>

              {receipts.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Aucun bon de réception.</div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="text-left border-b border-slate-100 dark:border-white/5">
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Référence BR</th>
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Référence BC</th>
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Fournisseur</th>
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Status</th>
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {receipts.map((receipt) => (
                        <tr key={receipt.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4">
                            <span className="text-sm font-bold text-amber-500 font-mono">{receipt.reference}</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">{receipt.date}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 font-mono">{receipt.po_reference}</span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{receipt.supplier_name}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", getStatusColor(receipt.status))}>
                              {receipt.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              {receipt.attachments && receipt.attachments.length > 0 && (
                                <Paperclip size={16} className="text-amber-500 m-2" />
                              )}
                              <div className="relative">
                                <input 
                                  type="file" 
                                  className="absolute inset-0 opacity-0 cursor-pointer" 
                                  accept="image/*,application/pdf"
                                  onChange={(e) => handleDocumentUpload(e, 'p2p_goods_receipts', receipt.id)}
                                />
                                <button 
                                  className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all" 
                                  title="Joindre BR signé"
                                >
                                  <Paperclip size={16} />
                                </button>
                              </div>
                              {receipt.status === 'received' && (
                                <div className="relative">
                                  <input 
                                    type="file" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    accept="image/*,application/pdf"
                                    onChange={(e) => handleFileUpload(e, receipt)}
                                  />
                                  <button 
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all font-black text-[9px] uppercase tracking-widest shadow-sm" 
                                    title="Scanner Facture avec l'IA"
                                  >
                                    <Camera size={12} /> Numériser Facture
                                  </button>
                                </div>
                              )}
                              {receipt.status === 'received' && (
                                <button 
                                  onClick={() => handleMatchInvoice(receipt)}
                                  className="p-2 text-slate-400 hover:text-purple-500 hover:bg-purple-500/10 rounded-lg transition-all" 
                                  title="Rapprocher Manuellement"
                                >
                                  <ClipboardCheck size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeStep === 'invoice_matching' && (
            <motion.div
              key="invoice_matching"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ClipboardCheck size={20} className="text-purple-500" />
                  Rapprochement Factures (3-way match)
                </h3>
              </div>

              {matchedInvoices.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Aucun rapprochement.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {matchedInvoices.map((inv) => (
                    <div key={inv.id} className="p-6 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl group hover:border-purple-500/50 transition-all shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 font-mono">{inv.reference}</span>
                        <div className="flex items-center gap-2">
                          {inv.attachments && inv.attachments.length > 0 && (
                            <Paperclip size={14} className="text-purple-400" />
                          )}
                          <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest", getStatusColor(inv.status))}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Fournisseur</div>
                          <div className="text-base font-black text-slate-900 dark:text-white">{inv.supplier_name}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Facture vs Commande</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(inv.amount_invoice)}</span>
                            {inv.amount_po && inv.amount_invoice !== inv.amount_po && (
                              <span className="text-[10px] text-slate-400 line-through">{formatCurrency(inv.amount_po)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                          <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">BC Référencé</div>
                          <div className="text-xs font-bold text-brand-green font-mono">{inv.po_reference}</div>
                        </div>
                        <div>
                          <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">BR Référencé</div>
                          <div className="text-xs font-bold text-amber-500 font-mono">{inv.receipt_reference}</div>
                        </div>
                      </div>
                      
                      {inv.anomalies && inv.anomalies.length > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-start gap-2 mb-4 border border-amber-100 dark:border-amber-500/20">
                          <AlertCircle size={14} className="text-amber-500 mt-0.5" />
                          <div className="text-[10px] text-amber-700 dark:text-amber-400">
                            <strong>Détection IA :</strong> {inv.anomalies.join(", ")}
                          </div>
                        </div>
                      )}

                      {inv.status === 'discrepancy' ? (
                        <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-start gap-2 mb-4 border border-red-100 dark:border-red-500/20">
                          <AlertCircle size={14} className="text-red-500 mt-0.5" />
                          <div className="text-[10px] text-red-700 dark:text-red-400">
                            <strong>Écarts détectés :</strong>
                            <ul className="mt-1 list-disc list-inside space-y-0.5">
                              {inv.discrepancies?.map((d, i) => <li key={i}>{d}</li>)}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-green-50 dark:bg-green-500/10 rounded-xl flex items-center gap-2 mb-4 border border-green-100 dark:border-green-500/20">
                          <CheckCircle2 size={14} className="text-green-500" />
                          <div className="text-xs text-green-700 dark:text-green-400 font-medium">
                            3-way matching réussi (BC = BR = Facture)
                          </div>
                        </div>
                      )}

                      {inv.entries && inv.entries.length > 0 && (
                        <div className="mb-4 bg-indigo-50 dark:bg-indigo-500/5 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                          <div className="text-[9px] font-black uppercase text-indigo-500 mb-2 tracking-widest">Écriture SYSCOHADA Proposée (IA)</div>
                          <div className="space-y-1">
                            {inv.entries.map((entry, idx) => (
                              <div key={idx} className="flex justify-between text-[10px] font-mono">
                                <span className={cn(entry.credit > 0 && "pl-4 text-slate-500")}>
                                  {entry.debit > 0 ? 'D' : 'C'} {entry.account_code} {entry.description}
                                </span>
                                <span className="font-bold">
                                  {formatCurrency(entry.debit > 0 ? entry.debit : entry.credit)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {inv.items && inv.items.length > 0 && (
                        <div className="mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Lignes de Facture (OCR)</div>
                          <div className="space-y-2">
                            {inv.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-start gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{item.description}</span>
                                  <span className="text-[8px] text-slate-400 uppercase tracking-tighter">Qte: {item.quantity} | PU: {formatCurrency(item.unit_price)}</span>
                                </div>
                                <span className="text-[10px] font-black text-slate-900 dark:text-white shrink-0">
                                  {formatCurrency(item.total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {inv.status === 'matched' && !inv.entries && (
                        <div className="mb-4 bg-indigo-50 dark:bg-indigo-500/5 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                          <div className="text-[9px] font-black uppercase text-indigo-500 mb-2 tracking-widest">Écriture SYSCOHADA Suggérée</div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span>D 601 Achats de marchandises</span>
                              <span className="font-bold">{formatCurrency(inv.amount_invoice)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono">
                              <span>D 445 TVA récupérable</span>
                              <span className="font-bold">{formatCurrency(inv.vat_invoice || 0)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono pl-4 text-slate-500">
                              <span>C 401 Fournisseurs</span>
                              <span className="font-bold">{formatCurrency(inv.amount_invoice + (inv.vat_invoice || 0))}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {(inv.status === 'matched' || inv.status === 'discrepancy') && (
                        <button 
                          onClick={() => handleSchedulePayment(inv)}
                          className="w-full py-3 bg-brand-green text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20"
                        >
                          <ChevronRight size={14} /> Valider l'entrée et programmer paiement
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeStep === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  Paiements et Règlements
                </h3>
              </div>

              {payments.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Aucun paiement enregistré.</div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="text-left border-b border-slate-100 dark:border-white/5">
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Réf Paiement</th>
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Facture / Bénéficiaire</th>
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Montant</th>
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Méthode</th>
                        <th className="pb-4 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {payments.map((p) => (
                        <tr key={p.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4">
                            <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{p.reference}</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">{p.payment_date}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{p.supplier_name}</div>
                            <div className="text-[10px] text-purple-500 font-mono">Facture: {p.invoice_reference}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm font-bold">{formatCurrency(p.amount)}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{p.payment_method}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", getStatusColor(p.status))}>
                                {p.status}
                              </span>
                              {p.attachments && p.attachments.length > 0 && (
                                <Paperclip size={14} className="text-emerald-500" />
                              )}
                              {p.status === 'scheduled' && p.priority_score && (
                                <div className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                                  p.priority_score >= 8 ? "bg-red-500 text-white animate-pulse" : "bg-indigo-100 text-indigo-700"
                                )} title="Priorité recommandée par l'IA">
                                  P{p.priority_score}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* End of Main View Area */}
      </div>

      <AnimatePresence>
        {isCopilotOpen && (
          <motion.div
            initial={{ opacity: 0, width: 0, x: 20 }}
            animate={{ opacity: 1, width: 320, x: 0 }}
            exit={{ opacity: 0, width: 0, x: 20 }}
            className="hidden lg:block shrink-0 h-full sticky top-6"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 h-[calc(100vh-200px)] shadow-sm overflow-y-auto">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                  <Clock size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-indigo-500 tracking-widest leading-none">Copilote</div>
                  <div className="text-xs font-bold leading-none mt-1">Intelligence d'Achat</div>
                </div>
              </div>

              <div className="space-y-4">
                {insightLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ory analyse votre cycle P2P...</p>
                  </div>
                ) : copilotInsights.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center">
                    <p className="text-[10px] text-slate-400">Aucun conseil stratégique pour le moment. Plus de données permettront une analyse fine.</p>
                  </div>
                ) : (
                  copilotInsights.map((insight, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 relative group hover:border-indigo-500/30 transition-all cursor-default"
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          insight.toLowerCase().includes("alerte") || insight.toLowerCase().includes("attention") ? "bg-red-500" :
                          insight.toLowerCase().includes("trésorerie") || insight.toLowerCase().includes("flux") ? "bg-amber-500" : 
                          "bg-indigo-500"
                        )} />
                        <div className="text-[11px] font-medium leading-relaxed text-slate-700 dark:text-slate-300">{insight}</div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Prévision Trésorerie (30j)</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="text-[10px] text-slate-500">Engagements</div>
                    <div className="text-xs font-bold">{formatCurrency(purchaseOrders.reduce((sum, p) => sum + p.amount, 0))}</div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-3/4 rounded-full" />
                  </div>
                  <div className="text-[9px] text-slate-400 italic">Risque modéré de tension fin de mois</div>
                </div>
              </div>

              <div className="mt-8">
                <button className="w-full py-3 bg-slate-900 dark:bg-indigo-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all">
                  Optimiser les paiements
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

      {/* Requisition Creation Modal */}
      <AnimatePresence>
        {showReqModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                    <FilePlus size={20} />
                  </div>
                  Nouvelle Demande
                </h3>
                <button onClick={() => setShowReqModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitReq} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Description du besoin</label>
                    <input
                      type="text"
                      required
                      value={reqDesc}
                      onChange={e => setReqDesc(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-green outline-none font-medium"
                      placeholder="Ex: Acquisition de véhicules de service"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Département</label>
                    <input
                      type="text"
                      required
                      value={reqDept}
                      onChange={e => setReqDept(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                      placeholder="Ex: Direction Générale"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Montant Estimé</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={reqAmount}
                      onChange={e => setReqAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Line Items Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lignes de commande</label>
                    <button 
                      type="button"
                      onClick={addReqItem}
                      className="text-[10px] font-bold text-brand-green hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Ajouter une ligne
                    </button>
                  </div>
                  
                  {reqItems.length === 0 ? (
                    <div className="text-center py-4 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl text-[10px] text-slate-400">
                      Aucune ligne ajoutée. Ajoutez au moins une ligne pour plus de précision.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reqItems.map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5 relative group">
                          <button 
                            type="button"
                            onClick={() => removeReqItem(idx)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-12">
                              <input
                                type="text"
                                placeholder="Description de l'article"
                                value={item.description}
                                onChange={e => updateReqItem(idx, 'description', e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border-none rounded-lg px-2 py-1.5 text-[10px] outline-none"
                              />
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                placeholder="Qté"
                                value={item.quantity}
                                onChange={e => updateReqItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border-none rounded-lg px-2 py-1.5 text-[10px] outline-none"
                              />
                            </div>
                            <div className="col-span-4">
                              <input
                                type="number"
                                placeholder="Prix Unitaire"
                                value={item.unitPrice}
                                onChange={e => updateReqItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border-none rounded-lg px-2 py-1.5 text-[10px] outline-none"
                              />
                            </div>
                            <div className="col-span-5 flex items-center justify-end text-[10px] font-bold text-slate-900 dark:text-white">
                              {formatCurrency(item.total)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-4 border border-slate-100 dark:border-white/5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Contexte Secteur Public (Optionnel)</div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Type d'Entité</label>
                      <select 
                        value={reqInstType}
                        onChange={e => setReqInstType(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border-none rounded-lg px-3 py-2 text-xs outline-none"
                      >
                        <option>Ministère</option>
                        <option>Institution Publique</option>
                        <option>Collectivité Locale</option>
                        <option>Projet de Développement</option>
                        <option>Etablissement Public</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Nom de l'Institution</label>
                      <input
                        type="text"
                        value={reqInstName}
                        onChange={e => setReqInstName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border-none rounded-lg px-3 py-2 text-xs outline-none"
                        placeholder="Ex: Ministère des Finances"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Ligne Budgétaire</label>
                      <input
                        type="text"
                        value={reqBudgetLine}
                        onChange={e => setReqBudgetLine(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border-none rounded-lg px-3 py-2 text-xs outline-none font-mono"
                        placeholder="602.100..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Code Projet / Activité</label>
                      <input
                        type="text"
                        value={reqProjectCode}
                        onChange={e => setReqProjectCode(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border-none rounded-lg px-3 py-2 text-xs outline-none font-mono"
                        placeholder="PRJ-24-..."
                      />
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl font-bold shadow-lg shadow-brand-green/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : 'Initier le Processus d\'Achat'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PO Creation Modal */}
      <AnimatePresence>
        {showPOModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                    <ShoppingBag size={20} />
                  </div>
                  Créer Bon de Commande
                </h3>
                <button onClick={() => setShowPOModal(null)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Demande Liée</div>
                <div className="text-sm font-bold">{showPOModal.description}</div>
                <div className="text-xs text-brand-green font-mono mt-1">{showPOModal.reference}</div>
              </div>

              <form onSubmit={handleSubmitPO} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Fournisseur</label>
                  <select
                    required
                    value={poSupplierId}
                    onChange={e => setPoSupplierId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-green outline-none font-bold"
                  >
                    <option value="">Sélectionner un fournisseur...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.account_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Date de livraison prévue</label>
                  <input
                    type="date"
                    required
                    value={poDelivery}
                    onChange={e => setPoDelivery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl font-bold shadow-lg shadow-brand-green/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : 'Générer Bon de Commande'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* OCR Loading Overlay */}
      <AnimatePresence>
        {ocrLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 max-w-sm w-full shadow-2xl text-center border border-slate-200 dark:border-white/10">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="text-indigo-500 animate-pulse" size={32} />
                </div>
              </div>
              
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Analyse IA en cours</h2>
              <div className="space-y-4">
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Le moteur IA extrait les données fiscales (TVA, NINEA, Montants) et génère la proposition d'écriture comptable selon les normes OHADA.
                </p>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="h-full bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                  />
                </div>
              </div>
              
              <div className="mt-8 grid grid-cols-2 gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">SYSCOHADA</div>
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">UEMOA/CEMAC</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


