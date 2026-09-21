"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  createStudent,
  deleteStudent,
  importStudents,
  listStudents,
  photoUrl,
  type Student,
  updateStudent,
  uploadPhoto,
} from "@/lib/api";

const LIMIT = 10;

export default function AddPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [nrp, setNrp] = useState("");
  const [name, setName] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      const res = await listStudents({ search, page, limit: LIMIT });
      setStudents(res.students);
      setTotal(res.pagination.total);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (editingId !== null) {
        await updateStudent(editingId, { nrp, name, photo_path: photoPath });
        setMsg({ kind: "ok", text: "Data mahasiswa diperbarui." });
      } else {
        await createStudent({ nrp, name, photo_path: photoPath });
        setMsg({ kind: "ok", text: "Mahasiswa ditambahkan." });
      }
      setNrp("");
      setName("");
      setPhotoPath("");
      setEditingId(null);
      setPage(1);
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await uploadPhoto(file);
      setPhotoPath(res.photo_path);
      setMsg({ kind: "ok", text: "Foto diunggah: " + res.photo_path });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const input = e.currentTarget as HTMLFormElement;
    const fileInput = input.elements.namedItem("csv") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await importStudents(file);
      setMsg({
        kind: "ok",
        text: `Import selesai: ${res.imported} berhasil, ${res.failed} gagal (total ${res.total_rows} baris).`,
      });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
      input.reset();
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Hapus ${name}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await deleteStudent(id);
      setMsg({ kind: "ok", text: "Mahasiswa dihapus." });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: Student) {
    setEditingId(s.id);
    setNrp(s.nrp);
    setName(s.name);
    setPhotoPath(s.photo_path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-400 hover:underline">
            ← Beranda
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Add — Kelola Mahasiswa</h1>
        </div>
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            msg.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Form tambah/edit */}
      <form
        onSubmit={handleSubmit}
        className="mb-8 grid gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h2 className="font-semibold">
          {editingId !== null ? `Edit Mahasiswa #${editingId}` : "Tambah Mahasiswa"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            NRP
            <input
              required
              value={nrp}
              onChange={(e) => setNrp(e.target.value)}
              placeholder="5025201001"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nama
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Andi Pratama"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Foto URL
            <input
              value={photoPath}
              onChange={(e) => setPhotoPath(e.target.value)}
              placeholder="/uploads/x.jpg atau https://..."
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <label className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-zinc-500 hover:border-zinc-500">
            ⬆ Upload foto…
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
              className="hidden"
            />
          </label>
          {editingId !== null && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setNrp("");
                setName("");
                setPhotoPath("");
              }}
              className="text-zinc-500 underline hover:text-zinc-800"
            >
              Batal edit
            </button>
          )}
        </div>

        <button
          disabled={busy}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
        >
          {editingId !== null ? "Simpan Perubahan" : "Tambahkan"}
        </button>
      </form>

      {/* Import CSV */}
      <form
        onSubmit={handleImport}
        className="mb-8 flex items-center gap-3 rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800"
      >
        <h2 className="font-semibold">Import CSV</h2>
        <input
          type="file"
          name="csv"
          accept=".csv"
          disabled={busy}
          className="text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:font-semibold dark:file:bg-zinc-800"
        />
        <button
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-4 py-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Import
        </button>
        <span className="ml-auto hidden text-xs text-zinc-400 sm:block">
          Format: <code>nrp,nama,photo_url</code>
        </span>
      </form>

      {/* Daftar */}
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Cari nama / NRP…"
          className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        />
        <span className="text-sm text-zinc-400">Total: {total}</span>
      </div>

      <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
        {students.map((s) => {
          const url = photoUrl(s.photo_path);
          return (
            <li
              key={s.id}
              className="flex items-center gap-4 py-3"
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={s.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800">
                  {s.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-sm text-zinc-400">{s.nrp}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(s)}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                >
                  Hapus
                </button>
              </div>
            </li>
          );
        })}
        {students.length === 0 && (
          <li className="py-8 text-center text-sm text-zinc-400">
            Belum ada data. Tambahkan lewat form atau import CSV.
          </li>
        )}
      </ul>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-lg border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
        >
          ← Sebelumnya
        </button>
        <span className="text-zinc-500">
          Halaman {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
        >
          Berikutnya →
        </button>
      </div>
    </main>
  );
}