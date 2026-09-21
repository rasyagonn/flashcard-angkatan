# 📇 FlashCard Angkatan

Aplikasi flashcard untuk mengingat nama mahasiswa satu angkatan. Lihat foto → tebak nama → kumpulkan poin → klaim self-reward.

📄 Spesifikasi lengkap: [`docs/PROJECT.md`](docs/PROJECT.md)

## Tech Stack
- **Frontend:** Next.js (App Router)
- **Backend:** Go + Gin
- **Database:** PostgreSQL + GORM
- **API Tools:** Postman, Swagger
- **VCS:** Git + GitHub

## Struktur
```
opencode-project/
├── docs/PROJECT.md    # Spesifikasi proyek
├── frontend/          # Next.js
├── backend/           # Go + Gin
└── docker-compose.yml # PostgreSQL lokal
```

## Menjalankan
> 1. PostgreSQL lokal (sudah terinstall via winget): user `postgres`, password `postgres`, database `flashcard` dibuat
> 2. Konfigurasi `backend/.env` (contoh di `backend/.env.example`)
> 3. `cd backend && go run ./cmd` → http://localhost:8080
> 4. `cd frontend && npm run dev` → http://localhost:3000

Status: **Fase 4 selesai — MVP lengkap** ✅ — Play flashcard (skor +2/-1), Rank dengan self-reward (klaim → reset poin), statistik sesi, **Swagger UI** di http://localhost:8080/swagger/index.html, dan **18 unit test Go** lulus. Semua terverifikasi end-to-end terhadap PostgreSQL.

Catatan:
- Folder `frontend/.npmrc` berisi `allow-scripts=**` untuk mengizinkan script instalasi npm (mengikuti kebijakan `allow-scripts` global di `~/.npmrc`).
- Regenerasi dokumen Swagger: `powershell -File backend/scripts/gen-swagger.ps1` (menggunakan staging copy karena kuirk `swag` di mesin tertentu).
- Jalankan unit test backend: `cd backend && go test ./...`.