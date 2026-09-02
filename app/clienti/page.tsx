"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileHomeButton from "@/components/MobileHomeButton";
import { createClient } from "@/lib/supabase/client";

type Client = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export default function ClientsPage() {
  const router = useRouter();

  const [clients, setClients] =
    useState<Client[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [showForm, setShowForm] =
    useState(false);

  const [editingClient, setEditingClient] =
    useState<Client | null>(null);

  const [companyName, setCompanyName] =
    useState("");

  const [contactName, setContactName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
  ========================================
  CARICAMENTO CLIENTI
  ========================================
  */

  async function loadClients() {
    setLoading(true);
    setError("");

    const supabase =
      createClient();

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("clients")
      .select(
        "id, company_name, contact_name, email, phone, notes, created_at"
      )
      .eq(
        "agent_id",
        user.id
      )
      .order(
        "company_name",
        {
          ascending: true,
        }
      );

    if (error) {
      console.error(
        "Errore caricamento clienti:",
        error
      );

      setError(
        "Impossibile caricare i clienti."
      );

      setLoading(false);
      return;
    }

    setClients(
      data || []
    );

    setLoading(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

  /*
  ========================================
  RESET FORM
  ========================================
  */

  function resetForm() {
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setNotes("");

    setEditingClient(
      null
    );

    setShowForm(false);
    setError("");
  }

  /*
  ========================================
  MODIFICA CLIENTE
  ========================================
  */

  function startEdit(
    client: Client
  ) {
    setEditingClient(
      client
    );

    setCompanyName(
      client.company_name
    );

    setContactName(
      client.contact_name ||
        ""
    );

    setEmail(
      client.email || ""
    );

    setPhone(
      client.phone || ""
    );

    setNotes(
      client.notes || ""
    );

    setShowForm(true);

    setError("");
  }

  /*
  ========================================
  SALVA CLIENTE
  ========================================
  */

  async function handleSave(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (
      !companyName.trim()
    ) {
      setError(
        "Inserisci il nome dell'azienda."
      );

      return;
    }

    setSaving(true);
    setError("");

    const supabase =
      createClient();

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (editingClient) {
      const {
        error,
      } = await supabase
        .from("clients")
        .update({
          company_name:
            companyName.trim(),

          contact_name:
            contactName.trim() ||
            null,

          email:
            email.trim() ||
            null,

          phone:
            phone.trim() ||
            null,

          notes:
            notes.trim() ||
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          editingClient.id
        )
        .eq(
          "agent_id",
          user.id
        );

      if (error) {
        console.error(
          "Errore modifica cliente:",
          error
        );

        setError(
          "Impossibile modificare il cliente."
        );

        setSaving(false);
        return;
      }
    } else {
      const {
        error,
      } = await supabase
        .from("clients")
        .insert({
          agent_id:
            user.id,

          company_name:
            companyName.trim(),

          contact_name:
            contactName.trim() ||
            null,

          email:
            email.trim() ||
            null,

          phone:
            phone.trim() ||
            null,

          notes:
            notes.trim() ||
            null,
        });

      if (error) {
        console.error(
          "Errore creazione cliente:",
          error
        );

        setError(
          "Impossibile creare il cliente."
        );

        setSaving(false);
        return;
      }
    }

    setSaving(false);

    resetForm();

    await loadClients();
  }

  /*
  ========================================
  ELIMINA CLIENTE
  ========================================
  */

  async function handleDelete(
    client: Client
  ) {
    const confirmed =
      window.confirm(
        `Vuoi eliminare "${client.company_name}"?`
      );

    if (!confirmed) {
      return;
    }

    const supabase =
      createClient();

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const {
      error,
    } = await supabase
      .from("clients")
      .delete()
      .eq(
        "id",
        client.id
      )
      .eq(
        "agent_id",
        user.id
      );

    if (error) {
      console.error(
        "Errore eliminazione cliente:",
        error
      );

      setError(
        "Impossibile eliminare il cliente."
      );

      return;
    }

    await loadClients();
  }

  /*
  ========================================
  FILTRO RICERCA
  ========================================
  */

  const filteredClients =
    clients.filter(
      (client) => {

        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return true;
        }

        return (
          client.company_name
            .toLowerCase()
            .includes(query) ||
          client.contact_name
            ?.toLowerCase()
            .includes(query) ||
          client.email
            ?.toLowerCase()
            .includes(query) ||
          client.phone
            ?.toLowerCase()
            .includes(query)
        );
      }
    );

  return (
    <main className="min-h-screen bg-[#f7f5f2] text-[#171717]">

      <div className="flex min-h-screen">

        {/* =====================================
            MINI SIDEBAR
        ===================================== */}

        <aside className="hidden w-[72px] shrink-0 flex-col items-center bg-[#211f1d] py-5 md:flex">

          <button
            onClick={() =>
              router.push("/")
            }
            className="mb-8 flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow"
          >
            <img
              src="/aliben-ai-mascot.png"
              alt="ALIBEN AI"
              className="h-10 w-10 object-contain"
            />
          </button>

          <div className="flex flex-1 flex-col items-center gap-3">

            <button
              onClick={() =>
                router.push("/")
              }
              className="flex h-11 w-11 items-center justify-center rounded-xl text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              title="Chat"
            >
              💬
            </button>

            <button
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#a51d20] text-xl text-white shadow"
              title="Clienti"
            >
              👥
            </button>

            <button
              className="flex h-11 w-11 items-center justify-center rounded-xl text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              title="Knowledge"
            >
              📖
            </button>

            <button
              className="flex h-11 w-11 items-center justify-center rounded-xl text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              title="Documenti"
            >
              🗂️
            </button>

            <button
              className="flex h-11 w-11 items-center justify-center rounded-xl text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              title="Impostazioni"
            >
              ⚙️
            </button>

          </div>

        </aside>

        {/* =====================================
            AREA PRINCIPALE
        ===================================== */}

        <section className="flex min-w-0 flex-1 flex-col">

          {/* =====================================
              HEADER
          ===================================== */}

          <header className="flex min-h-[94px] items-center justify-between border-b border-[#e8e3dd] bg-white px-6 lg:px-10">

            <div>

              <div className="text-lg font-bold">
                Clienti
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Gestisci i tuoi clienti e il loro storico.
              </div>

            </div>

            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#8e191c]"
            >
              ＋ Nuovo cliente
            </button>

          </header>

          {/* =====================================
              CONTENUTO
          ===================================== */}

          <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">

            <div className="mx-auto max-w-6xl">

              {/* =====================================
                  RICERCA
              ===================================== */}

              <div className="mb-8">

                <div className="relative max-w-xl">

                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    🔎
                  </span>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Cerca cliente..."
                    className="w-full rounded-2xl border border-[#e3ded8] bg-white py-4 pl-11 pr-4 text-sm outline-none transition focus:border-[#a51d20] focus:ring-2 focus:ring-[#a51d20]/10"
                  />

                </div>

              </div>

              {/* =====================================
                  ERRORE
              ===================================== */}

              {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {/* =====================================
                  LOADING
              ===================================== */}

              {loading ? (

                <div className="flex min-h-[300px] items-center justify-center">

                  <div className="text-center">

                    <img
                      src="/aliben-ai-mascot.png"
                      alt="ALIBEN AI"
                      className="mx-auto mb-4 h-20 w-20 animate-pulse object-contain"
                    />

                    <div className="text-sm text-gray-500">
                      Caricamento clienti...
                    </div>

                  </div>

                </div>

              ) : filteredClients.length === 0 ? (

                /* =====================================
                    NESSUN CLIENTE
                ===================================== */

                <div className="flex min-h-[350px] items-center justify-center">

                  <div className="max-w-md text-center">

                    <img
                      src="/aliben-ai-mascot.png"
                      alt="ALIBEN AI"
                      className="mx-auto mb-6 h-28 w-28 object-contain"
                    />

                    <h2 className="text-2xl font-black">
                      {search
                        ? "Nessun cliente trovato"
                        : "Ancora nessun cliente"}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      {search
                        ? "Prova a modificare la ricerca."
                        : "Crea il tuo primo cliente per iniziare a organizzare conversazioni e storico."}
                    </p>

                    {!search && (
                      <button
                        onClick={() => {
                          resetForm();
                          setShowForm(
                            true
                          );
                        }}
                        className="mt-6 rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8e191c]"
                      >
                        ＋ Crea il primo cliente
                      </button>
                    )}

                  </div>

                </div>

              ) : (

                /* =====================================
                    LISTA CLIENTI
                ===================================== */

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

                  {filteredClients.map(
                    (client) => (

                      <div
                        key={client.id}
                        className="group rounded-2xl border border-[#e8e3dd] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >

                        <div className="flex items-start justify-between gap-4">

                          <button
                            onClick={() =>
                              router.push(
                                `/clienti/${client.id}`
                              )
                            }
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >

                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5e5e2] text-xl">
                              🏢
                            </div>

                            <div className="min-w-0">

                              <div className="truncate text-base font-black">
                                {client.company_name}
                              </div>

                              {client.contact_name && (
                                <div className="mt-1 truncate text-xs text-gray-500">
                                  {client.contact_name}
                                </div>
                              )}

                            </div>

                          </button>

                          <div className="flex gap-1">

                            <button
                              onClick={() =>
                                startEdit(
                                  client
                                )
                              }
                              className="rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-50 hover:text-[#a51d20]"
                              title="Modifica"
                            >
                              ✎
                            </button>

                            <button
                              onClick={() =>
                                handleDelete(
                                  client
                                )
                              }
                              className="rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Elimina"
                            >
                              ×
                            </button>

                          </div>

                        </div>

                        <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">

                          {client.phone && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>
                                ☎
                              </span>

                              <span className="truncate">
                                {client.phone}
                              </span>
                            </div>
                          )}

                          {client.email && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>
                                ✉
                              </span>

                              <span className="truncate">
                                {client.email}
                              </span>
                            </div>
                          )}

                          {!client.phone &&
                            !client.email && (
                              <div className="text-xs text-gray-400">
                                Nessun contatto inserito
                              </div>
                            )}

                        </div>

                        <button
                          onClick={() =>
                            router.push(
                              `/clienti/${client.id}`
                            )
                          }
                          className="mt-5 flex w-full items-center justify-between rounded-xl bg-[#f8f5f2] px-4 py-3 text-xs font-bold text-[#8e191c] transition hover:bg-[#f5e8e7]"
                        >
                          <span>
                            Apri scheda cliente
                          </span>

                          <span>
                            →
                          </span>
                        </button>

                      </div>

                    )
                  )}

                </div>

              )}

            </div>

          </div>

        </section>

      </div>

      {/* =====================================
          MODALE NUOVO / MODIFICA CLIENTE
      ===================================== */}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">

          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-[#e8e3dd] px-6 py-5">

              <div>

                <h2 className="text-xl font-black">
                  {editingClient
                    ? "Modifica cliente"
                    : "Nuovo cliente"}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Inserisci i dati del cliente.
                </p>

              </div>

              <button
                onClick={
                  resetForm
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleSave
              }
              className="space-y-5 p-6"
            >

              {/* AZIENDA */}

              <div>

                <label className="mb-2 block text-sm font-bold text-gray-700">
                  Azienda *
                </label>

                <input
                  value={
                    companyName
                  }
                  onChange={(
                    event
                  ) =>
                    setCompanyName(
                      event.target
                        .value
                    )
                  }
                  placeholder="Es. Pane Pizza Rossi"
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#a51d20] focus:ring-2 focus:ring-[#a51d20]/10"
                />

              </div>

              {/* REFERENTE */}

              <div>

                <label className="mb-2 block text-sm font-bold text-gray-700">
                  Referente
                </label>

                <input
                  value={
                    contactName
                  }
                  onChange={(
                    event
                  ) =>
                    setContactName(
                      event.target
                        .value
                    )
                  }
                  placeholder="Nome e cognome"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#a51d20] focus:ring-2 focus:ring-[#a51d20]/10"
                />

              </div>

              {/* EMAIL + TELEFONO */}

              <div className="grid gap-5 sm:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Email
                  </label>

                  <input
                    type="email"
                    value={
                      email
                    }
                    onChange={(
                      event
                    ) =>
                      setEmail(
                        event.target
                          .value
                      )
                    }
                    placeholder="email@cliente.it"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#a51d20] focus:ring-2 focus:ring-[#a51d20]/10"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Telefono
                  </label>

                  <input
                    value={
                      phone
                    }
                    onChange={(
                      event
                    ) =>
                      setPhone(
                        event.target
                          .value
                      )
                    }
                    placeholder="+39..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#a51d20] focus:ring-2 focus:ring-[#a51d20]/10"
                  />

                </div>

              </div>

              {/* NOTE */}

              <div>

                <label className="mb-2 block text-sm font-bold text-gray-700">
                  Note
                </label>

                <textarea
                  rows={4}
                  value={
                    notes
                  }
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target
                        .value
                    )
                  }
                  placeholder="Note sul cliente, preferenze, prodotti utilizzati..."
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#a51d20] focus:ring-2 focus:ring-[#a51d20]/10"
                />

              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {/* AZIONI */}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">

                <button
                  type="button"
                  onClick={
                    resetForm
                  }
                  disabled={
                    saving
                  }
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  Annulla
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8e191c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Salvataggio..."
                    : editingClient
                    ? "Salva modifiche"
                    : "Crea cliente"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

<MobileHomeButton />

    </main>
  );
}