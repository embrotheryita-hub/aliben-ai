require("dotenv").config({
  path: ".env.local",
});

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const OpenAI = require("openai");

const db =
  new Database(
    path.join(
      __dirname,
      "..",
      "database",
      "knowledge.db"
    )
  );

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
  Migrazione database esistente.
*/

try {
  db.exec(`
    ALTER TABLE documents
    ADD COLUMN extraction_method TEXT
    DEFAULT 'pdf';
  `);
} catch {}

const client =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

function createHash(text) {
  return crypto
    .createHash("sha256")
    .update(
      text,
      "utf8"
    )
    .digest("hex");
}

function getExistingDocument(
  file
) {
  return db
    .prepare(`
      SELECT
        page,
        source_hash
      FROM documents
      WHERE file = ?
      ORDER BY page ASC
    `)
    .all(file);
}

function getCategory(
  file,
  document
) {
  if (document.category) {
    return document.category;
  }

  const metadata =
    db.prepare(`
      SELECT category
      FROM document_metadata
      WHERE file = ?
    `).get(file);

  return (
    metadata?.category ||
    "altro"
  );
}

function deleteDocument(
  file
) {
  db.prepare(`
    DELETE FROM documents
    WHERE file = ?
  `).run(file);
}

function isDocumentUnchanged(
  existingPages,
  currentPages
) {
  /*
    Se il numero di pagine
    non coincide, il documento
    è cambiato.
  */

  const currentNonEmptyPages =
    currentPages.filter(
      (page) =>
        page.text?.trim()
    );

  if (
    existingPages.length !==
    currentNonEmptyPages.length
  ) {
    return false;
  }

  for (
    let i = 0;
    i <
    currentNonEmptyPages.length;
    i++
  ) {
    const currentPage =
      currentNonEmptyPages[i];

    const currentText =
      currentPage.text
        ?.trim() || "";

    const currentHash =
      createHash(
        currentText
      );

    const existing =
      existingPages[i];

    if (!existing) {
      return false;
    }

    if (
      Number(
        existing.page
      ) !==
      Number(
        currentPage.page
      )
    ) {
      return false;
    }

    if (
      existing.source_hash !==
      currentHash
    ) {
      return false;
    }
  }

  return true;
}

async function main() {
  const cacheFolder =
    path.join(
      __dirname,
      "..",
      "knowledge-cache"
    );

  if (
    !fs.existsSync(
      cacheFolder
    )
  ) {
    console.log(
      "Cartella knowledge-cache non trovata."
    );

    return;
  }

  const files =
    fs
      .readdirSync(
        cacheFolder
      )
      .filter(
        (file) =>
          file.endsWith(
            ".json"
          )
      );

  console.log(
    "-----------------------------------"
  );

  console.log(
    `Documenti trovati: ${files.length}`
  );

  console.log(
    "-----------------------------------"
  );

  const insert =
    db.prepare(`
      INSERT INTO documents
      (
        file,
        page,
        text,
        embedding,
        source_hash,
        category,
        extraction_method,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

  for (const file of files) {
    console.log("");
    console.log(
      `Controllo: ${file}`
    );

    const documentPath =
      path.join(
        cacheFolder,
        file
      );

    const document =
      JSON.parse(
        fs.readFileSync(
          documentPath,
          "utf8"
        )
      );

    const currentPages =
      document.pages || [];

    const documentFile =
      document.file;

    const category =
      getCategory(
        documentFile,
        document
      );

    console.log(
      `Categoria: ${category}`
    );

    const existingPages =
      getExistingDocument(
        documentFile
      );

    /*
      DOCUMENTO GIÀ PRESENTE
    */

    if (
      existingPages.length > 0
    ) {
      const unchanged =
        isDocumentUnchanged(
          existingPages,
          currentPages
        );

      if (unchanged) {
        console.log(
          `✓ ${documentFile} già aggiornato.`
        );

        db.prepare(`
          UPDATE documents
          SET category = ?
          WHERE file = ?
        `).run(
          category,
          documentFile
        );

        continue;
      }

      console.log(
        `⚠ ${documentFile} è cambiato.`
      );

      console.log(
        "Elimino la vecchia indicizzazione..."
      );

      deleteDocument(
        documentFile
      );
    }

    /*
      NUOVO DOCUMENTO
      O DOCUMENTO MODIFICATO
    */

    console.log(
      `Indicizzazione: ${documentFile}`
    );

    for (
      const page of currentPages
    ) {
      const text =
        page.text
          ?.trim() || "";

      if (!text) {
        console.log(
          `Pagina ${page.page}: nessun testo disponibile, salto.`
        );

        continue;
      }

      const extractionMethod =
        page.extraction_method ||
        "pdf";

      if (
        extractionMethod ===
        "ocr"
      ) {
        console.log(
          `🔎 OCR: ${documentFile} - pagina ${page.page}`
        );
      } else {
        console.log(
          `Embedding: ${documentFile} - pagina ${page.page}`
        );
      }

      const hash =
        createHash(
          text
        );

      const response =
        await client.embeddings.create({
          model:
            "text-embedding-3-small",
          input:
            text,
        });

      const embedding =
        response.data[0]
          .embedding;

      insert.run(
        documentFile,
        page.page,
        text,
        JSON.stringify(
          embedding
        ),
        hash,
        category,
        extractionMethod,
        new Date().toISOString()
      );
    }

    /*
      Aggiorna metadati.
      Product name non viene toccato.
    */

    db.prepare(`
      INSERT INTO document_metadata
      (file, category)
      VALUES (?, ?)

      ON CONFLICT(file)
      DO UPDATE SET
        category =
          excluded.category
    `).run(
      documentFile,
      category
    );

    console.log(
      `✓ ${documentFile} inserito/aggiornato nel database`
    );
  }

  db.close();

  console.log("");
  console.log(
    "==================================="
  );

  console.log(
    "Indicizzazione embeddings completata!"
  );

  console.log(
    "Database SQLite aggiornato."
  );

  console.log(
    "==================================="
  );
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "ERRORE:",
      error
    );

    try {
      db.close();
    } catch {}

    process.exit(1);
  }
);