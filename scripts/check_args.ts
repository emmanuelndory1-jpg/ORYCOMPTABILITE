import Database from 'better-sqlite3';

const db = new Database('compta.db');

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const userDb = db;

const asyncHandler = (fn: any) => async (req: any, res: any) => {
  try {
    await fn(req, res);
  } catch (err: any) {
    console.error("Caught:", err.message);
  }
};

// ... we don't need to rebuild server ... Let's just find the issue by inspecting the endpoints one by one.
