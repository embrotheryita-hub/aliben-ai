const fs = require("fs");
const path = require("path");

async function main() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const pdfPath = path.join(
    __dirname,
    "..",
    "knowledge",
    "test.pdf"
  );

  const data = new Uint8Array(fs.readFileSync(pdfPath));

  const pdf = await pdfjs.getDocument({
    data,
  }).promise;

  console.log("Pagine:", pdf.numPages);

  let testo = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    const content = await page.getTextContent();

    testo +=
      content.items
        .map((item) => item.str)
        .join(" ") + "\n\n";
  }

  console.log("================================");
  console.log(testo);
}

main().catch(console.error);