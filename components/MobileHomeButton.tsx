"use client";

import { usePathname, useRouter } from "next/navigation";

export default function MobileHomeButton() {
  const router = useRouter();
  const pathname = usePathname();

  const buttons = [
    {
      label: "Home",
      icon: "🏠",
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e5e0da] bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around gap-1">
        {buttons.map((button) => {
          const active =
            button.path === "/"
              ? pathname === "/"
              : pathname.startsWith(button.path);

          return (
            <button
              key={button.path}
              type="button"
              onClick={() => router.push(button.path)}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 transition ${
                active
                  ? "bg-[#f7e7e5] text-[#a51d20]"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className="text-xl leading-none">
                {button.icon}
              </span>

              <span
                className={`mt-1 text-[11px] font-bold ${
                  active
                    ? "text-[#a51d20]"
                    : "text-gray-500"
                }`}
              >
                {button.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}