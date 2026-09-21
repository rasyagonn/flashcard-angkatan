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
> 1. Jalankan PostgreSQL (lihat `docker-compose.yml` atau instalasi lokal)
> 2. Konfigurasi `backend/.env` (contoh di `backend/.env.example`)
> 3. `cd backend && go run cmd/main.go` → http://localhost:8080
> 4. `cd frontend && npm run dev` → http://localhost:3000

Status: **Fase 1 dalam pengerjaan** — setup monorepo, model GORM, CRUD mahasiswa, upload foto, import CSV.