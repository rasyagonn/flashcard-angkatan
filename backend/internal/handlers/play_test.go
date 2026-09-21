package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"flashcard/internal/models"
)

// ── helpers test ──────────────────────────────────────────────

// setupTestDB membuat DB sqlite in-memory termigrasi semua model.
// Tiap test memakai nama memori unik agar tidak saling terkontaminasi.
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("gagal membuka sqlite: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1) // shared-cache butuh satu koneksi
	if err := db.AutoMigrate(
		&models.Student{}, &models.Reward{}, &models.UserProgress{},
		&models.PlaySession{}, &models.ClaimedReward{}, &models.SessionAnswer{},
	); err != nil {
		t.Fatalf("gagal migrasi: %v", err)
	}
	return db
}

// seedStudents membuat n mahasiswa berfoto (id 1..n, nrp/nama unik).
func seedStudents(t *testing.T, db *gorm.DB, n int) {
	t.Helper()
	for i := 1; i <= n; i++ {
		s := models.Student{
			NRP:       fmt.Sprintf("NRP%02d", i),
			Name:      fmt.Sprintf("Mahasiswa %d", i),
			PhotoPath: "/uploads/foto.png",
		}
		if err := db.Create(&s).Error; err != nil {
			t.Fatalf("seed student %d: %v", i, err)
		}
	}
}

// makeContext membuat gin context + response recorder untuk pengujian handler.
func makeContext(method, target string, body any) (*gin.Context, *httptest.ResponseRecorder) {
	var reader *bytes.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			panic(err)
		}
		reader = bytes.NewReader(data)
	} else {
		reader = bytes.NewReader(nil)
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, target, reader)
	if body != nil {
		c.Request.Header.Set("Content-Type", "application/json")
	}
	return c, w
}

func decode(t *testing.T, w *httptest.ResponseRecorder, out any) {
	t.Helper()
	if err := json.Unmarshal(w.Body.Bytes(), out); err != nil {
		t.Fatalf("gagal decode respons: %v — body: %s", err, w.Body.String())
	}
}

// ── tests: Round ──────────────────────────────────────────────

func TestRound_ButuhMinimal4MahasiswaBerfoto(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 3) // masih kurang dari 4
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodGet, "/api/v1/play/round", nil)
	h.Round(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("harusnya 400, dapat %d", w.Code)
	}
}

func TestRound_Mengembalikan4OpsiUnik(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 6)
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodGet, "/api/v1/play/round", nil)
	h.Round(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status %d body: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data struct {
			CardID   uint   `json:"card_id"`
			PhotoURL string `json:"photo_url"`
			Options  []struct {
				ID   uint   `json:"id"`
				Name string `json:"name"`
			} `json:"options"`
		} `json:"data"`
	}
	decode(t, w, &resp)

	if resp.Data.PhotoURL == "" {
		t.Error("photo_url kosong")
	}
	if len(resp.Data.Options) != 4 {
		t.Fatalf("jumlah opsi harus 4, dapat %d", len(resp.Data.Options))
	}
	seen := map[string]bool{}
	for _, o := range resp.Data.Options {
		if o.Name == "" {
			t.Error("ada opsi dengan nama kosong")
		}
		if seen[o.Name] {
			t.Errorf("nama opsi duplikat: %s", o.Name)
		}
		seen[o.Name] = true
	}
	// kartu benar harus muncul sebagai salah satu opsi
	found := false
	for _, o := range resp.Data.Options {
		if o.ID == resp.Data.CardID {
			found = true
			break
		}
	}
	if !found {
		t.Error("kartu benar (card_id) tidak ada di daftar opsi")
	}
}

func TestRound_FinishedSaatSemuaKartuDikecualikan(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 4)
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodGet, "/api/v1/play/round?exclude=1,2,3,4", nil)
	h.Round(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	var resp struct {
		Data struct {
			Finished bool `json:"finished"`
		} `json:"data"`
	}
	decode(t, w, &resp)
	if !resp.Data.Finished {
		t.Error("harusnya finished=true ketika semua kartu dikecualikan")
	}
}

// ── tests: Answer & skor ──────────────────────────────────────

func TestAnswer_BenarTambah2(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 4)
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodPost, "/api/v1/play/answer", map[string]any{"card_id": 1, "option_id": 1})
	h.Answer(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status %d body: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data struct {
			Correct       bool `json:"correct"`
			PointsDelta   int  `json:"points_delta"`
			CurrentPoints int  `json:"current_points"`
		} `json:"data"`
	}
	decode(t, w, &resp)
	if !resp.Data.Correct {
		t.Error("harusnya correct=true")
	}
	if resp.Data.PointsDelta != 2 {
		t.Errorf("delta harus +2, dapat %d", resp.Data.PointsDelta)
	}
	if resp.Data.CurrentPoints != 2 {
		t.Errorf("poin harus 2, dapat %d", resp.Data.CurrentPoints)
	}
}

func TestAnswer_SalahKurangi1(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 4)
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodPost, "/api/v1/play/answer", map[string]any{"card_id": 2, "option_id": 3})
	h.Answer(c)

	var resp struct {
		Data struct {
			Correct       bool `json:"correct"`
			PointsDelta   int  `json:"points_delta"`
			CurrentPoints int  `json:"current_points"`
		} `json:"data"`
	}
	decode(t, w, &resp)
	if resp.Data.Correct {
		t.Error("harusnya correct=false")
	}
	if resp.Data.PointsDelta != -1 {
		t.Errorf("delta harus -1, dapat %d", resp.Data.PointsDelta)
	}
}

func TestAnswer_PoinTidakBisaMinus(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 4)
	h := NewPlayHandler(db)

	for i := 0; i < 5; i++ {
		c, w := makeContext(http.MethodPost, "/api/v1/play/answer", map[string]any{"card_id": 2, "option_id": 3})
		h.Answer(c)
		if i == 0 {
			// jawaban salah pertama: poin = -1 → floor ke 0
		}
		var resp struct {
			Data struct {
				CurrentPoints int `json:"current_points"`
			} `json:"data"`
		}
		decode(t, w, &resp)
		if resp.Data.CurrentPoints < 0 {
			t.Fatalf("poin tidak boleh negatif: %d", resp.Data.CurrentPoints)
		}
	}
}

func TestAnswer_TotalPoinHanyaMenambahDeltaPositif(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 4)
	h := NewPlayHandler(db)

	// 1 benar (+2), lalu 3 salah (-1, -1, -1 → floor 0)
	for i := 0; i < 4; i++ {
		card := uint(2)
		opt := uint(2)
		if i > 0 {
			opt = 3 // salah
		}
		c, w := makeContext(http.MethodPost, "/api/v1/play/answer", map[string]any{"card_id": card, "option_id": opt})
		h.Answer(c)
		if w.Code != http.StatusOK {
			t.Fatalf("jawaban ke-%d status %d", i, w.Code)
		}
	}

	var progress models.UserProgress
	if err := db.First(&progress, "id = ?", 1).Error; err != nil {
		t.Fatalf("progress tidak ada: %v", err)
	}
	if progress.TotalPoints != 2 {
		t.Errorf("total poin harus 2 (hanya delta positif), dapat %d", progress.TotalPoints)
	}
	if progress.CurrentPoints != 0 {
		t.Errorf("poin berjalan harus 0 (floor), dapat %d", progress.CurrentPoints)
	}
}

func TestAnswer_PayloadTidakValid400(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 4)
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodPost, "/api/v1/play/answer", map[string]any{"card_id": 1}) // tanpa option_id
	h.Answer(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("harusnya 400, dapat %d", w.Code)
	}
}

func TestAnswer_KartuTidakDitemukan404(t *testing.T) {
	db := setupTestDB(t)
	seedStudents(t, db, 4)
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodPost, "/api/v1/play/answer", map[string]any{"card_id": 999, "option_id": 1})
	h.Answer(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("harusnya 404, dapat %d", w.Code)
	}
}

// ── tests: End sesi ───────────────────────────────────────────

func TestEnd_DataTidakKonsisten400(t *testing.T) {
	db := setupTestDB(t)
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodPost, "/api/v1/play/end", map[string]any{"total_cards": 5, "correct_count": 2, "wrong_count": 2})
	h.End(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("harusnya 400, dapat %d", w.Code)
	}
}

func TestEnd_MencatatSesiDenganBenar(t *testing.T) {
	db := setupTestDB(t)
	h := NewPlayHandler(db)

	c, w := makeContext(http.MethodPost, "/api/v1/play/end", map[string]any{"total_cards": 5, "correct_count": 4, "wrong_count": 1})
	h.End(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status %d body: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data struct {
			SessionID    uint    `json:"session_id"`
			PointsEarned int     `json:"points_earned"`
			Accuracy     float64 `json:"accuracy"`
		} `json:"data"`
	}
	decode(t, w, &resp)

	if resp.Data.PointsEarned != 7 { // 4*2 + 1*(-1)
		t.Errorf("points_earned harus 7, dapat %d", resp.Data.PointsEarned)
	}
	if resp.Data.Accuracy != 80 { // 4/5 * 100%
		t.Errorf("accuracy harus 80, dapat %v", resp.Data.Accuracy)
	}

	var count int64
	db.Model(&models.PlaySession{}).Count(&count)
	if count != 1 {
		t.Errorf("harus ada 1 session, ada %d", count)
	}
}

func TestEnd_SesiBolehSeluruhSalah(t *testing.T) {
	db := setupTestDB(t)
	h := NewPlayHandler(db)

	// correct_count = 0 harus tetap diterima (regression: binding required menolak 0)
	c, w := makeContext(http.MethodPost, "/api/v1/play/end", map[string]any{"total_cards": 3, "correct_count": 0, "wrong_count": 3})
	h.End(c)

	if w.Code != http.StatusOK {
		t.Fatalf("harusnya 200, dapat %d body: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data struct {
			PointsEarned int `json:"points_earned"`
		} `json:"data"`
	}
	decode(t, w, &resp)
	if resp.Data.PointsEarned != 0 { // 3*(-1) → floor 0
		t.Errorf("points_earned harus 0, dapat %d", resp.Data.PointsEarned)
	}
}

// ── tests: evaluasi (detail jawaban) ──────────────────────────────

func TestEnd_MenyimpanDetailJawaban(t *testing.T) {
	db := setupTestDB(t)
	h := NewPlayHandler(db)

	answers := []map[string]any{
		{"student_id": 1, "student_name": "Andi", "photo_path": "/uploads/a.png", "chosen_name": "Andi", "correct": true, "points_delta": 2},
		{"student_id": 2, "student_name": "Budi", "photo_path": "/uploads/b.png", "chosen_name": "Andi", "correct": false, "points_delta": -1},
		{"student_id": 3, "student_name": "Citra", "photo_path": "/uploads/c.png", "chosen_name": "Dewi", "correct": false, "points_delta": -1},
	}
	c, w := makeContext(http.MethodPost, "/api/v1/play/end", map[string]any{
		"total_cards":   3,
		"correct_count": 1,
		"wrong_count":   2,
		"answers":       answers,
	})
	h.End(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status %d body: %s", w.Code, w.Body.String())
	}

	var saved []models.SessionAnswer
	if err := db.Order("id ASC").Find(&saved).Error; err != nil {
		t.Fatalf("gagal mengambil session_answers: %v", err)
	}
	if len(saved) != 3 {
		t.Fatalf("harus ada 3 detail jawaban, ada %d", len(saved))
	}
	if saved[0].StudentID != 1 || !saved[0].Correct || saved[0].PointsDelta != 2 {
		t.Errorf("jawaban pertama salah: %+v", saved[0])
	}
	if saved[1].Correct || saved[1].ChosenName != "Andi" || saved[1].PointsDelta != -1 {
		t.Errorf("jawaban kedua salah: %+v", saved[1])
	}
	if saved[2].ChosenName != "Dewi" {
		t.Errorf("chosen_name jawaban ketiga harus 'Dewi', dapat '%s'", saved[2].ChosenName)
	}
	// semua jawaban harus terikat ke session yang sama
	if saved[0].SessionID == 0 || saved[0].SessionID != saved[1].SessionID || saved[0].SessionID != saved[2].SessionID {
		t.Errorf("session_id tidak konsisten: %+v", saved)
	}
}

func TestSessionAnswers_MengembalikanDetail(t *testing.T) {
	db := setupTestDB(t)
	h := NewRankHandler(db)

	session := models.PlaySession{TotalCards: 2, CorrectCount: 1, WrongCount: 1, Accuracy: 0, PointsEarned: 1}
	if err := db.Create(&session).Error; err != nil {
		t.Fatalf("gagal buat session: %v", err)
	}
	db.Create(&models.SessionAnswer{
		SessionID: session.ID, StudentID: 1, StudentName: "Andi",
		PhotoPath: "/uploads/a.png", ChosenName: "Andi", Correct: true, PointsDelta: 2,
	})
	db.Create(&models.SessionAnswer{
		SessionID: session.ID, StudentID: 2, StudentName: "Budi",
		PhotoPath: "/uploads/b.png", ChosenName: "Andi", Correct: false, PointsDelta: -1,
	})

	c, w := makeContext(http.MethodGet, "/api/v1/sessions/"+fmt.Sprint(session.ID)+"/answers", nil)
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprint(session.ID)}}
	h.SessionAnswers(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status %d body: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data []models.SessionAnswer `json:"data"`
	}
	decode(t, w, &resp)
	if len(resp.Data) != 2 {
		t.Fatalf("harus ada 2 jawaban, ada %d", len(resp.Data))
	}
	if resp.Data[0].StudentName != "Andi" || !resp.Data[0].Correct {
		t.Errorf("detail jawaban pertama salah: %+v", resp.Data[0])
	}
}

func TestSessionAnswers_SesiTidakAda404(t *testing.T) {
	db := setupTestDB(t)
	h := NewRankHandler(db)

	c, w := makeContext(http.MethodGet, "/api/v1/sessions/99/answers", nil)
	c.Params = gin.Params{{Key: "id", Value: "99"}}
	h.SessionAnswers(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("harusnya 404, dapat %d", w.Code)
	}
}

// ── tests: Reward & Klaim ─────────────────────────────────────

func claimContext(id string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := makeContext(http.MethodPost, "/api/v1/rewards/"+id+"/claim", nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	return c, w
}

func TestClaim_SuksesMeresetPoin(t *testing.T) {
	db := setupTestDB(t)
	h := NewRankHandler(db)

	db.Create(&models.Reward{Name: "Nonton anime", TargetPoints: 5})
	db.Create(&models.UserProgress{ID: 1, CurrentPoints: 5, TotalPoints: 20})

	c, w := claimContext("1")
	h.Claim(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status %d body: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data struct {
			RewardName   string `json:"reward_name"`
			CurrentPoints int    `json:"current_points"`
		} `json:"data"`
	}
	decode(t, w, &resp)
	if resp.Data.CurrentPoints != 0 {
		t.Errorf("poin harus direset 0, dapat %d", resp.Data.CurrentPoints)
	}

	var progress models.UserProgress
	db.First(&progress, "id = ?", 1)
	if progress.CurrentPoints != 0 || progress.TotalPoints != 20 {
		t.Errorf("progress salah: current=%d total=%d", progress.CurrentPoints, progress.TotalPoints)
	}

	var claims []models.ClaimedReward
	db.Find(&claims)
	if len(claims) != 1 || claims[0].PointsAtClaim != 5 {
		t.Errorf("riwayat klaim salah: %+v", claims)
	}
}

func TestClaim_PoinBelumCukup400(t *testing.T) {
	db := setupTestDB(t)
	h := NewRankHandler(db)

	db.Create(&models.Reward{Name: "Nonton anime", TargetPoints: 10})
	db.Create(&models.UserProgress{ID: 1, CurrentPoints: 5, TotalPoints: 5})

	c, w := claimContext("1")
	h.Claim(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("harusnya 400, dapat %d body: %s", w.Code, w.Body.String())
	}
}

func TestClaim_RewardTidakAda404(t *testing.T) {
	db := setupTestDB(t)
	h := NewRankHandler(db)

	c, w := claimContext("99")
	h.Claim(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("harusnya 404, dapat %d", w.Code)
	}
}

func TestRewardCreate_TargetHarusPositif(t *testing.T) {
	db := setupTestDB(t)
	h := NewRewardHandler(db)

	c, w := makeContext(http.MethodPost, "/api/v1/rewards", map[string]any{"name": "Reward", "description": "", "target_points": 0})
	h.Create(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("harusnya 400, dapat %d", w.Code)
	}
	var total int64
	db.Model(&models.Reward{}).Count(&total)
	if total != 0 {
		t.Error("reward tidak boleh tersimpan saat target <= 0")
	}
}

func TestRewardCreate_Sukses(t *testing.T) {
	db := setupTestDB(t)
	h := NewRewardHandler(db)

	c, w := makeContext(http.MethodPost, "/api/v1/rewards", map[string]any{"name": "Reward", "description": "desc", "target_points": 25})
	h.Create(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("status %d body: %s", w.Code, w.Body.String())
	}
}

// ── tests: Progress ───────────────────────────────────────────

func TestProgress_NextRewardDanAchievable(t *testing.T) {
	db := setupTestDB(t)
	h := NewRankHandler(db)

	db.Create(&models.Reward{Name: "Reward kecil", TargetPoints: 5})
	db.Create(&models.Reward{Name: "Reward sedang", TargetPoints: 10})
	db.Create(&models.Reward{Name: "Reward besar", TargetPoints: 25})
	db.Create(&models.UserProgress{ID: 1, CurrentPoints: 7, TotalPoints: 30})

	c, w := makeContext(http.MethodGet, "/api/v1/progress", nil)
	h.Progress(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	var resp struct {
		Data struct {
			CurrentPoints    int  `json:"current_points"`
			TotalPoints      int  `json:"total_points"`
			NextRewardPercent float64 `json:"next_reward_percent"`
			NextReward       *struct {
				Name         string `json:"name"`
				TargetPoints int    `json:"target_points"`
			} `json:"next_reward"`
			Rewards []struct {
				Name         string  `json:"name"`
				TargetPoints int     `json:"target_points"`
				Achievable   bool    `json:"achievable"`
				Percent      float64 `json:"percent"`
			} `json:"rewards"`
		} `json:"data"`
	}
	decode(t, w, &resp)

	if resp.Data.CurrentPoints != 7 || resp.Data.TotalPoints != 30 {
		t.Errorf("poin salah: current=%d total=%d", resp.Data.CurrentPoints, resp.Data.TotalPoints)
	}
	if resp.Data.NextReward == nil {
		t.Fatal("next_reward tidak boleh nil (masih ada target > poin)")
	}
	if resp.Data.NextReward.Name != "Reward sedang" {
		t.Errorf("next_reward harus 'Reward sedang', dapat '%s'", resp.Data.NextReward.Name)
	}
	if resp.Data.NextRewardPercent != 70 {
		t.Errorf("next_reward_percent harus 70, dapat %v", resp.Data.NextRewardPercent)
	}

	byName := map[string]struct {
		Achievable bool
		Percent    float64
	}{}
	for _, r := range resp.Data.Rewards {
		byName[r.Name] = struct {
			Achievable bool
			Percent    float64
		}{r.Achievable, r.Percent}
	}
	if !byName["Reward kecil"].Achievable {
		t.Error("'Reward kecil' (target 5 <= poin 7) harus achievable")
	}
	if byName["Reward kecil"].Percent != 100 { // 7/5 = 140% → cap 100
		t.Errorf("percent 'Reward kecil' harus 100, dapat %v", byName["Reward kecil"].Percent)
	}
	if byName["Reward sedang"].Achievable {
		t.Error("'Reward sedang' (target 10 > poin 7) tidak boleh achievable")
	}
	if byName["Reward sedang"].Percent != 70 {
		t.Errorf("percent 'Reward sedang' harus 70, dapat %v", byName["Reward sedang"].Percent)
	}
}

func TestProgress_SemuaTercapaiNextRewardNil(t *testing.T) {
	db := setupTestDB(t)
	h := NewRankHandler(db)

	db.Create(&models.Reward{Name: "Reward kecil", TargetPoints: 5})
	db.Create(&models.UserProgress{ID: 1, CurrentPoints: 50, TotalPoints: 50})

	c, w := makeContext(http.MethodGet, "/api/v1/progress", nil)
	h.Progress(c)

	var resp struct {
		Data struct {
			NextReward any `json:"next_reward"`
		} `json:"data"`
	}
	decode(t, w, &resp)
	if resp.Data.NextReward != nil {
		t.Errorf("next_reward harus nil saat semua tercapai, dapat %v", resp.Data.NextReward)
	}
}