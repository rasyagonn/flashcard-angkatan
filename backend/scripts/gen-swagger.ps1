# gen-swagger.ps1 — Regenerasi dokumen Swagger (docs/swagger) untuk backend FlashCard.
#
# Catatan penting:
#   Pada mesin tertentu (Windows), `swag init` gagal mem-parse folder kerja asli
#   (menghasilkan swagger.json kosong / paths: {}) meskipun isi file identik.
#   Solusi andal: salin sumber ke folder staging lalu jalankan swag di sana,
#   dan salin hasilnya kembali ke backend/docs/swagger.
#
# Cara pakai:
#   powershell -ExecutionPolicy Bypass -File scripts\gen-swagger.ps1
#   (jalankan dari folder backend)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot   # = backend/
$stage = Join-Path $env:TEMP "flashcard-swagger-gen"

# --- 1. Siapkan staging copy dari sumber yang diperlukan untuk generasi ---
if (Test-Path $stage) {
    Remove-Item $stage -Recurse -Force
}
New-Item -ItemType Directory -Path $stage | Out-Null | Out-Null
Copy-Item (Join-Path $root "cmd")       (Join-Path $stage "cmd")       -Recurse
Copy-Item (Join-Path $root "internal")  (Join-Path $stage "internal")  -Recurse
Copy-Item (Join-Path $root "go.mod")    (Join-Path $stage "go.mod")
Copy-Item (Join-Path $root "go.sum")    (Join-Path $stage "go.sum")

# --- 2. Jalankan swag di staging ---
$swag = Join-Path $env:USERPROFILE "go\bin\swag.exe"
if (-not (Test-Path $swag)) {
    throw "swag CLI belum terpasang. Jalankan: go install github.com/swaggo/swag/cmd/swag@latest"
}

Push-Location $stage
try {
    & $swag init --dir cmd,internal/handlers --generalInfo main.go --output docs/swagger
    if ($LASTEXITCODE -ne 0) {
        throw "swag init gagal (exit code $LASTEXITCODE)"
    }
} finally {
    Pop-Location
}

$generated = Join-Path $stage "docs\swagger\swagger.json"
if (-not (Test-Path $generated)) {
    throw "swagger.json tidak dihasilkan. Periksa anotasi @Router/@Summary pada handler."
}

# --- 3. Salin hasil ke backend/docs/swagger ---
$target = Join-Path $root "docs\swagger"
Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $stage "docs\swagger") $target -Recurse

# --- 4. Bersihkan staging ---
Remove-Item $stage -Recurse -Force

Write-Host "OK: Dokumen Swagger diperbarui di backend/docs/swagger"
Write-Host "    UI  : http://localhost:8080/swagger/index.html"
Write-Host "    JSON: backend/docs/swagger/swagger.json"