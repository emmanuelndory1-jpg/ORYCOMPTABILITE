import { useState, useEffect, createElement } from 'react';
import { apiFetch as fetch } from '@/lib/api';
import { DollarSign, Euro, PoundSterling, Banknote, Coins, Wallet } from 'lucide-react';

let cachedCurrency: string | null = null;
let cachedLoading = true;
const listeners: ((c: string) => void)[] = [];

export function useCurrency() {
  const [currency, setCurrency] = useState(cachedCurrency || 'FCFA');
  const [loading, setLoading] = useState(cachedLoading);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);

  useEffect(() => {
    const handleCurrencyChange = (c: string) => {
      setCurrency(c);
      setLoading(false);
    };
    listeners.push(handleCurrencyChange);

    const fetchRates = async () => {
      try {
        const res = await fetch('/api/exchange-rates');
        if (res.ok) {
          const data = await res.json();
          setExchangeRates(data);
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates", err);
      }
    };

    if (cachedCurrency) {
      setCurrency(cachedCurrency);
      setLoading(false);
      fetchRates();
    } else if (cachedLoading) {
      const fetchData = async () => {
        try {
          const res = await fetch('/api/company/dossier');
          if (res.ok) {
            const data = await res.json();
            if (data.settings && data.settings.currency) {
              cachedCurrency = data.settings.currency;
              cachedLoading = false;
              listeners.forEach(l => l(cachedCurrency!));
            }
          }
          await fetchRates();
        } catch (err) {
          console.error("Failed to fetch currency", err);
        } finally {
          cachedLoading = false;
          setLoading(false);
        }
      };
      fetchData();
    }

    return () => {
      const index = listeners.indexOf(handleCurrencyChange);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  const formatCurrency = (amount: number, customCurrency?: string) => {
    const curr = customCurrency || currency;
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: curr === 'FCFA' ? 'XOF' : curr 
    }).format(amount);
  };

  const convertAmount = (amount: number, from: string, to: string) => {
    if (from === to) return amount;
    const rate = exchangeRates.find(r => r.from_currency === from && r.to_currency === to);
    if (rate) return amount * rate.rate;
    
    // Try inverse rate
    const inverseRate = exchangeRates.find(r => r.from_currency === to && r.to_currency === from);
    if (inverseRate) return amount / inverseRate.rate;
    
    return amount; // Fallback if no rate found
  };

  const getExchangeRate = (from: string, to: string) => {
    if (from === to) return 1;
    const rate = exchangeRates.find(r => r.from_currency === from && r.to_currency === to);
    if (rate) return rate.rate;
    const inverseRate = exchangeRates.find(r => r.from_currency === to && r.to_currency === from);
    if (inverseRate) return 1 / inverseRate.rate;
    return 1;
  };

  const getCurrencyIcon = (size: number = 16, customCurrency?: string) => {
    const curr = customCurrency || currency;
    switch (curr) {
      case 'USD': return createElement(DollarSign, { size });
      case 'EUR': return createElement(Euro, { size });
      case 'GBP': return createElement(PoundSterling, { size });
      case 'FCFA':
      case 'XOF':
      case 'XAF':
        return createElement(Banknote, { size });
      case 'GNF':
        return createElement(Coins, { size });
      default: return createElement(Wallet, { size });
    }
  };

  return { currency, formatCurrency, getCurrencyIcon, loading, exchangeRates, convertAmount, getExchangeRate };
}
