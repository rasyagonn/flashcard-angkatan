"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/add", label: "Add" },
  { href: "/play", label: "Play" },
  { href: "/rank", label: "Rank" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-coral font-display text-lg font-extrabold text-paper shadow-[2px_2px_0_0_var(--ink)] transition-transform group-hover:-rotate-6">
            FC
          </span>
          <span className="font-display text-lg leading-none font-extrabold">
            FlashCard <span className="text-coral-deep">Angkatan</span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1.5">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-xl px-3.5 py-2 font-display text-sm font-bold transition ${
                  active
                    ? "bg-ink text-paper"
                    : "text-ink hover:bg-ink/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}