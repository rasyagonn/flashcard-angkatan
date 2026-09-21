"use client";

import { useCallback, useEffect, useState } from "react";
import {
  claimReward,
  createReward,
  deleteReward,
  getProgress,
  listSessionAnswers,
  listSessions,
  photoUrl,
  type PlaySessionItem,
  type ProgressData,
  type Reward,
  type RewardView,
  type SessionAnswer,
  updateReward,
} from "@/lib/api";
import {
  IconArrowRight,
  IconCheck,
  IconClose,
  IconGift,
  IconPencil,
  IconStar,
  IconTrash,
} from "@/components/icons";

const CARD_ACCENTS = ["bg-sun", "bg-teal", "bg-blue", "bg-berry", "bg-coral"];

export default function RankPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [sessions, setSessions] = useState<PlaySessionItem[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // form reward
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  // evaluasi sesi (expandable)
  const [answersOpen, setAnswersOpen] = useState<number | null>(null);
  const [answersBySession, setAnswersBySession] = useState<Record<number, SessionAnswer[]>>({});
  const [answersLoadingId, setAnswersLoadingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([getProgress(), listSessions()]);
      setProgress(p);
      setSessions(s);
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAnswers(id: number) {
    if (answersOpen === id) {
      setAnswersOpen(null);
      return;
    }
    setAnswersOpen(id);
    if (answersBySession[id]) return;
    setAnswersLoadingId(id);
    try {
      const data = await listSessionAnswers(id);
      setAnswersBySession((m) => ({ ...m, [id]: data }));
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setAnswersLoadingId(null);
    }
  }

  async function handleRewardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const targetPoints = Number(target);
      if (!targetPoints || targetPoints <= 0) throw new Error("Target poin harus lebih dari 0");
      if (editingId !== null) {
        await updateReward(editingId, { name, description, target_points: targetPoints });
      } else {
        await createReward({ name, description, target_points: targetPoints });
      }
      setName("");
      setDescription("");
      setTarget("");
      setEditingId(null);
      await load();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim(r: RewardView) {
    if (!confirm(`Klaim reward "${r.name}"? Poin akan di-reset ke 0.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await claimReward(r.id);
      setMessage({
        kind: "ok",
        text: `Reward "${res.reward_name}" diklaim (dengan ${res.claimed_reward.points_at_claim} poin). Poin sekarang 0.`,
      });
      await load();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteReward(r: Reward) {
    if (!confirm(`Hapus reward "${r.name}"?`)) return;
    setBusy(true);
    try {
      await deleteReward(r.id);
      await load();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(r: Reward) {
    setEditingId(r.id);
    setName(r.name);
    setDescription(r.description);
    setTarget(String(r.target_points));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <header>
        <span className="chip bg-teal text-ink">Rank & self-reward</span>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">
          Poin & <span className="text-teal-deep">Hadiahmu</span>
        </h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Kumpulin poin dari tiap sesi main, terus klaim reward yang targetnya
          udah nembus — poin balik ke 0, motivasi naik lagi.
        </p>
      </header>

      {message && (
        <div
          className={`animate-pop mt-6 rounded-xl border-2 px-4 py-3 text-sm font-medium ${
            message.kind === "ok"
              ? "border-good/50 bg-good/10 text-good"
              : "border-bad/50 bg-bad/10 text-bad"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Kartu poin utama */}
      <section className="card mt-8 p-6 sm:p-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
          <div className="shrink-0 rounded-2xl border-2 border-ink bg-ink p-6 text-center shadow-[4px_4px_0_0_var(--sun-deep)]">
            <p className="text-[11px] font-bold tracking-widest text-paper/70 uppercase">
              Poin berjalan
            </p>
            <p className="mt-1 font-display text-6xl font-extrabold tracking-tight text-sun tabular-nums">
              {progress?.current_points ?? "–"}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-paper/70 tabular-nums">
              <IconStar className="h-4 w-4 text-sun" /> total {progress?.total_points ?? "–"}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            {progress?.next_reward ? (
              <>
                <p className="text-sm text-ink-soft">
                  Reward berikutnya:{" "}
                  <strong className="font-display text-base text-ink">
                    {progress.next_reward.name}
                  </strong>{" "}
                  — target <strong className="tabular-nums">{progress.next_reward.target_points}</strong> poin
                </p>
                <div className="mt-3 h-5 w-full overflow-hidden rounded-xl border-2 border-ink bg-paper shadow-[2px_2px_0_0_var(--ink)]">
                  <div
                    className="flex h-full items-center rounded-l-[10px] border-r-2 border-ink bg-teal transition-all"
                    style={{ width: `${Math.min(100, progress.next_reward_percent)}%` }}
                  >
                    {progress.next_reward_percent >= 20 && (
                      <span className="pl-2 font-display text-[11px] font-extrabold text-ink">
                        {progress.next_reward_percent}%
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs font-medium text-ink-soft tabular-nums">
                  {progress.next_reward_percent}% tercapai —{" "}
                  {Math.max(0, progress.next_reward.target_points - (progress?.current_points ?? 0))}{" "}
                  poin lagi
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                {progress && progress.rewards.length > 0
                  ? "Semua reward sudah tercapai!"
                  : "Buat reward pertamamu di bawah"}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Form reward */}
      <section className="card mt-8 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="section-title">
            {editingId !== null ? "Edit Reward" : "Tambah Reward"}
          </h2>
          {editingId !== null && (
            <span className="chip bg-berry text-paper">Mengedit #{editingId}</span>
          )}
        </div>

        <form onSubmit={handleRewardSubmit} className="mt-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="label">Nama reward</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nonton 1 episode anime"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Target poin</span>
              <input
                required
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="50"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Deskripsi (opsional)</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Saya akan…"
                className="input"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button disabled={busy} className="btn btn-teal">
              {editingId !== null ? "Simpan Perubahan" : "Tambah Reward"}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setDescription("");
                  setTarget("");
                }}
                className="btn btn-ghost"
              >
                <IconClose className="h-4 w-4" /> Batal
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Daftar reward */}
      <section className="mt-10">
        <h2 className="section-title">Daftar Reward</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(progress?.rewards ?? []).map((r, i) => {
            const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
            const remaining = Math.max(
              0,
              r.target_points - (progress?.current_points ?? 0)
            );
            return (
              <div key={r.id} className="card overflow-hidden">
                <span className={`${accent} block h-2.5 w-full border-b-2 border-ink`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg leading-tight font-extrabold">
                      {r.name}
                    </h3>
                    {r.achievable && (
                      <span className="chip shrink-0 bg-coral text-paper">Siap klaim</span>
                    )}
                  </div>
                  {r.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      {r.description}
                    </p>
                  )}

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-ink-soft tabular-nums">
                        Target {r.target_points} poin
                      </span>
                      <span className="chip bg-paper text-ink tabular-nums">{r.percent}%</span>
                    </div>
                    <div className="mt-2 h-4 w-full overflow-hidden rounded-lg border-2 border-ink bg-paper shadow-[2px_2px_0_0_var(--ink)]">
                      <div
                        className={`h-full rounded-l-[6px] border-r-2 border-ink ${
                          r.achievable ? "bg-coral" : "bg-sun"
                        } transition-all`}
                        style={{ width: `${r.percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {r.achievable ? (
                      <button
                        disabled={busy}
                        onClick={() => handleClaim(r)}
                        className="btn btn-coral btn-sm"
                      >
                        <IconGift className="h-4 w-4" /> Klaim reward
                      </button>
                    ) : (
                      <span className="chip bg-ink text-paper tabular-nums">
                        {remaining} poin lagi
                      </span>
                    )}
                    <button
                      onClick={() => startEdit(r)}
                      className="btn btn-ghost btn-sm"
                    >
                      <IconPencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteReward(r)}
                      className="btn btn-ghost btn-sm text-bad"
                    >
                      <IconTrash className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {(progress?.rewards ?? []).length === 0 && (
            <p className="text-sm text-ink-soft">
              Belum ada reward. Tambahkan: mis. &ldquo;Nonton 1 episode&rdquo; target 50 poin.
            </p>
          )}
        </div>
      </section>

      {/* Riwayat klaim */}
      <section className="mt-10">
        <h2 className="section-title">Riwayat Klaim</h2>
        <ul className="card mt-4 divide-y-2 divide-ink/10">
          {(progress?.claimed ?? []).map((cl) => (
            <li
              key={cl.id}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <IconGift className="h-4 w-4 shrink-0 text-coral-deep" />
                Reward {cl.reward_id ? `#${cl.reward_id}` : ""} diklaim dengan{" "}
                <strong className="tabular-nums">{cl.points_at_claim} poin</strong>
              </span>
              <span className="chip bg-paper text-ink-soft">{fmtDate(cl.claimed_at)}</span>
            </li>
          ))}
          {(progress?.claimed ?? []).length === 0 && (
            <li className="px-5 py-4 text-sm text-ink-soft">
              Belum ada klaim — reward menunggu targetmu.
            </li>
          )}
        </ul>
      </section>

      {/* Riwayat sesi */}
      <section className="mt-10">
        <h2 className="section-title">Riwayat Sesi Permainan</h2>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b-2 border-ink bg-ink text-left text-paper">
                <th className="px-5 py-3 font-display text-xs font-extrabold tracking-widest uppercase">
                  Tanggal
                </th>
                <th className="px-5 py-3 font-display text-xs font-extrabold tracking-widest uppercase">
                  Benar / Total
                </th>
                <th className="px-5 py-3 font-display text-xs font-extrabold tracking-widest uppercase">
                  Akurasi
                </th>
                <th className="px-5 py-3 font-display text-xs font-extrabold tracking-widest uppercase">
                  Poin sesi
                </th>
                <th className="px-5 py-3 text-right font-display text-xs font-extrabold tracking-widest uppercase">
                  Evaluasi
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  open={answersOpen === s.id}
                  loading={answersLoadingId === s.id}
                  answers={answersBySession[s.id]}
                  onToggle={() => toggleAnswers(s.id)}
                  fmtDate={fmtDate}
                />
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-4 text-ink-soft">
                    Belum ada sesi bermain — ayo main di halaman Play!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SessionRow({
  session,
  open,
  loading,
  answers,
  onToggle,
  fmtDate,
}: {
  session: PlaySessionItem;
  open: boolean;
  loading: boolean;
  answers?: SessionAnswer[];
  onToggle: () => void;
  fmtDate: (iso: string) => string;
}) {
  return (
    <>
      <tr className="border-b border-ink/10 hover:bg-paper">
        <td className="px-5 py-3.5">{fmtDate(session.played_at)}</td>
        <td className="px-5 py-3.5 font-medium tabular-nums">
          {session.correct_count} / {session.total_cards}
        </td>
        <td className="px-5 py-3.5 tabular-nums">{session.accuracy}%</td>
        <td className="px-5 py-3.5 font-display font-bold text-good tabular-nums">
          +{session.points_earned}
        </td>
        <td className="px-5 py-3.5 text-right">
          <button onClick={onToggle} disabled={loading} className="btn btn-ghost btn-sm">
            {open ? <IconClose className="h-3.5 w-3.5" /> : <IconArrowRight className="h-3.5 w-3.5" />}
            {open ? "Tutup" : "Tinjau"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-ink/10 bg-paper">
          <td colSpan={5} className="px-5 py-4">
            {loading ? (
              <p className="text-sm font-medium text-ink-soft">Memuat detail jawaban…</p>
            ) : !answers || answers.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Belum ada detail jawaban untuk sesi ini (dibuat sebelum fitur evaluasi).
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {answers.map((a) => {
                  const url = photoUrl(a.photo_path);
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 ${
                        a.correct
                          ? "border-ink/15 bg-card"
                          : "border-bad/50 bg-bad/10"
                      }`}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={a.student_name}
                          className="h-10 w-10 shrink-0 rounded-lg border-2 border-ink object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper font-display font-extrabold text-ink-soft">
                          ?
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-bold">
                          {a.student_name}
                        </p>
                        {a.correct ? (
                          <p className="text-xs text-ink-soft">Dijawab benar</p>
                        ) : (
                          <p className="truncate text-xs text-ink-soft">
                            Kamu jawab{" "}
                            <span className="font-semibold text-bad line-through">
                              {a.chosen_name || "—"}
                            </span>
                          </p>
                        )}
                      </div>
                      {a.correct ? (
                        <IconCheck className="h-4 w-4 shrink-0 text-good" />
                      ) : (
                        <IconClose className="h-4 w-4 shrink-0 text-bad" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}