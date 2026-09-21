import Link from "next/link";
import { IconArrowRight, IconPlay, IconPlus } from "@/components/icons";

const steps = [
  {
    no: "1",
    color: "bg-blue",
    title: "Lihat foto",
    desc: "Kartu muncul dengan foto seorang teman seangkatan.",
  },
  {
    no: "2",
    color: "bg-coral",
    title: "Tebak namanya",
    desc: "Pilih dari 4 opsi. Benar +2 poin, salah -1.",
  },
  {
    no: "3",
    color: "bg-sun",
    title: "Kumpulin poin",
    desc: "Skor naik kumulatif — makin tajam ingatanmu, makin kaya.",
  },
  {
    no: "4",
    color: "bg-teal",
    title: "Klaim reward",
    desc: "Poin yang nembus target jadi hadiah buat diri sendiri.",
  },
];

const tiles = [
  {
    href: "/add",
    bar: "bg-sun",
    title: "Atur Data",
    desc: "Tambah, edit, hapus mahasiswa + foto, atau import sekaligus dari CSV.",
  },
  {
    href: "/play",
    bar: "bg-coral",
    title: "Main Kartu",
    desc: "Sesi flashcard: tebak nama dari foto, lawan diri sendiri.",
  },
  {
    href: "/rank",
    bar: "bg-teal",
    title: "Rank & Reward",
    desc: "Total poin, progress menuju hadiah, dan riwayat sesi.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      {/* Hero */}
      <section className="flex flex-col items-center text-center">
        <span className="chip bg-sun text-ink">Hafalan satu angkatan</span>
        <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.03] font-extrabold tracking-tight sm:text-6xl">
          Tebak. Kumpulin.{" "}
          <span className="text-coral-deep">Klaim hadiahmu.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          Flashcard buat mengingat nama teman-teman seangkatan. Foto muncul,
          kamu tebak namanya, poin mengalir — lalu self-reward pas poinnya
          nembus target.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link href="/play" className="btn btn-coral px-8 py-3.5 text-lg">
            <IconPlay className="h-5 w-5" /> Main Sekarang
          </Link>
          <Link href="/add" className="btn btn-ghost px-8 py-3.5 text-lg">
            <IconPlus className="h-5 w-5" /> Atur Data Dulu
          </Link>
        </div>
      </section>

      {/* Cara kerja */}
      <section className="mt-20">
        <h2 className="section-title">
          Alurnya <span className="text-teal-deep">gini</span>
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.no} className="card p-5">
              <span
                className={`${s.color} grid h-9 w-9 place-items-center rounded-xl border-2 border-ink font-display text-lg font-extrabold text-ink`}
              >
                {s.no}
              </span>
              <h3 className="mt-3 font-display text-lg font-extrabold">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Fitur */}
      <section className="mt-14 grid gap-5 md:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card group overflow-hidden transition-transform hover:-translate-y-1"
          >
            <span
              className={`${t.bar} block h-3 w-full border-b-2 border-ink`}
            />
            <div className="flex items-start justify-between p-6">
              <div>
                <h3 className="font-display text-2xl font-extrabold group-hover:text-coral-deep">
                  {t.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {t.desc}
                </p>
              </div>
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper text-ink transition-transform group-hover:translate-x-1">
                <IconArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}