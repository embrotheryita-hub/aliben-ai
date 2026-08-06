"use client";

import { useState } from "react";
import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";
import QuickActions from "@/components/QuickActions";
import ChatMessage from "@/components/ChatMessage";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  async function handleSend(message: string) {
    if (!message.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: message,
      },
    ]);

    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Errore durante la risposta.",
        },
      ]);
    }

    setIsTyping(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-100 to-stone-200">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6">
        <Header />

        <SearchBox
          onSend={handleSend}
          disabled={isTyping}
        />

        <QuickActions />

        <div className="mx-auto mt-10 w-full max-w-3xl space-y-4">
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              role={message.role}
              text={message.text}
            />
          ))}

          {isTyping && (
            <ChatMessage
              role="assistant"
              text="Sto scrivendo..."
            />
          )}
        </div>
      </div>
    </main>
  );
}