import OpenAI from "openai";
import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/search";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // Cerca nei documenti
    const results = searchKnowledge(message);

    console.log("RISULTATI TROVATI:");
    console.log(results);

    // Costruisce il contesto da passare a GPT
    const context = results
      .slice(0, 3)
      .map(
        (r: { file: string; page: number; text: string }) => `
FILE: ${r.file}
PAGINA: ${r.page}

${r.text}
`
      )
      .join("\n\n-------------------------\n\n");

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
Sei ALIBEN AI.

Sei il responsabile tecnico e commerciale dell'azienda Aliben.

Devi rispondere utilizzando PRIMA la documentazione fornita.

REGOLE:

- Se la documentazione contiene la risposta, usa SOLO quella.
- Non inventare prodotti Aliben.
- Se la documentazione non è sufficiente, dichiaralo chiaramente.
- Rispondi sempre in italiano.
- Se possibile cita il nome del file e la pagina.

==========================
DOCUMENTAZIONE
==========================

${context}

==========================
DOMANDA CLIENTE
==========================

${message}
`,
    });

    return NextResponse.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error("ERRORE OPENAI:", error);

    return NextResponse.json(
      {
        reply: "Errore durante la chiamata a OpenAI.",
      },
      { status: 500 }
    );
  }
}