const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");

async function readPdf(pdfPath) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = new Uint8Array(fs.readFileSync(pdfPath));

  const pdf = await pdfjs.getDocument({
    data,
  }).promise;

  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    const content = await page.getTextContent();

    const text = content.items
      .map((item) => item.str)
      .join(" ");

    pages.push({
      page: i,
      text,
    });
  }

  return pages;
}

async function main() {
  const knowledgeFolder = path.join(
    __dirname,
    "..",
    "knowledge"
  );

  const cacheFolder = path.join(
    __dirname,
    "..",
    "knowledge-cache"
  );

  // Crea la cartella cache se non esiste
  if (!fs.existsSync(cacheFolder)) {
    fs.mkdirSync(cacheFolder);
  }

  const files = await fg("**/*.pdf", {
    cwd: knowledgeFolder,
    absolute: true,
  });

  console.log("-----------------------------------");
  console.log("PDF trovati:", files.length);
  console.log("-----------------------------------");

  for (const file of files) {
    console.log("Leggo:", path.basename(file));

    const pages = await readPdf(file);

    const pdfData = {
      file: path.basename(file),
      pages,
    };

    const outputFile = path.join(
      cacheFolder,
      path.parse(file).name + ".json"
    );

    fs.writeFileSync(
      outputFile,
      JSON.stringify(pdfData, null, 2),
      "utf8"
    );

    console.log("Creato:", path.basename(outputFile));
  }

  console.log("");
  console.log("===================================");
  console.log("Indicizzazione completata!");
  console.log("===================================");
}

main().catch(console.error);