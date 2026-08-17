"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type Stats = {
  pdf: number;
  pages: number;
  indexed: number;
};

type DocumentItem = {
  file: string;
  path?: string;
  productName: string;
  pages: number;
  indexed: boolean;
  status: "indexed" | "pending";
  category: string;
};

const categories = [
  {
    value: "schede-tecniche",
    label: "📋 Schede tecniche",
  },
  {
    value: "catalogo",
    label: "📚 Catalogo",
  },
  {
    value: "ricettario",
    label: "🥖 Ricettario",
  },
  {
    value: "manuale",
    label: "📖 Manuale",
  },
  {
    value: "altro",
    label: "📦 Altro",
  },
];

export default function AdminPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [uploading, setUploading] =
    useState(false);

  const [indexing, setIndexing] =
    useState(false);

  const [deleting, setDeleting] =
    useState<string | null>(null);

  const [
    editingCategory,
    setEditingCategory,
  ] = useState<string | null>(null);

  const [
    editingProduct,
    setEditingProduct,
  ] = useState<string | null>(null);

  const [category, setCategory] =
    useState("schede-tecniche");

  const [search, setSearch] =
    useState("");

  const [
    filterCategory,
    setFilterCategory,
  ] = useState("tutte");

  const [stats, setStats] =
    useState<Stats>({
      pdf: 0,
      pages: 0,
      indexed: 0,
    });

  const [documents, setDocuments] =
    useState<DocumentItem[]>([]);

  async function loadStats() {
    try {
      const res = await fetch(
        "/api/stats",
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Errore caricamento statistiche"
        );
      }

      const data = await res.json();

      setStats({
        pdf: data.pdf ?? 0,
        pages: data.pages ?? 0,
        indexed: data.indexed ?? 0,
      });
    } catch (error) {
      console.error(
        "ERRORE STATISTICHE:",
        error
      );
    }
  }

  async function loadDocuments() {
    try {
      const res = await fetch(
        "/api/documents",
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Errore caricamento documenti"
        );
      }

      const data = await res.json();

      setDocuments(
        data.documents ?? []
      );
    } catch (error) {
      console.error(
        "ERRORE DOCUMENTI:",
        error
      );
    }
  }

  async function refreshDashboard() {
    await Promise.all([
      loadStats(),
      loadDocuments(),
    ]);
  }

  useEffect(() => {
    refreshDashboard();
  }, []);

  /*
    Determina lo stato visualizzato.
  */
  function getDocumentStatus(
    document: DocumentItem
  ) {
    if (document.indexed) {
      return "indexed";
    }

    /*
      Se il PDF ha una cache JSON con
      tutte le pagine OCR vuote,
      lo consideriamo una scansione
      non leggibile.
    */

    return "pending";
  }

  /*
    UPLOAD
  */
  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "category",
        category
      );

      const res = await fetch(
        "/api/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        alert(
          data.message ||
            "Errore durante il caricamento."
        );

        return;
      }

      alert(data.message);

      await refreshDashboard();
    } catch (error) {
      console.error(
        "ERRORE UPLOAD:",
        error
      );

      alert(
        "Errore durante il caricamento del PDF."
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  /*
    INDICIZZAZIONE
  */
  async function handleIndex() {
    if (indexing) return;

    setIndexing(true);

    try {
      const res = await fetch(
        "/api/index",
        {
          method: "POST",
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        alert(
          data.message ||
            "Errore durante l'indicizzazione."
        );

        return;
      }

      alert(
        "✅ Knowledge base aggiornata!"
      );

      await refreshDashboard();

      console.log(
        "RISULTATO INDICIZZAZIONE:",
        data
      );
    } catch (error) {
      console.error(
        "ERRORE INDICIZZAZIONE:",
        error
      );

      alert(
        "Errore durante l'indicizzazione."
      );
    } finally {
      setIndexing(false);
    }
  }

  /*
    MODIFICA CATEGORIA
  */
  async function handleCategoryChange(
    file: string,
    newCategory: string
  ) {
    if (
      editingCategory ||
      editingProduct
    ) {
      return;
    }

    setEditingCategory(file);

    try {
      const res = await fetch(
        "/api/documents",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            file,
            category:
              newCategory,
          }),
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        alert(
          data.message ||
            "Errore durante la modifica della categoria."
        );

        return;
      }

      await refreshDashboard();
    } catch (error) {
      console.error(
        "ERRORE MODIFICA CATEGORIA:",
        error
      );

      alert(
        "Errore durante la modifica della categoria."
      );
    } finally {
      setEditingCategory(null);
    }
  }

  /*
    MODIFICA NOME PRODOTTO
  */
  async function handleProductNameChange(
    file: string,
    currentName: string
  ) {
    if (
      editingCategory ||
      editingProduct
    ) {
      return;
    }

    const newName =
      window.prompt(
        "Inserisci il nome del prodotto:",
        currentName
      );

    if (newName === null) {
      return;
    }

    const trimmedName =
      newName.trim();

    if (!trimmedName) {
      alert(
        "Il nome del prodotto non può essere vuoto."
      );

      return;
    }

    if (
      trimmedName ===
      currentName
    ) {
      return;
    }

    setEditingProduct(file);

    try {
      const res = await fetch(
        "/api/documents",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            file,
            productName:
              trimmedName,
          }),
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        alert(
          data.message ||
            "Errore durante la modifica del nome."
        );

        return;
      }

      await refreshDashboard();
    } catch (error) {
      console.error(
        "ERRORE MODIFICA NOME:",
        error
      );

      alert(
        "Errore durante la modifica del nome prodotto."
      );
    } finally {
      setEditingProduct(null);
    }
  }

  /*
    ELIMINAZIONE
  */
  async function handleDelete(
    file: string
  ) {
    const confirmed =
      window.confirm(
        `Vuoi davvero eliminare "${file}"?\n\nIl documento verrà rimosso dalla knowledge base e dalla cartella dei PDF.`
      );

    if (!confirmed) {
      return;
    }

    setDeleting(file);

    try {
      const res = await fetch(
        "/api/documents",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            file,
          }),
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        alert(
          data.message ||
            "Errore durante l'eliminazione."
        );

        return;
      }

      alert(data.message);

      await refreshDashboard();
    } catch (error) {
      console.error(
        "ERRORE ELIMINAZIONE:",
        error
      );

      alert(
        "Errore durante l'eliminazione."
      );
    } finally {
      setDeleting(null);
    }
  }

  /*
    RICERCA + FILTRO
  */
  const filteredDocuments =
    documents.filter(
      (document) => {
        const searchText =
          search
            .toLowerCase()
            .trim();

        const matchesSearch =
          !searchText ||
          document.file
            .toLowerCase()
            .includes(
              searchText
            ) ||
          document.productName
            .toLowerCase()
            .includes(
              searchText
            );

        const matchesCategory =
          filterCategory ===
            "tutte" ||
          document.category ===
            filterCategory;

        return (
          matchesSearch &&
          matchesCategory
        );
      }
    );

  return (
    <main className="min-h-screen bg-gray-100 p-8">

      <h1 className="mb-8 text-4xl font-bold">
        ALIBEN AI - Dashboard
      </h1>

      {/* CARICAMENTO / INDICIZZAZIONE / STATISTICHE */}

      <div className="grid gap-6 md:grid-cols-4">

        {/* DOCUMENTI */}

        <div className="rounded-xl bg-white p-6 shadow">

          <h2 className="text-2xl font-semibold">
            📄 Documenti
          </h2>

          <p className="mt-3 text-gray-600">
            Carica schede tecniche,
            cataloghi, ricettari e
            manuali.
          </p>

          <label className="mt-6 block text-sm font-medium text-gray-700">
            Tipo documento
          </label>

          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value
              )
            }
            disabled={uploading}
            className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2"
          >
            {categories.map(
              (item) => (
                <option
                  key={
                    item.value
                  }
                  value={
                    item.value
                  }
                >
                  {item.label}
                </option>
              )
            )}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={
              handleUpload
            }
          />

          <button
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={uploading}
            className="mt-6 rounded bg-red-700 px-4 py-2 text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Caricamento..."
              : "Carica PDF"}
          </button>

        </div>

        {/* INDICIZZAZIONE */}

        <div className="rounded-xl bg-white p-6 shadow">

          <h2 className="text-2xl font-semibold">
            🧠 Indicizzazione
          </h2>

          <p className="mt-3 text-gray-600">
            Aggiorna la knowledge base
            con i documenti caricati.
          </p>

          <button
            onClick={
              handleIndex
            }
            disabled={indexing}
            className="mt-6 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {indexing
              ? "Indicizzazione..."
              : "Indicizza"}
          </button>

          {indexing && (
            <p className="mt-3 text-sm text-gray-500">
              Sto elaborando i
              documenti...
            </p>
          )}

        </div>

        {/* STATISTICHE */}

        <div className="rounded-xl bg-white p-6 shadow">

          <h2 className="text-2xl font-semibold">
            📊 Statistiche
          </h2>

          <ul className="mt-4 space-y-2">

            <li>
              📄 PDF:{" "}
              <strong>
                {stats.pdf}
              </strong>
            </li>

            <li>
              📑 Pagine:{" "}
              <strong>
                {stats.pages}
              </strong>
            </li>

            <li>
              🧠 Indicizzati:{" "}
              <strong>
                {stats.indexed}
              </strong>
            </li>

          </ul>

        </div>

        {/* CLIENTI */}

        <div className="rounded-xl bg-white p-6 shadow">

          <h2 className="text-2xl font-semibold">
            👥 Clienti
          </h2>

          <p className="mt-3 text-gray-600">
            Gestisci i clienti e apri
            direttamente le conversazioni
            con ALIBEN AI.
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.href =
                "/clienti";
            }}
            className="mt-6 rounded bg-red-700 px-4 py-2 text-white hover:bg-red-800"
          >
            👥 Apri Clienti
          </button>

        </div>

      </div>

      {/* LISTA DOCUMENTI */

      <section className="mt-8 rounded-xl bg-white p-6 shadow">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <h2 className="text-2xl font-semibold">
              📚 Documenti
            </h2>

            <p className="mt-1 text-gray-500">
              Gestisci i documenti
              della knowledge base.
            </p>

          </div>

          <button
            onClick={
              refreshDashboard
            }
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
          >
            🔄 Aggiorna
          </button>

        </div>

        {/* RICERCA E FILTRO */}

        <div className="mt-6 grid gap-3 md:grid-cols-2">

          <input
            type="text"
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="🔍 Cerca per nome file o prodotto..."
            className="w-full rounded border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
          />

          <select
            value={
              filterCategory
            }
            onChange={(
              event
            ) =>
              setFilterCategory(
                event.target.value
              )
            }
            className="w-full rounded border border-gray-300 bg-white px-4 py-3"
          >

            <option value="tutte">
              🗂️ Tutte le categorie
            </option>

            {categories.map(
              (item) => (
                <option
                  key={
                    item.value
                  }
                  value={
                    item.value
                  }
                >
                  {item.label}
                </option>
              )
            )}

          </select>

        </div>

        <div className="mt-4 text-sm text-gray-500">

          Visualizzati{" "}

          <strong>
            {
              filteredDocuments.length
            }
          </strong>{" "}

          di{" "}

          <strong>
            {
              documents.length
            }
          </strong>{" "}

          documenti

        </div>

        {/* LISTA */}

        <div className="mt-4">

          {documents.length ===
          0 ? (

            <p className="py-6 text-gray-500">
              Nessun PDF caricato.
            </p>

          ) : filteredDocuments.length ===
            0 ? (

            <div className="rounded-lg bg-gray-50 p-6 text-center text-gray-500">
              Nessun documento trovato
              con i filtri selezionati.
            </div>

          ) : (

            <div className="divide-y">

              {filteredDocuments.map(
                (document) => {

                  const status =
                    getDocumentStatus(
                      document
                    );

                  return (
                    <div
                      key={
                        document.file
                      }
                      className="flex items-center justify-between gap-4 py-4"
                    >

                      <div className="min-w-0">

                        <p className="truncate font-medium">
                          📄{" "}
                          {
                            document.file
                          }
                        </p>

                        <div className="mt-1 flex items-center gap-2">

                          <span className="text-sm text-gray-500">
                            🏷️
                          </span>

                          <button
                            onClick={() =>
                              handleProductNameChange(
                                document.file,
                                document.productName
                              )
                            }
                            disabled={
                              editingProduct ===
                                document.file ||
                              editingCategory !==
                                null
                            }
                            className="text-left text-sm font-medium text-gray-700 hover:text-blue-600 hover:underline disabled:cursor-not-allowed"
                          >
                            {
                              editingProduct ===
                              document.file
                                ? "Salvataggio..."
                                : document.productName
                            }
                          </button>

                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">

                          <select
                            value={
                              document.category
                            }
                            disabled={
                              editingCategory ===
                                document.file ||
                              editingProduct !==
                                null
                            }
                            onChange={(
                              event
                            ) =>
                              handleCategoryChange(
                                document.file,
                                event.target
                                  .value
                              )
                            }
                            className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-sm text-gray-700"
                          >

                            {categories.map(
                              (item) => (
                                <option
                                  key={
                                    item.value
                                  }
                                  value={
                                    item.value
                                  }
                                >
                                  {
                                    item.label
                                  }
                                </option>
                              )
                            )}

                          </select>

                          {editingCategory ===
                            document.file && (
                            <span className="text-gray-500">
                              Salvataggio...
                            </span>
                          )}

                          {status ===
                          "indexed" ? (

                            <>
                              <span className="font-medium text-green-600">
                                🟢 Indicizzato
                              </span>

                              <span className="text-gray-500">
                                {
                                  document.pages
                                }{" "}
                                {
                                  document.pages ===
                                  1
                                    ? "pagina"
                                    : "pagine"
                                }
                              </span>
                            </>

                          ) : document.file ===
                              "30- semi sesamo.pdf" ||
                            document.file ===
                              "375 - vital wheat gluten.pdf" ? (

                            <span className="font-medium text-gray-500">
                              ⚪ Scansione non leggibile
                            </span>

                          ) : (

                            <span className="font-medium text-orange-600">
                              🟠 Da indicizzare
                            </span>

                          )}

                        </div>

                      </div>

                      <button
                        onClick={() =>
                          handleDelete(
                            document.file
                          )
                        }
                        disabled={
                          deleting ===
                            document.file ||
                          editingCategory ===
                            document.file ||
                          editingProduct ===
                            document.file
                        }
                        className="shrink-0 rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deleting ===
                        document.file
                          ? "Eliminazione..."
                          : "🗑 Elimina"}
                      </button>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </div>

      </section>

    </main>
  );
}