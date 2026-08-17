const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const Database = require("better-sqlite3");

async function loadPdfJs() {
  return await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );
}

async function readPdfText(pdfPath) {
  const pdfjs = await loadPdfJs();

  const data = new Uint8Array(
    fs.readFileSync(pdfPath)
  );

  const pdf = await pdfjs.getDocument({
    data,
  }).promise;

  const pages = [];

  for (
    let i = 1;
    i <= pdf.numPages;
    i++
  ) {
    const page =
      await pdf.getPage(i);

    let text = "";

    try {
      const content =
        await page.getTextContent();

      text = content.items
        .map((item) => item.str)
        .join(" ")
        .trim();
    } catch (error) {
      console.log(
        `⚠ Errore estrazione testo pagina ${i}`
      );
    }

    pages.push({
      page: i,
      text,
      extraction_method:
        text
          ? "pdf"
          : "pdf-empty",
    });
  }

  return pages;
}

async function readPdf(pdfPath) {
  /*
    ========================================
    NIENTE OCR
    ========================================

    I ricettari sono PDF con testo digitale.
    Utilizziamo solamente l'estrazione
    nativa del PDF.

    Le pagine senza testo rimangono vuote.
  */

  return await readPdfText(pdfPath);
}

function getCategoryFromPath(
  knowledgeFolder,
  filePath
) {
  const relativePath =
    path.relative(
      knowledgeFolder,
      filePath
    );

  const parts =
    relativePath.split(
      path.sep
    );

  if (
    parts.length >= 2
  ) {
    return parts[0];
  }

  return "altro";
}

async function main() {
  const knowledgeFolder =
    path.join(
      __dirname,
      "..",
      "knowledge"
    );

  const cacheFolder =
    path.join(
      __dirname,
      "..",
      "knowledge-cache"
    );

  const databasePath =
    path.join(
      __dirname,
      "..",
      "database",
      "knowledge.db"
    );

  /*
    ========================================
    CARTELLA KNOWLEDGE
    ========================================
  */

  if (
    !fs.existsSync(
      knowledgeFolder
    )
  ) {
    fs.mkdirSync(
      knowledgeFolder,
      {
        recursive: true,
      }
    );
  }

  /*
    ========================================
    CACHE
    ========================================
  */

  if (
    !fs.existsSync(
      cacheFolder
    )
  ) {
    fs.mkdirSync(
      cacheFolder,
      {
        recursive: true,
      }
    );
  }

  /*
    ========================================
    DATABASE
    ========================================
  */

  const db =
    new Database(
      databasePath
    );

  /*
    ========================================
    MIGRAZIONE AUTOMATICA
    ========================================
  */

  try {
    db.exec(`
      ALTER TABLE documents
      ADD COLUMN extraction_method TEXT
      DEFAULT 'pdf';
    `);
  } catch {}

  /*
    ========================================
    CERCA TUTTI I PDF
    ========================================
  */

  const files =
    await fg(
      "**/*.pdf",
      {
        cwd:
          knowledgeFolder,
        absolute: true,
        onlyFiles: true,
      }
    );

  console.log(
    "-----------------------------------"
  );

  console.log(
    "PDF trovati:",
    files.length
  );

  console.log(
    "-----------------------------------"
  );

  /*
    ========================================
    ELABORAZIONE
    ========================================
  */

  for (
    const file of files
  ) {
    const fileName =
      path.basename(file);

    const category =
      getCategoryFromPath(
        knowledgeFolder,
        file
      );

    console.log("");
    console.log(
      "Leggo:",
      fileName
    );

    console.log(
      "Categoria:",
      category
    );

    let pages;

    try {
      pages =
        await readPdf(file);
    } catch (error) {
      console.log(
        `❌ Impossibile leggere ${fileName}`
      );

      console.log(
        error?.message ||
          error
      );

      continue;
    }

    const pdfData = {
      file:
        fileName,
      category,
      pages,
    };

    /*
      ========================================
      CACHE JSON
      ========================================
    */

    const outputFile =
      path.join(
        cacheFolder,
        path.parse(
          fileName
        ).name +
          ".json"
      );

    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        pdfData,
        null,
        2
      ),
      "utf8"
    );

    /*
      ========================================
      METADATI
      ========================================
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
      fileName,
      category
    );

    console.log(
      "Creato:",
      path.basename(
        outputFile
      )
    );
  }

  /*
    ========================================
    CHIUSURA DATABASE
    ========================================
  */

  db.close();

  console.log("");
  console.log(
    "==================================="
  );

  console.log(
    "Indicizzazione completata!"
  );

  console.log(
    "OCR DISATTIVATO."
  );

  console.log(
    "==================================="
  );
}

main().catch(
  (error) => {
    console.error(
      "ERRORE:",
      error
    );

    process.exit(1);
  }
);