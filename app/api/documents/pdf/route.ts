import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/database";
import { createClient } from "@supabase/supabase-js";

const categories = [
  "scheda-tecnica",
  "schede-tecniche",
  "catalogo",
  "ricettario",
  "manuale",
  "altro",
];

function findPdfFiles(
  folder: string,
  relativeFolder = ""
): string[] {
  if (!fs.existsSync(folder)) {
    return [];
  }

  const entries = fs.readdirSync(
    folder,
    {
      withFileTypes: true,
    }
  );

  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(
      folder,
      entry.name
    );

    if (entry.isDirectory()) {
      results.push(
        ...findPdfFiles(
          fullPath,
          path.join(
            relativeFolder,
            entry.name
          )
        )
      );
    }

    if (
      entry.isFile() &&
      entry.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      results.push(
        path.join(
          relativeFolder,
          entry.name
        )
      );
    }
  }

  return results;
}

function defaultProductName(
  file: string
) {
  return path
    .parse(file)
    .name
    .replace(
      /^\d+\s*[-_]\s*/,
      ""
    )
    .trim();
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findStoragePdfPath(
  fileName: string
): Promise<string | null> {
  const bucket = "knowledge-pdfs";

  const foldersToCheck = [
    "",
    "scheda-tecnica",
    "schede-tecniche",
    "catalogo",
    "ricettario",
    "manuale",
    "altro",
    "locandine",
  ];

  const pageSize = 1000;

  for (const folder of foldersToCheck) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(folder, {
          limit: pageSize,
          offset,
          sortBy: {
            column: "name",
            order: "asc",
          },
        });

      if (error) {
        console.error(
          `ERRORE LIST STORAGE (${folder || "root"}, offset ${offset}):`,
          error.message
        );
        break;
      }

      const items = data || [];

      const match = items.find(
        (item) =>
          item.name.toLowerCase() ===
          fileName.toLowerCase() &&
          !!item.metadata
      );

      if (match) {
        return folder
          ? `${folder}/${match.name}`
          : match.name;
      }

      if (items.length < pageSize) {
        break;
      }
    }
  }

  return null;
}

/*
========================================
GET DOCUMENTI / APERTURA PDF
========================================
*/

export async function GET(
  req: Request
) {
  try {
    const url = new URL(
      req.url
    );

    const requestedFile =
      url.searchParams.get(
        "file"
      );

    /*
    ----------------------------------------
    APERTURA PDF
    ----------------------------------------
    */

    if (requestedFile) {
      const safeFileName =
        path.basename(
          requestedFile.replaceAll("\\", "/")
        );

      if (!safeFileName || safeFileName === ".") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Nome file non valido.",
          },
          {
            status: 400,
          }
        );
      }

      const storagePath =
        await findStoragePdfPath(
          safeFileName
        );

      if (!storagePath) {
        return NextResponse.json(
          {
            success: false,
            message:
              "PDF non trovato su Supabase Storage.",
          },
          {
            status: 404,
          }
        );
      }

      const {
        data: pdfBlob,
        error: downloadError,
      } = await supabaseAdmin.storage
        .from("knowledge-pdfs")
        .download(storagePath);

      if (downloadError || !pdfBlob) {
        console.error(
          "ERRORE DOWNLOAD PDF:",
          downloadError?.message
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Errore nel recupero del PDF.",
          },
          {
            status: 500,
          }
        );
      }

      const pdfBuffer =
        Buffer.from(
          await pdfBlob.arrayBuffer()
        );

      return new NextResponse(
        pdfBuffer,
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/pdf",

            "Content-Disposition":
              `inline; filename="${safeFileName}"`,

            "Cache-Control":
              "private, max-age=3600",
          },
        }
      );
    }

    /*
    ----------------------------------------
    ELENCO DOCUMENTI
    ----------------------------------------
    */

    const knowledgeFolder =
      path.join(
        process.cwd(),
        "knowledge"
      );

    const files =
      findPdfFiles(
        knowledgeFolder
      );

    const documents =
      files.map(
        (relativeFile) => {
          const file =
            path.basename(
              relativeFile
            );

          const result =
            db.prepare(`
              SELECT
                COUNT(d.id) AS pages,

                CASE
                  WHEN COUNT(d.id) > 0
                  THEN 1
                  ELSE 0
                END AS indexed,

                COALESCE(
                  m.category,
                  'altro'
                ) AS category,

                m.product_name
                  AS product_name

              FROM documents d

              LEFT JOIN document_metadata m
                ON d.file = m.file

              WHERE d.file = ?
            `).get(file) as {
              pages: number;
              indexed: number;
              category: string;
              product_name:
                | string
                | null;
            };

          /*
          ------------------------------------
          Nome prodotto automatico
          ------------------------------------
          */

          const productName =
            result.product_name ||
            defaultProductName(
              file
            );

          /*
          ------------------------------------
          Salva nome automatico
          ------------------------------------
          */

          if (
            !result.product_name
          ) {
            db.prepare(`
              INSERT INTO document_metadata
              (
                file,
                category,
                product_name
              )

              VALUES (?, ?, ?)

              ON CONFLICT(file)
              DO UPDATE SET
                product_name =
                  excluded.product_name
            `).run(
              file,
              result.category,
              productName
            );
          }

          return {
            file,

            path:
              relativeFile,

            productName,

            pages:
              result.pages,

            indexed:
              result.indexed === 1,

            status:
              result.indexed === 1
                ? "indexed"
                : "pending",

            category:
              result.category,
          };
        }
      );

    return NextResponse.json({
      success: true,
      documents,
    });

  } catch (error) {
    console.error(
      "ERRORE DOCUMENTI:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Errore nel recupero dei documenti.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
========================================
PATCH DOCUMENTO

Permette di modificare:
- categoria
- nome prodotto
========================================
*/

export async function PATCH(
  req: Request
) {
  try {
    const body =
      await req.json();

    const file =
      body.file;

    const newCategory =
      body.category;

    const productName =
      body.productName;

    if (
      !file ||
      typeof file !==
        "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nome file non valido.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      newCategory &&
      !categories.includes(
        newCategory
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Categoria non valida.",
        },
        {
          status: 400,
        }
      );
    }

    const safeFileName =
      path.basename(file);

    const knowledgeFolder =
      path.join(
        process.cwd(),
        "knowledge"
      );

    const pdfFiles =
      findPdfFiles(
        knowledgeFolder
      );

    const currentRelativePath =
      pdfFiles.find(
        (pdf) =>
          path.basename(pdf) ===
          safeFileName
      );

    if (
      !currentRelativePath
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "PDF non trovato.",
        },
        {
          status: 404,
        }
      );
    }

    /*
    ----------------------------------------
    Recuperiamo metadati attuali
    ----------------------------------------
    */

    const currentMetadata =
      db.prepare(`
        SELECT
          category,
          product_name
        FROM document_metadata
        WHERE file = ?
      `).get(
        safeFileName
      ) as
        | {
            category: string;
            product_name:
              | string
              | null;
          }
        | undefined;

    const category =
      newCategory ||
      currentMetadata?.category ||
      "altro";

    const finalProductName =
      typeof productName ===
        "string" &&
      productName.trim()
        ? productName.trim()
        : currentMetadata?.product_name ||
          defaultProductName(
            safeFileName
          );

    /*
    ----------------------------------------
    Spostamento fisico PDF
    ----------------------------------------
    */

    const currentPath =
      path.join(
        knowledgeFolder,
        currentRelativePath
      );

    const destinationFolder =
      path.join(
        knowledgeFolder,
        category
      );

    const destinationPath =
      path.join(
        destinationFolder,
        safeFileName
      );

    if (
      path.resolve(
        currentPath
      ) !==
      path.resolve(
        destinationPath
      )
    ) {
      if (
        !fs.existsSync(
          destinationFolder
        )
      ) {
        fs.mkdirSync(
          destinationFolder,
          {
            recursive: true,
          }
        );
      }

      if (
        fs.existsSync(
          destinationPath
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Esiste già un PDF con questo nome nella categoria di destinazione.",
          },
          {
            status: 409,
          }
        );
      }

      fs.renameSync(
        currentPath,
        destinationPath
      );
    }

    /*
    ----------------------------------------
    Aggiorna metadati
    ----------------------------------------
    */

    db.prepare(`
      INSERT INTO document_metadata
      (
        file,
        category,
        product_name
      )

      VALUES (?, ?, ?)

      ON CONFLICT(file)
      DO UPDATE SET
        category =
          excluded.category,

        product_name =
          excluded.product_name
    `).run(
      safeFileName,
      category,
      finalProductName
    );

    /*
    ----------------------------------------
    Aggiorna categoria nelle pagine
    ----------------------------------------

    NON tocchiamo:
    - testo
    - embedding
    */

    db.prepare(`
      UPDATE documents

      SET category = ?

      WHERE file = ?
    `).run(
      category,
      safeFileName
    );

    return NextResponse.json({
      success: true,

      message:
        `${safeFileName} aggiornato correttamente.`,

      productName:
        finalProductName,

      category,
    });

  } catch (error) {
    console.error(
      "ERRORE MODIFICA DOCUMENTO:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Errore durante la modifica del documento.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
========================================
DELETE DOCUMENTO
========================================
*/

export async function DELETE(
  req: Request
) {
  try {
    const { file } =
      await req.json();

    if (
      !file ||
      typeof file !==
        "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nome file non valido.",
        },
        {
          status: 400,
        }
      );
    }

    const safeFileName =
      path.basename(file);

    /*
    ----------------------------------------
    Elimina embeddings
    ----------------------------------------
    */

    db.prepare(`
      DELETE FROM documents
      WHERE file = ?
    `).run(file);

    /*
    ----------------------------------------
    Elimina metadati
    ----------------------------------------
    */

    db.prepare(`
      DELETE FROM document_metadata
      WHERE file = ?
    `).run(file);

    /*
    ----------------------------------------
    Cerca PDF nelle sottocartelle
    ----------------------------------------
    */

    const knowledgeFolder =
      path.join(
        process.cwd(),
        "knowledge"
      );

    const pdfFiles =
      findPdfFiles(
        knowledgeFolder
      );

    const matchingPdf =
      pdfFiles.find(
        (pdf) =>
          path.basename(pdf) ===
          safeFileName
      );

    if (
      matchingPdf
    ) {
      const filePath =
        path.join(
          knowledgeFolder,
          matchingPdf
        );

      if (
        fs.existsSync(
          filePath
        )
      ) {
        fs.unlinkSync(
          filePath
        );
      }
    }

    /*
    ----------------------------------------
    Elimina cache JSON
    ----------------------------------------
    */

    const cacheFile =
      path.join(
        process.cwd(),
        "knowledge-cache",
        `${path.parse(
          safeFileName
        ).name}.json`
      );

    if (
      fs.existsSync(
        cacheFile
      )
    ) {
      fs.unlinkSync(
        cacheFile
      );
    }

    return NextResponse.json({
      success: true,
      message:
        `${safeFileName} eliminato correttamente.`,
    });

  } catch (error) {
    console.error(
      "ERRORE ELIMINAZIONE:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Errore durante l'eliminazione.",
      },
      {
        status: 500,
      }
    );
  }
}