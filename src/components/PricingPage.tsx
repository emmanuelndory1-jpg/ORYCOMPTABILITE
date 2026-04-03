import React, { useState } from 'react';
import { Check, CreditCard, Shield, Zap, Users, Loader2 } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { apiFetch as fetch } from '@/lib/api';

export function PricingPage() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState<string | null>(null);

  const plans = [
    {
      id: 'pro',
      name: 'Plan Pro',
      price: 25000,
      period: '/mois',
      description: 'Idéal pour les indépendants et petites structures.',
      features: [
        '1 Utilisateur',
        'Comptabilité Générale',
        'Gestion des Tiers',
        'Déclarations Fiscales (TVA)',
        'Support Email'
      ],
      color: 'brand-green',
      popular: false
    },
    {
      id: 'business',
      name: 'Plan Business',
      price: 100000,
      period: '/mois',
      description: 'Pour les PME en croissance avec plusieurs collaborateurs.',
      features: [
        'Jusqu\'à 5 Utilisateurs',
        'Tout du Plan Pro',
        'Comptabilité Analytique',
        'Gestion de la Paie',
        'Support Prioritaire',
        'Export FEC & Excel'
      ],
      color: 'blue',
      popular: true
    }
  ];

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await fetch('/api/payment/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, payment_method: 'cinetpay' })
      });
      
      const data = await res.json();
      
      if (data.payment_url) {
        // Redirect to Payment Gateway (or Mock Page)
        window.location.href = data.payment_url;
      } else {
        alert('Erreur lors de l\'initialisation du paiement');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur de connexion');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-12 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Choisissez votre plan</h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto">
          Des solutions adaptées à la taille de votre entreprise. Sans engagement, annulable à tout moment.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            className={`relative bg-white rounded-2xl shadow-xl border-2 transition-all hover:scale-105 ${
              plan.popular ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-100'
            }`}
          >
            {plan.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wide">
                Recommandé
              </div>
            )}

            <div className="p-8">
              <h3 className={`text-2xl font-bold mb-2 ${
                plan.color === 'brand-green' ? 'text-brand-green' : 'text-blue-600'
              }`}>
                {plan.name}
              </h3>
              <p className="text-slate-500 mb-6">{plan.description}</p>
              
              <div className="flex items-baseline mb-8">
                <span className="text-5xl font-extrabold text-slate-900">
                  {formatCurrency(plan.price).replace('FCFA', '').trim()}
                </span>
                <span className="text-xl text-slate-500 ml-2">FCFA{plan.period}</span>
              </div>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading !== null}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                  plan.color === 'brand-green' 
                    ? 'bg-brand-green/10 text-brand-green-dark hover:bg-brand-green/20' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                }`}
              >
                {loading === plan.id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    <CreditCard size={20} />
                    Choisir ce plan
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-50 p-8 rounded-b-2xl border-t border-slate-100">
              <ul className="space-y-4">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-slate-700">
                    <div className={`p-1 rounded-full ${
                      plan.color === 'brand-green' ? 'bg-brand-green/10 text-brand-green' : 'bg-blue-100 text-blue-600'
                    }`}>
                      <Check size={14} strokeWidth={3} />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-slate-400 text-sm mb-4">Moyens de paiement acceptés</p>
        <div className="flex justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all">
          <div className="flex flex-col items-center gap-1">
             <div className="h-10 w-16 bg-orange-500 rounded flex items-center justify-center text-white font-bold text-xs">Orange</div>
             <span className="text-xs">Money</span>
          </div>
          <div className="flex flex-col items-center gap-1">
             <div className="h-10 w-16 bg-yellow-400 rounded flex items-center justify-center text-slate-900 font-bold text-xs">MTN</div>
             <span className="text-xs">MoMo</span>
          </div>
          <div className="flex flex-col items-center gap-1">
             <div className="h-10 w-16 bg-blue-400 rounded flex items-center justify-center text-white font-bold text-xs">Wave</div>
             <span className="text-xs">Money</span>
          </div>
          <div className="flex flex-col items-center gap-1">
             <div className="h-10 w-16 bg-slate-800 rounded flex items-center justify-center text-white font-bold text-xs">VISA</div>
             <span className="text-xs">Card</span>
          </div>
        </div>
      </div>
    </div>
  );
}
