import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/invoices', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-xsrf-token': 'dummy12345678901234567890'
      },
      body: JSON.stringify({
        type: 'invoice',
        date: '2026-05-27',
        third_party_id: 1,
        items: [
          { description: 'Test', quantity: 1, unit_price: 1000, discount_rate: 0, vat_rate: 18, account_code: '701' }
        ],
        currency: 'FCFA',
        exchange_rate: 1
      })
    });
    
    const data = await res.json();
    console.log("POST /api/invoices response:", data);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

test();
