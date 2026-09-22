# Cara Membangun FlashCard Angkatan
Dokumen ringkas & lengkap untuk presentasi — bagaimana aplikasi ini dibangun dari nol sampai jadi.

---

## 1. Gambaran Aplikasi

**FlashCard Angkatan** adalah aplikasi web untuk mengingat nama mahasiswa satu angkatan, dikemas sebagai game.

Alur pengguna (dari halaman ke halaman):

```
Home ──► Add (kelola data mahasiswa + foto)
  │
  ├──► Play (game: lihat foto → tebak nama → skor)
  │        └── selesai → Evaluasi (kartu yang salah + jawaban benar)
  │
  └──► Rank (poin kumulatif → progress reward → klaim → poin reset 0)
```

Fitur inti yang dibangun:
1. **Kelola mahasiswa** — CRUD + upload foto + import massal CSV + pencarian & pagination.
2. **Game flashcard** — MCQ 4 opsi, skor +2 benar / -1 salah (tidak pernah minus), riwayat sesi.
3. **Rank & self-reward** — poin kumulatif, progress bar menuju target hadiah, klaim reward (poin reset ke 0).
4. **Evaluasi setelah main** — detail tiap jawaban (salah di mana + siapa yang benar), bisa ditinjau ulang dari riwayat.

---

## 2. Arsitektur

Aplikasi ini adalah **monorepo** dua layer: frontend (SPA) + backend (REST API), satu database.

```
┌─────────────────────┐      HTTP/JSON       ┌──────────────────────────────┐
│  Browser            │  ─────────────────►  │  Backend: Go + Gin + GORM    │
│  Next.js 16 (React) │                      │  · route handler → logic     │
│  port 3000          │  ◄─────────────────  │  · helpers (respons JSON)    │
└─────────────────────┘        JSON          │  · validasi & transaksi DB    │
                                             │  port 8080                    │
                                             └──────────────┬───────────────┘
                                                            │ GORM (ORM)
                                             ┌──────────────▼───────────────┐
                                             │  PostgreSQL 16               │
                                             │  (di-dockerize via compose)  │
                                             └──────────────────────────────┘
```

- **Foto mahasiswa** disajikan statis oleh backend di `/uploads/*` (folder `backend/uploads/`).
- Frontend **tidak pernah menyentuh database** — semua lewat REST API.
- Respons API memakai format seragam dari `internal/helpers`:

```json
{ "success": true,  "data": ... }
{ "success": false, "error": "pesan" }
```

### Kenapa arsitektur ini?
| Keputusan | Alasan |
| --- | --- |
| Frontend/backend terpisah | Fokus masing-masing: UI cepat (Next.js) vs logika & data (Go ringan, satu binary, start cepat) |
| REST + JSON | Sederhana, mudah dites dengan Postman/Swagger, frontend cukup fetch |
| PostgreSQL + GORM | Relasi antar data jelas (sesi → jawaban), migrasi otomatis dari struct model |
| Go + Gin | Kinerja tinggi, typos/error ketahuan saat compile, deploy praktis (satu binary) |

---

## 3. Tech Stack & Role

| Layer | Teknologi | Dipakai untuk |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS) | Routing halaman, UI game, state client |
| Backend | Go 1.27, Gin, GORM | REST API, validasi, transaksi, scoring |
| Database | PostgreSQL 16 (via docker-compose) | Data mahasiswa, poin, sesi, reward |
| Dokumentasi API | Swagger (swaggo) | UI interaktif di `/swagger/index.html` |
| VCS & kolaborasi | Git + GitHub | 6 commit di `main`, repo public |

---

## 4. Database (6 tabel)

Schema dibuat otomatis dari struct Go lewat **GORM AutoMigrate** (di `internal/database/database.go`) — tidak perlu bikin tabel manual. Reward default (3 seed) otomatis diisi saat pertama kali backend jalan.

```
students                      rewards
├─ id (PK)                    ├─ id (PK)
├─ nrp (unik)                 ├─ name
├─ name                       ├─ description
└─ photo_path                 └─ target_points

user_progress ── 1 baris saja (id=1)
├─ id                         claimed_rewards
├─ current_points             ├─ id (PK)
└─ total_points               ├─ reward_id
                              ├─ points_at_claim (snapshot)
play_sessions                 └─ claimed_at
├─ id (PK)
├─ played_at                  session_answers
├─ total_cards                ├─ id (PK)
├─ correct_count              ├─ session_id (FK → play_sessions)
├─ wrong_count                ├─ student_id
├─ accuracy (persen)          ├─ student_name      ← di-denormalisasi agar
└─ points_earned              ├─ photo_path            tampilan evaluasi cepat
                              ├─ chosen_name
                              ├─ correct (bool)
                              ├─ points_delta
                              └─ answered_at
```

Catatan desain penting:
- `user_progress` **selalu satu baris** (single user) — dipastikan ada lewat `getOrInitProgress()`.
- `session_answers` menyimpan nama/jawaban **langsung sebagai teks (denormalisasi)** — evaluasi tidak perlu join rumit, dan tetap tampil benar meski mahasiswa dihapus.
- Poin maju `current_points` dan poin total `total_points` dipisah: total bersifat kumulatif permanen, current dipakai untuk klaim reward.

---

## 5. REST API (19 endpoint)

Semua di bawah `/api/v1`, dokumentasi live di `http://localhost:8080/swagger/index.html`.

| Metode & Path | Fungsi |
| --- | --- |
| `GET /health` | Cek backend hidup |
| `POST /upload` | Upload foto (jpg/jpeg/png/webp, maks 5 MB) → `photo_path` |
| `POST /students` | Tambah mahasiswa |
| `GET /students?page=&limit=&search=` | Daftar (pagination + cari nrp/nama, `ILIKE`) |
| `GET /students/:id` | Detail satu mahasiswa |
| `PUT /students/:id` | Edit |
| `DELETE /students/:id` | Hapus (file foto ikut dihapus kalau lokal) |
| `POST /students/import` | Import CSV `nrp,nama,photo_url` |
| `GET /play/round?exclude=1,2` | Ambil kartu + 4 opsi (acak, tanpa penanda jawaban) |
| `POST /play/answer` | Validasi jawaban, terapkan poin |
| `POST /play/end` | Simpan riwayat sesi + detail jawaban evaluasi |
| `GET /rewards` | Daftar reward |
| `POST /rewards` | Tambah reward (target poin) |
| `PUT /rewards/:id` | Edit reward |
| `DELETE /rewards/:id` | Hapus reward |
| `GET /progress` | Poin, reward + status achievable, reward berikutnya, riwayat klaim |
| `POST /rewards/:id/claim` | Klaim reward (validasi poin, snapshot, reset) |
| `GET /sessions` | Riwayat sesi (maks 50 terakhir) |
| `GET /sessions/:id/answers` | Detail jawaban satu sesi (untuk evaluasi) |

---

## 6. Cara Kerja Fitur Inti

### 6.1 Kelola Mahasiswa (upload + CSV)
- Upload: file diperiksa **ekstensi** (jpg/jpeg/png/webp) dan **ukuran** (5 MB via `MaxBytesReader`), disimpan dengan nama unik (`timestamp.ext`), folder dibuat otomatis (`MkdirAll`).
- Import CSV: parser membaca tepat **3 kolom** (`nrp,nama,photo_url`), baris header dilewati, kolom kosong di-skip. Diproses **dalam satu transaksi** — jika ada satu baris gagal, seluruh import dibatalkan dan detail baris yang gagal dikembalikan.
- `photo_url` bisa kosong / path upload sendiri (`/uploads/...`) / URL foto langsung (mis. Google Drive `uc?export=view`).

### 6.2 Game Flashcard
Alur per ronde (kotak kode menunjukkan antarmuka API):

```
frontend           backend
  │  GET /play/round            pilih 1 kartu acak yg belum dimainkan
  │  (exclude=id yg sudah)      A      + 3 pengecoh nama unik
  │◄────────────── card_id, photo_url, options[4]
  │  POST /play/answer          benar? +2 : -1 (floor → 0)
  │◄────────────── correct, points_delta, current_points, correct_name
  └─ ulang sampai semua kartu habis → "finished"
       POST /play/end           simpan play_sessions + session_answers
```

Aturan yang di-hardcode di `play.go`:
- **Minimal 4 mahasiswa berfoto** untuk bisa main (agar 4 opsi bisa dibentuk).
- **Opsi selalu unik** — nama kartu benar tidak boleh muncul ganda sebagai pengecoh (`pickDecoys`).
- **Skor server-authoritative** — jawaban divalidasi di backend, bukan di browser (anti-cheat sederhana).
- **Poin tidak pernah negatif** (`if CurrentPoints < 0 { CurrentPoints = 0 }`), dan hanya jawaban benar yang menambah poin total.

### 6.3 Rank & Self-Revard
- `GET /progress` menghitung per reward: `percent = current/target`, `achievable = current >= target`, plus `next_reward` (yang paling dekat belum tercapai) — semua dihitung di backend, frontend tinggal render.
- **Klaim = transaksi DB** (`progress.go`): cek poin ≥ target → catat `claimed_rewards` (snapshot poin) → reset `current_points = 0`. Kalau gagal di tengah, semua dibatalkan (tidak ada state menggantung).
- Konsep gamification: poin dari game jadi "mata uang" hadiah — klaim sengaja me-reset agar motivasi loop.

### 6.4 Evaluasi Setelah Game (fitur terbaru)
- Saat sesi selesai, frontend mengirim semua jawaban per kartu (student, foto, jawabanmu, benar/salah, delta poin) di payload `/play/end`.
- Backend menyimpannya ke tabel `session_answers` (baru, ikut AutoMigrate).
- Layar selesai langsung menampilkan **Evaluasi**: kartu yang salah disorot merah (foto, nama sebenarnya, dan jawabanmu yang dicoret).
- Halaman Rank punya tombol **Tinjau** per sesi → `GET /sessions/:id/answers`.
- 3 test baru + 1 bug fix lama ditemukan saat fitur ini: sesi dengan `correct_count = 0` (semua salah) sebelumnya ditolak validasi `binding:"required"` — sudah diperbaiki.

---

## 7. Frontend Next.js

### Halaman & routing (App Router)
| Route | Isi |
| --- | --- |
| `/` | Hero + alur cara kerja + kartu fitur |
| `/add` | Form tambah/edit, upload foto, import CSV, daftar + cari + pagination |
| `/play` | Start screen → kartu & 4 opsi → feedback benar/salah → layar hasil + Evaluasi |
| `/rank` | Kartu poin + progress bar, CRUD reward, klaim, riwayat klaim & sesi (dengan Tinjau) |

### Pola state di halaman Play (yang paling menarik)
- Sesi dijaga di `useRef` (jawaban, ids) + state React untuk render; server tetap sumber kebenaran skor.
- Menggunakan `useCallback` untuk `getRound` per kartu — status `exclude` (id yang sudah dimainkan) dikirim ke backend agar tidak ada kartu ganda dalam satu sesi.
- Fase render: `start → loading → playing → feedback → finished`, plus animasi `pop`/`shake`.

### API client (`src/lib/api.ts`)
- Satu fungsi `request()` yang meng-unwrap format `{success, data}` dan melempar error pesan Indonesia.
- `BASE_URL = NEXT_PUBLIC_API_BASE_URL ?? http://localhost:8080/api/v1`.
- `photoUrl()`: URL `http(s)://` dipakai apa adanya; path `/uploads/...` di-prefix origin backend.

### Design system ("Flash Bold")
- Font: **Bricolage Grotesque** (judul) + **Inter** (isi) via `next/font`.
- Warna di `globals.css`: `paper/ink/coral/sun/teal/berry/blue/good/bad` + var Tailwind.
- Komponen kelas: `.btn*`, `.card`, `.chip`, `.input`, `.label` — semua pakai hard-offset shadow khas board-game, background dotted paper.
- **Ikon SVG stroke konsisten** (24×24, `currentColor`, dari `components/icons.tsx`) — menggantikan emoji agar tampilan lebih profesional dan seragam.

---

## 8. Kualitas & Verifikasi

- **22 unit test Go** (file `*_test.go`, DB sqlite in-memory): CRUD, aturan skor, sesi, klaim, evaluasi, kasus edge (semua-salah, 404, payload tidak konsisten). Semua lulus: `go test ./...`.
- **Swagger** — setiap handler dianotasi `@Router/@Summary`; didokumentasikan oleh `swag init`, live di `/swagger/index.html`.
- **Build bersih** — `next build` sukses tanpa error TS; `go vet` + `go build` bersih.
- **Teruji end-to-end** terhadap database nyata: alur main lengkap, evaluasi tersimpan & bisa diambil ulang.
- Git: 6 commit rapi di `main`, GitHub public (`rasyagonn/flashcard-angkatan`), `.env`/uploads/binary tidak ikut di-push.

---

## 9. Menjalankan (ringkas)

```bash
docker compose up -d                # PostgreSQL 16 (user postgres / pass secret / db flashcard)

cd backend
copy .env.example .env              # Windows (cp di Linux/Mac)
go run ./cmd                        # → http://localhost:8080 (Swagger: /swagger/index.html)

cd frontend
npm install
npm run dev                         # → http://localhost:3000
```

Detail lengkap di `README.md` (prasyarat, isi data, CSV, FAQ foto).

---

## 10. Poin yang Menarik untuk Disampaikan di Presentasi

1. **Tidak bikin tabel manual** — schema lahir dari struct Go via GORM AutoMigrate, plus seed reward otomatis.
2. **Skor ditentukan server, bukan browser** — jawaban selalu divalidasi backend, jadi tidak bisa "curang" lewat inspect element.
3. **Transaksi DB** untuk klaim reward dan import CSV — tidak ada state menggantung saat gagal di tengah.
4. **Evaluasi berbasis data** — tiap jawaban tersimpan permanent, jadi kamu bisa lihat persis "salahnya di mana" setelah selesai dan di riwayat.
5. **Desain konsisten tanpa emoji** — ikon SVG stroke seragam + desain token ("Flash Bold") bikin aplikasi terlihat dibuat serius, bukan template.
6. **Ternyata test memunculkan bug nyata** — saat menambah fitur evaluasi, test menemukan sesi "semua jawaban salah" tadinya ditolak server.
7. **Siap dikerjakan bareng teman** — repo public, README onboarding, `.gitattributes` untuk konsistensi lintas OS.

---

## Lampiran: Contoh Request & Response

`POST /api/v1/play/end` (payload klien):

```json
{
  "total_cards": 3,
  "correct_count": 1,
  "wrong_count": 2,
  "answers": [
    { "student_id": 1, "student_name": "Hilal", "photo_path": "/uploads/a.png",
      "chosen_name": "Hilal", "correct": true, "points_delta": 2 },
    { "student_id": 2, "student_name": "Rasya", "photo_path": "/uploads/b.jpeg",
      "chosen_name": "Hilal", "correct": false, "points_delta": -1 }
  ]
}
```

Response:

```json
{ "success": true, "data": { "session_id": 5, "points_earned": 1, "accuracy": 33.33 } }
```

`GET /api/v1/sessions/5/answers` → mengembalikan detail `session_answers` untuk halaman Evaluasi/Tinjau.