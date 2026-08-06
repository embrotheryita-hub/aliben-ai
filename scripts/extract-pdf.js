const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");
const fg = require("fast-glob");

const PDF_FOLDER = path.join(__dirname, "..", "data", "pdf");
const OUTPUT = path.join(__dirname, "..", "data", "knowledge.json");

async function main() {
  const files = await fg("**/*.pdf", {
    cwd: PDF_FOLDER,
    absolute: true,
  });

  const knowledge = [];

  for (const file of files) {
    console.log("Leggo:", path.basename(file));

    const buffer = fs.readFileSync(file);
    const data = await pdf(buffer);

    knowledge.push({
      file: path.basename(file),
      text: data.text,
    });
  }

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(knowledge, null, 2),
    "utf8"
  );

  console.log("================================");
  console.log("PDF letti:", knowledge.length);
  console.log("Creato:", OUTPUT);
}

main();