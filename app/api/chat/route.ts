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

La fotografia viene analizzata esclusivamente per
individuare informazioni visibili utili alla ricerca:

- nome prodotto
- marca
- codice
- testo sull'etichetta
- formato
- parole chiave
- eventuale categoria apparente

NON deve inventare dati tecnici.

Il risultato viene poi utilizzato per cercare
nella Knowledge Base ALIBEN.
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

Trasforma domande come:

"qual è il dosaggio?"
"e per la brioche?"
"ingredienti?"
"quanto ne devo mettere?"
"e questo?"

in una query autonoma utile per la Knowledge Base.
====================================================
*/

async function resolveContextualQuery(
  message: string,
  history: ChatHistoryItem[] = []
) {
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
  CASO SEMPLICE:
  "ingredienti?", "dosaggio?", ecc.
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

    Se presente una foto, GPT legge ciò che è
    effettivamente visibile.

    Questo NON è ancora il dato tecnico finale.
    Serve solamente a trovare il documento corretto.
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

    Uniamo:

    - domanda del cliente
    - continuità conversazione
    - ciò che è stato letto dalla fotografia
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

    const results =
      await searchKnowledge(
        searchQuery,
        8
      );

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
    5. COSTRUZIONE DOCUMENTAZIONE
    ==================================================
    */

    const context =
      results.length > 0
        ? results
            .map(
              (r, index) => `
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
${r.score.toFixed(4)}

CONTENUTO:
${r.text}
`
            )
            .join(
              "\n\n============================\n\n"
            )
        : "Nessuna documentazione interna pertinente trovata.";

    /*
    ==================================================
    6. FONTI INTERNE
    ==================================================
    */

    const internalSources =
      results.length > 0
        ? results
            .map(
              (r) =>
                `📄 ${r.productName} — ${r.file}, pagina ${r.page}`
            )
            .join("\n")
        : "Nessuna fonte interna pertinente.";

    /*
    ==================================================
    7. RISPOSTA FINALE
    ==================================================
    */

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

Esempio:

CLIENTE:
Qual è il dosaggio?

RISPOSTA:

Il dosaggio è **10%**.

Fonte:
📄 nome-file.pdf — pagina 2

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

NON proporre prodotti soltanto perché
il nome sembra adatto.

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

Quando il cliente chiede un elenco
di prodotti, quando disponibile mostra:

- Nome prodotto
- Codice articolo
- Marca / fornitore
- Peso / formato

========================================
MARCA E FORNITORE
========================================

Se la documentazione associa
chiaramente un prodotto a una marca
o a un fornitore, riportalo.

La marca può essere indicata:

- nella riga del prodotto;
- nell'intestazione;
- nella tabella;
- nella sezione del catalogo;
- nella pagina.

Se una marca è chiaramente associata
a una sezione del catalogo, puoi
associarla ai prodotti di quella
sezione salvo diversa indicazione.

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

Esempio:

**PREIMPASTO**

- Mix Contessa: **1000 g**
- Acqua: **500 g**
- Tuorlo d'uovo: **100 g**
- Burro: **200 g**
- Lievito di birra: **1 g**

**PROCEDIMENTO**

1. Impastare tutti gli ingredienti.
2. Lavorare fino a ottenere un impasto liscio.
3. Aggiungere il burro.
4. Lasciare lievitare secondo la fonte.

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

Infine indica la fonte.

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
FONTI INTERNE
========================================

${internalSources}

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

11. Non trasferire caratteristiche
    da un prodotto a un altro.

12. Non usare il nome del prodotto
    come prova della destinazione d'uso.

13. Non usare la similarità semantica
    come prova di compatibilità tecnica.

14. Non usare la fotografia come prova
    di dati tecnici non verificati.

15. Se la documentazione non è sufficiente,
    dichiaralo chiaramente.

16. Se il sito ufficiale ALIBEN fornisce
    informazioni utili, puoi utilizzarlo
    come fonte secondaria.

17. Mantieni sempre un tono professionale,
    semplice e pratico.

========================================
FONTI
========================================

Le fonti devono essere brevi e discrete.

Per documentazione interna:

Fonte:
📄 nome-file.pdf — pagina X

Per il sito:

Fonte:
🌐 Sito ufficiale ALIBEN — pagina del prodotto

Se utilizzi entrambe:

Fonti:
📄 nome-file.pdf — pagina X
🌐 Sito ufficiale ALIBEN — pagina del prodotto

Cita solamente le fonti realmente
utilizzate.
`,
      });

    /*
    ==================================================
    8. RISPOSTA API
    ==================================================
    */

    return NextResponse.json({
      reply:
        response.output_text ||
        "Non ho ricevuto una risposta.",
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