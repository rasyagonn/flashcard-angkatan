"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  claimReward,
  createReward,
  deleteReward,
  getProgress,
  listSessions,
  type PlaySessionItem,
  type ProgressData,
  type Reward,
  type RewardView,
  updateReward,
} from "@/lib/api";

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
        text: `🎉 Reward "${res.reward_name}" diklaim (dengan ${res.claimed_reward.points_at_claim} poin). Poin sekarang 0.`,
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-zinc-400 hover:underline">
        ← Beranda
      </Link>
      <h1 className="mt-1 text-2xl font-bold">Rank — Poin & Self-Reward 🏆</h1>

      {message && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Kartu poin */}
      <div className="mt-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-zinc-400">Poin berjalan</p>
            <p className="text-5xl font-bold">⭐ {progress?.current_points ?? "–"}</p>
            <p className="mt-1 text-sm text-zinc-400">
              Total poin pernah didapat: {progress?.total_points ?? "–"}
            </p>
          </div>
          {progress?.next_reward ? (
            <div className="w-1/2 text-right">
              <p className="text-sm text-zinc-400">
                Reward berikutnya:{" "}
                <strong className="text-zinc-100">
                  {progress.next_reward.name}
                </strong>{" "}
                ({progress.next_reward.target_points} poin)
              </p>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                  style={{ width: `${Math.min(100, progress.next_reward_percent)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {progress.next_reward_percent}% tercapai
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 text-right">
              {progress && progress.rewards.length > 0
                ? "🎯 Semua reward sudah tercapai!"
                : "Buat reward pertamamu di bawah 👇"}
            </p>
          )}
        </div>
      </div>

      {/* Form reward */}
      <form
        onSubmit={handleRewardSubmit}
        className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h2 className="font-semibold">
          {editingId !== null ? `Edit Reward #${editingId}` : "Tambah Reward"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Nama reward
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nonton 1 episode anime"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Target poin
            <input
              required
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="50"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Deskripsi (opsional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Saya akan…"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            />
          </label>
        </div>
        <div className="flex gap-3">
          <button
            disabled={busy}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
          >
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
              className="text-sm text-zinc-500 underline hover:text-zinc-800"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      {/* Daftar reward */}
      <h2 className="mt-8 font-semibold">Daftar Reward</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {(progress?.rewards ?? []).map((r) => (
          <div
            key={r.id}
            className={`rounded-2xl border p-5 ${
              r.achievable
                ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{r.name}</h3>
              {r.achievable && <span className="text-lg">🎉</span>}
            </div>
            {r.description && (
              <p className="mt-1 text-sm text-zinc-500">{r.description}</p>
            )}
            <p className="mt-3 text-sm text-zinc-500">
              Target: <strong>{r.target_points}</strong> poin
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${r.percent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-400">{r.percent}%</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.achievable ? (
                <button
                  disabled={busy}
                  onClick={() => handleClaim(r)}
                  className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  Klaim reward 🎁
                </button>
              ) : (
                <span className="text-xs text-zinc-400">
                  {r.target_points - (progress?.current_points ?? 0)} poin lagi
                </span>
              )}
              <button
                onClick={() => startEdit(r)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteReward(r)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
        {(progress?.rewards ?? []).length === 0 && (
          <p className="text-sm text-zinc-400">
            Belum ada reward. Tambahkan: mis. &ldquo;Nonton 1 episode&rdquo; target 50 poin.
          </p>
        )}
      </div>

      {/* Riwayat klaim */}
      <h2 className="mt-8 font-semibold">Riwayat Klaim</h2>
      <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
        {(progress?.claimed ?? []).map((cl) => (
          <li key={cl.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              Reward #{cl.reward_id} diklaim dengan{" "}
              <strong>{cl.points_at_claim} poin</strong>
            </span>
            <span className="text-zinc-400">{fmtDate(cl.claimed_at)}</span>
          </li>
        ))}
        {(progress?.claimed ?? []).length === 0 && (
          <li className="py-2 text-sm text-zinc-400">Belum ada klaim.</li>
        )}
      </ul>

      {/* Riwayat sesi */}
      <h2 className="mt-8 font-semibold">Riwayat Sesi Permainan</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-400 dark:border-zinc-800">
              <th className="py-2">Tanggal</th>
              <th>Benar / Total</th>
              <th>Akurasi</th>
              <th>Poin sesi</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{fmtDate(s.played_at)}</td>
                <td>
                  {s.correct_count} / {s.total_cards}
                </td>
                <td>{s.accuracy}%</td>
                <td>+{s.points_earned}</td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-zinc-400">
                  Belum ada sesi bermain.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}