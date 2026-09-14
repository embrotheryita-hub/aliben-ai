import OpenAI from "openai";
import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/search";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatHistoryItem = {
  role?: string;
  content?: string;
};

type ImageInput = string | null;

/*
====================================================
ESTRAE IL TESTO DALLA RISPOSTA OPENAI
====================================================
*/

function responseText(response: any) {
  return response?.output_text || "";
}

/*
====================================================
FORMATTA CRONOLOGIA
====================================================
*/

function formatConversationHistory(
  history: ChatHistoryItem[] = []
) {
  if (!history.length) {
    return "Nessuna cronologia disponibile.";
  }

  return history
    .slice(-8)
    .map((item) => {
      const role =
        item.role === "assistant"
          ? "AI"
          : "CLIENTE";

      const content =
        typeof item.content === "string"
          ? item.content.slice(0, 5000)
          : "";

      return `${role}:\n${content}`;
    })
    .join(
      "\n\n============================\n\n"
    );
}

/*
====================================================
ANALISI IMMAGINE
====================================================
*/

async function analyzeImage(
  image: ImageInput,
  message: string
) {
  if (!image) {
    return "";
  }

  try {
    const visionResponse =
      await openai.responses.create({
        model: "gpt-4.1-mini",

        input: [
          {
            role: "user",

            content: [
              {
                type: "input_text",

                text: `
Sei il modulo di ANALISI VISIVA di ALIBEN AI.

Devi analizzare la fotografia allegata.

Il tuo compito NON è rispondere al cliente.

Il tuo compito è estrarre solamente gli elementi
VISIBILI nella fotografia che possono essere utili
per cercare il prodotto corretto nella Knowledge Base
ALIBEN.

Cerca soprattutto:

- nome prodotto
- marca
- codice articolo
- codice a barre se leggibile
- testo dell'etichetta
- descrizione visibile
- categoria apparente
- formato
- peso
- parole distintive
- eventuali indicazioni d'uso visibili

REGOLA FONDAMENTALE:

NON inventare informazioni.

Se un testo non è leggibile, non ricostruirlo
arbitrariamente.

Se non sei sicuro del nome del prodotto,
indicalo come possibile lettura.

NON inventare:

- dosaggi
- ingredienti
- allergeni
- ricette
- destinazioni d'uso
- caratteristiche tecniche
- certificazioni
- codici non leggibili

Queste informazioni dovranno essere verificate
successivamente nella Knowledge Base.

Se il cliente ha scritto una domanda insieme
alla fotografia, usala solamente per capire
cosa cercare.

DOMANDA DEL CLIENTE:

${message || "Il cliente ha inviato solamente una fotografia."}

Rispondi con un breve elenco di ELEMENTI VISIBILI
UTILI ALLA RICERCA.

Se non riesci a leggere nulla di utile,
scrivi:

NESSUN ELEMENTO TESTUALE UTILE RILEVATO.
`,
              },

              {
                type: "input_image",
                image_url: image,
                detail: "auto",
              },
            ],
          },
        ],
      });

    const result =
      responseText(visionResponse);

    if (!result.trim()) {
      return "";
    }

    return result.trim();
  } catch (error) {
    console.error(
      "ERRORE ANALISI IMMAGINE:",
      error
    );

    return "";
  }
}

/*
====================================================
RISOLUZIONE CONTINUITÀ CONVERSAZIONE
====================================================
*/

/*
  Query autonome di prodotto/categoria.

  Query brevi come "lievito", "farina", "margarina",
  "emulsionante" sono già autonome e non devono essere
  riscritte dal modulo di continuità.
*/
function isAutonomousProductQuery(
  message: string
) {
  const normalized =
    message
      .toLowerCase()
      .trim()
      .replace(/[?!.,;:]+$/g, "");

  if (!normalized) {
    return false;
  }

  /*
    REGOLA FONDAMENTALE:
    una domanda che contiene già un riferimento concreto
    deve arrivare alla Knowledge Base ESATTAMENTE così
    com'è stata scritta.

    In particolare non dobbiamo trasformare:
      "mimosa"
      "cornetto vegano arancia e carota"
      "cosa abbiamo per i muffin?"
      "ingredienti mimosa eska"

    in query artificiali come:
      "prodotto ALIBEN mimosa"

    La continuità viene usata solo quando la domanda è
    chiaramente una continuazione della precedente.
  */

  const exactFollowUps = new Set([
    "ingredienti",
    "ingrediente",
    "allergeni",
    "allergene",
    "dosaggio",
    "dosaggi",
    "dose",
    "dosi",
    "conservazione",
    "caratteristiche",
    "composizione",
    "uso",
    "utilizzo",
    "come si usa",
    "come usarlo",
    "quanto ne devo mettere",
    "procedimento",
    "ricetta",
    "ricette",
    "preparazione",
    "valori nutrizionali",
    "scheda tecnica",
    "scheda",
  ]);

  if (exactFollowUps.has(normalized)) {
    return false;
  }

  /* Continuazioni esplicite della domanda precedente. */
  const contextualFollowUp =
    /^(e|ed|ma)\s+(per|questo|questa|quello|quella|il|la|lo|i|gli|le)\b/i.test(normalized) ||
    /\b(di prima|del prodotto di prima|dello stesso prodotto|questo prodotto|quel prodotto|quello di prima|questa scheda|la scheda di prima)\b/i.test(normalized) ||
    /^(quanto|come|dove|con cosa)\s+(ne|lo|la|li|le|si|usarlo|usarla|usano)\b/i.test(normalized);

  if (contextualFollowUp) {
    return false;
  }

  /*
    Tutto il resto è considerato una query autonoma.
    Non facciamo una whitelist di prodotti: il catalogo ALIBEN
    può contenere migliaia di nomi e non dobbiamo conoscerli
    nel codice per poterli cercare.
  */
  return true;
}

async function resolveContextualQuery(
  message: string,
  history: ChatHistoryItem[] = []
) {
  if (
    isAutonomousProductQuery(message)
  ) {
    return message;
  }

  if (!history.length) {
    return message;
  }

  const normalizedMessage = message
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:]+$/g, "");

  const shortFollowUpWords = new Set([
    "ingredienti",
    "ingrediente",
    "allergeni",
    "allergene",
    "dosaggio",
    "dosaggi",
    "dose",
    "dosi",
    "conservazione",
    "caratteristiche",
    "composizione",
    "uso",
    "utilizzo",
    "come si usa",
    "come usarlo",
    "quanto ne devo mettere",
    "procedimento",
    "ricetta",
    "ricette",
    "preparazione",
    "valori nutrizionali",
  ]);

  const isShortFollowUp =
    shortFollowUpWords.has(
      normalizedMessage
    );

  /*
  ----------------------------------------------------
  CASO SEMPLICE
  ----------------------------------------------------
  */

  if (isShortFollowUp) {
    const previousUserMessages =
      history
        .filter(
          (item) =>
            item.role === "user" &&
            typeof item.content ===
              "string"
        )
        .map((item) =>
          item.content!.trim()
        )
        .filter(Boolean);

    let previousUserMessage = "";

    for (
      let i =
        previousUserMessages.length - 1;
      i >= 0;
      i--
    ) {
      const candidate =
        previousUserMessages[i]
          .toLowerCase()
          .replace(
            /[?!.,;:]+$/g,
            ""
          )
          .trim();

      if (
        shortFollowUpWords.has(
          candidate
        )
      ) {
        continue;
      }

      previousUserMessage =
        previousUserMessages[i];

      break;
    }

    if (previousUserMessage) {
      return `${message} ${previousUserMessage}`;
    }
  }

  /*
  ----------------------------------------------------
  CRONOLOGIA RECENTE
  ----------------------------------------------------
  */

  const recentHistory =
    history
      .slice(-8)
      .map((item) => {
        const role =
          item.role === "assistant"
            ? "AI"
            : "CLIENTE";

        const content =
          typeof item.content ===
          "string"
            ? item.content.slice(
                0,
                4000
              )
            : "";

        return `${role}: ${content}`;
      })
      .join("\n\n");

  /*
  ----------------------------------------------------
  MODELLO DI CONTINUITÀ
  ----------------------------------------------------
  */

  try {
    const resolution =
      await openai.responses.create({
        model: "gpt-4.1-mini",

        input: `
Sei un modulo di CONTINUITÀ CONVERSAZIONALE
per ALIBEN AI.

Il tuo unico compito è trasformare l'ultima
domanda del cliente in una QUERY AUTONOMA
per una ricerca nella Knowledge Base.

NON rispondere alla domanda.

NON inventare prodotti.

NON inventare informazioni tecniche.

NON aggiungere informazioni che non sono
presenti nella cronologia.

Usa la cronologia esclusivamente per
risolvere riferimenti contestuali.

Puoi risolvere riferimenti come:

- "quello"
- "questo prodotto"
- "il prodotto di prima"
- "la scheda tecnica"
- "il dosaggio"
- "quanto ne devo mettere"
- "con cosa lo sostituisco"
- "e per la brioche?"
- "e per la pizza?"
- "dammi la ricetta"
- "ingredienti?"
- "allergeni?"
- "caratteristiche?"

Se l'ultima domanda è già autonoma,
restituiscila praticamente invariata.

Se il cliente sta chiaramente continuando
a parlare dello stesso prodotto o della
stessa lavorazione, includi quel riferimento
nella query.

Esempio:

CRONOLOGIA:

CLIENTE:
Parlami del Besozzi Mix Lievitati.

AI:
È un mix per grandi lievitati...

ULTIMA DOMANDA:

Dammi la scheda tecnica.

QUERY AUTONOMA:

scheda tecnica Besozzi Mix Lievitati

Altro esempio:

CRONOLOGIA:

CLIENTE:
Sto lavorando con il Besozzi Mix Lievitati.

AI:
...

ULTIMA DOMANDA:

Qual è il dosaggio?

QUERY AUTONOMA:

dosaggio Besozzi Mix Lievitati

Altro esempio:

CRONOLOGIA:

CLIENTE:
Che prodotto abbiamo per i muffin?

AI:
Ti consiglio...

ULTIMA DOMANDA:

E per la brioche?

QUERY AUTONOMA:

prodotto ALIBEN per brioche

Se ci sono due prodotti diversi e non è
possibile capire quale sia il riferimento,
NON scegliere arbitrariamente.

In quel caso restituisci la domanda
originale.

Rispondi SOLO con la query autonoma.

NON usare virgolette.

NON aggiungere spiegazioni.

========================================
CRONOLOGIA RECENTE
========================================

${recentHistory}

========================================
ULTIMA DOMANDA
========================================

${message}
`,
      });

    const resolved =
      responseText(
        resolution
      );

    if (
      resolved &&
      resolved.trim()
    ) {
      return resolved.trim();
    }

    return message;
  } catch (error) {
    console.error(
      "ERRORE CONTINUITÀ:",
      error
    );

    return message;
  }
}

/*
====================================================
POST
====================================================
*/

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const message =
      typeof body?.message ===
      "string"
        ? body.message
        : "";

    const image: ImageInput =
      typeof body?.image ===
      "string" &&
      body.image.trim()
        ? body.image
        : null;

    const history =
      Array.isArray(
        body?.history
      )
        ? body.history
        : [];

    /*
    ==================================================
    VALIDAZIONE
    ==================================================
    */

    if (
      !message.trim() &&
      !image
    ) {
      return NextResponse.json(
        {
          reply:
            "Inserisci una domanda oppure invia una fotografia.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ==================================================
    1. ANALISI FOTOGRAFIA
    ==================================================
    */

    let imageAnalysis = "";

    if (image) {
      imageAnalysis =
        await analyzeImage(
          image,
          message
        );

      console.log(
        "ANALISI IMMAGINE:",
        imageAnalysis
      );
    }

    /*
    ==================================================
    2. RISOLUZIONE CONTESTO
    ==================================================
    */

    const contextualQuery =
      await resolveContextualQuery(
        message ||
          "Identifica il prodotto presente nella fotografia.",
        history
      );

    /*
    ==================================================
    3. COSTRUZIONE QUERY KNOWLEDGE BASE
    ==================================================
    */

    const searchQueryParts: string[] =
      [];

    if (
      contextualQuery &&
      contextualQuery.trim()
    ) {
      searchQueryParts.push(
        contextualQuery.trim()
      );
    }

    if (
      imageAnalysis &&
      imageAnalysis.trim()
    ) {
      searchQueryParts.push(
        `INFORMAZIONI VISIBILI NELLA FOTO:\n${imageAnalysis}`
      );
    }

    const searchQuery =
      searchQueryParts.join(
        "\n\n"
      );

    console.log(
      "CONTEXT QUERY:",
      {
        originalMessage:
          message,
        contextualQuery,
        imageAnalysis,
        searchQuery,
      }
    );

    /*
    ==================================================
    4. RICERCA KNOWLEDGE BASE
    ==================================================
    */

    const normalizedListQuery =
      searchQuery
        .toLowerCase()
        .trim();

    const wantsProductList =
      /\b(elenco|lista|quali|quale|cosa abbiamo|che prodotti|prodotti abbiamo|referenze|alternative)\b/
        .test(normalizedListQuery);

    const searchLimit =
      wantsProductList
        ? 40
        : 16;

    let results: Awaited<
      ReturnType<typeof searchKnowledge>
    >;

    if (wantsProductList) {
      /*
        Per gli elenchi non facciamo affidamento su una
        sola query semantica.

        Esempio:
          "elenco brioche vegane"

        Cerchiamo separatamente:
          - query completa
          - categoria/prodotto principale
          - attributo principale

        Poi uniamo i risultati eliminando i duplicati.
        Questo aumenta molto il recall quando esistono
        molte referenze simili.
      */

      const baseQuery =
        searchQuery.trim();

      const listWords =
        baseQuery
          .split(/\s+/)
          .filter(Boolean);

      const stopListWords = new Set([
        "elenco",
        "lista",
        "quali",
        "quale",
        "cosa",
        "abbiamo",
        "prodotti",
        "prodotto",
        "referenze",
        "alternative",
        "che",
        "per",
        "con",
      ]);

      const meaningfulListWords =
        listWords.filter(
          (word) =>
            !stopListWords.has(
              word.toLowerCase()
            ) &&
            word.length >= 3
        );

      const queries = [
        baseQuery,
        meaningfulListWords.join(" "),
      ];

      /*
        Per richieste di 2-4 parole aggiungiamo anche
        le singole parole significative.
      */
      for (const word of meaningfulListWords) {
        if (word.length >= 4) {
          queries.push(word);
        }
      }

      const uniqueQueries =
        Array.from(
          new Set(
            queries
              .map((q) => q.trim())
              .filter(Boolean)
          )
        ).slice(0, 5);

      const batches =
        await Promise.all(
          uniqueQueries.map((q) =>
            searchKnowledge(q, 40)
          )
        );

      const merged =
        new Map<
          string,
          Awaited<
            ReturnType<typeof searchKnowledge>
          >[number]
        >();

      for (const batch of batches) {
        for (const result of batch) {
          const key =
            `${result.file}::${result.page}`;

          const existing =
            merged.get(key);

          if (
            !existing ||
            result.score > existing.score
          ) {
            merged.set(key, result);
          }
        }
      }

      results =
        Array.from(merged.values())
          .sort(
            (a, b) =>
              (b.score || 0) -
              (a.score || 0)
          )
          .slice(0, 80);
    } else {
      results =
        await searchKnowledge(
          searchQuery,
          searchLimit
        );
    }

    console.log(
      "RISULTATI TROVATI:"
    );

    console.log(
      results.map((r) => ({
        file: r.file,
        page: r.page,
        productName:
          r.productName,
        category:
          r.category,
        score: r.score,
      }))
    );

    /*
    ==================================================
    5. MODALITÀ ELENCO PRODOTTI
    ==================================================

    IMPORTANTE:
    Per una richiesta di elenco NON lasciamo a GPT
    la decisione su quanti prodotti mostrare.

    La pipeline è:

    ricerca KB
      -> candidati tecnici
      -> verifica lessicale
      -> deduplica per file/prodotto
      -> estrazione nome prodotto
      -> elenco deterministico
      -> GPT NON decide il numero dei prodotti

    In questo modo se la KB contiene 10 referenze
    pertinenti, l'applicazione può mostrarle tutte.
    */

    function normalizeListValue(value: string) {
      return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function cleanProductLabel(value: string) {
      return value
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^[\s:;|•\-–—]+/, "")
        .replace(/[\s:;|]+$/, "")
        .trim();
    }

    function looksLikeOnlyCode(value: string) {
      const normalized = value.trim();

      if (!normalized) {
        return true;
      }

      return (
        /^\d{4,12}$/.test(normalized) ||
        /^[A-Z]?\d{4,12}$/.test(normalized)
      );
    }

    /*
      Quando productName contiene solo un codice,
      proviamo a ricavare il nome commerciale dal testo
      della prima pagina.

      Cerchiamo prima etichette esplicite tipiche delle
      schede tecniche, poi alcune righe molto informative.
    */
    function extractDisplayProductName(
      result: (typeof results)[number]
    ) {
      const rawProductName =
        cleanProductLabel(result.productName || "");

      if (
        rawProductName &&
        !looksLikeOnlyCode(rawProductName)
      ) {
        return rawProductName;
      }

      const text =
        (result.text || "")
          .replace(/\r/g, "")
          .slice(0, 5000);

      const explicitPatterns = [
        /(?:nome prodotto|product name|regulated product name|denominazione(?: del prodotto)?|prodotto|descrizione(?: prodotto)?|commercial name)\s*[:\-]\s*(.+)/i,
      ];

      for (const pattern of explicitPatterns) {
        const match = text.match(pattern);

        if (match?.[1]) {
          const candidate =
            cleanProductLabel(match[1]);

          if (
            candidate &&
            candidate.length >= 4 &&
            candidate.length <= 180 &&
            !looksLikeOnlyCode(candidate)
          ) {
            return candidate;
          }
        }
      }

      /*
        Fallback: prendiamo una riga breve e informativa.
        Evitiamo righe che sembrano solo codici, date,
        intestazioni generiche o valori tecnici.
      */
      const genericLines = text
        .split("\n")
        .map((line) =>
          cleanProductLabel(line)
        )
        .filter(Boolean);

      for (const line of genericLines) {
        const normalized =
          normalizeListValue(line);

        if (
          line.length < 5 ||
          line.length > 180 ||
          looksLikeOnlyCode(line)
        ) {
          continue;
        }

        if (
          /^(scheda tecnica|technical data sheet|pagina|page|codice|code|prodotto|product|aliben|ingredienti|ingredients|composizione|composition|allergeni|allergens)$/i.test(
            line
          )
        ) {
          continue;
        }

        if (
          /^\d+([.,]\d+)?\s*(kg|g|ml|l|%)?$/.test(
            normalized
          )
        ) {
          continue;
        }

        return line;
      }

      /*
        Ultimo fallback: nome file senza estensione.
        È comunque meglio mantenere il riferimento al
        documento che inventare un nome.
      */
      const fileName =
        cleanProductLabel(
          result.file.replace(/\.pdf$/i, "")
        );

      return fileName || rawProductName || "Prodotto";
    }

    function getListMeaningfulTokens(
      value: string
    ) {
      const stopWords = new Set([
        "elenco",
        "lista",
        "quali",
        "quale",
        "cosa",
        "abbiamo",
        "prodotti",
        "prodotto",
        "referenze",
        "alternative",
        "che",
        "per",
        "con",
        "gli",
        "delle",
        "dei",
        "del",
        "una",
        "uno",
        "un",
        "nostri",
        "nostre",
      ]);

      return Array.from(
        new Set(
          normalizeListValue(value)
            .split(/\s+/)
            .filter(
              (token) =>
                token.length >= 4 &&
                !stopWords.has(token)
            )
        )
      );
    }

    /*
      Varianti linguistiche usate SOLO per il matching.
      Non vengono mostrate al cliente e non diventano
      requisiti aggiuntivi: sono alternative.
    */
    const listTokenVariants: Record<
      string,
      string[]
    > = {
      brioche: [
        "brioche",
        "brioches",
      ],
      vegana: [
        "vegana",
        "vegane",
        "vegano",
        "vegani",
        "vegan",
      ],
      vegane: [
        "vegana",
        "vegane",
        "vegano",
        "vegani",
        "vegan",
      ],
      vegan: [
        "vegana",
        "vegane",
        "vegano",
        "vegani",
        "vegan",
      ],
      cornetto: [
        "cornetto",
        "cornetti",
      ],
      croissant: [
        "croissant",
      ],
      pane: [
        "pane",
        "bread",
      ],
      bread: [
        "pane",
        "bread",
      ],
      grissini: [
        "grissini",
        "grissino",
        "breadsticks",
      ],
      grissino: [
        "grissini",
        "grissino",
        "breadsticks",
      ],
      muffin: [
        "muffin",
      ],
      pizza: [
        "pizza",
      ],
    };

    function getVariants(token: string) {
      return listTokenVariants[token] || [token];
    }

    const listQueryTokens =
      getListMeaningfulTokens(searchQuery);

    /*
      Solo schede tecniche: per un elenco di referenze
      commerciali non vogliamo ricette/cataloghi come
      prodotti autonomi.
    */
    const technicalResults =
      results.filter(
        (result) =>
          result.file &&
          (
            result.category === "schede-tecniche" ||
            result.category === "scheda-tecnica"
          )
      );

    type ListProductCandidate = {
      result: (typeof results)[number];
      displayName: string;
      normalizedName: string;
      normalizedFile: string;
      normalizedText: string;
      matchedGroups: number;
      queryGroups: number;
      coverage: number;
      nameCoverage: number;
      relevance: number;
    };

    const listCandidates: ListProductCandidate[] = [];

    for (const result of technicalResults) {
      const displayName =
        extractDisplayProductName(result);

      const normalizedName =
        normalizeListValue(displayName);

      const normalizedFile =
        normalizeListValue(
          result.file.replace(/\.pdf$/i, "")
        );

      const normalizedProductField =
        normalizeListValue(
          result.productName || ""
        );

      const normalizedText =
        normalizeListValue(
          `${result.text || ""}`
        );

      const nameAndFile =
        `${normalizedName} ${normalizedFile} ${normalizedProductField}`;

      const allSearchableText =
        `${nameAndFile} ${normalizedText}`;

      let matchedGroups = 0;
      let nameMatchedGroups = 0;

      for (const token of listQueryTokens) {
        const variants =
          getVariants(token);

        const matchedInName =
          variants.some((variant) =>
            nameAndFile.includes(
              normalizeListValue(variant)
            )
          );

        const matchedAnywhere =
          variants.some((variant) =>
            allSearchableText.includes(
              normalizeListValue(variant)
            )
          );

        if (matchedInName) {
          nameMatchedGroups++;
        }

        if (matchedAnywhere) {
          matchedGroups++;
        }
      }

      const queryGroups =
        listQueryTokens.length;

      const coverage =
        queryGroups > 0
          ? matchedGroups / queryGroups
          : 1;

      const nameCoverage =
        queryGroups > 0
          ? nameMatchedGroups / queryGroups
          : 1;

      /*
        Relevance deterministica.

        Il nome/file pesa più del testo libero perché una
        parola come "vegana" dentro una ricetta non deve
        trasformare quella ricetta in una referenza.

        Il punteggio semantico originale resta un segnale
        secondario.
      */
      const relevance =
        coverage * 0.55 +
        nameCoverage * 0.30 +
        Math.min(
          1,
          Math.max(0, result.score || 0)
        ) * 0.15;

      /*
        Con più concetti (es. "brioche vegane") vogliamo
        entrambe le caratteristiche.

        Accettiamo:
        - tutti i concetti nel nome/file;
        - tutti nel contenuto;
        - oppure forte evidenza semantica + almeno una
          caratteristica nel nome/file.

        Non accettiamo semplicemente una singola parola
        generica.
      */
      const semanticallyStrong =
        (result.score || 0) >= 0.78;

      const clearlyRelevant =
        queryGroups <= 1
          ? coverage >= 1
          : (
              coverage >= 1 ||
              (
                coverage >= 0.5 &&
                nameCoverage >= 0.5 &&
                semanticallyStrong
              )
            );

      if (!clearlyRelevant) {
        continue;
      }

      listCandidates.push({
        result,
        displayName,
        normalizedName,
        normalizedFile,
        normalizedText,
        matchedGroups,
        queryGroups,
        coverage,
        nameCoverage,
        relevance,
      });
    }

    /*
      Deduplica:
      una stessa scheda può comparire in più pagine o in
      più ricerche. Preferiamo il candidato con evidenza
      migliore.
    */
    const dedupedListCandidates =
      new Map<string, ListProductCandidate>();

    for (const candidate of listCandidates) {
      const result = candidate.result;

      const fileKey =
        result.file.trim().toLowerCase();

      const productKey =
        candidate.normalizedName &&
        !looksLikeOnlyCode(candidate.displayName)
          ? candidate.normalizedName
          : fileKey;

      const key =
        `${fileKey}::${productKey}`;

      const existing =
        dedupedListCandidates.get(key);

      if (
        !existing ||
        candidate.relevance >
          existing.relevance
      ) {
        dedupedListCandidates.set(
          key,
          candidate
        );
      }
    }

    /*
      Una scheda tecnica = una referenza.

      Ordiniamo prima per copertura dei concetti,
      poi per presenza dei concetti nel nome,
      poi per score della ricerca.
    */
    const finalListCandidates =
      Array.from(
        dedupedListCandidates.values()
      )
        .sort(
          (a, b) =>
            b.coverage -
              a.coverage ||
            b.nameCoverage -
              a.nameCoverage ||
            b.relevance -
              a.relevance ||
            (b.result.score || 0) -
              (a.result.score || 0)
        );

    /*
      Limite alto per evitare una risposta infinita, ma
      abbastanza ampio da non perdere le numerose
      referenze di una categoria.
    */
    const listProducts =
      finalListCandidates.slice(0, 50);

    console.log(
      "CANDIDATI ELENCO DETERMINISTICO:",
      listProducts.map(
        (candidate) => ({
          product:
            candidate.displayName,
          file:
            candidate.result.file,
          score:
            candidate.result.score,
          coverage:
            candidate.coverage,
          nameCoverage:
            candidate.nameCoverage,
        })
      )
    );

    const contextResults =
      wantsProductList
        ? listProducts.map(
            (candidate) =>
              candidate.result
          )
        : results.slice(0, 16);

    const context =
      contextResults.length > 0
        ? contextResults
            .map(
              (r, index) => {
                const maxTextLength =
                  wantsProductList
                    ? 1800
                    : 12000;

                const compactText =
                  (r.text || "").slice(
                    0,
                    maxTextLength
                  );

                return `
RISULTATO ${index + 1}

PRODOTTO:
${r.productName}

FILE:
${r.file}

CATEGORIA:
${r.category}

PAGINA:
${r.page}

RILEVANZA:
${(r.score || 0).toFixed(4)}

CONTENUTO:
${compactText}
`;
              }
            )
            .join(
              "\n\n============================\n\n"
            )
        : "Nessuna documentazione interna pertinente trovata.";

    console.log(
      "CONTESTO FINALE:",
      {
        wantsProductList,
        risultatiRicerca:
          results.length,
        candidatiElenco:
          finalListCandidates.length,
        prodottiElenco:
          listProducts.length,
        risultatiPassatiAlModello:
          contextResults.length,
      }
    );

    /*
    ==================================================
    6. RISPOSTA FINALE
    ==================================================
    */

    /*
      In modalità elenco la lista è già stata costruita
      deterministicamente dal codice.

      GPT viene usato solo nelle richieste normali:
      non deve poter eliminare arbitrariamente referenze
      da un elenco.
    */
    let finalReply = "";

    if (wantsProductList) {
      if (listProducts.length === 0) {
        finalReply =
          "Non ho trovato nelle schede tecniche interne referenze chiaramente pertinenti alla richiesta.";
      } else {
        const intro =
          listProducts.length === 1
            ? "Ho trovato 1 referenza pertinente nelle schede tecniche:"
            : `Ho trovato ${listProducts.length} referenze pertinenti nelle schede tecniche:`;

        const productLines =
          listProducts.map(
            (candidate, index) =>
              `${index + 1}. ${candidate.displayName}`
          );

        finalReply =
          `${intro}\n\n${productLines.join("\n")}`;
      }
    } else {
      const response =
        await openai.responses.create({
          model: "gpt-4.1",

          input: `
Sei ALIBEN AI.

Sei l'assistente tecnico e commerciale
di ALIBEN.

Aiuti:

- commerciali ALIBEN
- panificatori
- pasticceri
- pizzaioli
- clienti professionali

========================================
REGOLA FONDAMENTALE
========================================

Per questa risposta devi utilizzare
principalmente la DOCUMENTAZIONE INTERNA
ALIBEN riportata nel contesto.

La documentazione interna è la fonte
PRIMARIA per:

- ingredienti
- dosaggi
- allergeni
- composizione
- valori nutrizionali
- caratteristiche tecniche
- modalità di utilizzo
- conservazione
- ricette
- procedimenti
- dati tecnici
- codici articolo
- marche
- fornitori
- formati

NON inventare informazioni.

NON utilizzare la conoscenza generale
del modello per colmare lacune tecniche.

NON trasferire caratteristiche da un
prodotto a un altro.

NON inventare prodotti ALIBEN.

NON inventare dosaggi.

NON inventare ingredienti.

NON inventare allergeni.

NON inventare ricette.

NON inventare codici articolo.

NON inventare marche o fornitori.

========================================
FOTOGRAFIA DEL PRODOTTO
========================================

Quando il cliente invia una fotografia,
l'analisi visiva serve solamente come
strumento di IDENTIFICAZIONE e RICERCA.

Le informazioni ricavate dalla fotografia
NON sono automaticamente dati tecnici ALIBEN.

Usa la fotografia per:

- individuare il nome del prodotto;
- individuare la marca;
- individuare il codice;
- leggere eventuale testo;
- individuare parole chiave;
- individuare il formato;
- restringere la ricerca nella Knowledge Base.

Per i dati tecnici finali devi utilizzare
la DOCUMENTAZIONE INTERNA ALIBEN.

Se la fotografia mostra chiaramente un nome
o un codice ma la Knowledge Base non contiene
documentazione sufficiente, dichiaralo.

NON inventare informazioni tecniche basandoti
solamente sulla fotografia.

NON assumere che un prodotto sia ALIBEN
solamente perché la fotografia sembra
riguardare un prodotto alimentare.

========================================
ATTENZIONE ALLA SIMILARITÀ
========================================

La similarità della ricerca NON è una
prova della destinazione d'uso.

Il fatto che un prodotto abbia un nome
simile alla richiesta del cliente NON
significa automaticamente che sia adatto.

Esempio:

Se trovi un prodotto chiamato:

"Crusca Muffin"

NON puoi concludere automaticamente
che sia destinato alla produzione
di muffin.

Devi verificare la documentazione.

Se la documentazione dice:

"pane e grissini con crusca"

questa è la destinazione d'uso
documentata.

========================================
DIVIETO DI INFERENZE
========================================

NON dedurre caratteristiche da:

- nome prodotto
- codice prodotto
- nome file
- parole contenute nel nome
- categoria generica
- somiglianza semantica
- conoscenze generali
- intuizioni commerciali
- fotografia da sola

Il nome può essere utilizzato per
CERCARE il prodotto.

Il nome NON può essere utilizzato
come PROVA della destinazione d'uso.

========================================
SITO UFFICIALE ALIBEN
========================================

Il sito ufficiale ALIBEN può essere
utilizzato come fonte SECONDARIA.

Sito ufficiale:

https://www.aliben.it/

Può essere utilizzato per verificare
o integrare soprattutto:

- destinazione d'uso
- categoria prodotto
- applicazioni
- descrizione commerciale
- prodotti disponibili
- informazioni commerciali

NON utilizzare:

- marketplace
- rivenditori
- blog
- forum
- siti concorrenti
- altre fonti esterne

Se il sito ufficiale ALIBEN non permette
di determinare una risposta, NON inventare.

========================================
RISPOSTE TECNICHE
========================================

Se il cliente chiede un dato preciso,
rispondi direttamente con quel dato.

Non aggiungere informazioni tecniche
non richieste.

========================================
RICHIESTE COMMERCIALI
========================================

Quando il cliente chiede:

"cosa posso proporre?"

"cosa mi consigli?"

"quale prodotto posso usare?"

"ho un cliente che vuole..."

"qual è il prodotto migliore?"

devi:

1. capire l'esigenza;

2. cercare nella documentazione interna;

3. verificare la destinazione d'uso
   realmente documentata;

4. se necessario verificare il sito
   ufficiale ALIBEN;

5. proporre solo prodotti realmente
   supportati dalle fonti.

Se esistono più alternative realmente
pertinenti, presentale brevemente.

IMPORTANTE:
le richieste di elenco prodotti vengono
gestite dal codice applicativo prima di
arrivare qui. Per una normale richiesta
non trasformare un prodotto in un altro
e non inventare referenze.

========================================
CODICI ARTICOLO
========================================

Quando un codice articolo è presente
nella documentazione, riportalo
ESATTAMENTE come appare.

Mantieni:

- zeri iniziali
- lettere
- numeri
- eventuali simboli

NON modificare il codice.

NON inventare codici.

========================================
MARCA E FORNITORE
========================================

Se la documentazione associa
chiaramente un prodotto a una marca
o a un fornitore, riportalo.

NON dedurre la marca dal nome.

NON usare conoscenze esterne.

NON confondere ALIBEN con il fornitore.

========================================
RICETTE
========================================

Quando la risposta riguarda:

- ricetta
- procedimento
- formulazione
- impasto
- preimpasto
- preparazione tecnica

usa Markdown.

Mantieni esattamente:

- quantità
- ingredienti
- percentuali
- temperature
- tempi
- condizioni di lavorazione

NON aggiungere informazioni
non presenti nella fonte.

========================================
STILE
========================================

Rispondi sempre in italiano.

La risposta deve essere:

- naturale
- professionale
- concreta
- breve
- facile da leggere
- orientata alla soluzione

NON parlare come un motore di ricerca.

NON riversare tutta la scheda tecnica
se il cliente non la richiede.

Dai prima la risposta diretta.

Poi aggiungi una breve spiegazione
se utile.

NON inserire una sezione "Fonte:".

NON inserire una sezione "Fonti:".

NON elencare i PDF utilizzati.

NON elencare tutti i risultati della ricerca.

La documentazione viene collegata
automaticamente dall'applicazione.

========================================
CONTINUITÀ
========================================

La cronologia serve esclusivamente
a capire il contesto della conversazione.

NON trattare la cronologia come fonte
tecnica.

Per i dati tecnici devi utilizzare
la documentazione interna disponibile
nel contesto e, quando previsto,
il sito ufficiale ALIBEN.

========================================
DOCUMENTAZIONE INTERNA
========================================

${context}

========================================
ANALISI DELLA FOTOGRAFIA
========================================

${imageAnalysis || "Nessuna fotografia allegata."}

ATTENZIONE:

L'analisi della fotografia serve
solamente per identificare e cercare
il prodotto.

NON usarla come fonte tecnica.

========================================
CRONOLOGIA CONVERSAZIONE
========================================

${formatConversationHistory(
  history
)}

========================================
QUERY UTILIZZATA
========================================

${searchQuery}

========================================
DOMANDA ATTUALE
========================================

${
  message ||
  "Il cliente ha inviato una fotografia e chiede di identificare/analizzare il prodotto."
}

========================================
REGOLE FINALI
========================================

1. Rispondi sempre in italiano.
2. Non inventare.
3. Non inventare prodotti.
4. Non inventare caratteristiche.
5. Non inventare destinazioni d'uso.
6. Non inventare dosaggi.
7. Non inventare ingredienti.
8. Non inventare allergeni.
9. Non inventare tempi o temperature.
10. Non inventare certificazioni.
11. Non trasferire caratteristiche da un prodotto a un altro.
12. Non usare il nome del prodotto come prova della destinazione d'uso.
13. Non usare la similarità semantica come prova di compatibilità tecnica.
14. Non usare la fotografia come prova di dati tecnici non verificati.
15. Se la documentazione non è sufficiente, dichiaralo chiaramente.
16. Se il sito ufficiale ALIBEN fornisce informazioni utili, puoi utilizzarlo come fonte secondaria.
17. Mantieni sempre un tono professionale, semplice e pratico.
18. NON inserire nel testo della risposta link ai PDF.
19. NON inserire elenchi di fonti.
20. NON mostrare i nomi dei file PDF.
`,
        });

      finalReply =
        response.output_text ||
        "Non ho ricevuto una risposta.";
    }

    /*
    ==================================================
    7. RISPOSTA FINALE
    ==================================================
    */

    /*
    ==================================================
    8. SCHEDE TECNICHE
    ==================================================

    Per gli elenchi usiamo ESATTAMENTE gli stessi
    candidati che abbiamo già mostrato.

    Questo elimina il vecchio problema:
    "prodotto A e B nell'elenco, ma PDF di C".

    Per le richieste normali manteniamo il matching
    sulla risposta AI.
    */

    function normalizePdfText(value: string) {
      return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const normalizedReplyForPdf =
      normalizePdfText(finalReply);

    const pdfStopWords = new Set([
      "il", "lo", "la", "i", "gli", "le",
      "un", "uno", "una",
      "di", "del", "della", "dei", "degli",
      "da", "a", "al", "alla", "ai", "agli", "alle",
      "con", "per", "nel", "nella", "nei", "nelle",
      "che", "e", "o", "come", "cosa",
    ]);

    function getPdfTokens(value: string) {
      return normalizePdfText(value)
        .split(" ")
        .filter(
          (token) =>
            token.length >= 4 &&
            !pdfStopWords.has(token)
        );
    }

    function pdfProductMatchScore(
      result: (typeof results)[number]
    ) {
      const productName =
        (result.productName || "").trim();

      const fileName =
        result.file
          .replace(/\.pdf$/i, "")
          .trim();

      if (!productName && !fileName) {
        return 0;
      }

      const normalizedProduct =
        normalizePdfText(productName);

      const normalizedFile =
        normalizePdfText(fileName);

      if (
        normalizedProduct.length >= 5 &&
        normalizedReplyForPdf.includes(
          normalizedProduct
        )
      ) {
        return 1;
      }

      if (
        normalizedFile.length >= 5 &&
        normalizedReplyForPdf.includes(
          normalizedFile
        )
      ) {
        return 0.95;
      }

      const productTokens =
        getPdfTokens(productName);

      if (productTokens.length < 2) {
        return 0;
      }

      let matches = 0;

      for (const token of productTokens) {
        if (
          normalizedReplyForPdf.includes(token)
        ) {
          matches++;
        }
      }

      const coverage =
        matches / productTokens.length;

      return coverage >= 0.80 ? 0.85 : 0;
    }

    let selectedTechnicalSheets:
      (typeof results)[number][] = [];

    if (wantsProductList) {
      /*
        FONDAMENTALE:
        i PDF dell'elenco sono gli stessi candidati
        deterministici usati per costruire la lista.
      */
      selectedTechnicalSheets =
        listProducts.map(
          (candidate) =>
            candidate.result
        );
    } else {
      const technicalResults =
        [...results]
          .filter(
            (result) =>
              result.file &&
              (
                result.category === "schede-tecniche" ||
                result.category === "scheda-tecnica"
              )
          )
          .sort(
            (a, b) =>
              (b.score || 0) -
              (a.score || 0)
          );

      const matchedTechnicalSheets =
        technicalResults
          .map((result) => ({
            result,
            matchScore:
              pdfProductMatchScore(result),
          }))
          .filter(
            ({ matchScore }) =>
              matchScore > 0
          )
          .sort(
            (a, b) =>
              b.matchScore - a.matchScore ||
              (b.result.score || 0) -
                (a.result.score || 0)
          );

      const seenTechnicalFiles =
        new Set<string>();

      const seenTechnicalProducts =
        new Set<string>();

      for (
        const { result } of matchedTechnicalSheets
      ) {
        const fileKey =
          result.file.trim().toLowerCase();

        const productKey =
          (result.productName || result.file)
            .trim()
            .toLowerCase();

        if (
          seenTechnicalFiles.has(fileKey) ||
          seenTechnicalProducts.has(productKey)
        ) {
          continue;
        }

        selectedTechnicalSheets.push(
          result
        );

        seenTechnicalFiles.add(
          fileKey
        );

        seenTechnicalProducts.add(
          productKey
        );

        if (
          selectedTechnicalSheets.length >= 3
        ) {
          break;
        }
      }
    }

    /*
    ==================================================
    9. AGGIUNTA PULSANTI PDF
    ==================================================
    */

    if (
      selectedTechnicalSheets.length > 0
    ) {
      const pdfLinks =
        selectedTechnicalSheets.map(
          (result) => {
            const pdfUrl =
              `/api/documents/pdf?file=${encodeURIComponent(
                result.file
              )}#page=${result.page}`;

            const label =
              result.productName &&
              result.productName.trim() &&
              !looksLikeOnlyCode(
                result.productName.trim()
              )
                ? result.productName.trim()
                : extractDisplayProductName(
                    result
                  );

            return `[📄 ${label} — pagina ${result.page}](${pdfUrl})`;
          }
        );

      finalReply +=
        `\n\n${pdfLinks.join("\n")}`;
    }

    /*
    ==================================================
    10. RISPOSTA API
    ==================================================
    */

    return NextResponse.json({
      reply: finalReply,
    });
  } catch (error) {
    console.error(
      "ERRORE CHAT:",
      error
    );

    return NextResponse.json(
      {
        reply:
          "Errore durante l'elaborazione della richiesta.",
      },
      {
        status: 500,
      }
    );
  }
}