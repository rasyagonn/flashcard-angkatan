package handlers

import (
	"errors"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"flashcard/internal/helpers"
	"flashcard/internal/models"
)

// getOrInitProgress memastikan baris user_progress (id=1) selalu ada.
func getOrInitProgress(db *gorm.DB) (*models.UserProgress, error) {
	var p models.UserProgress
	err := db.First(&p, "id = ?", 1).Error
	if err == gorm.ErrRecordNotFound {
		p = models.UserProgress{ID: 1}
		if err := db.Create(&p).Error; err != nil {
			return nil, err
		}
		return &p, nil
	}
	return &p, err
}

// RankHandler menangani progress poin, klaim reward, dan statistik permainan.
type RankHandler struct {
	DB *gorm.DB
}

// NewRankHandler membuat handler rank.
func NewRankHandler(db *gorm.DB) *RankHandler {
	return &RankHandler{DB: db}
}

// rewardView adalah Reward + status capaian.
type rewardView struct {
	models.Reward
	Achievable bool    `json:"achievable"`
	Percent    float64 `json:"percent"`
}

// Progress menampilkan poin, daftar reward (dengan status), reward berikutnya, dan riwayat klaim.
// @Summary Progress poin & reward
// @Tags rank
// @Produce json
// @Success 200 {object} map[string]interface{} "current_points, total_points, rewards (+achievable,percent), next_reward, claimed"
// @Router /progress [get]
func (h *RankHandler) Progress(c *gin.Context) {
	progress, err := getOrInitProgress(h.DB)
	if err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal membaca poin")
		return
	}

	var rewards []models.Reward
	if err := h.DB.Order("target_points ASC, id ASC").Find(&rewards).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal mengambil reward")
		return
	}

	views := make([]rewardView, 0, len(rewards))
	var nextReward *models.Reward
	nextPercent := 0.0
	for i := range rewards {
		r := rewards[i]
		percent := 0.0
		if r.TargetPoints > 0 {
			percent = math.Round(float64(progress.CurrentPoints)/float64(r.TargetPoints)*1000) / 10
			if percent > 100 {
				percent = 100
			}
		}
		views = append(views, rewardView{
			Reward:     r,
			Achievable: progress.CurrentPoints >= r.TargetPoints,
			Percent:    percent,
		})
		if nextReward == nil && progress.CurrentPoints < r.TargetPoints {
			nr := r
			nextReward = &nr
			nextPercent = percent
		}
	}

	var claimed []models.ClaimedReward
	h.DB.Order("claimed_at DESC").Limit(20).Find(&claimed)

	helpers.Success(c, http.StatusOK, gin.H{
		"current_points":      progress.CurrentPoints,
		"total_points":        progress.TotalPoints,
		"rewards":             views,
		"next_reward":         nextReward, // nil jika semua reward sudah tercapai
		"next_reward_percent": nextPercent,
		"claimed":             claimed,
	})
}

// Claim mengklaim reward: validasi poin ≥ target, catat riwayat klaim, lalu reset poin ke 0.
// @Summary Klaim reward
// @Tags rank
// @Produce json
// @Param id path int true "ID reward"
// @Success 200 {object} map[string]interface{} "claimed_reward + poin direset ke 0"
// @Failure 400 {object} map[string]interface{} "Poin belum mencukupi"
// @Failure 404 {object} map[string]interface{} "Reward tidak ditemukan"
// @Router /rewards/{id}/claim [post]
func (h *RankHandler) Claim(c *gin.Context) {
	id := c.Param("id")
	var reward models.Reward
	if err := h.DB.First(&reward, "id = ?", id).Error; err != nil {
		helpers.Error(c, http.StatusNotFound, "reward tidak ditemukan")
		return
	}

	var claimed models.ClaimedReward
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		progress, err := getOrInitProgress(tx)
		if err != nil {
			return err
		}
		if progress.CurrentPoints < reward.TargetPoints {
			return errors.New("poin belum mencukupi target reward")
		}

		claimed = models.ClaimedReward{
			RewardID:      reward.ID,
			PointsAtClaim: progress.CurrentPoints,
			ClaimedAt:     time.Now(),
		}
		if err := tx.Create(&claimed).Error; err != nil {
			return err
		}

		progress.CurrentPoints = 0
		return tx.Save(progress).Error
	})
	if err != nil {
		if err.Error() == "poin belum mencukupi target reward" {
			helpers.Error(c, http.StatusBadRequest, err.Error())
		} else {
			helpers.Error(c, http.StatusInternalServerError, "gagal mengklaim reward: "+err.Error())
		}
		return
	}

	helpers.Success(c, http.StatusOK, gin.H{
		"claimed_reward": claimed,
		"reward_name":    reward.Name,
		"current_points": 0,
	})
}

// Sessions menampilkan riwayat sesi permainan (statistik).
// @Summary Riwayat sesi permainan
// @Tags rank
// @Produce json
// @Success 200 {object} map[string]interface{} "Daftar play_sessions (maks 50 terakhir)"
// @Router /sessions [get]
func (h *RankHandler) Sessions(c *gin.Context) {
	var sessions []models.PlaySession
	if err := h.DB.Order("played_at DESC").Limit(50).Find(&sessions).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal mengambil riwayat sesi")
		return
	}
	helpers.Success(c, http.StatusOK, sessions)
}