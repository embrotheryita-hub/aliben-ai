"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError("");
    setLoading(true);

    console.log("LOGIN: inizio");
    console.log("LOGIN: email", email);

    try {
      const supabase = createClient();

      const loginPromise =
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      const timeoutPromise =
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Il server non ha risposto entro 10 secondi. Controlla la connessione."
              )
            );
          }, 10000);
        });

      const result =
        await Promise.race([
          loginPromise,
          timeoutPromise,
        ]);

      console.log(
        "LOGIN: risposta",
        result.error
      );

      if (result.error) {
        console.error(
          "SUPABASE LOGIN ERROR:",
          result.error
        );

        setError(
          result.error.message ||
            "Email o password non corrette."
        );

        setLoading(false);
        return;
      }

      console.log(
        "LOGIN: autenticazione riuscita"
      );

      const {
        data: {
          session,
        },
      } = await supabase.auth.getSession();

      console.log(
        "LOGIN: sessione",
        session ? "OK" : "MANCANTE"
      );

      if (!session) {
        setError(
          "Accesso effettuato, ma la sessione non è stata creata. Riprova."
        );

        setLoading(false);
        return;
      }

      console.log(
        "LOGIN: redirect home"
      );

      router.replace("/");
      router.refresh();

    } catch (err) {
      console.error(
        "LOGIN: errore generale",
        err
      );

      if (
        err instanceof Error
      ) {
        setError(
          err.message ||
            "Errore durante l'accesso."
        );
      } else {
        setError(
          "Errore durante l'accesso."
        );
      }

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5f2]">
      <div className="flex min-h-screen">

        {/* =====================================
            PARTE SINISTRA
        ===================================== */}

        <div className="hidden w-1/2 flex-col justify-between bg-[#211f1d] p-12 text-white lg:flex">

          <div>

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#f5e5e2]">

                <img
                  src="/aliben-ai-mascot.png"
                  alt="ALIBEN AI"
                  className="h-14 w-14 object-contain"
                />

              </div>

              <div>

                <div className="text-3xl font-black tracking-tight">
                  ALIBEN
                </div>

                <div className="-mt-1 text-lg font-bold text-[#c43a3f]">
                  AI
                </div>

              </div>

            </div>

          </div>

          <div className="max-w-lg">

            <img
              src="/aliben-ai-mascot.png"
              alt="ALIBEN AI"
              className="mb-8 h-64 w-64 object-contain"
            />

            <h1 className="text-5xl font-black leading-tight">
              Il tuo assistente
              <br />
              tecnico e commerciale.
            </h1>

            <p className="mt-6 text-lg leading-8 text-white/60">
              Prodotti, ricette, schede tecniche,
              cataloghi e supporto commerciale.
              Tutto in un unico posto.
            </p>

          </div>

          <div className="text-sm text-white/40">
            ALIBEN AI · Assistente interno
          </div>

        </div>

        {/* =====================================
            LOGIN
        ===================================== */}

        <div className="flex flex-1 items-center justify-center px-6 py-12">

          <div className="w-full max-w-md">

            {/* MOBILE LOGO */}

            <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">

              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#f5e5e2]">

                <img
                  src="/aliben-ai-mascot.png"
                  alt="ALIBEN AI"
                  className="h-12 w-12 object-contain"
                />

              </div>

              <div>

                <div className="text-2xl font-black">
                  ALIBEN
                </div>

                <div className="-mt-1 font-bold text-[#a51d20]">
                  AI
                </div>

              </div>

            </div>

            {/* TITOLO */}

            <div className="mb-8">

              <h2 className="text-3xl font-black tracking-tight">
                Bentornato
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Accedi al tuo account ALIBEN AI.
              </p>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >

              {/* EMAIL */}

              <div>

                <label className="mb-2 block text-sm font-bold text-gray-700">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  placeholder="nome@aliben.it"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#a51d20] focus:ring-2 focus:ring-[#a51d20]/10"
                />

              </div>

              {/* PASSWORD */}

              <div>

                <div className="mb-2 flex items-center justify-between">

                  <label className="block text-sm font-bold text-gray-700">
                    Password
                  </label>

                  <button
                    type="button"
                    className="text-xs font-semibold text-[#a51d20] hover:underline"
                    onClick={() => {
                      setError(
                        "Il recupero password verrà attivato a breve."
                      );
                    }}
                  >
                    Password dimenticata?
                  </button>

                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#a51d20] focus:ring-2 focus:ring-[#a51d20]/10"
                />

              </div>

              {/* ERRORE */}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {/* BOTTONE */}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#a51d20] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#8e191c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Accesso in corso..."
                  : "Accedi"}
              </button>

            </form>

            {/* SEPARATORE */}

            <div className="my-8 flex items-center gap-4">

              <div className="h-px flex-1 bg-gray-200" />

              <span className="text-xs text-gray-400">
                Accesso agenti
              </span>

              <div className="h-px flex-1 bg-gray-200" />

            </div>

            {/* INFO */}

            <p className="text-center text-xs leading-5 text-gray-400">
              Questo accesso è riservato agli
              agenti e collaboratori autorizzati
              ALIBEN.
            </p>

          </div>

        </div>

      </div>
    </main>
  );
}