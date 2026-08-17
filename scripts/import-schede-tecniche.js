const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const sourceFolder =
  "C:\\Users\\Super\\Documents\\aliben\\da importare temporaneo";

const projectRoot = path.join(
  __dirname,
  ".."
);

const destinationFolder = path.join(
  projectRoot,
  "knowledge",
  "schede-tecniche"
);

const databasePath = path.join(
  projectRoot,
  "database",
  "knowledge.db"
);

const db = new Database(databasePath);

function main() {
  console.log("");
  console.log(
    "==================================="
  );
  console.log(
    "IMPORTAZIONE SCHEDE TECNICHE"
  );
  console.log(
    "==================================="
  );

  if (!fs.existsSync(sourceFolder)) {
    console.error(
      "ERRORE: cartella temporanea non trovata:"
    );
    console.error(sourceFolder);
    process.exit(1);
  }

  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder, {
      recursive: true,
    });
  }

  const files = fs
    .readdirSync(sourceFolder)
    .filter((file) =>
      file.toLowerCase().endsWith(".pdf")
    );

  console.log("");
  console.log(
    `PDF trovati nella cartella temporanea: ${files.length}`
  );
  console.log("");

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const sourcePath = path.join(
      sourceFolder,
      file
    );

    const destinationPath = path.join(
      destinationFolder,
      file
    );

    if (fs.existsSync(destinationPath)) {
      console.log(
        `GIÀ PRESENTE: ${file}`
      );

      skipped++;
      continue;
    }

    fs.copyFileSync(
      sourcePath,
      destinationPath
    );

    db.prepare(`
      INSERT INTO document_metadata
      (file, category)
      VALUES (?, ?)
      ON CONFLICT(file)
      DO UPDATE SET
        category = excluded.category
    `).run(
      file,
      "scheda-tecnica"
    );

    console.log(
      `✓ Importato: ${file}`
    );

    imported++;
  }

  db.close();

  console.log("");
  console.log(
    "==================================="
  );
  console.log(
    "IMPORTAZIONE COMPLETATA"
  );
  console.log(
    "==================================="
  );
  console.log(
    `Importati: ${imported}`
  );
  console.log(
    `Già presenti: ${skipped}`
  );
  console.log(
    `Totale trovati: ${files.length}`
  );
  console.log(
    "==================================="
  );
}

main();