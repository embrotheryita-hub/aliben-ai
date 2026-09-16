const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve("knowledge");
const BUCKET = "knowledge-pdfs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  console.log("Controllo connessione Supabase...");
  console.log("");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("ERRORE: manca NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("ERRORE: manca SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1 });

  if (error) {
    console.error("ERRORE Supabase:");
    console.error(error.message);
    process.exit(1);
  }

  console.log("OK - connessione Supabase funzionante");
  console.log(`Bucket "${BUCKET}" raggiungibile`);
  console.log("");

  if (data && data.length > 0) {
    console.log("Il bucket contiene già almeno un elemento.");
  } else {
    console.log("Il bucket risulta vuoto.");
  }

  console.log("");
  console.log("Nessun PDF è stato caricato.");
}

function getPdfFiles(dir) {
  const results = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...getPdfFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".pdf")
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

async function uploadFiles() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Manca NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Manca SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!fs.existsSync(ROOT)) {
    throw new Error(`Cartella non trovata: ${ROOT}`);
  }

  const files = getPdfFiles(ROOT);

  console.log("");
  console.log("========================================");
  console.log("   UPLOAD KNOWLEDGE -> SUPABASE");
  console.log("========================================");
  console.log("");
  console.log(`PDF trovati: ${files.length}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log("");

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];

    const relativePath = path
      .relative(ROOT, filePath)
      .split(path.sep)
      .join("/");

    try {
      const fileBuffer = fs.readFileSync(filePath);

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(relativePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (!error) {
        uploaded++;

        console.log(
          `[${i + 1}/${files.length}] CARICATO: ${relativePath}`
        );

        continue;
      }

      const message = (error.message || "").toLowerCase();

      if (
        message.includes("already exists") ||
        message.includes("already exist") ||
        message.includes("duplicate")
      ) {
        skipped++;

        console.log(
          `[${i + 1}/${files.length}] GIÀ PRESENTE: ${relativePath}`
        );
      } else {
        errors++;

        console.error(
          `[${i + 1}/${files.length}] ERRORE: ${relativePath}`
        );

        console.error(`   ${error.message}`);
      }
    } catch (error) {
      errors++;

      console.error(
        `[${i + 1}/${files.length}] ERRORE: ${relativePath}`
      );

      console.error(`   ${error.message}`);
    }
  }

  console.log("");
  console.log("========================================");
  console.log("             COMPLETATO");
  console.log("========================================");
  console.log("");
  console.log(`Totale PDF:   ${files.length}`);
  console.log(`Caricati:     ${uploaded}`);
  console.log(`Già presenti: ${skipped}`);
  console.log(`Errori:       ${errors}`);
}

async function main() {
  if (process.argv.includes("--test")) {
    await testConnection();
    return;
  }

  await uploadFiles();
}

main().catch((error) => {
  console.error("");
  console.error("ERRORE FATALE:");
  console.error(error.message);
  process.exit(1);
});