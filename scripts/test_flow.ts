import db from '../server/db';

async function runTest() {
  console.log("Starting System Test (API Integration)...\n");

  // 1. Reset DB for clean test
  console.log("1. Resetting Database...");
  db.exec("DELETE FROM journal_entries");
  db.exec("DELETE FROM assets");
  db.exec("DELETE FROM transactions");
  db.exec("DELETE FROM company_settings");

  // 2. Create Company via API
  console.log("\n2. Creating Company via API...");
  const companyPayload = {
    name: "API Test SARL",
    legalForm: "SARL",
    activity: "Test Activity",
    creationDate: new Date().toISOString().split('T')[0],
    capitalAmount: 2000000,
    paidUpType: "total",
    paidAmount: 2000000,
    cashContribution: 1500000,
    kindContribution: 500000,
    constitutionCosts: 100000,
    taxRegime: "RNI",
    vatRegime: "assujetti",
    managerName: "API Manager",
    address: "Rue API",
    city: "Abidjan",
    country: "Côte d'Ivoire"
  };

  try {
    const response = await fetch('http://localhost:3000/api/company/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(companyPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("   ✅ Company created via API:", result);
  } catch (error) {
    console.error("   ❌ API Call Failed:", error);
    return;
  }

  // 3. Verify Journal Entries via DB
  console.log("\n3. Verifying Journal Entries...");
  const entries = db.prepare(`
    SELECT t.date, t.description, je.account_code, je.debit, je.credit 
    FROM journal_entries je 
    JOIN transactions t ON je.transaction_id = t.id 
    ORDER BY t.id ASC
  `).all();
  
  entries.forEach((e: any) => {
    console.log(`   - ${e.date} | ${e.account_code} | ${e.description} | D:${e.debit} | C:${e.credit}`);
  });

  // 4. Verify Trial Balance Equilibrium
  console.log("\n4. Verifying Trial Balance Equilibrium...");
  const balance = db.prepare(`
    SELECT SUM(debit) as total_debit, SUM(credit) as total_credit 
    FROM journal_entries
  `).get();

  console.log(`   Total Debit: ${balance.total_debit}`);
  console.log(`   Total Credit: ${balance.total_credit}`);

  if (Math.abs(balance.total_debit - balance.total_credit) < 0.01) {
    console.log("   ✅ Trial Balance is BALANCED.");
  } else {
    console.error("   ❌ Trial Balance is UNBALANCED!");
  }

  // 5. Verify Asset Creation
  console.log("\n5. Verifying Asset Creation...");
  const assets = db.prepare("SELECT * FROM assets").all();
  if (assets.length > 0) {
    console.log(`   ✅ ${assets.length} Asset(s) created.`);
    assets.forEach((a: any) => console.log(`   - ${a.name} (${a.type}): ${a.purchase_price}`));
  } else {
    console.error("   ❌ No assets created (Expected 1 for Kind Contribution).");
  }

  console.log("\nTest Complete.");
}

runTest().catch(console.error);
