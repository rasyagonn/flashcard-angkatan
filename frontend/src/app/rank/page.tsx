import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rank" };

export default function RankPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-5xl">🏆</p>
      <h1 className="text-2xl font-bold">Rank — Poin & Self-Reward</h1>
      <p className="max-w-md text-zinc-500">
        Fitur ini akan dibangun di <strong>Fase 3</strong>: pantau poin
        kumulatif, daftar reward dengan target, klaim reward, dan statistik
        permainan.
      </p>
      <Link
        href="/"
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        ← Kembali ke Beranda
      </Link>
    </main>
  );
}