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

// getOrInitProgress memastikan baris user_progress (id=1) selalu ada.
func (h *PlayHandler) getOrInitProgress() (*models.UserProgress, error) {
	var p models.UserProgress
	err := h.DB.First(&p, "id = ?", 1).Error
	if err == gorm.ErrRecordNotFound {
		p = models.UserProgress{ID: 1}
		if err := h.DB.Create(&p).Error; err != nil {
			return nil, err
		}
		return &p, nil
	}
	return &p, err
}

// Round mengambil satu kartu acak + 4 opsi nama (diacak, tanpa penanda jawaban).
// Query param `exclude` = id kartu yang sudah dimainkan pada sesi ini.
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

	progress, err := h.getOrInitProgress()
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

// End mencatat riwayat satu sesi permainan ke play_sessions.
func (h *PlayHandler) End(c *gin.Context) {
	var input struct {
		TotalCards   int `json:"total_cards" binding:"required"`
		CorrectCount int `json:"correct_count" binding:"required"`
		WrongCount   int `json:"wrong_count" binding:"required"`
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

	helpers.Success(c, http.StatusOK, gin.H{
		"session_id":    session.ID,
		"points_earned": session.PointsEarned,
		"accuracy":      session.Accuracy,
	})
}