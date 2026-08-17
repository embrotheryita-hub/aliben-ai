"use client";

import {
  useEffect,
  useState,
} from "react";

type InstagramPost = {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string;
  permalink: string;
  timestamp: string;
};

export default function InstagramPage() {
  const [posts, setPosts] =
    useState<InstagramPost[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadInstagram() {
      try {
        const response =
          await fetch(
            "/api/instagram",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setError(
            data.error ||
              "Errore nel recupero di Instagram."
          );

          return;
        }

        setPosts(
          Array.isArray(data.posts)
            ? data.posts
            : []
        );

        if (data.message) {
          setError(data.message);
        }
      } catch (error) {
        console.error(
          "ERRORE INSTAGRAM:",
          error
        );

        setError(
          "Impossibile collegarsi a Instagram."
        );
      } finally {
        setLoading(false);
      }
    }

    loadInstagram();
  }, []);

  function formatDate(
    timestamp: string
  ) {
    if (!timestamp) {
      return "";
    }

    const date =
      new Date(timestamp);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "it-IT",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(date);
  }

  return (
    <main className="min-h-screen bg-[#f7f5f2]">

      <div className="flex min-h-screen">

        {/* SIDEBAR */}

        <aside className="hidden w-[190px] shrink-0 flex-col bg-[#211f1d] px-3 py-5 md:flex">

          <div className="mb-8 flex items-center justify-center">

            <button
              type="button"
              onClick={() =>
                (window.location.href = "/")
              }
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow"
              title="Torna alla chat"
            >
              <img
                src="/aliben-ai-mascot.png"
                alt="ALIBEN AI"
                className="h-11 w-11 object-contain"
              />
            </button>

          </div>

          <div className="flex flex-1 flex-col gap-2">

            <button
              type="button"
              onClick={() =>
                (window.location.href = "/")
              }
              className="flex h-12 w-full items-center rounded-xl px-4 text-left text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <span className="mr-3 text-lg">
                💬
              </span>

              CHAT
            </button>

            <button
              type="button"
              onClick={() =>
                (window.location.href = "/")
              }
              className="flex h-12 w-full items-center rounded-xl px-4 text-left text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <span className="mr-3 text-lg">
                📖
              </span>

              KNOWLEDGE
            </button>

            <button
              type="button"
              onClick={() =>
                (window.location.href = "/")
              }
              className="flex h-12 w-full items-center rounded-xl px-4 text-left text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <span className="mr-3 text-lg">
                🗂️
              </span>

              DOCUMENTI
            </button>

            <button
              type="button"
              onClick={() =>
                (window.location.href = "/clienti")
              }
              className="flex h-12 w-full items-center rounded-xl px-4 text-left text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <span className="mr-3 text-lg">
                👥
              </span>

              CLIENTI
            </button>

            <button
              type="button"
              className="flex h-12 w-full items-center rounded-xl bg-[#a51d20] px-4 text-left text-sm font-bold text-white shadow"
            >
              <span className="mr-3 text-lg">
                📸
              </span>

              INSTAGRAM
            </button>

            <button
              type="button"
              className="flex h-12 w-full items-center rounded-xl px-4 text-left text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <span className="mr-3 text-lg">
                ⚙️
              </span>

              IMPOSTAZIONI
            </button>

          </div>

        </aside>

        {/* CONTENUTO */}

        <section className="flex min-w-0 flex-1 flex-col">

          <header className="flex shrink-0 items-center justify-between border-b border-[#e8e3dd] bg-white px-6 py-5 lg:px-10">

            <div>

              <h1 className="text-2xl font-black tracking-tight">
                INSTAGRAM ALIBEN
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Scopri le ultime novità,
                prodotti, eventi e contenuti
                dal mondo ALIBEN.
              </p>

            </div>

            <a
              href={
                process.env
                  .NEXT_PUBLIC_INSTAGRAM_PROFILE_URL ||
                "https://www.instagram.com/"
              }
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#8e191c] sm:block"
            >
              📸 Apri profilo Instagram ↗
            </a>

          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">

            <div className="mx-auto max-w-7xl">

              <div className="mb-6 flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5e5e2] text-xl">
                  📸
                </div>

                <div>

                  <h2 className="text-xl font-black">
                    Ultimi post
                  </h2>

                  <p className="text-sm text-gray-500">
                    Contenuti aggiornati dal
                    profilo Instagram aziendale.
                  </p>

                </div>

              </div>

              {loading && (
                <div className="rounded-2xl border border-[#e8e3dd] bg-white p-10 text-center text-sm text-gray-500">
                  Caricamento dei post Instagram...
                </div>
              )}

              {!loading &&
                error &&
                posts.length === 0 && (
                  <div className="rounded-2xl border border-[#ead9d6] bg-white p-8">

                    <div className="text-lg font-black">
                      Instagram non è ancora collegato
                    </div>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                      {error}
                    </p>

                    <div className="mt-5 rounded-xl bg-[#f7f5f2] p-4 text-sm text-gray-600">

                      <div className="font-bold text-gray-800">
                        Cosa faremo
                      </div>

                      <div className="mt-1">
                        Collegheremo l'account
                        Instagram professionale
                        tramite le API Meta, così
                        questa pagina potrà mostrare
                        automaticamente gli ultimi
                        post.
                      </div>

                    </div>

                  </div>
                )}

              {!loading &&
                !error &&
                posts.length === 0 && (
                  <div className="rounded-2xl border border-[#e8e3dd] bg-white p-10 text-center text-sm text-gray-500">
                    Nessun post disponibile al momento.
                  </div>
                )}

              {posts.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                  {posts.map(
                    (post) => (
                      <a
                        key={post.id}
                        href={
                          post.permalink ||
                          "#"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-2xl border border-[#e8e3dd] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      >

                        <div className="aspect-square overflow-hidden bg-[#eeeae5]">

                          {post.mediaUrl ? (
                            <img
                              src={post.mediaUrl}
                              alt={
                                post.caption ||
                                "Post Instagram ALIBEN"
                              }
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-4xl">
                              📸
                            </div>
                          )}

                        </div>

                        <div className="p-4">

                          <div className="line-clamp-3 text-sm leading-5 text-gray-700">
                            {post.caption ||
                              "Post Instagram ALIBEN"}
                          </div>

                          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">

                            <span>
                              {formatDate(
                                post.timestamp
                              )}
                            </span>

                            <span className="font-bold text-[#a51d20]">
                              Apri ↗
                            </span>

                          </div>

                        </div>

                      </a>
                    )
                  )}

                </div>
              )}

            </div>

          </div>

          {/* ROBERTO */}

          <div className="shrink-0 border-t border-[#e8e3dd] bg-white px-6 py-4 lg:px-10">

            <div className="flex justify-end">

              <div className="rounded-2xl border border-[#ead9d6] bg-[#fff8f7] px-5 py-3 text-right shadow-sm">

                <div className="text-xs font-semibold text-gray-500">
                  Per qualsiasi altra cosa,
                </div>

                <div className="text-sm font-bold text-[#171717]">
                  chiama il nostro tecnico Roberto
                </div>

                <a
                  href="tel:3666093385"
                  className="mt-1 inline-flex items-center gap-2 text-base font-black text-[#a51d20] hover:underline"
                >
                  📞 366 609 3385
                </a>

              </div>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}