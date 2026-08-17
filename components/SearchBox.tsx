"use client";

import { useState } from "react";

type SearchBoxProps = {
  onSend: (message: string) => void;
  disabled: boolean;
};

export default function SearchBox({
  onSend,
  disabled,
}: SearchBoxProps) {
  const [message, setMessage] = useState("");

  function handleClick() {
    if (!message.trim()) return;

    onSend(message);
    setMessage("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">

      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg">

        <div className="flex items-end gap-3">

          <textarea
            rows={2}
            value={message}
            disabled={disabled}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();
                handleClick();
              }
            }}
            placeholder="Chiedi qualsiasi cosa... Es. Il cliente vuole una brioche più soffice e con una shelf life di 5 giorni."
            className="min-h-[58px] flex-1 resize-none border-none bg-transparent px-1 py-1 text-[15px] leading-6 outline-none placeholder:text-gray-400 disabled:opacity-50"
          />

          <button
            onClick={handleClick}
            disabled={
              disabled ||
              !message.trim()
            }
            className="shrink-0 rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8e191c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {disabled
              ? "Attendi..."
              : "Invia"}
          </button>

        </div>

      </div>

    </div>
  );
}