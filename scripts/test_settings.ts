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
  
  try {
      const res = await fetch('http://127.0.0.1:3000/api/company/settings', {
        headers: { cookie: cookieString }
      });
      const text = await res.text();
      console.log(`Settings => ${res.status}`);
      if (text.includes("Too many parameter values") || res.status === 500) {
          console.error("FOUND IN ROUTE: /api/company/settings");
          console.error(text.substring(0, 300));
      }
  } catch (e) {
      console.error(e);
  }
}

testAll();
