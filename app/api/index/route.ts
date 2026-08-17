import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";

function runScript(scriptName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      scriptName
    );

    execFile(
      "node",
      [scriptPath],
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Errore ${scriptName}:`, stderr);

          reject(
            new Error(
              stderr || error.message
            )
          );

          return;
        }

        console.log(`${scriptName}:`);
        console.log(stdout);

        resolve(stdout);
      }
    );
  });
}

export async function POST() {
  try {
    console.log("===================================");
    console.log("AVVIO INDICIZZAZIONE");
    console.log("===================================");

    // 1. Estrae i PDF e aggiorna knowledge.json/cache
    const knowledgeOutput =
      await runScript(
        "index-knowledge.js"
      );

    // 2. Crea gli embeddings e li salva in SQLite
    const embeddingsOutput =
      await runScript(
        "create-embeddings.js"
      );

    console.log("===================================");
    console.log("INDICIZZAZIONE COMPLETATA");
    console.log("===================================");

    return NextResponse.json({
      success: true,
      message:
        "Knowledge base aggiornata con successo.",
      details: {
        knowledge: knowledgeOutput,
        embeddings: embeddingsOutput,
      },
    });

  } catch (error) {
    console.error(
      "ERRORE INDICIZZAZIONE:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Errore durante l'indicizzazione.",
      },
      {
        status: 500,
      }
    );
  }
}