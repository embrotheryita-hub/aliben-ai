const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const root =
  path.join(
    __dirname,
    ".."
  );

const knowledgeFolder =
  path.join(
    root,
    "knowledge"
  );

const db =
  new Database(
    path.join(
      root,
      "database",
      "knowledge.db"
    )
  );

const categories = [
  "scheda-tecnica",
  "catalogo",
  "ricettario",
  "manuale",
  "altro",
];

// Crea tutte le cartelle
for (
  const category of categories
) {
  const folder =
    path.join(
      knowledgeFolder,
      category
    );

  if (
    !fs.existsSync(folder)
  ) {
    fs.mkdirSync(
      folder,
      {
        recursive: true,
      }
    );
  }
}

// PDF presenti direttamente
// nella root knowledge/
const files =
  fs.readdirSync(
    knowledgeFolder
  );

for (const file of files) {
  if (
    !file
      .toLowerCase()
      .endsWith(".pdf")
  ) {
    continue;
  }

  const metadata =
    db.prepare(`
      SELECT category
      FROM document_metadata
      WHERE file = ?
    `).get(file);

  const category =
    metadata?.category ||
    "altro";

  const source =
    path.join(
      knowledgeFolder,
      file
    );

  const destination =
    path.join(
      knowledgeFolder,
      category,
      file
    );

  // Se per qualche motivo
  // la destinazione esiste già,
  // non sovrascriviamo.
  if (
    fs.existsSync(
      destination
    )
  ) {
    console.log(
      `Già presente: ${category}/${file}`
    );

    continue;
  }

  fs.renameSync(
    source,
    destination
  );

  console.log(
    `Spostato: ${file} → ${category}/`
  );
}

db.close();

console.log("");
console.log(
  "==================================="
);

console.log(
  "Organizzazione completata!"
);

console.log(
  "==================================="
);