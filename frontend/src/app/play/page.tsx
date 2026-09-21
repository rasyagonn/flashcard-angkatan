"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  endSession,
  getRound,
  photoUrl,
  submitAnswer,
  type PlayAnswerRecord,
  type PlayAnswerResult,
  type PlayRound,
} from "@/lib/api";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClose,
  IconPlay,
  IconPlus,
  IconRotate,
  IconStar,
  IconTarget,
  IconTrophy,
} from "@/components/icons";

type Phase = "start" | "loading" | "playing" | "feedback" | "finished";
type FeedbackKind = "correct" | "wrong";

interface SessionSummary {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
  pointsEarned: number;
}

const LETTERS = ["A", "B", "C", "D"];
const LETTER_COLORS = ["bg-blue", "bg-sun", "bg-berry", "bg-teal"];

export default function PlayPage() {
  const [phase, setPhase] = useState<Phase>("start");
  const [error, setError] = useState<string | null>(null);

  const [card, setCard] = useState<PlayRound | null>(null);
  const [answeredIds, setAnsweredIds] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [lastResult, setLastResult] = useState<PlayAnswerResult | null>(null);
  const [records, setRecords] = useState<PlayAnswerRecord[]>([]);

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const sessionRef = useRef({
    correct: 0,
    wrong: 0,
    ids: [] as number[],
    records: [] as PlayAnswerRecord[],
  });

  const beginSession = useCallback(async () => {
    sessionRef.current = { correct: 0, wrong: 0, ids: [], records: [] };
    setCorrectCount(0);
    setWrongCount(0);
    setAnsweredIds([]);
    setRecords([]);
    setSummary(null);
    setError(null);
    setPhase("loading");
    try {
      const round = await getRound([]);
      if (round.finished) {
        setError("Belum ada kartu untuk dimainkan. Tambahkan data mahasiswa berfoto dulu di halaman Add.");
        setPhase("start");
        return;
      }
      setCard(round);
      setPhase("playing");
    } catch (e) {
      setError((e as Error).message);
      setPhase("start");
    }
  }, []);

  const nextCard = useCallback(async () => {
    setPhase("loading");
    try {
      const round = await getRound(sessionRef.current.ids);
      if (round.finished) {
        // sesi selesai → simpan history + detail jawaban (untuk evaluasi)
        const total = sessionRef.current.correct + sessionRef.current.wrong;
        const result = await endSession({
          total_cards: total,
          correct_count: sessionRef.current.correct,
          wrong_count: sessionRef.current.wrong,
          answers: sessionRef.current.records,
        });
        const accuracy =
          total > 0
            ? Math.round((sessionRef.current.correct / total) * 10000) / 100
            : 0;
        setSummary({
          total,
          correct: sessionRef.current.correct,
          wrong: sessionRef.current.wrong,
          accuracy,
          pointsEarned: result.points_earned,
        });
        setPhase("finished");
        return;
      }
      setCard(round);
      setPhase("playing");
    } catch (e) {
      setError((e as Error).message);
      setPhase("start");
    }
  }, []);

  async function handleAnswer(optionId: number) {
    if (!card) return;
    setPhase("feedback");
    try {
      const result = await submitAnswer(card.card_id, optionId);
      setLastResult(result);
      setCurrentPoints(result.current_points);

      const chosen = card.options.find((o) => o.id === optionId);
      sessionRef.current.records.push({
        student_id: card.card_id,
        student_name: result.correct_name,
        photo_path: card.photo_url,
        chosen_name: chosen?.name ?? "",
        correct: result.correct,
        points_delta: result.points_delta,
      });
      setRecords([...sessionRef.current.records]);

      if (result.correct) {
        sessionRef.current.correct++;
        setCorrectCount(sessionRef.current.correct);
      } else {
        sessionRef.current.wrong++;
        setWrongCount(sessionRef.current.wrong);
      }
      sessionRef.current.ids.push(card.card_id);
      setAnsweredIds([...sessionRef.current.ids]);
    } catch (e) {
      setError((e as Error).message);
      setPhase("playing");
    }
  }

  function handleNext() {
    setLastResult(null);
    nextCard();
  }

  useEffect(() => {
    beginSession();
  }, [beginSession]);

  // ── Tampilan ───────────────────────────────────────────

  if (phase === "start") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <span className="chip bg-coral text-paper">Siap-siap hafalan</span>
        <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
          Tebak <span className="text-coral-deep">Namanya!</span>
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-ink-soft">
          Foto muncul, kamu pilih siapa namanya dari 4 opsi.{" "}
          <strong className="text-ink">Benar +2 poin</strong>,{" "}
          <strong className="text-ink">salah -1 poin</strong>.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="chip bg-good text-paper">+2 kalau benar</span>
          <span className="chip bg-bad text-paper">-1 kalau salah</span>
          <span className="chip bg-ink text-paper">skor gak pernah minus</span>
        </div>

        {error && (
          <div className="animate-pop max-w-md rounded-xl border-2 border-bad/50 bg-bad/10 px-4 py-3 text-sm font-medium text-bad">
            {error}
          </div>
        )}

        <div className="mt-2 flex flex-wrap justify-center gap-4">
          <button onClick={beginSession} className="btn btn-coral px-8 py-3.5 text-lg">
            <IconPlay className="h-5 w-5" /> Mulai Main
          </button>
          <Link href="/add" className="btn btn-ghost px-6 py-3.5 text-lg">
            <IconPlus className="h-5 w-5" /> Atur data dulu
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-4">
          <span className="chip animate-pulse bg-sun text-ink">
            Menyiapkan kartu…
          </span>
          <div className="h-2 w-40 animate-pulse rounded-full bg-ink/20" />
        </div>
      </main>
    );
  }

  if (phase === "finished" && summary) {
    const wrong = records.filter((r) => !r.correct);
    const stats = [
      {
        label: "Benar",
        value: String(summary.correct),
        bar: "bg-good text-paper",
        icon: <IconCheck className="h-4 w-4" />,
      },
      {
        label: "Salah",
        value: String(summary.wrong),
        bar: "bg-bad text-paper",
        icon: <IconClose className="h-4 w-4" />,
      },
      {
        label: "Akurasi",
        value: `${summary.accuracy}%`,
        bar: "bg-blue text-paper",
        icon: <IconTarget className="h-4 w-4" />,
      },
      {
        label: "Poin sesi",
        value: `+${summary.pointsEarned}`,
        bar: "bg-sun text-ink",
        icon: <IconStar className="h-4 w-4" />,
      },
    ];
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
        <div className="card animate-pop p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink bg-sun shadow-[3px_3px_0_0_var(--ink)]">
            <IconTrophy className="h-7 w-7 text-ink" />
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight">
            Sesi <span className="text-teal-deep">Beres!</span>
          </h1>
          <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`${s.bar} rounded-xl border-2 border-ink p-4 shadow-[3px_3px_0_0_var(--ink)]`}
              >
                <p>{s.icon}</p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                  {s.value}
                </p>
                <p className="text-[11px] font-bold tracking-widest uppercase opacity-80">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-ink-soft">
            {summary.total} kartu dimainkan — sekarang kamu pegang{" "}
            <strong className="inline-flex items-center gap-1.5 font-display text-base text-ink">
              <IconStar className="h-4 w-4 text-sun" /> {currentPoints} poin
            </strong>
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <button onClick={beginSession} className="btn btn-teal px-7 py-3 text-lg">
              <IconRotate className="h-5 w-5" /> Main Lagi
            </button>
            <Link href="/rank" className="btn btn-ghost px-7 py-3 text-lg">
              <IconTrophy className="h-5 w-5" /> Lihat Reward
            </Link>
          </div>
        </div>

        {/* Evaluasi */}
        <section className="card p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="section-title text-xl">Evaluasi</h2>
            {wrong.length > 0 ? (
              <span className="chip ml-auto bg-bad text-paper tabular-nums">
                {wrong.length} salah
              </span>
            ) : (
              <span className="chip ml-auto bg-good text-paper">
                Nggak ada yang salah
              </span>
            )}
          </div>

          {wrong.length === 0 ? (
            <p className="mt-4 rounded-xl border-2 border-good/40 bg-good/10 px-4 py-3 text-sm font-medium text-good">
              Semua jawaban benar. Hafalanmu tajam — lanjut ke level berikutnya!
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {records.map((r, i) => {
                const url = photoUrl(r.photo_path);
                return (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 ${
                      r.correct
                        ? "border-ink/15 bg-paper"
                        : "border-bad/50 bg-bad/10"
                    }`}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={r.student_name}
                        className="h-12 w-12 shrink-0 rounded-lg border-2 border-ink object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper font-display font-extrabold text-ink-soft">
                        ?
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-bold">
                        {r.student_name}
                      </p>
                      {r.correct ? (
                        <p className="text-xs text-ink-soft">
                          Dijawab benar
                        </p>
                      ) : (
                        <p className="truncate text-xs text-ink-soft">
                          Kamu jawab{" "}
                          <span className="font-semibold text-bad line-through">
                            {r.chosen_name || "—"}
                          </span>
                        </p>
                      )}
                    </div>
                    {r.correct ? (
                      <IconCheck className="h-4 w-4 shrink-0 text-good" />
                    ) : (
                      <IconClose className="h-4 w-4 shrink-0 text-bad" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {error && (
          <div className="animate-pop mx-auto max-w-md rounded-xl border-2 border-bad/50 bg-bad/10 px-4 py-3 text-sm font-medium text-bad">
            {error}
          </div>
        )}
      </main>
    );
  }

  // playing / feedback
  if (!card) return null;
  const feedbackKind: FeedbackKind | null = lastResult
    ? lastResult.correct
      ? "correct"
      : "wrong"
    : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      {/* Header skor */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="btn btn-ghost btn-sm">
          <IconArrowLeft className="h-4 w-4" /> Keluar
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-good text-paper">
            <IconCheck className="h-3.5 w-3.5" /> {correctCount}
          </span>
          <span className="chip bg-bad text-paper">
            <IconClose className="h-3.5 w-3.5" /> {wrongCount}
          </span>
          <span className="chip bg-ink text-paper tabular-nums">
            <IconStar className="h-3.5 w-3.5" /> {currentPoints} poin
          </span>
        </div>
      </div>

      {/* Kartu */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="relative w-full max-w-sm">
          {/* Sticker badge */}
          <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rotate-[-3deg] rounded-xl border-2 border-ink bg-coral px-4 py-1.5 font-display text-sm font-extrabold tracking-wider text-paper uppercase shadow-[3px_3px_0_0_var(--ink)]">
            Siapa namanya?
          </span>

          <div className="card flex flex-col items-center p-7 pt-9 text-center">
            {(() => {
              const url = photoUrl(card.photo_url);
              return url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt="Foto mahasiswa"
                  className="mx-auto h-56 w-56 rounded-2xl border-2 border-ink object-cover shadow-[4px_4px_0_0_var(--sun-deep)] sm:h-64 sm:w-64"
                />
              ) : (
                <div className="mx-auto grid h-56 w-56 place-items-center rounded-2xl border-2 border-ink bg-paper font-display text-6xl font-extrabold text-ink-soft sm:h-64 sm:w-64">
                  ?
                </div>
              );
            })()}
            <p className="mt-5 text-sm font-semibold tracking-widest text-ink-soft uppercase">
              Ini siapa ya…
            </p>
          </div>
        </div>

        {/* Opsi atau feedback */}
        {phase === "feedback" && lastResult ? (
          <div
            key={card.card_id}
            className={`animate-pop w-full max-w-sm rounded-2xl border-2 border-ink px-6 py-5 text-center shadow-[4px_4px_0_0_var(--ink)] ${
              feedbackKind === "correct" ? "bg-teal" : "animate-shake bg-coral"
            }`}
          >
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border-2 border-ink bg-paper shadow-[2px_2px_0_0_var(--ink)]">
              {feedbackKind === "correct" ? (
                <IconCheck className="h-6 w-6 text-good" />
              ) : (
                <IconClose className="h-6 w-6 text-bad" />
              )}
            </span>
            <p className="mt-2 font-display text-2xl font-extrabold text-paper">
              {lastResult.correct ? "Benar!" : "Salah!"}
            </p>
            {!lastResult.correct && (
              <p className="mt-1 font-medium text-paper/90">
                Jawabannya:{" "}
                <strong className="underline">{lastResult.correct_name}</strong>
              </p>
            )}
            <p className="mt-1 inline-flex items-center justify-center gap-1.5 font-display text-lg font-bold tabular-nums text-paper">
              {lastResult.points_delta > 0 ? "+" : ""}
              {lastResult.points_delta} poin
              <IconStar className="h-4 w-4" /> {currentPoints}
            </p>
            <button onClick={handleNext} className="btn btn-ink mx-auto mt-4 px-8">
              Lanjut <IconArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2">
            {card.options.map((opt, i) => (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                disabled={phase !== "playing"}
                className="card group flex items-center gap-3 px-4 py-3.5 text-left transition-transform hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--ink)] disabled:opacity-50"
              >
                <span
                  className={`${LETTER_COLORS[i % LETTER_COLORS.length]} grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-ink font-display text-sm font-extrabold text-ink shadow-[2px_2px_0_0_var(--ink)] transition-transform group-hover:rotate-6`}
                >
                  {LETTERS[i]}
                </span>
                <span className="font-display font-bold">{opt.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}