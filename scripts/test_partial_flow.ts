import db from '../server/db';

async function runTest() {
  console.log("Starting Partial Liberation System Test...\n");

  // 1. Reset DB
  console.log("1. Resetting Database...");
  db.exec("DELETE FROM journal_entries");
  db.exec("DELETE FROM assets");
  db.exec("DELETE FROM transactions");
  db.exec("DELETE FROM company_settings");

  // 2. Create Company via API (Partial)
  console.log("\n2. Creating Company via API (Partial)...");
  const companyPayload = {
    name: "Partial Test SARL",
    legalForm: "SARL",
    activity: "Test Activity",
    creationDate: new Date().toISOString().split('T')[0],
    capitalAmount: 10000000, // 10M
    paidUpType: "partial",
    paidAmount: 3000000, // 3M Cash Paid
    cashContribution: 6000000, // 6M Cash Total
    kindContribution: 4000000, // 4M Kind Total
    constitutionCosts: 0,
    taxRegime: "RNI",
    vatRegime: "assujetti",
    managerName: "Partial Manager",
    address: "Rue Partial",
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

  // 3. Verify Journal Entries
  console.log("\n3. Verifying Journal Entries...");
  const entries = db.prepare(`
    SELECT t.date, t.description, je.account_code, je.debit, je.credit 
    FROM journal_entries je 
    JOIN transactions t ON je.transaction_id = t.id 
    ORDER BY t.id ASC, je.rowid ASC
  `).all();
  
  entries.forEach((e: any) => {
    console.log(`   - ${e.date} | ${e.account_code} | ${e.description} | D:${e.debit} | C:${e.credit}`);
  });

  // 4. Verify Account 109 Balance
  console.log("\n4. Verifying Account 109 Balance (Uncalled Capital)...");
  const balance109 = db.prepare(`
    SELECT SUM(debit) - SUM(credit) as balance 
    FROM journal_entries 
    WHERE account_code = '109'
  `).get();
  
  console.log(`   Account 109 Balance: ${balance109.balance} FCFA`);
  const expectedBalance = 3000000; // 6M Cash - 3M Paid
  if (balance109.balance === expectedBalance) {
    console.log("   ✅ Account 109 Balance is CORRECT.");
  } else {
    console.error(`   ❌ Account 109 Balance is INCORRECT (Expected ${expectedBalance}).`);
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
