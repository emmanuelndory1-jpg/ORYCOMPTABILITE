import crypto from 'crypto';
import db from './db';

// Generic Aggregator API implementation (FedaPay / CinetPay style)
// Supporting Orange Money, MTN Mobile Money, Wave
const getBaseUrl = () => {
  const env = process.env.MOBILE_MONEY_ENV || 'sandbox';
  return env === 'production' 
    ? 'https://api.fedapay.com/v1' 
    : 'https://sandbox-api.fedapay.com/v1';
};

const getHeaders = () => {
  return {
    'Authorization': `Bearer ${process.env.MOBILE_MONEY_API_SECRET || process.env.MOBILE_MONEY_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

export const createPayment = async (amount: number, description: string, customer: any, currency = 'XOF') => {
  if (!process.env.MOBILE_MONEY_API_SECRET) {
    throw new Error('MOBILE_MONEY_API_SECRET is not configured');
  }

  const payload = {
    description,
    amount: Math.round(amount),
    currency: {
      iso: currency
    },
    customer: {
      firstname: customer.firstname || 'Client',
      lastname: customer.lastname || 'Occasionnel',
      email: customer.email || 'client@example.com',
      phone_number: {
        number: customer.phone,
        country: 'sn' // Senegal, CI, etc based on implementation, defaulting to generic
      }
    }
  };

  const response = await fetch(`${getBaseUrl()}/transactions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(data.message || 'Payment creation failed');
  }

  // Generate payment token for link
  const tokenResponse = await fetch(`${getBaseUrl()}/transactions/${data.v1.id}/token`, {
    method: 'POST',
    headers: getHeaders()
  });

  const tokenData = await tokenResponse.json() as any;
  if (!tokenResponse.ok) {
    throw new Error(tokenData.message || 'Failed to generate payment link');
  }

  return {
    transaction_id: data.v1.id,
    payment_url: tokenData.url,
    amount,
    currency
  };
};

export const createPayout = async (amount: number, phone_number: string, network: string, description: string, currency = 'XOF') => {
  if (!process.env.MOBILE_MONEY_API_SECRET) {
    throw new Error('MOBILE_MONEY_API_SECRET is not configured');
  }

  // Determine provider mapping
  let providerCode = '';
  const net = network.toLowerCase();
  if (net.includes('orange')) providerCode = 'orange';
  else if (net.includes('mtn')) providerCode = 'mtn';
  else if (net.includes('wave')) providerCode = 'wave';
  else if (net.includes('moov')) providerCode = 'moov';
  else if (net.includes('free')) providerCode = 'free';
  else throw new Error('Unsupported network provider');

  const payload = {
    amount: Math.round(amount),
    currency: { iso: currency },
    mode: providerCode,
    customer: {
      firstname: 'Fournisseur',
      lastname: '',
      phone_number: {
        number: phone_number,
        country: 'sn'
      }
    },
    send_now: true,
    description
  };

  const response = await fetch(`${getBaseUrl()}/payouts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(data.message || 'Payout failed');
  }

  return {
    payout_id: data.v1.id,
    status: data.v1.status // pending, approved, canceled
  };
};

export const fetchGatewayTransactions = async (startDate?: Date, endDate?: Date) => {
  if (!process.env.MOBILE_MONEY_API_SECRET) {
    throw new Error('MOBILE_MONEY_API_SECRET is not configured');
  }

  // For reconciliation, fetch payments
  const response = await fetch(`${getBaseUrl()}/transactions?limit=100&status=approved`, {
    method: 'GET',
    headers: getHeaders()
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch transactions');
  }

  return data.v1.map((t: any) => ({
    gateway_id: t.id.toString(),
    amount: t.amount,
    currency: t.currency_id,
    description: t.description,
    date: t.created_at,
    status: t.status, // approved
    customer_name: t.customer?.firstname + ' ' + t.customer?.lastname,
    customer_phone: t.customer?.phone_number?.number
  }));
};
