type ChatMessageProps = {
  role: "user" | "assistant";
  text: string;
};

export default function ChatMessage({
  role,
  text,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isTyping = text === "Sto scrivendo...";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-4 shadow ${
          isUser
            ? "bg-red-900 text-white"
            : "bg-white text-black"
        }`}
      >
        <p className="mb-2 text-sm font-bold">
          {isUser ? "👤 Tu" : "🤖 ALIBEN AI"}
        </p>

        {isTyping ? (
          <div className="flex gap-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500"></span>
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0.2s]"></span>
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0.4s]"></span>
          </div>
        ) : (
          <p>{text}</p>
        )}
      </div>
    </div>
  );
}