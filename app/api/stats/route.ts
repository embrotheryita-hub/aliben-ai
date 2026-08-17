import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET() {
  try {
    const stats = db
      .prepare(`
        SELECT
          COUNT(DISTINCT file) AS pdf,
          COUNT(*) AS pages,
          COUNT(
            CASE
              WHEN embedding IS NOT NULL
              AND embedding != ''
              THEN 1
            END
          ) AS indexed
        FROM documents
      `)
      .get() as {
        pdf: number;
        pages: number;
        indexed: number;
      };

    return NextResponse.json({
      pdf: stats.pdf,
      pages: stats.pages,
      indexed: stats.indexed,
    });
  } catch (error) {
    console.error("ERRORE STATISTICHE:", error);

    return NextResponse.json(
      {
        pdf: 0,
        pages: 0,
        indexed: 0,
        error: "Errore nel recupero delle statistiche.",
      },
      { status: 500 }
    );
  }
}