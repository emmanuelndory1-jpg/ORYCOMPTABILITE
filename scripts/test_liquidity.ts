import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/dashboard/liquidity-history');
  const text = await res.text();
  console.log(res.status, text.slice(0, 100));
}
test();
