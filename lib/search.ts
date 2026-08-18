import db from "./database";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type DocumentRow = {
  id: number;
  file: string;
  page: number;
  text: string;
  embedding: string;
  source_hash: string | null;
  created_at: string | null;
  category: string;
};

type MetadataRow = {
  file: string;
  category: string;
  product_name: string | null;
};

function cosineSimilarity(
  a: number[],
  b: number[]
) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const length = Math.min(
    a.length,
    b.length
  );

  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return (
    dot /
    (Math.sqrt(normA) *
      Math.sqrt(normB))
  );
}

/*
  Normalizza il testo per rendere
  confrontabili:

  - maiuscole/minuscole
  - accenti
  - punteggiatura
  - spazi multipli
*/

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Normalizzazione aggiuntiva per testi OCR/PDF.

  Alcuni PDF vengono estratti con le lettere separate:

  "M I M O S A"

  che deve poter essere riconosciuto anche come:

  "MIMOSA"
*/
function normalizeCompactText(text: string) {
  return normalizeText(text).replace(
    /\b(?:[a-z]\s+){2,}[a-z]\b/g,
    (match) => match.replace(/\s+/g, "")
  );
}

function getTokens(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter(
      (token) => token.length >= 3
    );
}

/*
  Parole poco utili per la ricerca esatta.

  Servono soprattutto per evitare che frasi
  come "dammi la ricetta con il prodotto..."
  vengano considerate una corrispondenza
  testuale forte.
*/

const STOP_WORDS = new Set([
  "dammi",
  "fammi",
  "dimmi",
  "mostrami",
  "indicami",
  "puoi",
  "posso",
  "vorrei",
  "voglio",
  "una",
  "uno",
  "un",
  "il",
  "lo",
  "la",
  "le",
  "gli",
  "i",
  "di",
  "del",
  "della",
  "dei",
  "degli",
  "da",
  "con",
  "per",
  "nel",
  "nella",
  "nei",
  "nelle",
  "che",
  "mi",
  "si",
  "su",
  "come",
  "qual",
  "quale",
  "quali",
  "cosa",
  "ho",
  "hai",
  "avete",
  "abbiamo",
]);

/*
  Ricerca delle parole della domanda
  nel nome del prodotto e nel nome file.
*/

function tokenMatchScore(
  query: string,
  productName: string,
  file: string
) {
  const queryTokens =
    getTokens(query);

  const productTokens =
    getTokens(productName);

  const fileWithoutExtension =
    file.replace(
      /\.pdf$/i,
      ""
    );

  const fileTokens =
    getTokens(
      fileWithoutExtension
    );

  if (
    queryTokens.length === 0
  ) {
    return 0;
  }

  let productMatches = 0;
  let fileMatches = 0;

  for (
    const token of queryTokens
  ) {
    if (
      productTokens.includes(token)
    ) {
      productMatches++;
    }

    if (
      fileTokens.includes(token)
    ) {
      fileMatches++;
    }
  }

  const productScore =
    productMatches /
    queryTokens.length;

  const fileScore =
    fileMatches /
    queryTokens.length;

  return (
    productScore * 0.35 +
    fileScore * 0.15
  );
}

/*
  Ricerca testuale DIRETTA nel contenuto
  della pagina.

  Questo è importante per:

  - ricette
  - nomi di prodotti
  - ingredienti
  - codici
  - nomi propri
  - termini specifici dei cataloghi
*/

function textMatchScore(
  query: string,
  text: string
) {
  const normalizedQuery =
    normalizeText(query);

  const normalizedText =
    normalizeText(text);

  const compactQuery =
    normalizeCompactText(query);

  const compactText =
    normalizeCompactText(text);

  if (
    !normalizedQuery ||
    !normalizedText
  ) {
    return 0;
  }

  const queryTokens =
    getTokens(query);

  if (queryTokens.length === 0) {
    return 0;
  }

  const textTokens =
    new Set(getTokens(text));

  let matches = 0;

  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      matches++;
    }
  }

  const tokenCoverage =
    matches / queryTokens.length;

  /*
    Controllo anche il testo "compatto"
    per gestire OCR del tipo:

    M I M O S A

    -> MIMOSA
  */

  const compactQueryTokens =
    getTokens(compactQuery);

  let compactMatches = 0;

  const compactTextTokens =
    new Set(getTokens(compactText));

  for (const token of compactQueryTokens) {
    if (compactTextTokens.has(token)) {
      compactMatches++;
    }
  }

  const compactCoverage =
    compactQueryTokens.length > 0
      ? compactMatches /
        compactQueryTokens.length
      : 0;

  /*
    Bonus per frase esatta.
  */

  let exactPhraseScore = 0;

  const meaningfulTokens =
    queryTokens.filter(
      (token) =>
        !STOP_WORDS.has(token)
    );

  if (meaningfulTokens.length >= 2) {
    for (
      let i = 0;
      i <
      meaningfulTokens.length - 1;
      i++
    ) {
      const first =
        meaningfulTokens[i];

      const second =
        meaningfulTokens[i + 1];

      const phrase =
        `${first} ${second}`;

      if (
        normalizedText.includes(
          phrase
        ) ||
        compactText.includes(
          `${first}${second}`
        )
      ) {
        exactPhraseScore = 1;
        break;
      }
    }
  }

  return Math.min(
    tokenCoverage * 0.25 +
      compactCoverage * 0.20 +
      exactPhraseScore * 0.50,
    1
  );
}

export async function searchKnowledge(
  query: string,
  limit = 8
) {
  if (!query.trim()) {
    return [];
  }

  /*
    ========================================
    INTENTO DELLA RICERCA
    ========================================

    Se l'utente chiede esplicitamente una
    scheda tecnica, non devono competere
    ricette, cataloghi o altri documenti.
  */

  const normalizedQuery =
  normalizeText(query);

const explicitlyWantsTechnicalSheet =
  /\b(scheda tecnica|scheda|specifiche tecniche|caratteristiche tecniche|documentazione tecnica)\b/
    .test(normalizedQuery);

/*
  Richieste orientate a prodotti/uso tecnico.
  Manteniamo questa informazione anche per
  il ranking, senza renderla equivalente a
  una prova tecnica di compatibilità.
*/

const wantsTechnicalProduct =
  /\b(prodotto|prodotti|quale prodotto|quali prodotti|consiglia|consigli|consigliami|utilizzare|usare|uso|migliorare|migliora|correttore|miglioratore|emulsionante|enzima|additivo|semilavorato|scheda tecnica|scheda)\b/
    .test(normalizedQuery);

const wantsRecipe =
  /\b(ricetta|ricette|dose|dosi|dosaggio|ingredienti|impasto|preparazione|preparare|procedimento|come fare|come preparo|grammi|kg|quantita)\b/
    .test(normalizedQuery);

  /*
    ========================================
    1. EMBEDDING DELLA DOMANDA
    ========================================
  */

  const response =
    await openai.embeddings.create({
      model:
        "text-embedding-3-small",
      input: query,
    });

  const queryEmbedding =
    response.data[0].embedding;

  /*
    ========================================
    2. DOCUMENTI
    ========================================
  */

  const documents =
    db.prepare(`
      SELECT
        id,
        file,
        page,
        text,
        embedding,
        source_hash,
        created_at,
        category
      FROM documents
    `).all() as DocumentRow[];

  /*
    ========================================
    3. METADATI
    ========================================
  */

  const metadataRows =
    db.prepare(`
      SELECT
        file,
        category,
        product_name
      FROM document_metadata
    `).all() as MetadataRow[];

  const metadataMap =
    new Map<string, MetadataRow>();

  for (
    const metadata of metadataRows
  ) {
    metadataMap.set(
      metadata.file,
      metadata
    );
  }

  /*
    ========================================
    4. CALCOLO RILEVANZA
    ========================================
  */

  const results =
    documents.map(
      (document) => {
        const embedding =
          JSON.parse(
            document.embedding
          ) as number[];

        /*
          A. Ricerca semantica
        */

        const semanticScore =
          cosineSimilarity(
            queryEmbedding,
            embedding
          );

        /*
          B. Nome prodotto / file
        */

        const metadata =
          metadataMap.get(
            document.file
          );

        const productName =
          metadata?.product_name ||
          document.file;

          const normalizedFileName =
  normalizeText(
    document.file.replace(
      /\.pdf$/i,
      ""
    )
  );

const normalizedProductName =
  normalizeText(productName);

const directNameMatch =
  normalizedFileName.includes(
    normalizedQuery
  ) ||
  normalizedProductName.includes(
    normalizedQuery
  );

/*
  Se la query contiene parole generiche
  come "ingredienti", "dosaggio", "allergeni",
  ecc., controlliamo anche se il nome del
  prodotto/file compare nella parte specifica
  della query.

  Esempio:

  "ingredienti mimosa eska"

  deve riconoscere:

  prodotto = "mimosa eska"
  richiesta = "ingredienti"
*/

const queryTokens =
  getTokens(query);

const genericRequestWords =
  new Set([
    "ingredienti",
    "ingrediente",
    "allergeni",
    "allergene",
    "dosaggio",
    "dose",
    "dosi",
    "conservazione",
    "caratteristiche",
    "composizione",
    "uso",
    "utilizzo",
    "procedimento",
    "preparazione",
    "ricetta",
    "ricette",
    "grammi",
    "quantita",
    "quantità",
  ]);

const productQueryTokens =
  queryTokens.filter(
    (token) =>
      !genericRequestWords.has(token)
  );

const productQuery =
  productQueryTokens.join(" ");

const directProductMatch =
  productQuery.length > 0 &&
  (
    normalizedFileName.includes(
      productQuery
    ) ||
    normalizedProductName.includes(
      productQuery
    )
  );

        const nameScore =
          tokenMatchScore(
            query,
            productName,
            document.file
          );

        /*
          C. Ricerca diretta nel testo
        */

        const contentScore =
          textMatchScore(
            query,
            document.text
          );

        /*
          D. PUNTEGGIO FINALE

          La semantica resta la componente
          principale, ma l'intento della domanda
          può correggere il ranking.

          IMPORTANTE:
          un boost di categoria NON dimostra che
          il prodotto sia tecnicamente adatto.
          Serve solo a scegliere meglio i documenti
          da passare all'AI.
        */

       let finalScore =
  semanticScore * 0.80 +
  nameScore * 0.10 +
  contentScore * 0.10;

if (directNameMatch) {
  finalScore = Math.max(
    finalScore,
    0.90
  );
}

if (directProductMatch) {
  finalScore = Math.max(
    finalScore,
    0.96
  );
}
        const category =
          (
            metadata?.category ||
            document.category ||
            "altro"
          ).toLowerCase();

        const isTechnicalSheet =
          category ===
            "schede-tecniche" ||
          category ===
            "scheda-tecnica";

        if (
          wantsTechnicalProduct &&
          isTechnicalSheet
        ) {
          finalScore += 0.12;
        }

        if (
  wantsRecipe &&
  category ===
    "ricettario" &&
  !directProductMatch
) {
  finalScore += 0.10;
}

        if (
          wantsTechnicalProduct &&
          category ===
            "ricettario" &&
          nameScore === 0 &&
          contentScore < 0.20
        ) {
          finalScore -= 0.08;
        }

        if (
          wantsRecipe &&
          isTechnicalSheet &&
          nameScore === 0 &&
          contentScore < 0.20
        ) {
          finalScore -= 0.05;
        }

        finalScore =
          Math.min(
            finalScore,
            1
          );

        return {
          file: document.file,
          page: document.page,
          text: document.text,

          score: finalScore,

          semanticScore,
          nameScore,
          contentScore,

          category,

          productName,
        };
      }
    );

  /*
    ========================================
    5. ORDINIAMO
    ========================================
  */

  results.sort(
    (a, b) =>
      b.score - a.score
  );

  /*
    ========================================
    6. CONFIDENCE GATE
    ========================================

    Un risultato può essere considerato
    forte anche quando contiene una
    corrispondenza testuale molto precisa.

    Questo è particolarmente importante
    per ricette e cataloghi.
  */

  const strongResults =
    results.filter(
      (result) =>
        result.score >= 0.60 ||
        result.contentScore >= 0.45
    );

  const mediumResults =
    results.filter(
      (result) =>
        result.score >= 0.50
    );

  let candidateResults: typeof results;

  /*
    ========================================
    RICHIESTA ESPLICITA DI SCHEDA TECNICA
    ========================================

    Se l'utente chiede "scheda tecnica",
    "scheda", "specifiche tecniche" ecc.,
    le ricette NON devono entrare nella
    selezione finale.

    Se non esiste nessuna scheda tecnica
    pertinente, restituiamo comunque []:
    sarà l'AI a dichiarare che la documentazione
    interna non contiene una scheda sufficiente,
    invece di usare una ricetta come sostituto.
  */

  if (
    explicitlyWantsTechnicalSheet
  ) {
    candidateResults =
      results.filter(
        (result) =>
          (
            result.category ===
              "schede-tecniche" ||
            result.category ===
              "scheda-tecnica"
          ) &&
          (
            result.score >= 0.50 ||
            result.nameScore > 0 ||
            result.contentScore >= 0.20
          )
      );

    candidateResults.sort(
      (a, b) =>
        b.score - a.score
    );
  } else if (
    strongResults.length > 0
  ) {
    candidateResults = [
      ...strongResults,
      ...mediumResults,
    ];
  } else {
    candidateResults =
      mediumResults;
  }

  /*
    ========================================
    7. SELEZIONE DOCUMENTI
    ========================================
  */

  const selected: typeof results =
    [];

  const pagesPerDocument =
    new Map<string, number>();

  for (
    const result of candidateResults
  ) {
    const count =
      pagesPerDocument.get(
        result.file
      ) || 0;

    /*
      Massimo 3 pagine per documento.
    */

    if (count >= 3) {
      continue;
    }

    selected.push(result);

    pagesPerDocument.set(
      result.file,
      count + 1
    );

    if (
      selected.length >= limit
    ) {
      break;
    }
  }

  /*
    ========================================
    8. LOG DIAGNOSTICO
    ========================================
  */

  console.log(
    "CONFIDENCE SEARCH:",
    {
      query,

      explicitlyWantsTechnicalSheet,

      wantsTechnicalProduct,

      wantsRecipe,

      totalResults:
        results.length,

      strongResults:
        strongResults.length,

      mediumResults:
        mediumResults.length,

      selectedResults:
        selected.length,

      topResults:
        selected.slice(0, 5).map(
          (result) => ({
            file:
              result.file,

            page:
              result.page,

            score:
              result.score,

            semantic:
              result.semanticScore,

            name:
              result.nameScore,

            content:
              result.contentScore,
          })
        ),
    }
  );

  return selected;
}