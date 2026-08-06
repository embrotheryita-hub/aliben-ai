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
      <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-xl">
        <textarea
          rows={3}
          value={message}
          disabled={disabled}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleClick();
            }
          }}
          placeholder="Chiedi qualsiasi cosa... Es. Il cliente vuole una brioche più soffice e con una shelf life di 5 giorni."
          className="w-full resize-none border-none p-3 text-lg outline-none disabled:opacity-50"
        />

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleClick}
            disabled={disabled}
            className="rounded-xl bg-red-900 px-6 py-3 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {disabled ? "Attendi..." : "Invia"}
          </button>
        </div>
      </div>
    </div>
  );
}