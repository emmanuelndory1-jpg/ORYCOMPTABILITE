import Database from 'better-sqlite3';
const db = new Database('compta.db');
const modules = db.prepare('SELECT module_key FROM modules').all();
console.log('Modules:', modules);
