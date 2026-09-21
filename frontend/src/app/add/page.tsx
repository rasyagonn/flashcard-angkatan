"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  IconClose,
  IconPencil,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@/components/icons";

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
  const avatarColors = ["bg-sun", "bg-coral", "bg-teal", "bg-blue", "bg-berry"];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <header>
        <span className="chip bg-sun text-ink">Daftar mahasiswa</span>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">
          Kelola <span className="text-coral-deep">Mahasiswa</span>
        </h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Tambah satu-satu dengan foto, atau import langsung dari file CSV.
        </p>
      </header>

      {msg && (
        <div
          className={`animate-pop mt-6 rounded-xl border-2 px-4 py-3 text-sm font-medium ${
            msg.kind === "ok"
              ? "border-good/50 bg-good/10 text-good"
              : "border-bad/50 bg-bad/10 text-bad"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Form tambah/edit */}
      <section className="card mt-8 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="section-title">
            {editingId !== null ? "Edit Mahasiswa" : "Tambah Mahasiswa"}
          </h2>
          {editingId !== null && (
            <span className="chip bg-coral text-paper">Mengedit #{editingId}</span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="label">NRP</span>
              <input
                required
                value={nrp}
                onChange={(e) => setNrp(e.target.value)}
                placeholder="5025201001"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Nama</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Andi Pratama"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Foto URL</span>
              <input
                value={photoPath}
                onChange={(e) => setPhotoPath(e.target.value)}
                placeholder="/uploads/x.jpg atau https://..."
                className="input"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="btn btn-ghost btn-sm cursor-pointer">
              <IconUpload className="h-4 w-4" /> Upload foto…
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
                className="btn btn-ghost btn-sm"
              >
                <IconClose className="h-4 w-4" /> Batal edit
              </button>
            )}
            <button disabled={busy} className="btn btn-teal ml-auto">
              {editingId !== null ? "Simpan Perubahan" : "Tambahkan"}
            </button>
          </div>
        </form>
      </section>

      {/* Import CSV */}
      <form
        onSubmit={handleImport}
        className="card mt-5 flex flex-wrap items-center gap-4 border-l-8 border-l-sun p-6"
      >
        <div className="min-w-0">
          <h2 className="section-title text-xl">Import CSV</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Format:{" "}
            <code className="rounded bg-ink/10 px-1.5 py-0.5 font-mono">
              nrp,nama,photo_url
            </code>
          </p>
        </div>
        <input
          type="file"
          name="csv"
          accept=".csv"
          disabled={busy}
          className="min-w-0 flex-1 text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded-lg file:border-2 file:border-ink file:bg-ink file:px-3 file:py-1.5 file:font-display file:text-sm file:font-bold file:text-paper"
        />
        <button disabled={busy} className="btn btn-ink">
          Import
        </button>
      </form>

      {/* Daftar */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="section-title">Daftar Mahasiswa</h2>
          <span className="chip ml-auto bg-ink text-paper tabular-nums">
            Total {total}
          </span>
        </div>

        <div className="relative mt-4 max-w-sm">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama / NRP…"
            className="input pl-10"
          />
        </div>

        <ul className="card mt-4 divide-y-2 divide-ink/10">
          {students.map((s, i) => {
            const url = photoUrl(s.photo_path);
            return (
              <li key={s.id} className="flex items-center gap-4 px-5 py-4">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={s.name}
                    className="h-12 w-12 shrink-0 rounded-xl border-2 border-ink object-cover shadow-[2px_2px_0_0_var(--ink)]"
                  />
                ) : (
                  <div
                    className={`${avatarColors[i % avatarColors.length]} grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-ink font-display text-lg font-extrabold text-ink shadow-[2px_2px_0_0_var(--ink)]`}
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold">{s.name}</p>
                  <span className="chip mt-1 bg-paper text-ink-soft">
                    {s.nrp}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => startEdit(s)}
                    className="btn btn-ghost btn-sm"
                  >
                    <IconPencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    className="btn btn-coral btn-sm"
                  >
                    <IconTrash className="h-3.5 w-3.5" /> Hapus
                  </button>
                </div>
              </li>
            );
          })}
          {students.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-ink-soft">
              Belum ada data. Tambahkan lewat form atau import CSV.
            </li>
          )}
        </ul>

        <div className="mt-5 flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn btn-ghost btn-sm"
          >
            Sebelumnya
          </button>
          <span className="chip bg-paper text-ink-soft tabular-nums">
            Halaman {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-ghost btn-sm"
          >
            Berikutnya
          </button>
        </div>
      </section>
    </main>
  );
}