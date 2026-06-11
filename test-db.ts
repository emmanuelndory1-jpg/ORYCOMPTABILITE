import Database from "better-sqlite3";

const db = new Database('database.sqlite');
try {
  const schema = db.prepare("PRAGMA table_info(company_settings)").all();
  console.log("SCHEMA:", schema.map(c => c.name));
} catch (e) {
  console.error("DB missing or error", e);
}
