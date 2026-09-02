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
      className={`flex items-start gap-3 ${
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
        className={`max-w-[80%] rounded-2xl px-5 py-4 shadow ${
          isUser
            ? "bg-red-900 text-white"
            : "bg-white text-black"
        }`}
      >
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
          <div className="mb-3 overflow-hidden rounded-xl">
            <img
              src={image}
              alt="Foto allegata"
              className="max-h-[320px] w-full rounded-xl object-contain"
            />
          </div>
        )}

        {isTyping ? (
          <div className="flex gap-2 py-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />

            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0.2s]" />

            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0.4s]" />
          </div>
        ) : (
          <div
            className="
              text-[16px]
              leading-7

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
            "
          >
            <ReactMarkdown>
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