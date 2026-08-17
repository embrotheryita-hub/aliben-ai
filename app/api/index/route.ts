import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";

function runScript(
  scriptName: "index-knowledge.js" | "create-embeddings.js"
): Promise<string> {
  return new Promise((resolve, reject) => {
    let scriptPath: string;

    if (scriptName === "index-knowledge.js") {
      scriptPath = path.join(
        process.cwd(),
        "scripts",
        "index-knowledge.js"
      );
    } else {
      scriptPath = path.join(
        process.cwd(),
        "scripts",
        "create-embeddings.js"
      );
    }

    execFile(
      process.execPath,
      [scriptPath],
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(
            `Errore ${scriptName}:`,
            stderr
          );

          reject(
            new Error(
              stderr || error.message
            )
          );

          return;
        }

        console.log(
          `${scriptName}:`
        );

        console.log(stdout);

        resolve(stdout);
      }
    );
  });
}

export async function POST() {
  try {
    console.log(
      "==================================="
    );

    console.log(
      "AVVIO INDICIZZAZIONE"
    );

    console.log(
      "==================================="
    );

    /*
      1. Estrae i PDF e aggiorna
         knowledge-cache
    */

    const knowledgeOutput =
      await runScript(
        "index-knowledge.js"
      );

    /*
      2. Crea gli embeddings
         e aggiorna SQLite
    */

    const embeddingsOutput =
      await runScript(
        "create-embeddings.js"
      );

    console.log(
      "==================================="
    );

    console.log(
      "INDICIZZAZIONE COMPLETATA"
    );

    console.log(
      "==================================="
    );

    return NextResponse.json({
      success: true,

      message:
        "Knowledge base aggiornata con successo.",

      details: {
        knowledge:
          knowledgeOutput,

        embeddings:
          embeddingsOutput,
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