import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const allowedCategories = [
  "scheda-tecnica",
  "schede-tecniche",
  "catalogo",
  "ricettario",
  "manuale",
  "altro",
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const file = searchParams.get("file");

    if (!file) {
      return NextResponse.json(
        { message: "File non specificato." },
        { status: 400 }
      );
    }

    const safeFileName = path.basename(file);

    const knowledgeFolder = path.join(
      process.cwd(),
      "knowledge"
    );

    let foundPath: string | null = null;

    for (const category of allowedCategories) {
      const possiblePath = path.join(
        knowledgeFolder,
        category,
        safeFileName
      );

      if (fs.existsSync(possiblePath)) {
        foundPath = possiblePath;
        break;
      }
    }

    if (!foundPath) {
      return NextResponse.json(
        { message: "PDF non trovato." },
        { status: 404 }
      );
    }

    const buffer = fs.readFileSync(foundPath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ERRORE APERTURA PDF:", error);

    return NextResponse.json(
      {
        message: "Errore durante l'apertura del PDF.",
      },
      {
        status: 500,
      }
    );
  }
}