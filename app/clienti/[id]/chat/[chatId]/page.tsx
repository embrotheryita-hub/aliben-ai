"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Client = {
  id: string;
  company_name: string;
  contact_name: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Chat = {
  id: string;
  title: string;
};

export default function ClientChatPage() {
  const router = useRouter();
  const params = useParams();

  const clientId = params.id as string;
  const chatId = params.chatId as string;

  const [client, setClient] =
    useState<Client | null>(null);

  const [chat, setChat] =
    useState<Chat | null>(null);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const [pdfViewer, setPdfViewer] =
    useState<{
      file: string;
      page: number;
    } | null>(null);

  /*
  ========================================
  CARICAMENTO CLIENTE + CHAT + MESSAGGI
  ========================================
  */

  async function loadChat() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

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
    } = await supabase
      .from("clients")
      .select(
        "id, company_name, contact_name"
      )
      .eq("id", clientId)
      .eq("agent_id", user.id)
      .single();

    if (
      clientError ||
      !clientData
    ) {
      console.error(
        "Errore cliente:",
        clientError
      );

      setError(
        "Cliente non trovato."
      );

      setLoading(false);
      return;
    }

    setClient(clientData);

    /*
    ----------------------------------------
    CHAT
    ----------------------------------------
    */

    const {
      data: chatData,
      error: chatError,
    } = await supabase
      .from("chats")
      .select(
        "id, title"
      )
      .eq("id", chatId)
      .eq("client_id", clientId)
      .eq("agent_id", user.id)
      .single();

    if (
      chatError ||
      !chatData
    ) {
      console.error(
        "Errore chat:",
        chatError
      );

      setError(
        "Conversazione non trovata."
      );

      setLoading(false);
      return;
    }

    setChat(chatData);

    /*
    ----------------------------------------
    MESSAGGI
    ----------------------------------------
    */

    const {
      data: messageData,
      error: messageError,
    } = await supabase
      .from("messages")
      .select(
        "id, role, content, created_at"
      )
      .eq(
        "chat_id",
        chatId
      )
      .eq(
        "agent_id",
        user.id
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (messageError) {
      console.error(
        "Errore messaggi:",
        messageError
      );

      setError(
        "Impossibile caricare i messaggi."
      );

      setLoading(false);
      return;
    }

    setMessages(
      messageData || []
    );

    setLoading(false);
  }

  useEffect(() => {
    if (
      clientId &&
      chatId
    ) {
      loadChat();
    }
  }, [
    clientId,
    chatId,
  ]);

  useEffect(() => {
  messagesEndRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "end",
  });
}, [
  messages,
  sending,
]);

  /*
  ========================================
  INVIO MESSAGGIO
  ========================================
  */

  async function handleSend() {
    const text =
      message.trim();

    if (
      !text ||
      sending
    ) {
      return;
    }

    setSending(true);
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
    SALVA MESSAGGIO UTENTE
    ----------------------------------------
    */

    const {
      data: userMessage,
      error: userMessageError,
    } =
      await supabase
        .from("messages")
        .insert({
          chat_id:
            chatId,

          agent_id:
            user.id,

          role:
            "user",

          content:
            text,
        })
        .select(
          "id, role, content, created_at"
        )
        .single();

    if (
      userMessageError ||
      !userMessage
    ) {
      console.error(
        "Errore salvataggio messaggio:",
        userMessageError
      );

      setError(
        "Impossibile salvare il messaggio."
      );

      setSending(false);
      return;
    }

    setMessages(
      (prev) => [
        ...prev,
        userMessage,
      ]
    );

    setMessage("");

    /*
    ----------------------------------------
    AGGIORNA TITOLO CHAT
    ----------------------------------------
    */

    if (
      chat?.title ===
      "Nuova conversazione"
    ) {
      const newTitle =
        text.length > 45
          ? `${text.slice(
              0,
              45
            )}...`
          : text;

      const {
        error: titleError,
      } = await supabase
        .from("chats")
        .update({
          title:
            newTitle,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          chatId
        )
        .eq(
          "agent_id",
          user.id
        );

      if (titleError) {
        console.error(
          "Errore aggiornamento titolo:",
          titleError
        );
      }

      setChat(
        (prev) =>
          prev
            ? {
                ...prev,
                title:
                  newTitle,
              }
            : prev
      );
    } else {
      await supabase
        .from("chats")
        .update({
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          chatId
        )
        .eq(
          "agent_id",
          user.id
        );
    }

    /*
    ----------------------------------------
    CHIAMATA ALL'AI
    ----------------------------------------
    */

    try {
      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                message:
                  text,

                history:
                  messages
                    .slice(-12)
                    .map(
                      (item) => ({
                        role:
                          item.role ===
                          "user"
                            ? "user"
                            : "assistant",

                        content:
                          item.content,
                      })
                    ),
              }),
          }
        );

      if (!response.ok) {
        throw new Error(
          `API chat error: ${response.status}`
        );
      }

      const data =
        await response.json();

      const reply =
        data.reply ||
        "Non ho ricevuto una risposta.";

      /*
      --------------------------------------
      SALVA RISPOSTA AI
      --------------------------------------
      */

      const {
        data: assistantMessage,
        error:
          assistantError,
      } =
        await supabase
          .from("messages")
          .insert({
            chat_id:
              chatId,

            agent_id:
              user.id,

            role:
              "assistant",

            content:
              reply,
          })
          .select(
            "id, role, content, created_at"
          )
          .single();

      if (
        assistantError ||
        !assistantMessage
      ) {
        console.error(
          "Errore salvataggio risposta AI:",
          assistantError
        );

        setError(
          "La risposta è arrivata, ma non è stato possibile salvarla."
        );

        setSending(false);
        return;
      }

      setMessages(
        (prev) => [
          ...prev,
          assistantMessage,
        ]
      );

      /*
      --------------------------------------
      AGGIORNA DATA CHAT
      --------------------------------------
      */

      await supabase
        .from("chats")
        .update({
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          chatId
        )
        .eq(
          "agent_id",
          user.id
        );
    } catch (error) {
      console.error(
        "Errore AI:",
        error
      );

      setError(
        "Si è verificato un errore durante la risposta dell'AI."
      );
    }

    setSending(false);
  }

  /*
  ========================================
  ENTER PER INVIARE
  ========================================
  */

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      handleSend();
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
    ).toLocaleString(
      "it-IT",
      {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  /*
  ========================================
  FONTI PDF
  ========================================
  */

  function renderMessageContent(
    content: string
  ): ReactNode[] {
    const sourceRegex =
      /(?:📄\s*)?(?:\*\*)?([^*\n]+?\.pdf)(?:\*\*)?\s*[—–-]\s*pagina\s+(\d+)/gi;

    const parts: ReactNode[] = [];

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while (
      (match =
        sourceRegex.exec(content)) !== null
    ) {
      const [
        fullMatch,
        rawFileName,
        rawPage,
      ] = match;

      const start =
        match.index;

      if (start > lastIndex) {
        parts.push(
          <span
            key={`text-${lastIndex}`}
          >
            {content.slice(
              lastIndex,
              start
            )}
          </span>
        );
      }

      const cleanFileName =
        rawFileName.trim();

      const page =
        Number(rawPage);

      parts.push(
        <button
          key={`source-${start}`}
          type="button"
          onClick={() => {
            setPdfViewer({
              file:
                cleanFileName,
              page,
            });
          }}
          className="my-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-[#ead9d6] bg-[#fff8f7] px-3 py-2 text-left text-sm font-medium text-[#a51d20] transition hover:bg-[#f8e9e7]"
        >
          <span>📄</span>

          <span className="truncate underline decoration-[#d9aaa7] underline-offset-2">
            {cleanFileName}
          </span>

          <span className="shrink-0 text-xs font-semibold text-gray-500">
            · pagina {page}
          </span>

          <span className="shrink-0 text-xs">
            ↗
          </span>
        </button>
      );

      lastIndex =
        start +
        fullMatch.length;
    }

    if (
      lastIndex <
      content.length
    ) {
      parts.push(
        <span
          key={`text-${lastIndex}`}
        >
          {content.slice(
            lastIndex
          )}
        </span>
      );
    }

    return parts;
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
            Caricamento conversazione...
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

  if (
    !client ||
    !chat
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f5f2] px-6">

        <div className="text-center">

          <div className="mb-4 text-5xl">
            😕
          </div>

          <h1 className="text-2xl font-black">
            Conversazione non trovata
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {error}
          </p>

          <button
            onClick={() =>
              router.push(
                `/clienti/${clientId}`
              )
            }
            className="mt-6 rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8e191c]"
          >
            ← Torna al cliente
          </button>

        </div>

      </main>
    );
  }

  /*
  ========================================
  PAGINA CHAT
  ========================================
  */

  return (
    <main className="flex h-screen overflow-hidden bg-[#f7f5f2] text-[#171717]">

      <div className="flex h-screen w-full">

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
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#a51d20] text-xl text-white shadow"
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
              className="flex h-11 w-11 items-center justify-center rounded-xl text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
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
            AREA CHAT
        ===================================== */}

        <section className="flex min-w-0 flex-1 flex-col">

          {/* =====================================
              HEADER
          ===================================== */}

          <header className="flex shrink-0 items-center justify-between border-b border-[#e8e3dd] bg-white px-5 py-4 lg:px-8">

            <div className="flex min-w-0 items-center gap-3">

              <button
                onClick={() =>
                  router.push(
                    `/clienti/${clientId}`
                  )
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e8e3dd] text-gray-500 transition hover:bg-gray-50 hover:text-[#a51d20]"
                title="Torna alla scheda cliente"
              >
                ←
              </button>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5e5e2]">

                <img
                  src="/aliben-ai-mascot.png"
                  alt="ALIBEN AI"
                  className="h-10 w-10 object-contain"
                />

              </div>

              <div className="min-w-0">

                <div className="truncate text-sm font-black">
                  {chat.title}
                </div>

                <div className="truncate text-xs text-gray-400">
                  {client.company_name}

                  {client.contact_name
                    ? ` · ${client.contact_name}`
                    : ""}
                </div>

              </div>

            </div>

            <button
              onClick={() =>
                router.push(
                  `/clienti/${clientId}`
                )
              }
              className="hidden rounded-xl border border-[#e8e3dd] bg-white px-4 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 sm:block"
            >
              Scheda cliente
            </button>

          </header>

          {/* =====================================
              MESSAGGI
          ===================================== */}

          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(247,245,242,0.20), rgba(247,245,242,0.20)), url('/aliben-chat-bg.png')",

              backgroundSize:
                "cover",

              backgroundPosition:
                "center",

              backgroundRepeat:
                "no-repeat",
            }}
          >

            <div className="mx-auto max-w-4xl">

              {messages.length ===
              0 ? (

                <div className="flex min-h-[500px] items-center justify-center">

                  <div className="max-w-xl text-center">

                    <img
                      src="/aliben-ai-mascot.png"
                      alt="ALIBEN AI"
                      className="mx-auto mb-7 h-36 w-36 object-contain"
                    />

                    <h1 className="text-3xl font-black">
                      Come posso aiutarti?
                    </h1>

                    <p className="mt-3 text-sm leading-7 text-gray-500">
                      Questa conversazione è associata a{" "}

                      <strong>
                        {client.company_name}
                      </strong>

                      .
                      <br />

                      Tutti i messaggi verranno salvati nello storico del cliente.
                    </p>

                  </div>

                </div>

              ) : (

                <div className="space-y-5">

                  {messages.map(
                    (item) => (

                      <div
                        key={
                          item.id
                        }
                        className={
                          item.role ===
                          "user"
                            ? "flex justify-end"
                            : "flex justify-start"
                        }
                      >

                        <div
                          className={
                            item.role ===
                            "user"
                              ? "max-w-[85%] rounded-2xl rounded-br-md bg-[#a51d20] px-5 py-3.5 text-sm leading-6 text-white shadow-sm"
                              : "max-w-[85%] rounded-2xl rounded-bl-md border border-[#e8e3dd] bg-white px-5 py-3.5 text-sm leading-6 text-gray-800 shadow-sm"
                          }
                        >

                          {item.role ===
                            "assistant" && (

                            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a51d20]">

                              <img
                                src="/aliben-ai-mascot.png"
                                alt=""
                                className="h-5 w-5 object-contain"
                              />

                              ALIBEN AI

                            </div>

                          )}

                          <div className="whitespace-pre-wrap">
                            {renderMessageContent(
                              item.content
                            )}
                          </div>

                          <div
                            className={
                              item.role ===
                              "user"
                                ? "mt-2 text-right text-[9px] text-white/60"
                                : "mt-2 text-[9px] text-gray-400"
                            }
                          >
                            {formatDate(
                              item.created_at
                            )}
                          </div>

                        </div>

                      </div>

                    )
                  )}

                  {sending && (
                    

                    <div className="flex justify-start">

                      <div className="rounded-2xl rounded-bl-md border border-[#e8e3dd] bg-white px-5 py-4 shadow-sm">

                        <div className="flex items-center gap-2">

                          <img
                            src="/aliben-ai-mascot.png"
                            alt=""
                            className="h-6 w-6 animate-pulse object-contain"
                          />

                          <div className="flex gap-1">

                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />

                            <span
                              className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                              style={{
                                animationDelay:
                                  "150ms",
                              }}
                            />

                            <span
                              className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                              style={{
                                animationDelay:
                                  "300ms",
                              }}
                              
                            />

                          </div>

                        </div>

                      </div>

                    </div>

                  )}

                  <div ref={messagesEndRef} />

                </div>

              )}

            </div>

          </div>

          {/* =====================================
              ERRORE
          ===================================== */}

          {error && (

            <div className="shrink-0 border-t border-red-100 bg-red-50 px-5 py-3 text-center text-xs font-medium text-red-700">
              {error}
            </div>

          )}

          {/* =====================================
              INPUT
          ===================================== */}

          <div className="shrink-0 border-t border-[#e8e3dd] bg-white px-4 py-4 lg:px-10">

            <div className="mx-auto max-w-4xl">

              <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-xl">

                <textarea
                  rows={3}
                  value={
                    message
                  }
                  disabled={
                    sending
                  }
                  onChange={(
                    event
                  ) =>
                    setMessage(
                      event.target
                        .value
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder={`Scrivi qualcosa per ${client.company_name}...`}
                  className="w-full resize-none border-none p-3 text-base outline-none disabled:opacity-50"
                />

                <div className="flex items-center justify-between">

                  <div className="pl-3 text-[10px] text-gray-400">
                    Invio per inviare · Shift + Invio per andare a capo
                  </div>

                  <button
                    onClick={
                      handleSend
                    }
                    disabled={
                      sending ||
                      !message.trim()
                    }
                    className="rounded-xl bg-[#a51d20] px-6 py-3 font-semibold text-white transition hover:bg-[#8e191c] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending
                      ? "Attendi..."
                      : "Invia"}
                  </button>

                </div>

              </div>

              <div className="mt-2 text-center text-[10px] text-gray-400">
                ALIBEN AI può commettere errori.
                Verifica sempre le informazioni importanti.
              </div>

            </div>

          </div>

        </section>

      </div>

      {pdfViewer && (
        <div className="fixed inset-0 z-50 flex bg-black/60">

          <div className="flex h-full w-full flex-col bg-[#f7f5f2]">

            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e8e3dd] bg-white px-5">

              <div className="flex min-w-0 items-center gap-3">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f5e5e2]">
                  📄
                </div>

                <div className="min-w-0">

                  <div className="truncate text-sm font-black">
                    {pdfViewer.file}
                  </div>

                  <div className="text-xs text-gray-400">
                    Pagina {pdfViewer.page}
                  </div>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setPdfViewer(null)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e3dd] text-xl text-gray-500 transition hover:bg-gray-100 hover:text-[#a51d20]"
                title="Chiudi"
              >
                ×
              </button>

            </div>

            <div className="min-h-0 flex-1 bg-[#525252]">

              <iframe
                src={`/api/documents?file=${encodeURIComponent(
                  pdfViewer.file
                )}#page=${pdfViewer.page}`}
                title={pdfViewer.file}
                className="h-full w-full border-0"
              />

            </div>

          </div>

        </div>
      )}

    </main>
  );
}