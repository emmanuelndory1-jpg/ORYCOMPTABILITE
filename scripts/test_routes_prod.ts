import fetch from 'node-fetch';

async function testAll() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
  });
  
  const cookies = loginRes.headers.raw()['set-cookie'];
  const cookieString = cookies ? cookies.join('; ') : '';
  console.log("Logged in:", loginRes.status);
  
  const routes = [
    '/api/dashboard/stats',
    '/api/dashboard/charts',
    '/api/dashboard/cashflow-forecast',
    '/api/dashboard/liquidity-history',
    '/api/dashboard/breakdown',
    '/api/dashboard/recent',
    '/api/dashboard/budget-vs-actual',
    '/api/dashboard/ratios',
    '/api/assets/stats',
    '/api/audit-logs?limit=5',
    '/api/recurring-transactions/due-count',
    '/api/dashboard/deadlines?days=7',
    '/api/third-parties/defaults',
    '/api/company/status'
  ];
  
  for (const route of routes) {
    try {
      const res = await fetch('http://127.0.0.1:3000' + route, {
        headers: { cookie: cookieString }
      });
      const text = await res.text();
      console.log(`${route} => ${res.status}`);
      if (text.includes("Too many parameter values") || res.status === 500) {
          console.error("FOUND IN ROUTE:", route);
          console.error(text.substring(0, 300));
      }
    } catch (e) {
      console.error(e);
    }
  }
}

testAll();
