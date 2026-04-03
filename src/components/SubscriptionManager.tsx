import React, { useState, useEffect } from 'react';
import { Shield, Check, AlertTriangle, CreditCard, Clock } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { useNavigate } from 'react-router-dom';

interface Subscription {
  plan_name: string;
  status: string;
  end_date: string;
  max_users: number;
  days_left?: number;
}

export function SubscriptionManager() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/subscription/status')
      .then(res => res.json())
      .then(data => {
        setSubscription(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="animate-pulse h-24 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>;

  const isPro = subscription?.plan_name === 'pro';
  const isBusiness = subscription?.plan_name === 'business';
  const isActive = subscription?.status === 'active';
  const daysLeft = subscription?.days_left || 0;

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
            <Shield className={isActive ? "text-brand-green" : "text-slate-400 dark:text-slate-500"} size={20} />
            Abonnement
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gérez votre plan et vos accès.</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
          isActive 
            ? (isBusiness ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "bg-brand-green/20 text-brand-green-dark dark:text-brand-green-light")
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
        }`}>
          {isActive ? (isBusiness ? "Business" : "Pro") : "Gratuit"}
        </div>
      </div>

      <div className="space-y-4">
        {isActive ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Expiration</span>
              <span className={`font-medium ${daysLeft < 5 ? "text-orange-600 dark:text-orange-400" : "text-slate-900 dark:text-slate-100"}`}>
                Dans {daysLeft} jours
              </span>
            </div>
            
            {daysLeft < 5 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 p-3 rounded-lg text-xs flex items-center gap-2 border border-orange-100 dark:border-orange-900/40">
                <AlertTriangle size={14} />
                Votre abonnement expire bientôt. Renouvelez maintenant pour éviter toute interruption.
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Inclus dans votre plan</div>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-brand-green" />
                  {subscription?.max_users} Utilisateur(s)
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-brand-green" />
                  Support {isBusiness ? "Prioritaire" : "Email"}
                </li>
                {isBusiness && (
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-brand-green" />
                    Comptabilité Analytique
                  </li>
                )}
              </ul>
            </div>
          </>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-center transition-colors">
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">Vous utilisez la version gratuite limitée.</p>
            <button 
              onClick={() => navigate('/pricing')}
              className="w-full py-2 bg-brand-green text-white rounded-lg text-sm font-bold hover:bg-brand-green-dark transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard size={16} />
              Passer à la version Pro
            </button>
          </div>
        )}

        {isActive && (
           <button 
             onClick={() => navigate('/pricing')}
             className="w-full py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
           >
             Changer de plan
           </button>
        )}
      </div>
    </div>
  );
}
