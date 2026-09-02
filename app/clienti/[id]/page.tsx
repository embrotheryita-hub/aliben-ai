"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type Chat = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export default function ClientPage() {
  const router = useRouter();
  const params = useParams();

  const clientId =
    params.id as string;

  const [client, setClient] =
    useState<Client | null>(null);

  const [chats, setChats] =
    useState<Chat[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
  ========================================
  CARICAMENTO CLIENTE + CHAT
  ========================================
  */

  useEffect(() => {
    async function loadClient() {
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

      /*
      ----------------------------------------
      CLIENTE
      ----------------------------------------
      */

      const {
        data: clientData,
        error: clientError,
      } =
        await supabase
          .from("clients")
          .select(
            `
              id,
              company_name,
              contact_name,
              email,
              phone,
              notes,
              created_at
            `
          )
          .eq(
            "id",
            clientId
          )
          .eq(
            "agent_id",
            user.id
          )
          .single();

      if (clientError) {
        console.error(
          "Errore caricamento cliente:",
          clientError
        );

        setError(
          "Cliente non trovato."
        );

        setLoading(false);
        return;
      }

      setClient(
        clientData
      );

      /*
      ----------------------------------------
      CHAT DEL CLIENTE
      ----------------------------------------
      */

      const {
        data: chatData,
        error: chatError,
      } =
        await supabase
          .from("chats")
          .select(
            `
              id,
              title,
              created_at,
              updated_at
            `
          )
          .eq(
            "client_id",
            clientId
          )
          .eq(
            "agent_id",
            user.id
          )
          .order(
            "updated_at",
            {
              ascending: false,
            }
          );

      if (chatError) {
        console.error(
          "Errore caricamento chat:",
          chatError
        );

        setError(
          "Impossibile caricare le conversazioni."
        );

        setLoading(false);
        return;
      }

      setChats(
        chatData || []
      );

      setLoading(false);
    }

    if (clientId) {
      loadClient();
    }
  }, [
    clientId,
    router,
  ]);

  /*
  ========================================
  NUOVA CONVERSAZIONE
  ========================================
  */

  async function handleNewChat() {
    if (!client) {
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
      data,
      error,
    } =
      await supabase
        .from("chats")
        .insert({
          agent_id:
            user.id,

          client_id:
            client.id,

          title:
            "Nuova conversazione",
        })
        .select(
          "id, title, created_at, updated_at"
        )
        .single();

    if (error) {
      console.error(
        "Errore creazione chat:",
        error
      );

      setError(
        "Impossibile creare la conversazione."
      );

      return;
    }

    if (data) {
      router.push(
        `/clienti/${client.id}/chat/${data.id}`
      );
    }
  }

  /*
  ========================================
  FORMAT DATA
  ========================================
  */

  function formatDate(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleDateString(
      "it-IT",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  /*
  ========================================
  LOADING
  ========================================
  */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f5f2]">

        <div className="text-center">

          <img
            src="/aliben-ai-mascot.png"
            alt="ALIBEN AI"
            className="mx-auto mb-5 h-24 w-24 animate-pulse object-contain"
          />

          <div className="text-sm text-gray-500">
            Caricamento cliente...
          </div>

        </div>

      </main>
    );
  }

  /*
  ========================================
  ERRORE
  ========================================
  */

  if (!client) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f5f2] px-6">

        <div className="text-center">

          <div className="mb-4 text-5xl">
            😕
          </div>

          <h1 className="text-2xl font-black">
            Cliente non trovato
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {error ||
              "Il cliente richiesto non esiste o non è accessibile."}
          </p>

          <button
            onClick={() =>
              router.push(
                "/clienti"
              )
            }
            className="mt-6 rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white"
          >
            ← Torna ai clienti
          </button>

        </div>

      </main>
    );
  }

  /*
  ========================================
  PAGINA
  ========================================
  */

  return (
    <main className="min-h-screen bg-[#f7f5f2] text-[#171717]">

      <div className="flex min-h-screen">

        {/* =====================================
            SIDEBAR
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
              onClick={() =>
                router.push(
                  "/clienti"
                )
              }
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
            CONTENUTO
        ===================================== */}

        <section className="flex min-w-0 flex-1 flex-col">

          {/* HEADER */}

          <header className="flex min-h-[94px] items-center justify-between border-b border-[#e8e3dd] bg-white px-6 lg:px-10">

            <div>

              <button
                onClick={() =>
                  router.push(
                    "/clienti"
                  )
                }
                className="mb-2 text-xs font-semibold text-gray-400 transition hover:text-[#a51d20]"
              >
                ← Torna ai clienti
              </button>

              <h1 className="text-2xl font-black">
                {client.company_name}
              </h1>

              {client.contact_name && (
                <div className="mt-1 text-sm text-gray-500">
                  {client.contact_name}
                </div>
              )}

            </div>

            <button
              onClick={
                handleNewChat
              }
              className="rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#8e191c]"
            >
              ＋ Nuova conversazione
            </button>

          </header>

          {/* CONTENUTO */}

          <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">

            <div className="mx-auto max-w-6xl">

              {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

                {/* =====================================
                    CONVERSAZIONI
                ===================================== */}

                <div>

                  <div className="mb-4 flex items-center justify-between">

                    <div>

                      <h2 className="text-lg font-black">
                        Conversazioni
                      </h2>

                      <p className="mt-1 text-xs text-gray-500">
                        Tutte le conversazioni con questo cliente.
                      </p>

                    </div>

                    <div className="rounded-full bg-[#f5e8e7] px-3 py-1 text-xs font-bold text-[#8e191c]">
                      {chats.length}
                    </div>

                  </div>

                  {chats.length ===
                  0 ? (

                    <div className="rounded-2xl border border-[#e8e3dd] bg-white p-10 text-center">

                      <img
                        src="/aliben-ai-mascot.png"
                        alt="ALIBEN AI"
                        className="mx-auto mb-5 h-24 w-24 object-contain"
                      />

                      <h3 className="text-xl font-black">
                        Nessuna conversazione
                      </h3>

                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                        Inizia una nuova conversazione
                        per questo cliente. Lo storico
                        rimarrà associato alla sua scheda.
                      </p>

                      <button
                        onClick={
                          handleNewChat
                        }
                        className="mt-6 rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8e191c]"
                      >
                        ＋ Inizia conversazione
                      </button>

                    </div>

                  ) : (

                    <div className="space-y-3">

                      {chats.map(
                        (chat) => (

                          <button
                            key={
                              chat.id
                            }
                            onClick={() =>
                              router.push(
                                `/clienti/${client.id}/chat/${chat.id}`
                              )
                            }
                            className="group flex w-full items-center gap-4 rounded-2xl border border-[#e8e3dd] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8c7c5] hover:shadow-md"
                          >

                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5e5e2] text-xl">
                              💬
                            </div>

                            <div className="min-w-0 flex-1">

                              <div className="truncate text-sm font-black">
                                {chat.title}
                              </div>

                              <div className="mt-1 text-xs text-gray-400">
                                Ultima modifica:{" "}
                                {formatDate(
                                  chat.updated_at
                                )}
                              </div>

                            </div>

                            <div className="text-lg text-gray-300 transition group-hover:text-[#a51d20]">
                              →
                            </div>

                          </button>

                        )
                      )}

                    </div>

                  )}

                </div>

                {/* =====================================
                    INFORMAZIONI CLIENTE
                ===================================== */}

                <aside>

                  <div className="rounded-2xl border border-[#e8e3dd] bg-white p-5 shadow-sm">

                    <div className="mb-5 flex items-center gap-3">

                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5e5e2] text-xl">
                        🏢
                      </div>

                      <div className="min-w-0">

                        <div className="truncate text-base font-black">
                          {client.company_name}
                        </div>

                        <div className="text-xs text-gray-400">
                          Cliente
                        </div>

                      </div>

                    </div>

                    <div className="space-y-4 border-t border-gray-100 pt-5">

                      {client.contact_name && (
                        <div>

                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Referente
                          </div>

                          <div className="mt-1 text-sm font-semibold">
                            {client.contact_name}
                          </div>

                        </div>
                      )}

                      {client.phone && (
                        <div>

                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Telefono
                          </div>

                          <div className="mt-1 text-sm font-semibold">
                            {client.phone}
                          </div>

                        </div>
                      )}

                      {client.email && (
                        <div>

                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Email
                          </div>

                          <div className="mt-1 break-all text-sm font-semibold">
                            {client.email}
                          </div>

                        </div>
                      )}

                      <div>

                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Cliente dal
                        </div>

                        <div className="mt-1 text-sm font-semibold">
                          {formatDate(
                            client.created_at
                          )}
                        </div>

                      </div>

                    </div>

                    {client.notes && (
                      <div className="mt-5 border-t border-gray-100 pt-5">

                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Note
                        </div>

                        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {client.notes}
                        </div>

                      </div>
                    )}

                  </div>

                </aside>

              </div>

            </div>

          </div>

        </section>

      </div>
<MobileHomeButton />
    </main>
  );
}