# Tech Stack & Alur Folder — FlashCard Angkatan

Dokumen pendamping presentasi: apa saja teknologi yang dipakai, **gunanya di proyek ini**, dan **peta folder lengkap + alurnya**.

---

## 1. Tech Stack — Guna Tiap Teknologi

| Layer | Teknologi | Guna di proyek ini | Dipakai di |
| --- | --- | --- | --- |
| Framework frontend | **Next.js 16** (App Router) | Routing halaman (`/`, `/add`, `/play`, `/rank`), render React, build & dev server (Turbopack) | `frontend/src/app/*` |
| UI library | **React** | Komponen UI & state (hooks: `useState`, `useRef`, `useEffect`, `useCallback`) | semua halaman |
| Bahasa / type | **TypeScript** | Type safety frontend — error terdeteksi saat compile | `frontend/src/**` |
| Styling | **Tailwind CSS 4** | Utility class + design token (warna/font) via `@theme` di CSS | `frontend/src/app/globals.css`, komponen |
| Font | **next/font (Google)** | Bricolage Grotesque (judul) + Inter (isi), dimuat lokal | `layout.tsx` |
| Bahasa backend | **Go 1.27** | Logika API, validasi, scoring, transaksi DB. Satu binary, compile cepat | `backend/cmd`, `backend/internal` |
| HTTP framework | **Gin** | Router & handler: bind JSON body/query, ganti path param, serve static `/uploads` + Swagger | `handlers/*.go` |
| ORM | **GORM** | Migrasi otomatis dari struct → tabel, query, **transaksi** (import CSV, klaim reward), seed | `models.go`, `database.go` |
| Database | **PostgreSQL 16** | Penyimpanan: mahasiswa, poin, reward, sesi, detail jawaban evaluasi | via `docker-compose` / lokal |
| Container | **Docker + docker-compose** | Cara mudah teman menjalankan PostgreSQL (opsional) | `docker-compose.yml` |
| Dokumentasi API | **Swagger (swaggo)** | Anotasi handler → UI interaktif `/swagger/index.html` | `scripts/gen-swagger.ps1`, `docs/swagger/` |
| Testing API | **Postman** (opsional) | Eksplorasi & verifikasi endpoint | — |
| VCS | **Git + GitHub** | Versioning, kolaborasi, repo public | seluruh repo |
| Package manager | **npm** (frontend), **Go modules** (backend) | Kelola dependency | `package.json`, `go.mod` |

### Kenapa kombinasi ini (jawaban singkat untuk presentasi)
- **Next.js + React + Tailwind** = pengembangan UI cepat, DX bagus, hasil build static ringan.
- **Go + Gin + GORM** = backend cepat, aman tipe, ORM yang migrasi tabelnya otomatis (tidak bikin SQL manual).
- **PostgreSQL** = relasi antar data (sesi → jawaban, reward → klaim) butuh database relasional.
- **Docker** hanya untuk menyederhanakan setup PostgreSQL bagi orang lain.

---

## 2. Alur Satu Request (gimana data mengalir)

```
 Browser (React UI)
     │  user klik / ketik di halaman (frontend/src/app/**/page.tsx)
     ▼
 frontend/src/lib/api.ts          ← satu pintu API: BASE_URL, fetch, unwrap {success,data}
     │  GET/POST JSON  →  http://localhost:8080/api/v1/...
     ▼
 backend: Gin router (cmd/main.go)
     │  middleware CORS → cocokkan path ke handler
     ▼
 backend/internal/handlers/*.go   ← lipat logika: validasi input, hitung skor, atur poin
     │  pakai GORM (struct models) : query / transaksi / simpan
     ▼
 PostgreSQL                       ← data aktual
     │  ⬆ hasil dikembalikan
     ▼
 helpers/response.go  → { "success": true, "data": ... }
     │  JSON kembali ke frontend
     ▼
 api.ts → setState → halaman render ulang
```

Contoh nyata satu ronde game:

```
play/page.tsx  --getRound(exclude)-->  api.ts  --GET /play/round?exclude=1,2-->
  play.go: Round (pilih kartu acak + 3 pengecoh unik) ──SELECT──► students (random)
  ◄--{card_id, photo_url, options[4]}--◄
play/page.tsx  --submitAnswer(card, option)-->  api.ts  --POST /play/answer-->
  play.go: Answer (benar? +2 : -1, floor 0, simpan poin) ──UPDATE──► user_progress
  ◄--{correct, points_delta, current_points, correct_name}--◄
```

---

## 3. Struktur Folder Lengkap (repo)

```
flashcard-angkatan/
│
├── README.md                    # Panduan jalankan dari nol (untuk teman)
├── .gitignore                   # node_modules, uploads, .env, *.exe dsb.
├── .gitattributes               # Normalisasi baris LF antar OS
├── docker-compose.yml           # PostgreSQL 16 (opsional, utk DB mudah)
│
├── docs/
│   ├── PROJECT.md               # Spesifikasi proyek (konsep & roadmap)
│   └── PEMBUATAN.md             # "Cara membangun" untuk presentasi
│
├── samples/
│   └── mahasiswa.csv            # Contoh file import (nrp,nama,photo_url)
│
├── backend/                     # ─── BACKEND (Go + Gin + GORM) ───
│   ├── .env.example             # Contoh konfigurasi (copy → .env)
│   ├── go.mod / go.sum          # Dependency Go
│   ├── cmd/
│   │   └── main.go              # Titik masuk: konek DB, migrasi, seed,
│   │                            #   daftar semua route API + serve /uploads & Swagger
│   ├── internal/
│   │   ├── models/
│   │   │   └── models.go        # 6 struct tabel (Student, Reward, UserProgress,
│   │   │                        #   PlaySession, ClaimedReward, SessionAnswer)
│   │   ├── database/
│   │   │   └── database.go      # Koneksi PostgreSQL + AutoMigrate + seed reward
│   │   ├── handlers/            # ── logika semua endpoint ──
│   │   │   ├── student.go       # CRUD mahasiswa + import CSV (transaksi)
│   │   │   ├── upload.go        # Upload foto (cek ekstensi/ukuran 5MB)
│   │   │   ├── play.go          # Game: Round, Answer (+2/-1), End (+ evaluasi)
│   │   │   ├── reward.go        # CRUD reward
│   │   │   ├── progress.go      # Poin/progress, klaim reward, riwayat sesi
│   │   │   │                    #   & detail jawaban (evaluasi)
│   │   │   └── play_test.go     # 22 unit test (DB sqlite in-memory)
│   │   ├── middlewares/
│   │   │   └── cors.go          # CORS: izinkan origin frontend
│   │   └── helpers/
│   │       └── response.go      # Format JSON seragam {success, data|error}
│   ├── docs/swagger/            # Dokumen Swagger hasil generate (jangan edit manual)
│   └── scripts/
│       └── gen-swagger.ps1      # Regenerasi Swagger dari komentar handler
│
├── frontend/                    # ─── FRONTEND (Next.js 16) ───
│   ├── package.json             # Dependency & script (dev/build/lint)
│   ├── next.config.ts            # Konfigurasi Next (Turbopack root)
│   ├── tsconfig.json            # Konfigurasi TypeScript
│   ├── postcss.config.mjs       # Config Tailwind/PostCSS
│   ├── eslint.config.mjs        # Lint rules
│   ├── .npmrc                   # allow-scripts=** (izin script npm)
│   ├── public/                  # Asset static default create-next-app
│   └── src/
│       ├── app/                 # Routing (App Router)
│       │   ├── layout.tsx       # Font + Nav global + metadata
│       │   ├── globals.css      # Design system: warna, btn, card, chip, dsb.
│       │   ├── page.tsx         # Halaman Home (hero + cara kerja + fitur)
│       │   ├── add/page.tsx     # Halaman Kelola Mahasiswa
│       │   ├── play/page.tsx    # Halaman Game + layar Evaluasi
│       │   ├── rank/page.tsx    # Halaman Rank/Reward + Tinjau evaluasi
│       │   └── favicon.ico
│       ├── components/
│       │   ├── Nav.tsx          # Navigasi sticky (logo + Add/Play/Rank)
│       │   └── icons.tsx        # 16 ikon SVG stroke (pengganti emoji)
│       └── lib/
│           └── api.ts           # Satu pintu API: BASE_URL, request(), photoUrl()
│
└── (folder runtime, TIDAK di-push)
    ├── backend/.env             # Konfigurasi rahasia lokal
    ├── backend/uploads/         # Foto yang diupload dari UI
    └── frontend/node_modules/   # Dependency npm hasil npm install
```

### Alur antar folder (peta kerja)

```
Halaman (frontend/src/app/*/page.tsx)
        │  import fungsi dari
        ▼
lib/api.ts  ──►  HTTP JSON  ──►  cmd/main.go (rute)
                                        │
                                        ▼
                        internal/handlers/*.go   ──GORM──►  internal/models/models.go
                                        │                             │
                                        ▼                             ▼
                        helpers/response.go              PostgreSQL (database.go)
                                        │
        ◄── JSON {success:true,...} ────┘
        ▼
        state React berubah → komponen render ulang (Tailwind + ikon SVG)
```

- **Bagian materi yang bisa ditunjukkan saat presentasi:** `models.go` (schema), `handlers/play.go` (logika skor), `frontend/src/lib/api.ts` (satu pintu API), `globals.css` (design system), `icons.tsx` (kenapa tanpa emoji).

---

## 4. Catatan Kecil (supaya tidak ada yang aneh di presentasi)

- `frontend/public/*.svg` & `frontend/README.md` bawaan `create-next-app` — belum dipakai (bisa dihapus kapan saja).
- `backend/.env` dan `backend/uploads/` ada di runtime, tidak ikut di-push (aman versi rahasia).
- Swagger di `backend/docs/swagger/` adalah **hasil generate** dari komentar handler — saat demo, buka `http://localhost:8080/swagger/index.html`.