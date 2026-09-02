"use client";

import { usePathname, useRouter } from "next/navigation";

export default function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const items = [
    {
      label: "Chat",
      icon: "💬",
      path: "/",
    },
    {
      label: "Clienti",
      icon: "👥",
      path: "/clienti",
    },
    {
      label: "Admin",
      icon: "⚙️",
      path: "/admin",
    },
    {
      label: "Instagram",
      icon: "📸",
      path: "/instagram",
    },
  ];

  return (
    <aside className="hidden w-[210px] shrink-0 flex-col bg-[#211f1d] px-4 py-5 md:flex">
      
      {/* LOGO */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mb-8 flex items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white/5"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow">
          <img
            src="/aliben-ai-mascot.png"
            alt="ALIBEN AI"
            className="h-10 w-10 object-contain"
          />
        </div>

        <div>
          <div className="text-base font-black tracking-tight text-white">
            ALIBEN
          </div>

          <div className="-mt-1 text-xs font-bold text-[#c43a3f]">
            AI
          </div>
        </div>
      </button>

      {/* MENU */}
      <nav className="flex flex-1 flex-col gap-2">
        {items.map((item) => {
          const active =
            item.path === "/"
              ? pathname === "/"
              : pathname.startsWith(item.path);

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => router.push(item.path)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${
                active
                  ? "bg-[#a51d20] text-white shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex w-7 justify-center text-lg">
                {item.icon}
              </span>

              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="border-t border-white/10 pt-4 text-center text-[10px] text-white/30">
        ALIBEN AI
      </div>
    </aside>
  );
}