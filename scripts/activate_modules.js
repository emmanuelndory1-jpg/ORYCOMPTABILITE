import db from '../server/db';

try {
  const company = db.prepare("SELECT id FROM company_settings LIMIT 1").get();
  if (company) {
    console.log("Found company:", company.id);

    const checkModule = db.prepare("SELECT id FROM company_modules WHERE company_id = ? AND module_key = ?");
    const insertModule = db.prepare("INSERT INTO company_modules (company_id, module_key, is_active) VALUES (?, ?, ?)");
    const updateModule = db.prepare("UPDATE company_modules SET is_active = ? WHERE company_id = ? AND module_key = ?");

    const modulesToActivate = ['payroll', 'analytics', 'audit'];

    for (const mod of modulesToActivate) {
      if (checkModule.get(company.id, mod)) {
        updateModule.run(1, company.id, mod);
      } else {
        insertModule.run(company.id, mod, 1);
      }
    }

    console.log("Modules activés avec succès!");
  } else {
    console.log("No company found.");
  }
} catch (err) {
  console.error("Error:", err);
}
