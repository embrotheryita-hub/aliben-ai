import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/database";

const allowedCategories = [
  "scheda-tecnica",
  "catalogo",
  "ricettario",
  "manuale",
  "altro",
];

export async function POST(req: Request) {
  try {
    const formData =
      await req.formData();

    const file =
      formData.get("file") as File;

    const category =
      formData
        .get("category")
        ?.toString() ||
      "altro";

    if (!file) {
      return NextResponse.json(
        {
          message:
            "Nessun file ricevuto.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !allowedCategories.includes(
        category
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Categoria non valida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return NextResponse.json(
        {
          message:
            "Sono consentiti solo file PDF.",
        },
        {
          status: 400,
        }
      );
    }

    const safeFileName =
      path.basename(
        file.name
      );

    const knowledgeFolder =
      path.join(
        process.cwd(),
        "knowledge"
      );

    const categoryFolder =
      path.join(
        knowledgeFolder,
        category
      );

    // Crea la cartella categoria
    if (
      !fs.existsSync(
        categoryFolder
      )
    ) {
      fs.mkdirSync(
        categoryFolder,
        {
          recursive: true,
        }
      );
    }

    /*
      Se esiste già un PDF con lo stesso nome
      in un'altra categoria, lo rimuoviamo.
      Questo evita duplicati quando si cambia
      categoria a un documento.
    */

    for (
      const existingCategory
      of allowedCategories
    ) {
      const existingPath =
        path.join(
          knowledgeFolder,
          existingCategory,
          safeFileName
        );

      if (
        fs.existsSync(
          existingPath
        )
      ) {
        fs.unlinkSync(
          existingPath
        );
      }
    }

    const bytes =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(bytes);

    const filePath =
      path.join(
        categoryFolder,
        safeFileName
      );

    fs.writeFileSync(
      filePath,
      buffer
    );

    // Salva categoria
    db.prepare(`
      INSERT INTO document_metadata
      (file, category)
      VALUES (?, ?)
      ON CONFLICT(file)
      DO UPDATE SET
        category = excluded.category
    `).run(
      safeFileName,
      category
    );

    return NextResponse.json({
      success: true,
      message:
        `${safeFileName} caricato con successo!`,
    });

  } catch (error) {
    console.error(
      "ERRORE UPLOAD:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Errore durante il caricamento.",
      },
      {
        status: 500,
      }
    );
  }
}