import fetch from 'node-fetch';

async function testAll() {
  const routes = [
    '/api/dashboard/stats',
    '/api/dashboard/charts',
    '/api/dashboard/cashflow-forecast',
    '/api/dashboard/breakdown',
    '/api/dashboard/recent',
    '/api/dashboard/budget-vs-actual',
    '/api/dashboard/ratios',
    '/api/assets/stats',
    '/api/audit-logs?limit=5',
    '/api/recurring-transactions/due-count',
    '/api/dashboard/deadlines?days=7',
    '/api/dashboard/liquidity-history'
  ];
  
  for (const route of routes) {
    try {
      const res = await fetch('http://127.0.0.1:3000' + route, {
        headers: {
            'cookie': 'session=something' // might need auth, wait I can just disable auth middleware locally for a sec
        }
      });
      const text = await res.text();
      console.log(`Route ${route}: status ${res.status}`);
      if (text.includes("Too many parameter values")) {
          console.error("FOUND IN ROUTE:", route);
          console.error(text);
      }
    } catch (e) {
      console.error(`Route ${route} fetch error:`, e.message);
    }
  }
}
testAll();
