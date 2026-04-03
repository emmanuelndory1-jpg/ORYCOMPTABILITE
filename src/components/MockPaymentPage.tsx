import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiFetch as fetch } from '@/lib/api';
import { CheckCircle, XCircle, Loader2, CreditCard, Smartphone } from 'lucide-react';

export function MockPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [method, setMethod] = useState<'orange' | 'mtn' | 'wave' | 'card'>('orange');

  const transactionId = searchParams.get('transaction_id');
  const amount = searchParams.get('amount');
  const plan = searchParams.get('plan');

  const handlePayment = async () => {
    setStatus('processing');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const res = await fetch('/api/payment/mock-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId })
      });

      if (res.ok) {
        setStatus('success');
        setTimeout(() => {
          navigate('/dashboard'); // Redirect to dashboard after success
        }, 3000);
      } else {
        setStatus('failed');
      }
    } catch (err) {
      setStatus('failed');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-brand-green/10 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-brand-green w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Paiement Réussi !</h2>
          <p className="text-slate-500 mb-6">Votre abonnement {plan} est maintenant actif.</p>
          <div className="text-sm text-slate-400">Redirection vers le tableau de bord...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 p-6 text-white text-center">
          <h2 className="text-lg font-bold">CinetPay (Simulation)</h2>
          <div className="text-slate-400 text-sm">Paiement Sécurisé</div>
        </div>

        <div className="p-8">
          <div className="mb-8 text-center">
            <div className="text-sm text-slate-500 uppercase tracking-wide mb-1">Montant à payer</div>
            <div className="text-4xl font-bold text-slate-900">{amount} FCFA</div>
            <div className="text-xs font-mono text-slate-400 mt-2">Ref: {transactionId}</div>
          </div>

          <div className="space-y-4 mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-2">Moyen de paiement</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMethod('orange')}
                className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition-all ${
                  method === 'orange' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Smartphone size={20} />
                <span className="text-xs font-bold">Orange Money</span>
              </button>
              <button
                onClick={() => setMethod('mtn')}
                className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition-all ${
                  method === 'mtn' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Smartphone size={20} />
                <span className="text-xs font-bold">MTN MoMo</span>
              </button>
              <button
                onClick={() => setMethod('wave')}
                className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition-all ${
                  method === 'wave' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Smartphone size={20} />
                <span className="text-xs font-bold">Wave</span>
              </button>
              <button
                onClick={() => setMethod('card')}
                className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition-all ${
                  method === 'card' ? 'border-slate-800 bg-slate-100 text-slate-900' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CreditCard size={20} />
                <span className="text-xs font-bold">Carte Bancaire</span>
              </button>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={status === 'processing'}
            className="w-full py-4 bg-brand-green text-white rounded-xl font-bold text-lg hover:bg-brand-green-dark transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20"
          >
            {status === 'processing' ? (
              <Loader2 className="animate-spin" />
            ) : (
              'Payer Maintenant'
            )}
          </button>
          
          <div className="mt-4 text-center text-xs text-slate-400">
            Ceci est une simulation. Aucun montant ne sera débité.
          </div>
        </div>
      </div>
    </div>
  );
}
