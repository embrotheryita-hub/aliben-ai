import Database from "better-sqlite3";
import path from "path";

const db = new Database(
  path.join(
    process.cwd(),
    "database",
    "knowledge.db"
  )
);

/*
  Tabella principale degli embeddings
*/
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file TEXT NOT NULL,
    page INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    source_hash TEXT,
    category TEXT NOT NULL DEFAULT 'altro',
    created_at DATETIME,
    extraction_method TEXT DEFAULT 'pdf'
  );
`);

/*
  Tabella metadati documenti
*/
db.exec(`
  CREATE TABLE IF NOT EXISTS document_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'altro',
    product_name TEXT
  );
`);

/*
  MIGRAZIONI AUTOMATICHE
*/

/*
  product_name
*/
try {
  db.exec(`
    ALTER TABLE document_metadata
    ADD COLUMN product_name TEXT;
  `);
} catch {}

/*
  source_hash
*/
try {
  db.exec(`
    ALTER TABLE documents
    ADD COLUMN source_hash TEXT;
  `);
} catch {}

/*
  category
*/
try {
  db.exec(`
    ALTER TABLE documents
    ADD COLUMN category TEXT NOT NULL DEFAULT 'altro';
  `);
} catch {}

/*
  created_at
*/
try {
  db.exec(`
    ALTER TABLE documents
    ADD COLUMN created_at DATETIME;
  `);
} catch {}

/*
  extraction_method
*/
try {
  db.exec(`
    ALTER TABLE documents
    ADD COLUMN extraction_method TEXT
    DEFAULT 'pdf';
  `);
} catch {}

export default db;