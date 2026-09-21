# FlashCard Angkatan

Aplikasi flashcard untuk mengingat nama mahasiswa satu angkatan: lihat foto → tebak nama → kumpulkan poin → klaim self-reward.

## Fitur

- **Kelola mahasiswa** — tambah/edit/hapus dengan foto, cari, import massal dari CSV
- **Main flashcard** — MCQ 4 opsi, skor +2 benar / -1 salah (floor 0)
- **Evaluasi per sesi** — setelah game selesai kelihatan kartu mana yang salah + jawaban yang benar; riwayatnya bisa ditinjau di halaman Rank
- **Rank & self-reward** — poin kumulatif, progress bar menuju target, klaim reward (poin reset ke 0)
- **Swagger UI** — dokumentasi API interaktif di `http://localhost:8080/swagger/index.html`

Spesifikasi lengkap: [`docs/PROJECT.md`](docs/PROJECT.md)

## Tech Stack

| Layer | Teknologi |
| --- | --- |
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind) |
| Backend | Go 1.27+ + Gin + GORM |
| Database | PostgreSQL 16 |
| API Tools | Postman, Swagger (swaggo) |
| VCS | Git + GitHub |

## Prasyarat (di laptop teman)

| Tool | Catatan |
| --- | --- |
| [Git](https://git-scm.com/downloads) | — |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Cara paling mudah menjalankan PostgreSQL (opsional; bisa pakai PostgreSQL lokal) |
| [Go](https://go.dev/dl/) | Versi 1.27+ |
| [Node.js](https://nodejs.org/) (LTS) | Versi 20.9+ untuk Next.js 16 |

## Cara Menjalankan (dari nol)

### 1. Clone

```bash
git clone <url-repo-mu> flashcard-angkatan
cd flashcard-angkatan
```

> `.env.example` dan `samples/mahasiswa.csv` tersedia sebagai contoh. File `.env` asli, folder `uploads/`, dan data database **tidak ikut di-push** (ada di `.gitignore`).

### 2. Siapkan PostgreSQL

**Opsi A — Docker (disarankan):**

```bash
docker compose up -d
```

Membuat container `flashcard-db` dengan database `flashcard`, user `postgres`, password `secret` (bisa diubah di `docker-compose.yml` + `backend/.env`).

**Opsi B — PostgreSQL lokal:**

Install PostgreSQL, lalu buat database dengan nilai yang sama dengan `backend/.env.example`:

```sql
CREATE USER postgres WITH PASSWORD 'secret';
CREATE DATABASE flashcard OWNER postgres;
```

### 3. Jalankan backend (port 8080)

```bash
cd backend
copy .env.example .env    # Windows
# cp .env.example .env    # Mac/Linux
go run ./cmd
```

Backend otomatis menjalankan migrasi tabel (termasuk `session_answers` untuk evaluasi) dan meng-seed 3 reward default saat pertama kali jalan.

Verifikasi: buka <http://localhost:8080/api/v1/health> atau Swagger UI di <http://localhost:8080/swagger/index.html>.

### 4. Jalankan frontend (port 3000)

```bash
cd frontend
npm install
npm run dev
```

Buka <http://localhost:3000> di browser.

> Frontend memanggil backend di `http://localhost:8080/api/v1` secara default. Kalau backend di host/port lain, salin `frontend/.env.example` ke `.env.local` dan set `NEXT_PUBLIC_API_BASE_URL`.

### 5. Isi data mahasiswa

Main baru bisa jalan kalau minimal ada **4 mahasiswa berfoto**. Dua cara:

- **Via UI** di halaman `/add` — isi NRP + nama, lalu upload foto atau isi URL foto.
- **Import CSV** — format kolom `nrp,nama,photo_url` (contoh: [`samples/mahasiswa.csv`](samples/mahasiswa.csv)). Kolom `photo_url` bisa:
  - dikosongkan (mahasiswa tanpa foto — tidak ikut main),
  - path file yang kamu upload sendiri lewat UI (mis. `/uploads/xxx.png`) — yang paling aman,
  - atau URL foto langsung, mis. `https://drive.google.com/uc?export=view&id=FILE_ID` (file harus public). Link share Drive biasa (`drive.google.com/file/d/...`) **tidak akan tampil**.

### 6. Selesai

Main di <http://localhost:3000/play>. Setelah sesi selesai ada bagian **Evaluasi** (kartu yang salah + jawaban benar), dan riwayat sesi + tombol **Tinjau** ada di halaman Rank.

## Test & Kegunaan Developer

```bash
# Unit test backend (22 test)
cd backend && go test ./...

# Regenerasi dokumen Swagger (wajib jalankan kalau ubah handler)
powershell -File backend/scripts/gen-swagger.ps1
```

Catatan:
- `frontend/.npmrc` berisi `allow-scripts=**` agar script instalasi npm berjalan (mengikuti kebijakan `allow-scripts` global di `~/.npmrc`).
- Folder foto tersimpan di `backend/uploads/` (tidak di-push). Kalau temanmu clone, folder ini dibuat otomatis/penuh sesuai data yang dia masukkan sendiri.

## Struktur

```
flashcard-angkatan/
├── docs/PROJECT.md     # Spesifikasi proyek
├── frontend/           # Next.js 16
├── backend/            # Go + Gin + GORM
│   └── scripts/        # Skrip regenerasi Swagger
├── samples/            # Contoh CSV import
└── docker-compose.yml  # PostgreSQL 16 lokal
```