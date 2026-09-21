package handlers

import (
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"flashcard/internal/helpers"
	"flashcard/internal/models"
)

const (
	pointsCorrect = 2
	pointsWrong   = -1
	minOptions    = 4 // jumlah pilihan MCQ (1 benar + 3 pengecoh)
)

// PlayHandler memuat dependensi handler permainan.
type PlayHandler struct {
	DB *gorm.DB
}

// NewPlayHandler membuat handler permainan.
func NewPlayHandler(db *gorm.DB) *PlayHandler {
	return &PlayHandler{DB: db}
}

// parseIDs mengurai string "1,2,3" menjadi slice uint id.
func parseIDs(s string) []uint {
	parts := strings.Split(s, ",")
	ids := make([]uint, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if n, err := strconv.ParseUint(p, 10, 64); err == nil && n > 0 {
			ids = append(ids, uint(n))
		}
	}
	return ids
}

// getOrInitProgress dipindah ke progress.go sebagai fungsi paket bersama.
// lihat: internal/handlers/progress.go

// Round mengambil satu kartu acak + 4 opsi nama (diacak, tanpa penanda jawaban).
// Query param `exclude` = id kartu yang sudah dimainkan pada sesi ini.
// @Summary Ambil kartu acak (round baru)
// @Tags play
// @Produce json
// @Param exclude query string false "ID kartu yang sudah dimainkan, pisahkan koma (1,2,3)"
// @Success 200 {object} map[string]interface{} "card_id, photo_url, options[4] — {finished:true} jika sesi habis"
// @Failure 400 {object} map[string]interface{} "Minimal 4 mahasiswa berfoto"
// @Failure 500 {object} map[string]interface{} "Kesalahan server"
// @Router /play/round [get]
func (h *PlayHandler) Round(c *gin.Context) {
	// butuh minimal 4 mahasiswa berfoto agar MCQ 4 opsi bisa dibentuk
	var totalPlayable int64
	if err := h.DB.Model(&models.Student{}).Where("photo_path <> ''").Count(&totalPlayable).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menghitung kartu")
		return
	}
	if totalPlayable < minOptions {
		helpers.Error(c, http.StatusBadRequest, "perlu minimal 4 mahasiswa berfoto untuk bermain")
		return
	}

	exclude := parseIDs(c.Query("exclude"))

	// pilih kartu acak yang belum dimainkan di sesi ini
	query := h.DB.Where("photo_path <> ''")
	if len(exclude) > 0 {
		query = query.Where("id NOT IN ?", exclude)
	}
	var candidates []models.Student
	if err := query.Order("RANDOM()").Limit(1).Find(&candidates).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal mengambil kartu")
		return
	}
	if len(candidates) == 0 {
		// semua kartu sudah dimainkan → sesi selesai
		helpers.Success(c, http.StatusOK, gin.H{"finished": true})
		return
	}
	card := candidates[0]
	decoys := h.pickDecoys(card, minOptions-1)

	options := []gin.H{{"id": card.ID, "name": card.Name}}
	for _, d := range decoys {
		options = append(options, gin.H{"id": d.ID, "name": d.Name})
	}
	rand.Shuffle(len(options), func(i, j int) { options[i], options[j] = options[j], options[i] })

	helpers.Success(c, http.StatusOK, gin.H{
		"card_id":   card.ID,
		"photo_url": card.PhotoPath,
		"options":   options,
	})
}

// pickDecoys memilih N nama lain (bebas, boleh dari kartu sesi lain) dengan nama selalu unik.
func (h *PlayHandler) pickDecoys(card models.Student, count int) []models.Student {
	var pool []models.Student
	h.DB.Where("photo_path <> '' AND id <> ?", card.ID).Order("RANDOM()").Find(&pool)

	decoys := make([]models.Student, 0, count)
	used := map[string]bool{card.Name: true} // nama kartu benar tidak boleh terulang jadi opsi
	for _, s := range pool {
		if len(decoys) >= count {
			break
		}
		if used[s.Name] {
			continue
		}
		used[s.Name] = true
		decoys = append(decoys, s)
	}
	return decoys
}

// Answer memvalidasi jawaban dan mengaplikasikan skor (+2 benar, -1 salah, minimal 0).
// @Summary Jawab pertanyaan
// @Tags play
// @Accept json
// @Produce json
// @Param payload body object true "Jawaban" SchemaExample({"card_id":1,"option_id":3})
// @Success 200 {object} map[string]interface{} "correct, points_delta, current_points, correct_name"
// @Failure 400 {object} map[string]interface{} "Payload tidak valid"
// @Failure 404 {object} map[string]interface{} "Kartu tidak ditemukan"
// @Router /play/answer [post]
func (h *PlayHandler) Answer(c *gin.Context) {
	var input struct {
		CardID   uint `json:"card_id" binding:"required"`
		OptionID uint `json:"option_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		helpers.Error(c, http.StatusBadRequest, "payload tidak valid: "+err.Error())
		return
	}

	var card models.Student
	if err := h.DB.First(&card, "id = ? AND photo_path <> ''", input.CardID).Error; err != nil {
		helpers.Error(c, http.StatusNotFound, "kartu tidak ditemukan")
		return
	}

	progress, err := getOrInitProgress(h.DB)
	if err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal membaca poin")
		return
	}

	correct := input.OptionID == input.CardID
	delta := pointsWrong
	if correct {
		delta = pointsCorrect
	}

	progress.CurrentPoints += delta
	if progress.CurrentPoints < 0 {
		progress.CurrentPoints = 0
	}
	if delta > 0 {
		progress.TotalPoints += delta
	}

	if err := h.DB.Save(progress).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menyimpan poin")
		return
	}

	helpers.Success(c, http.StatusOK, gin.H{
		"correct":        correct,
		"points_delta":   delta,
		"current_points": progress.CurrentPoints,
		"correct_name":   card.Name,
	})
}

// sessionAnswerInput adalah satu record jawaban yang dikirim klien saat sesi
// berakhir, untuk dijadikan bahan evaluasi.
type sessionAnswerInput struct {
	StudentID   uint   `json:"student_id"`
	StudentName string `json:"student_name"`
	PhotoPath   string `json:"photo_path"`
	ChosenName  string `json:"chosen_name"`
	Correct     bool   `json:"correct"`
	PointsDelta int    `json:"points_delta"`
}

// End mencatat riwayat satu sesi permainan ke play_sessions, plus detail
// jawaban per kartu ke session_answers (opsional, untuk evaluasi).
// @Summary Akhiri sesi & catat statistik
// @Tags play
// @Accept json
// @Produce json
// @Param payload body object true "Hasil sesi (+ optional answers[] detail jawaban)" SchemaExample({"total_cards":7,"correct_count":4,"wrong_count":3,"answers":[{"student_id":1,"student_name":"Andi","photo_path":"/uploads/a.png","chosen_name":"Andi","correct":true,"points_delta":2}]})
// @Success 200 {object} map[string]interface{} "session_id, points_earned, accuracy"
// @Failure 400 {object} map[string]interface{} "Payload tidak valid / tidak konsisten"
// @Router /play/end [post]
func (h *PlayHandler) End(c *gin.Context) {
	var input struct {
		TotalCards   int                  `json:"total_cards"`
		CorrectCount int                  `json:"correct_count"`
		WrongCount   int                  `json:"wrong_count"`
		Answers      []sessionAnswerInput `json:"answers"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		helpers.Error(c, http.StatusBadRequest, "payload tidak valid: "+err.Error())
		return
	}
	if input.TotalCards <= 0 || input.CorrectCount < 0 || input.WrongCount < 0 ||
		input.CorrectCount+input.WrongCount != input.TotalCards {
		helpers.Error(c, http.StatusBadRequest, "data sesi tidak konsisten")
		return
	}

	pointsEarned := input.CorrectCount*pointsCorrect + input.WrongCount*pointsWrong
	if pointsEarned < 0 {
		pointsEarned = 0
	}
	accuracy := math.Round(float64(input.CorrectCount)/float64(input.TotalCards)*10000) / 100 // persen, 2 desimal

	session := models.PlaySession{
		PlayedAt:     time.Now(),
		TotalCards:   input.TotalCards,
		CorrectCount: input.CorrectCount,
		WrongCount:   input.WrongCount,
		Accuracy:     accuracy,
		PointsEarned: pointsEarned,
	}
	if err := h.DB.Create(&session).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menyimpan riwayat sesi")
		return
	}

	// simpan detail tiap jawaban (opsional) untuk evaluasi setelah main
	if len(input.Answers) > 0 {
		now := time.Now()
		rows := make([]models.SessionAnswer, 0, len(input.Answers))
		for _, a := range input.Answers {
			if a.StudentID == 0 {
				continue
			}
			rows = append(rows, models.SessionAnswer{
				SessionID:   session.ID,
				StudentID:   a.StudentID,
				StudentName: a.StudentName,
				PhotoPath:   a.PhotoPath,
				ChosenName:  a.ChosenName,
				Correct:     a.Correct,
				PointsDelta: a.PointsDelta,
				AnsweredAt:  now,
			})
		}
		if len(rows) > 0 {
			if err := h.DB.Create(&rows).Error; err != nil {
				helpers.Error(c, http.StatusInternalServerError, "gagal menyimpan detail jawaban")
				return
			}
		}
	}

	helpers.Success(c, http.StatusOK, gin.H{
		"session_id":    session.ID,
		"points_earned": session.PointsEarned,
		"accuracy":      session.Accuracy,
	})
}