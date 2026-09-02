import { NextResponse } from "next/server";
import db from "@/lib/database";
import { createClient } from "@/lib/supabase/server";
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Non autorizzato.",
        },
        {
          status: 401,
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["admin", "agent"].includes(profile.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Accesso negato.",
        },
        {
          status: 403,
        }
      );
    }

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