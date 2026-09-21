"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  endSession,
  getRound,
  photoUrl,
  submitAnswer,
  type PlayAnswerResult,
  type PlayRound,
} from "@/lib/api";

type Phase = "start" | "loading" | "playing" | "feedback" | "finished";
type FeedbackKind = "correct" | "wrong";

interface SessionSummary {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
  pointsEarned: number;
}

export default function PlayPage() {
  const [phase, setPhase] = useState<Phase>("start");
  const [error, setError] = useState<string | null>(null);

  const [card, setCard] = useState<PlayRound | null>(null);
  const [answeredIds, setAnsweredIds] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [lastResult, setLastResult] = useState<PlayAnswerResult | null>(null);

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const sessionRef = useRef({ correct: 0, wrong: 0, ids: [] as number[] });

  const beginSession = useCallback(async () => {
    sessionRef.current = { correct: 0, wrong: 0, ids: [] };
    setCorrectCount(0);
    setWrongCount(0);
    setAnsweredIds([]);
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
        // sesi selesai → simpan history
        const total =
          sessionRef.current.correct + sessionRef.current.wrong;
        const result = await endSession({
          total_cards: total,
          correct_count: sessionRef.current.correct,
          wrong_count: sessionRef.current.wrong,
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
      if (result.correct) {
        sessionRef.current.correct++;
        setCorrectCount(sessionRef.current.correct);
      } else {
        sessionRef.current.wrong++;
        setWrongCount(sessionRef.current.wrong);
      }
      sessionRef.current.ids.push(card.card_id);
      setAnsweredIds(sessionRef.current.ids);
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
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-5xl">🎴</p>
        <h1 className="text-2xl font-bold">Play — Flashcard</h1>
        <p className="max-w-md text-zinc-500">
          Lihat fotonya → tebak siapa namanya dari 4 pilihan.
          <br />
          Benar <strong>+2</strong>, salah <strong>-1</strong> (poin tidak pernah
          negatif).
        </p>
        {error && (
          <div className="max-w-md rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={beginSession}
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            🚀 Mulai Main
          </button>
          <Link
            href="/add"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            + Tambah data dulu
          </Link>
        </div>
        <Link
          href="/"
          className="mt-4 text-sm text-zinc-400 hover:underline"
        >
          ← Beranda
        </Link>
      </main>
    );
  }

  if (phase === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-zinc-400">Memuat kartu…</p>
      </main>
    );
  }

  if (phase === "finished" && summary) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
        <div className="rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-5xl">🏁</p>
          <h1 className="mt-3 text-2xl font-bold">Sesi Selesai!</h1>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950">
              <dt className="text-xs uppercase tracking-wide opacity-70">Benar</dt>
              <dd className="mt-1 text-2xl font-bold">{summary.correct}</dd>
            </div>
            <div className="rounded-xl bg-red-50 p-4 text-red-800 dark:bg-red-950">
              <dt className="text-xs uppercase tracking-wide opacity-70">Salah</dt>
              <dd className="mt-1 text-2xl font-bold">{summary.wrong}</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
              <dt className="text-xs uppercase tracking-wide opacity-70">Akurasi</dt>
              <dd className="mt-1 text-2xl font-bold">{summary.accuracy}%</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
              <dt className="text-xs uppercase tracking-wide opacity-70">Poin sesi</dt>
              <dd className="mt-1 text-2xl font-bold">
                +{summary.pointsEarned}
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-zinc-500">
            Total kartu: {summary.total} · Poin terkumpul sekarang:{" "}
            <strong>{currentPoints}</strong>
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={beginSession}
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            🔁 Main Lagi
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Ke Beranda
          </Link>
        </div>
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      {/* Header skor */}
      <div className="mb-6 flex items-center justify-between text-sm">
        <Link href="/" className="text-zinc-400 hover:underline">
          ← Keluar
        </Link>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">
            ✅ {correctCount} · ❌ {wrongCount}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            ⭐ {currentPoints} poin
          </span>
        </div>
      </div>

      {/* Kartu */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {(() => {
            const url = photoUrl(card.photo_url);
            return url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt="Foto mahasiswa"
                className="mx-auto h-64 w-64 rounded-2xl object-cover"
              />
            ) : (
              <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                ?
              </div>
            );
          })()}
          <p className="mt-4 text-sm text-zinc-400">Siapa nama mahasiswa ini?</p>
        </div>

        {/* Opsi atau feedback */}
        {phase === "feedback" && lastResult ? (
          <div
            className={`w-full max-w-sm rounded-2xl border px-6 py-5 text-center ${
              feedbackKind === "correct"
                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950"
                : "border-red-300 bg-red-50 dark:bg-red-950"
            }`}
          >
            <p className="text-2xl">{feedbackKind === "correct" ? "🎉" : "😅"}</p>
            <p className="mt-1 font-semibold">
              {lastResult.correct ? "Benar!" : "Salah!"}
            </p>
            {!lastResult.correct && (
              <p className="mt-1 text-sm">
                Jawabannya: <strong>{lastResult.correct_name}</strong>
              </p>
            )}
            <p className="mt-1 text-sm opacity-80">
              {lastResult.points_delta > 0 ? "+" : ""}
              {lastResult.points_delta} poin · total ⭐ {currentPoints}
            </p>
            <button
              onClick={handleNext}
              className="mt-4 rounded-lg bg-zinc-900 px-6 py-2 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
            >
              Lanjut →
            </button>
          </div>
        ) : (
          <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2">
            {card.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                disabled={phase !== "playing"}
                className="rounded-xl border border-zinc-300 px-4 py-3 text-left font-medium transition hover:border-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {opt.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}