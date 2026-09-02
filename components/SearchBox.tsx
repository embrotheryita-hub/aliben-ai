"use client";

import { useRef, useState } from "react";

type SearchBoxProps = {
  onSend: (message: string, image?: string) => void;
  disabled: boolean;
};

export default function SearchBox({
  onSend,
  disabled,
}: SearchBoxProps) {
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Puoi caricare solo immagini.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result === "string") {
        setImage(result);
        setImageName(file.name);
      }
    };

    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImage(null);
    setImageName("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClick() {
    if (
      (!message.trim() && !image) ||
      disabled
    ) {
      return;
    }

    onSend(
      message.trim() ||
        "Analizza questa immagine e cerca il prodotto ALIBEN più pertinente.",
      image || undefined
    );

    setMessage("");
    removeImage();
  }

  return (
    <div className="mx-auto w-full max-w-3xl">

      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg">

        {/* PREVIEW IMMAGINE */}

        {image && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#ead9d6] bg-[#fff8f7] p-2">

            <img
              src={image}
              alt="Anteprima"
              className="h-16 w-16 rounded-lg object-cover"
            />

            <div className="min-w-0 flex-1">

              <div className="text-xs font-bold text-gray-700">
                Foto allegata
              </div>

              <div className="truncate text-[11px] text-gray-400">
                {imageName}
              </div>

            </div>

            <button
              type="button"
              onClick={removeImage}
              disabled={disabled}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-[#a51d20]"
              title="Rimuovi foto"
            >
              ×
            </button>

          </div>
        )}

        <div className="flex items-end gap-2">

          {/* INPUT FOTO */}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={disabled}
            className="flex h-[58px] w-[48px] shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-xl transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Scatta o carica una foto"
          >
            📷
          </button>

          {/* TESTO */}

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

          {/* INVIA */}

          <button
            type="button"
            onClick={handleClick}
            disabled={
              disabled ||
              (!message.trim() && !image)
            }
            className="shrink-0 rounded-xl bg-[#a51d20] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8e191c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {disabled
              ? "Attendi..."
              : "Invia"}
          </button>

        </div>

        {image && !message.trim() && (
          <div className="mt-2 px-1 text-[11px] text-gray-400">
            Puoi inviare la foto così com'è oppure
            aggiungere una domanda.
          </div>
        )}

      </div>

    </div>
  );
}