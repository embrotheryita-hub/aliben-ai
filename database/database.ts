import Database from "better-sqlite3";
import path from "path";

const db = new Database(
  path.join(process.cwd(), "database", "knowledge.db")
);

db.exec(`
CREATE TABLE IF NOT EXISTS documents (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    file TEXT,

    page INTEGER,

    text TEXT,

    embedding TEXT

);
`);

export default db;