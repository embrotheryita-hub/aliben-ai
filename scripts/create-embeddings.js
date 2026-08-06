require("dotenv").config();

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  const cacheFolder = path.join(
    __dirname,
    "..",
    "knowledge-cache"
  );

  const files = fs
    .readdirSync(cacheFolder)
    .filter(f => f.endsWith(".json"));

  const embeddings = [];

  for (const file of files) {

    console.log("Embedding:", file);

    const document = JSON.parse(
      fs.readFileSync(
        path.join(cacheFolder, file),
        "utf8"
      )
    );

    for (const page of document.pages) {

      const response =
        await client.embeddings.create({

          model: "text-embedding-3-small",

          input: page.text

        });

      embeddings.push({

        file: document.file,

        page: page.page,

        text: page.text,

        embedding: response.data[0].embedding

      });

    }

  }

  fs.writeFileSync(

    path.join(
      __dirname,
      "..",
      "embeddings.json"
    ),

    JSON.stringify(
      embeddings,
      null,
      2
    )

  );

  console.log("Embeddings creati!");
}

main();