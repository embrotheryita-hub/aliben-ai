import fs from "fs";
import path from "path";

type Page = {
  page: number;
  text: string;
};

type PdfDocument = {
  file: string;
  pages: Page[];
};

export function searchKnowledge(query: string) {
  const cacheFolder = path.join(
    process.cwd(),
    "knowledge-cache"
  );

  const files = fs
    .readdirSync(cacheFolder)
    .filter((file) => file.endsWith(".json"));

  const results = [];

  const search = query.toLowerCase();

  for (const file of files) {
    const document: PdfDocument = JSON.parse(
      fs.readFileSync(
        path.join(cacheFolder, file),
        "utf8"
      )
    );

    for (const page of document.pages) {
      if (page.text.toLowerCase().includes(search)) {
        results.push({
          file: document.file,
          page: page.page,
          text: page.text,
        });
      }
    }
  }

  return results;
}