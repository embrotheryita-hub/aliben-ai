import ReactMarkdown from "react-markdown";

type ChatMessageProps = {
  role: "user" | "assistant";
  text: string;
  image?: string;
};

export default function ChatMessage({
  role,
  text,
  image,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isTyping = text === "Sto scrivendo...";

  return (
    <div
      className={`flex min-w-0 items-start gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5e5e2]">
          <img
            src="/aliben-ai-mascot.png"
            alt="ALIBEN AI"
            className="h-9 w-9 object-contain"
          />
        </div>
      )}

      <div
        className={`min-w-0 max-w-[80%] overflow-hidden rounded-2xl px-5 py-4 shadow ${
          isUser
            ? "bg-red-900 text-white"
            : "bg-white text-black"
        }`}
      >
        {/* NOME */}

        <p
          className={`mb-2 text-sm font-bold ${
            isUser
              ? "text-white"
              : "text-[#a51d20]"
          }`}
        >
          {isUser ? "Tu" : "ALIBEN AI"}

          {!isUser && (
            <span className="ml-1 text-xs">
              ●
            </span>
          )}
        </p>

        {/* FOTO ALLEGATA */}

        {image && (
          <div className="mb-3 max-w-full overflow-hidden rounded-xl">
            <img
              src={image}
              alt="Foto allegata"
              className="max-h-[320px] max-w-full rounded-xl object-contain"
            />
          </div>
        )}

        {/* RISPOSTA */}

        {isTyping ? (
          <div className="flex gap-2 py-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />

            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0.2s]" />

            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0.4s]" />
          </div>
        ) : (
          <div
            className="
              min-w-0
              max-w-full
              overflow-hidden
              text-[16px]
              leading-7
              break-words
              [overflow-wrap:anywhere]

              [&_p]:mb-3
              [&_p:last-child]:mb-0

              [&_strong]:font-bold

              [&_h1]:mb-3
              [&_h1]:text-xl
              [&_h1]:font-bold

              [&_h2]:mb-3
              [&_h2]:mt-4
              [&_h2]:text-lg
              [&_h2]:font-bold

              [&_h3]:mb-2
              [&_h3]:mt-4
              [&_h3]:text-base
              [&_h3]:font-bold

              [&_ul]:mb-3
              [&_ul]:ml-5
              [&_ul]:list-disc

              [&_ol]:mb-3
              [&_ol]:ml-5
              [&_ol]:list-decimal

              [&_li]:mb-1

              [&_hr]:my-4

              [&_pre]:max-w-full
              [&_pre]:overflow-x-auto

              [&_code]:break-words
              [&_code]:[overflow-wrap:anywhere]

              [&_table]:block
              [&_table]:max-w-full
              [&_table]:overflow-x-auto
            "
          >
            <ReactMarkdown
              components={{
                a: ({
                  href,
                  children,
                }) => {
                  const isPdfLink =
                    href?.includes(
                      "/api/documents/pdf"
                    );

                  return (
                    <a
                      href={href}
                      target={
                        isPdfLink
                          ? "_blank"
                          : undefined
                      }
                      rel={
                        isPdfLink
                          ? "noopener noreferrer"
                          : undefined
                      }
                      className={
                        isPdfLink
                          ? `
                            mt-3
                            inline-flex
                            max-w-full
                            items-center
                            gap-2
                            rounded-lg
                            bg-[#a51d20]
                            px-4
                            py-2
                            text-sm
                            font-semibold
                            text-white
                            no-underline
                            transition
                            hover:bg-[#86181b]
                          `
                          : `
                            font-semibold
                            text-blue-700
                            underline
                            hover:text-blue-900
                          `
                      }
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#a51d20] text-xs font-bold text-white">
          TU
        </div>
      )}
    </div>
  );
}