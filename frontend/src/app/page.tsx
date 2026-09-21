import Link from "next/link";

const menus = [
  {
    href: "/add",
    title: "Add",
    desc: "Kelola data mahasiswa — tambah, edit, hapus, dan import CSV",
  },
  {
    href: "/play",
    title: "Play",
    desc: "Bermain flashcard: tebak nama dari foto, kumpulkan poin",
  },
  {
    href: "/rank",
    title: "Rank",
    desc: "Pantau poin, klaim self-reward, dan lihat statistik",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          📇 FlashCard Angkatan
        </h1>
        <p className="mt-3 max-w-md text-zinc-500">
          Hafalkan nama mahasiswa seangkatanku lewat permainan flashcard.
          Lihat foto → tebak nama → kumpulkan poin → klaim self-reward.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {menus.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-2xl border border-zinc-200 p-6 transition hover:border-zinc-400 hover:shadow-md dark:border-zinc-800"
          >
            <h2 className="text-xl font-semibold group-hover:underline">
              {m.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{m.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}