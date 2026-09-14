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

/*
  MATCHING GENERALE DEL NOME PRODOTTO / FILE

  La ricerca non deve dipendere dal fatto che il cliente conosca
  esattamente il nome commerciale del prodotto.

  Gestiamo insieme:
  - corrispondenza esatta
  - corrispondenza parziale
  - singolare/plurale
  - abbreviazioni comuni
  - parole contenute una nell'altra
  - piccoli errori ortografici
  - nomi commerciali semanticamente vicini (tramite embedding,
    calcolato separatamente nel punteggio finale)

  IMPORTANTE:
  questo serve SOLO a migliorare il recupero dei candidati.
  Non dimostra la destinazione d'uso del prodotto.
*/

function normalizeSearchToken(token: string) {
  let value = normalizeText(token);

  // Gestione semplice di alcune terminazioni italiane comuni.
  // Non è uno stemmer aggressivo: evita di trasformare troppo i termini.
  if (value.length > 5 && value.endsWith("i")) {
    value = value.slice(0, -1);
  } else if (
    value.length > 5 &&
    value.endsWith("e")
  ) {
    value = value.slice(0, -1);
  } else if (
    value.length > 5 &&
    value.endsWith("o")
  ) {
    value = value.slice(0, -1);
  }

  return value;
}

function getSearchTokens(text: string) {
  return getTokens(text)
    .map(normalizeSearchToken)
    .filter(Boolean);
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;

  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from(
    { length: b.length + 1 },
    (_, i) => i
  );

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      const insertion = current[j - 1] + 1;
      const deletion = previous[j] + 1;
      const substitution =
        previous[j - 1] +
        (a[i - 1] === b[j - 1] ? 0 : 1);

      current.push(
        Math.min(
          insertion,
          deletion,
          substitution
        )
      );
    }

    for (let j = 0; j < current.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function fuzzyTokenMatch(
  queryToken: string,
  candidateToken: string
) {
  if (!queryToken || !candidateToken) {
    return 0;
  }

  if (queryToken === candidateToken) {
    return 1;
  }

  // "marg" vs "margarina", "veg" vs "vegetale", ecc.
  // Lo consideriamo solo per token sufficientemente lunghi
  // per evitare falsi positivi su parole molto corte.
  if (
    queryToken.length >= 4 &&
    candidateToken.length >= 4
  ) {
    if (
      candidateToken.startsWith(queryToken) ||
      queryToken.startsWith(candidateToken)
    ) {
      const shorter = Math.min(
        queryToken.length,
        candidateToken.length
      );
      const longer = Math.max(
        queryToken.length,
        candidateToken.length
      );

      const coverage = shorter / longer;

      if (coverage >= 0.45) {
        return 0.88;
      }
    }

    const distance =
      levenshteinDistance(
        queryToken,
        candidateToken
      );

    const maxLength = Math.max(
      queryToken.length,
      candidateToken.length
    );

    const similarity =
      1 - distance / maxLength;

    if (similarity >= 0.78) {
      return similarity;
    }
  }

  return 0;
}

/*
  ESPANSIONE BILINGUE ITALIANO / INGLESE

  Molte schede tecniche possono essere in inglese.
  La query del commerciale invece può essere in italiano.

  Non traduciamo la domanda intera: aggiungiamo varianti
  tecniche/commerciali comuni ai token della ricerca.
  In questo modo:
    burro -> butter
    lievito -> yeast
    farina -> flour
    zucchero -> sugar
    ecc.

  L'espansione serve esclusivamente al retrieval.
  Non viene usata come prova tecnica della destinazione d'uso.
*/

const BILINGUAL_SEARCH_TERMS: Record<string, string[]> = {
  burro: ["butter"],
  burri: ["butter"],
  lievito: ["yeast"],
  lieviti: ["yeast"],
  farina: ["flour"],
  farine: ["flour"],
  zucchero: ["sugar"],
  zuccheri: ["sugar"],
  sale: ["salt"],
  acqua: ["water"],
  latte: ["milk"],
  panna: ["cream"],
  crema: ["cream"],
  creme: ["cream"],
  uovo: ["egg"],
  uova: ["eggs", "egg"],
  tuorlo: ["yolk", "egg yolk"],
  albume: ["egg white", "albumen"],
  miele: ["honey"],
  cacao: ["cocoa"],
  cioccolato: ["chocolate"],
  cioccolati: ["chocolate"],
  margarina: ["margarine"],
  margarine: ["margarine"],
  vegetale: ["vegetable"],
  vegetali: ["vegetable"],
  olio: ["oil"],
  oli: ["oil"],
  grasso: ["fat"],
  grassi: ["fats", "fat"],
  emulsionante: ["emulsifier"],
  emulsionanti: ["emulsifiers", "emulsifier"],
  miglioratore: ["improver"],
  miglioratori: ["improvers", "improver"],
  enzima: ["enzyme"],
  enzimi: ["enzymes", "enzyme"],
  additivo: ["additive"],
  additivi: ["additives", "additive"],
  semilavorato: ["semi-finished", "premix"],
  semilavorati: ["semi-finished", "premixes", "premix"],
  lievitazione: ["leavening", "fermentation", "proofing"],
  impasto: ["dough", "mix"],
  impasti: ["dough", "mixes"],
  pane: ["bread"],
  pani: ["bread"],
  panificazione: ["baking", "breadmaking"],
  pizza: ["pizza"],
  pizzа: ["pizza"],
  brioche: ["brioche"],
  croissant: ["croissant"],
  grissino: ["breadstick", "breadsticks"],
  grissini: ["breadsticks", "breadstick"],
  cracker: ["cracker", "crackers"],
  crackers: ["crackers", "cracker"],
  sfoglia: ["puff pastry", "pastry"],
  pasticceria: ["pastry", "confectionery"],
  biscotto: ["biscuit", "cookie"],
  biscotti: ["biscuits", "cookies"],
  torta: ["cake"],
  torte: ["cakes"],
  dolce: ["sweet", "dessert"],
  dolci: ["sweets", "desserts"],
  glassa: ["glaze", "icing"],
  glasse: ["glazes", "icing"],
  decorazione: ["decoration"],
  decorazioni: ["decorations"],
  conservazione: ["storage"],
  ingredienti: ["ingredients"],
  ingrediente: ["ingredient"],
  allergeni: ["allergens"],
  allergene: ["allergen"],
  dosaggio: ["dosage", "dosing"],
  dose: ["dose"],
  dosi: ["doses"],
  composizione: ["composition"],
  caratteristiche: ["characteristics", "specifications"],
  utilizzo: ["use", "usage"],
  uso: ["use", "usage"],
  applicazione: ["application"],
  applicazioni: ["applications"],
};

function expandBilingualSearchTokens(
  tokens: string[]
) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    const variants =
      BILINGUAL_SEARCH_TERMS[token] || [];

    for (const variant of variants) {
      for (const variantToken of getTokens(variant)) {
        expanded.add(variantToken);
      }
    }
  }

  return Array.from(expanded);
}

function tokenMatchScore(
  query: string,
  productName: string,
  file: string
) {
  /*
    Le traduzioni sono ALTERNATIVE dello stesso concetto,
    non parole aggiuntive da contare separatamente.

    Esempio:
      burro -> [burro, butter]

    Un prodotto che contiene "butter" deve quindi ottenere
    una corrispondenza piena, non il 50%.
  */
  const queryTokens =
    getSearchTokens(query).filter(
      (token) => !STOP_WORDS.has(token)
    );

  const productTokens =
    getSearchTokens(productName);

  const fileWithoutExtension =
    file.replace(/\.pdf$/i, "");

  const fileTokens =
    getSearchTokens(fileWithoutExtension);

  if (queryTokens.length === 0) {
    return 0;
  }

  function scoreAgainst(
    candidateTokens: string[]
  ) {
    let total = 0;

    for (const queryToken of queryTokens) {
      const alternatives = [
        queryToken,
        ...(BILINGUAL_SEARCH_TERMS[
          queryToken
        ] || []).flatMap((variant) =>
          getTokens(variant)
        ),
      ];

      let best = 0;

      for (const alternative of alternatives) {
        for (const candidateToken of candidateTokens) {
          best = Math.max(
            best,
            fuzzyTokenMatch(
              alternative,
              candidateToken
            )
          );
        }
      }

      total += best;
    }

    return total / queryTokens.length;
  }

  const productScore =
    scoreAgainst(productTokens);

  const fileScore =
    scoreAgainst(fileTokens);

  return (
    productScore * 0.45 +
    fileScore * 0.20
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

/*
  MATCH GENERALE NEL CONTENUTO

  Per richieste generiche l'utente può usare una descrizione
  del prodotto, mentre il nome commerciale può essere molto
  diverso.

  Esempio:
  "margarina vegetale"

  Un PDF può avere:
  - nome commerciale: NEXT MARG PRO CK...
  - destinazione: MARGARINA AD USO PROFESSIONALE
  - ingredienti: oli e grassi vegetali...

  In questi casi il contenuto della scheda deve poter
  contribuire fortemente al recupero del prodotto.
*/

function contentIdentityScore(
  query: string,
  text: string
) {
  const queryTokens =
    getSearchTokens(query).filter(
      (token) => !STOP_WORDS.has(token)
    );

  if (!queryTokens.length || !text.trim()) {
    return 0;
  }

  const textTokens =
    getSearchTokens(text);

  let total = 0;

  for (const queryToken of queryTokens) {
    const alternatives = [
      queryToken,
      ...(BILINGUAL_SEARCH_TERMS[
        queryToken
      ] || []).flatMap((variant) =>
        getTokens(variant)
      ),
    ];

    let best = 0;

    for (const alternative of alternatives) {
      for (const textToken of textTokens) {
        best = Math.max(
          best,
          fuzzyTokenMatch(
            alternative,
            textToken
          )
        );
      }
    }

    total += best;
  }

  return total / queryTokens.length;
}

function isGenericProductQuery(query: string) {
  const tokens = getSearchTokens(query).filter(
    (token) => !STOP_WORDS.has(token)
  );

  // Una richiesta molto corta come "margarina" o "emulsionante"
  // è una ricerca di categoria/prodotto, non di un nome preciso.
  return tokens.length <= 4;
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
  Query breve di assortimento/prodotto.

  Esempi:
    "burro"
    "lievito"
    "farina"
    "margarina vegetale"

  In questi casi una scheda tecnica di prodotto
  deve avere priorita rispetto a una ricetta che
  cita casualmente lo stesso ingrediente.
*/
const broadProductLookup =
  !explicitlyWantsTechnicalSheet &&
  !wantsRecipe &&
  getSearchTokens(query).filter(
    (token) => !STOP_WORDS.has(token)
  ).length <= 4;

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

  // IMPORTANTE PER RENDER: non carichiamo tutti gli 8300+ documenti
  // in memoria con .all(). better-sqlite3 deve restituire tutte le
  // stringhe (testo + embedding) contemporaneamente e Node può andare OOM.
  // Iteriamo una riga alla volta e conserviamo solo i migliori candidati.
  const documentsStmt = db.prepare(`
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
  `);

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

  const MAX_RANKED_RESULTS = 300;
  const results: Array<{
    file: string;
    page: number;
    text: string;
    score: number;
    semanticScore: number;
    nameScore: number;
    contentScore: number;
    contentIdentity: number;
    directContentMatch: boolean;
    category: string;
    productName: string;
  }> = [];

  let totalResults = 0;
  let strongResultsCount = 0;
  let mediumResultsCount = 0;

  for (const document of documentsStmt.iterate() as Iterable<DocumentRow>) {
    totalResults++;
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
  getSearchTokens(query).filter(
    (token) =>
      !genericRequestWords.has(token)
  );

function hasProductTokenMatch(
  queryToken: string,
  candidateTokens: string[]
) {
  const alternatives = [
    queryToken,
    ...(BILINGUAL_SEARCH_TERMS[
      queryToken
    ] || []).flatMap((variant) =>
      getTokens(variant)
    ),
  ];

  return alternatives.some(
    (alternative) =>
      candidateTokens.some(
        (candidateToken) =>
          fuzzyTokenMatch(
            alternative,
            candidateToken
          ) >= 0.88
      )
  );
}

const directProductMatch =
  productQueryTokens.length > 0 &&
  (
    productQueryTokens.every(
      (queryToken) =>
        hasProductTokenMatch(
          queryToken,
          getSearchTokens(
            normalizedProductName
          )
        )
    ) ||
    productQueryTokens.every(
      (queryToken) =>
        hasProductTokenMatch(
          queryToken,
          getSearchTokens(
            normalizedFileName
          )
        )
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

        const contentIdentity =
          contentIdentityScore(
            query,
            document.text
          );

        /*
          Match diretto molto forte nel contenuto.

          È fondamentale per query brevi come:
            "burro"
            "lievito"
            "farina"

          Se la parola richiesta compare realmente nella
          scheda, non dobbiamo farla sparire perché il nome
          commerciale è completamente diverso.

          Esempio:
            query: "burro"
            nome commerciale: "Prima Italia Markenbutter 10kg"
            scheda: "IT: BURRO materia grassa 82%"
        */
        const normalizedDocumentText =
          normalizeText(document.text);

        const normalizedQueryText =
          normalizeText(query);

        const directContentMatch =
          normalizedQueryText.length >= 3 &&
          normalizedDocumentText.includes(
            normalizedQueryText
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
  semanticScore * 0.72 +
  nameScore * 0.10 +
  contentScore * 0.10;

if (directContentMatch) {
  /*
    La presenza letterale della richiesta nella scheda
    è una prova di recupero molto forte.
    Non è una prova di destinazione d'uso: quella viene
    verificata successivamente dal modello sulla fonte.
  */
  finalScore = Math.max(
    finalScore,
    0.88
  );
}

if (
  isGenericProductQuery(query) &&
  contentIdentity >= 0.75
) {
  finalScore +=
    0.10 +
    (contentIdentity - 0.75) * 0.20;
}

const generalizedNameMatch =
  tokenMatchScore(
    query,
    productName,
    document.file
  );

if (generalizedNameMatch >= 0.70) {
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
          broadProductLookup &&
          isTechnicalSheet
        ) {
          finalScore += 0.18;
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

        const result = {
          file: document.file,
          page: document.page,
          text: document.text,

          score: finalScore,

          semanticScore,
          nameScore,
          contentScore,
          contentIdentity,
          directContentMatch,

          category,

          productName,
        };

        if (finalScore >= 0.60 || contentScore >= 0.45) {
          strongResultsCount++;
        }
        if (finalScore >= 0.50) {
          mediumResultsCount++;
        }

        // Manteniamo solo i migliori candidati: il resto non può entrare
        // nella selezione finale e non deve rimanere in memoria.
        if (results.length < MAX_RANKED_RESULTS) {
          results.push(result);
          results.sort((a, b) => b.score - a.score);
        } else if (finalScore > results[results.length - 1].score) {
          results[results.length - 1] = result;
          results.sort((a, b) => b.score - a.score);
        }
  }

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

      broadProductLookup,

      totalResults,

      strongResults: strongResultsCount,

      mediumResults: mediumResultsCount,

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

            contentIdentity:
              result.contentIdentity,

            directContentMatch:
              result.directContentMatch,
          })
        ),
    }
  );

  return selected;
}