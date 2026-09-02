"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import DesktopSidebar from "@/components/DesktopSidebar";
import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";
import QuickActions from "@/components/QuickActions";
import ChatMessage from "@/components/ChatMessage";

import { createClient } from "@/lib/supabase/client";

type Message = {
  role: "user" | "assistant";
  text: string;
  image?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

const STORAGE_KEY = "aliben-ai-chats";

function createChat(): Chat {
  return {
    id: crypto.randomUUID(),
    title: "Nuova chat",
    messages: [],
  };
}

export default function Home() {
  const router = useRouter();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] =
    useState<string | null>(null);

  const [isTyping, setIsTyping] =
    useState(false);

  const [isEditingTitle, setIsEditingTitle] =
    useState(false);

  const [newTitle, setNewTitle] =
    useState("");

  const [agentName, setAgentName] =
    useState("Agente");

  const [agentInitials, setAgentInitials] =
    useState("AG");

  const [documentCount, setDocumentCount] =
    useState<number | null>(null);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  /*
  ========================================
  CONTROLLO DOCUMENTI
  ========================================
  */

  useEffect(() => {
    async function loadDocumentCount() {
      try {
        const response = await fetch(
          "/api/stats",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Errore nel recupero delle statistiche"
          );
        }

        const data =
          await response.json();

        setDocumentCount(
          Number(data.pdf) || 0
        );
      } catch (error) {
        console.error(
          "ERRORE CONTEGGIO DOCUMENTI:",
          error
        );

        setDocumentCount(0);
      }
    }

    loadDocumentCount();
  }, []);

  /*
  ========================================
  CARICAMENTO PROFILO
  ========================================
  */

  useEffect(() => {
    async function loadAgentProfile() {
      const supabase =
        createClient();

      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const {
        data: profile,
        error,
      } = await supabase
        .from("profiles")
        .select(
          "first_name, last_name, username"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(
          "Errore caricamento profilo:",
          error
        );

        return;
      }

      if (profile) {
        const firstName =
          profile.first_name || "";

        const lastName =
          profile.last_name || "";

        const fullName =
          `${firstName} ${lastName}`.trim();

        setAgentName(
          fullName ||
            profile.username ||
            "Agente"
        );

        const initials =
          `${firstName.charAt(0)}${lastName.charAt(0)}`
            .toUpperCase();

        setAgentInitials(
          initials || "AG"
        );
      }
    }

    loadAgentProfile();
  }, [router]);

  /*
  ========================================
  CARICAMENTO CHAT
  ========================================
  */

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (saved) {
        const parsed =
          JSON.parse(saved) as Chat[];

        if (
          Array.isArray(parsed) &&
          parsed.length > 0
        ) {
          setChats(parsed);
          setActiveChatId(
            parsed[0].id
          );

          return;
        }
      }
    } catch (error) {
      console.error(
        "Errore caricamento chat:",
        error
      );
    }

    const firstChat =
      createChat();

    setChats([firstChat]);

    setActiveChatId(
      firstChat.id
    );
  }, []);

  /*
  ========================================
  SALVATAGGIO CHAT
  ========================================
  */

  useEffect(() => {
    if (chats.length === 0) {
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error(
        "Errore salvataggio chat:",
        error
      );
    }
  }, [chats]);

  const activeChat =
    chats.find(
      (chat) =>
        chat.id === activeChatId
    ) || null;

  /*
  ========================================
  NUOVA CHAT
  ========================================
  */

  function handleNewChat() {
    if (isTyping) {
      return;
    }

    const chat =
      createChat();

    setChats((prev) => [
      chat,
      ...prev,
    ]);

    setActiveChatId(
      chat.id
    );

    setIsEditingTitle(false);
    setNewTitle("");
  }

  /*
  ========================================
  CAMBIO CHAT
  ========================================
  */

  function handleSelectChat(
    chatId: string
  ) {
    if (isTyping) {
      return;
    }

    setActiveChatId(
      chatId
    );

    setIsEditingTitle(false);
    setNewTitle("");
  }

  /*
  ========================================
  RINOMINA CHAT
  ========================================
  */

  function startRename() {
    if (!activeChat) {
      return;
    }

    setNewTitle(
      activeChat.title
    );

    setIsEditingTitle(true);
  }

  function saveTitle() {
    if (!activeChatId) {
      return;
    }

    const title =
      newTitle.trim() ||
      "Nuova chat";

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              title,
            }
          : chat
      )
    );

    setIsEditingTitle(false);
  }

  /*
  ========================================
  ELIMINA CHAT
  ========================================
  */

  function handleDeleteChat(
    chatId: string
  ) {
    if (isTyping) {
      return;
    }

    const remaining =
      chats.filter(
        (chat) =>
          chat.id !== chatId
      );

    if (
      remaining.length === 0
    ) {
      const newChat =
        createChat();

      setChats([
        newChat,
      ]);

      setActiveChatId(
        newChat.id
      );

      return;
    }

    setChats(
      remaining
    );

    if (
      chatId ===
      activeChatId
    ) {
      setActiveChatId(
        remaining[0].id
      );
    }
  }

  /*
  ========================================
  LOGOUT
  ========================================
  */

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    const supabase =
      createClient();

    await supabase.auth.signOut();

    router.push("/login");

    router.refresh();
  }

  /*
  ========================================
  INVIO MESSAGGIO
  ========================================
  */

  async function handleSend(
    message: string,
    image?: string
  ) {
    if (
      (!message.trim() && !image) ||
      !activeChatId ||
      isTyping
    ) {
      return;
    }

    const userMessage: Message = {
      role: "user",

      text:
        message.trim() ||
        "Analizza questo prodotto e trovami l'alternativa ALIBEN più pertinente.",

      image,
    };

    /*
    ========================================
    AGGIUNGI MESSAGGIO ALLA CHAT
    ========================================
    */

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,

              messages: [
                ...chat.messages,
                userMessage,
              ],
            }
          : chat
      )
    );

    /*
    ========================================
    TITOLO AUTOMATICO
    ========================================
    */

    setChats((prev) =>
      prev.map((chat) => {
        if (
          chat.id !==
          activeChatId
        ) {
          return chat;
        }

        if (
          chat.title ===
          "Nuova chat"
        ) {
          return {
            ...chat,

            title:
              message
                .trim()
                .slice(0, 40) ||
              "Analisi prodotto",
          };
        }

        return chat;
      })
    );

    setIsTyping(true);

    try {
      /*
      ========================================
      CHIAMATA API CHAT
      ========================================
      */

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              message,

              image,

              history:
                activeChat
                  ? activeChat.messages.map(
                      (item) => ({
                        role:
                          item.role,

                        content:
                          item.text,
                      })
                    )
                  : [],
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          "Errore nella risposta del server."
        );
      }

      const data =
        await response.json();

      /*
      ========================================
      RISPOSTA AI
      ========================================
      */

      const assistantMessage:
        Message = {
          role: "assistant",

          text:
            data.reply ||
            "Non ho ricevuto una risposta.",
        };

      setChats((prev) =>
        prev.map((chat) =>
          chat.id ===
          activeChatId
            ? {
                ...chat,

                messages: [
                  ...chat.messages,
                  assistantMessage,
                ],
              }
            : chat
        )
      );
    } catch (error) {
      console.error(
        "Errore chat:",
        error
      );

      setChats((prev) =>
        prev.map((chat) =>
          chat.id ===
          activeChatId
            ? {
                ...chat,

                messages: [
                  ...chat.messages,

                  {
                    role:
                      "assistant",

                    text:
                      "Errore durante la risposta.",
                  },
                ],
              }
            : chat
        )
      );
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#f7f5f2] text-[#171717]">

      <div className="flex h-full flex-col md:flex-row md:overflow-hidden">

        {/* =====================================
            MINI SIDEBAR
        ===================================== */}

        <DesktopSidebar />

        {/* =====================================
            SIDEBAR CHAT
        ===================================== */}

        <aside className="hidden w-[330px] shrink-0 border-r border-[#e8e3dd] bg-[#fbfaf8] md:flex md:flex-col">

          <div className="border-b border-[#e8e3dd] px-6 py-5">

            <div className="flex items-center gap-3">

              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#f5e5e2]">

                <img
                  src="/aliben-ai-mascot.png"
                  alt="ALIBEN AI"
                  className="h-11 w-11 object-contain"
                />

              </div>

              <div>

                <div className="text-xl font-black tracking-tight">
                  ALIBEN
                </div>

                <div className="-mt-1 text-sm font-bold text-[#a51d20]">
                  AI
                </div>

              </div>

            </div>

            <div className="mt-2 sm:mt-3">

              <div className="text-sm font-bold">
                Il tuo assistente tecnico e commerciale
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Sempre al tuo fianco, ogni giorno.
              </div>

            </div>

          </div>

          <div className="px-5 pt-5">

            <button
              onClick={handleNewChat}
              disabled={isTyping}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#a51d20] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#8e191c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-lg">
                ＋
              </span>

              Nuova chat
            </button>

          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">

            <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Le mie chat
            </div>

            <div className="space-y-1.5">

              {chats.map(
                (chat) => {

                  const isActive =
                    chat.id ===
                    activeChatId;

                  return (
                    <div
                      key={chat.id}
                      className={`group flex items-center rounded-xl transition ${
                        isActive
                          ? "bg-[#f5e8e7]"
                          : "hover:bg-[#f2efeb]"
                      }`}
                    >

                      <button
                        onClick={() =>
                          handleSelectChat(
                            chat.id
                          )
                        }
                        disabled={
                          isTyping
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left"
                      >

                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                            isActive
                              ? "bg-[#f5e5e2]"
                              : "bg-[#f3e7e4]"
                          }`}
                        >

                          <img
                            src="/aliben-ai-mascot.png"
                            alt=""
                            className="h-9 w-9 object-contain"
                          />

                        </div>

                        <div className="min-w-0 flex-1">

                          <div
                            className={`truncate text-sm font-bold ${
                              isActive
                                ? "text-[#8e191c]"
                                : "text-gray-800"
                            }`}
                          >
                            {chat.title}
                          </div>

                          <div className="mt-0.5 truncate text-xs text-gray-400">
                            {chat.messages.length ===
                            0
                              ? "Nuova conversazione"
                              : `${chat.messages.length} messaggi`}
                          </div>

                        </div>

                      </button>

                      <button
                        onClick={() =>
                          handleDeleteChat(
                            chat.id
                          )
                        }
                        disabled={
                          isTyping
                        }
                        className="mr-2 hidden rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-white hover:text-[#a51d20] group-hover:block"
                        title="Elimina chat"
                      >
                        ×
                      </button>

                    </div>
                  );
                }
              )}

            </div>

          </div>

          <div className="border-t border-[#e8e3dd] p-5">

            <div className="rounded-2xl bg-white p-4 shadow-sm">

              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                ALIBEN AI in breve
              </div>

              <div className="grid grid-cols-3 divide-x divide-gray-100">

                <div className="text-center">

                  <div className="text-lg font-black text-[#a51d20]">
                    {documentCount === null
                      ? "..."
                      : documentCount}
                  </div>

                  <div className="text-[10px] text-gray-400">
                    Documenti
                  </div>

                </div>

                <div className="text-center">

                  <div className="text-lg font-black text-[#a51d20]">
                    AI
                  </div>

                  <div className="text-[10px] text-gray-400">
                    Knowledge
                  </div>

                </div>

                <div className="text-center">

                  <div className="text-lg font-black text-[#a51d20]">
                    ✓
                  </div>

                  <div className="text-[10px] text-gray-400">
                    Online
                  </div>

                </div>

              </div>

            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl p-2">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a51d20] text-white">
                📚
              </div>

              <div>

                <div className="text-xs font-bold">
                  La nostra conoscenza
                </div>

                <div className="text-[10px] text-gray-400">
                  Schede, ricette e cataloghi
                </div>

              </div>

            </div>

          </div>

        </aside>

        {/* =====================================
            AREA PRINCIPALE
        ===================================== */}

        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

          {/* =====================================
              TOP BAR
          ===================================== */}

          <header className="flex min-h-[68px] shrink-0 items-center justify-between border-b border-[#e8e3dd] bg-white px-3 py-3 sm:px-6 lg:h-[94px] lg:px-10">

            <div>

              <div className="text-[13px] font-bold sm:text-lg">
                Il tuo assistente tecnico e commerciale
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Sempre al tuo fianco, ogni giorno.
              </div>

            </div>

            <div className="flex items-center gap-3">

              <button className="hidden rounded-xl border border-[#e8e3dd] bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 md:block">
                ?&nbsp;&nbsp;Guida
              </button>

              <div className="flex items-center gap-2 rounded-xl border border-[#e8e3dd] bg-white px-3 py-2">

                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#a51d20] text-xs font-bold text-white">
                  {agentInitials}
                </div>

                <div className="hidden text-left sm:block">

                  <div className="text-xs font-bold">
                    {agentName}
                  </div>

                  <div className="text-[10px] text-gray-400">
                    Agente · ALIBEN
                  </div>

                </div>

                <button
                  onClick={
                    handleLogout
                  }
                  disabled={
                    isLoggingOut
                  }
                  className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-400 transition hover:bg-red-50 hover:text-[#a51d20] disabled:opacity-50"
                  title="Esci"
                >
                  {isLoggingOut
                    ? "..."
                    : "Esci"}
                </button>

              </div>

            </div>

          </header>

          {/* =====================================
    MOBILE
===================================== */}

<div className="shrink-0 border-b border-[#e8e3dd] bg-white px-2 py-2 md:hidden">

  <div className="flex w-full items-center gap-1 overflow-x-auto">

    <button
      type="button"
      onClick={() =>
        router.push("/")
      }
      className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#e8e3dd] bg-white px-2.5 text-xs font-bold text-gray-700 shadow-sm"
    >
      🏠 Home
    </button>

    <button
      type="button"
      onClick={handleNewChat}
      disabled={isTyping}
      className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-[#a51d20] px-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
    >
      ＋ Chat
    </button>

    <button
      type="button"
      onClick={() =>
        router.push("/clienti")
      }
      className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#e8e3dd] bg-white px-2.5 text-xs font-bold text-gray-700 shadow-sm"
    >
      👥 Clienti
    </button>

    <button
      type="button"
      onClick={() =>
        router.push("/admin")
      }
      className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#e8e3dd] bg-white px-2.5 text-xs font-bold text-gray-700 shadow-sm"
    >
      ⚙️ Admin
    </button>

    <button
      type="button"
      onClick={() =>
        router.push("/instagram")
      }
      className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#e8e3dd] bg-white px-2.5 text-xs font-bold text-gray-700 shadow-sm"
    >
      📸 Instagram
    </button>

  </div>

  <div className="mt-2">
    <select
      value={activeChatId || ""}
      onChange={(event) =>
        handleSelectChat(
          event.target.value
        )
      }
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none shadow-sm"
    >
      {chats.map((chat) => (
        <option
          key={chat.id}
          value={chat.id}
        >
          {chat.title}
        </option>
      ))}
    </select>
  </div>

</div>

          {/* =====================================
              CHAT HEADER
          ===================================== */}

          <div className="shrink-0 border-b border-[#e8e3dd] bg-white px-3 py-3 sm:px-6 sm:py-5 lg:px-10">

            <div className="mx-auto flex max-w-5xl items-center justify-between">

              <div className="flex min-w-0 items-center gap-4">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5e5e2] sm:h-14 sm:w-14">

                  <img
                    src="/aliben-ai-mascot.png"
                    alt="ALIBEN AI"
                    className="h-10 w-10 object-contain sm:h-12 sm:w-12"
                  />

                </div>

                <div className="min-w-0">

                  {isEditingTitle ? (

                    <div className="flex gap-2">

                      <input
                        autoFocus
                        value={
                          newTitle
                        }
                        onChange={(
                          event
                        ) =>
                          setNewTitle(
                            event.target
                              .value
                          )
                        }
                        onKeyDown={(
                          event
                        ) => {

                          if (
                            event.key ===
                            "Enter"
                          ) {
                            saveTitle();
                          }

                          if (
                            event.key ===
                            "Escape"
                          ) {
                            setIsEditingTitle(
                              false
                            );
                          }

                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-lg font-bold outline-none focus:border-[#a51d20]"
                      />

                      <button
                        onClick={
                          saveTitle
                        }
                        className="rounded-lg bg-[#a51d20] px-4 text-sm font-bold text-white"
                      >
                        Salva
                      </button>

                    </div>

                  ) : (

                    <>
                      <div className="flex min-w-0 items-center gap-2">

                        <h1 className="truncate text-base font-black sm:text-xl">
                          {activeChat?.title ||
                            "Nuova chat"}
                        </h1>

                        <button
                          onClick={
                            startRename
                          }
                          disabled={
                            isTyping
                          }
                          className="text-gray-400 transition hover:text-[#a51d20]"
                          title="Rinomina chat"
                        >
                          ✎
                        </button>

                      </div>

                      <div className="mt-1 text-xs text-gray-400">
                        Conversazione cliente
                      </div>

                    </>

                  )}

                </div>

              </div>

              <div className="hidden gap-2 sm:flex">

                <button
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e3dd] bg-white text-gray-500 transition hover:bg-gray-50"
                  title="Fissa chat"
                >
                  📌
                </button>

                <button
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e3dd] bg-white text-gray-500 transition hover:bg-gray-50"
                  title="Altre opzioni"
                >
                  •••
                </button>

              </div>

            </div>

          </div>

          {/* =====================================
              AREA CHAT
          ===================================== */}

          <div
            className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-10"
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

            <div className="mx-auto w-full max-w-5xl px-0.5 sm:px-0">

              <div className="flex flex-col gap-5">

                {isTyping && (
                  <ChatMessage
                    role="assistant"
                    text="Sto scrivendo..."
                  />
                )}

                {activeChat &&
                  [
                    ...activeChat.messages,
                  ]
                    .reverse()
                    .map(
                      (
                        message,
                        index
                      ) => (
                        <ChatMessage
                          key={`${activeChat.id}-${index}`}
                          role={
                            message.role
                          }
                          text={
                            message.text
                          }
                          image={
                            message.image
                          }
                        />
                      )
                    )}

              </div>

              {activeChat &&
                activeChat.messages.length ===
                  0 && (

                  <div className="flex min-h-[220px] items-center justify-center px-3 py-8 sm:min-h-[430px]">

                    <div className="text-center">

                      <img
                        src="/aliben-ai-mascot.png"
                        alt="ALIBEN AI"
                        className="mx-auto mb-5 h-28 w-28 object-contain drop-shadow-sm sm:mb-8 sm:h-44 sm:w-44"
                      />

                      <h2 className="text-2xl font-black tracking-tight text-[#171717] sm:text-3xl">
                        Come posso aiutarti?
                      </h2>

                      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500 sm:mt-3 sm:text-[15px] sm:leading-7">
                        Chiedimi informazioni
                        su prodotti, dosaggi,
                        ricette, ingredienti,
                        cataloghi e soluzioni
                        tecniche ALIBEN.
                      </p>

                    </div>

                  </div>

                )}

            </div>

          </div>

          {/* =====================================
              INPUT
          ===================================== */}

          <div className="shrink-0 border-t border-[#e8e3dd] bg-white px-3 py-3 sm:px-4 sm:py-4 lg:px-10">

            <div className="mx-auto max-w-5xl">

              <SearchBox
                onSend={
                  handleSend
                }
                disabled={
                  isTyping ||
                  !activeChat
                }
              />

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}