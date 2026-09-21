package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"flashcard/internal/helpers"
	"flashcard/internal/models"
)

// RewardHandler mengelola daftar self-reward (CRUD).
type RewardHandler struct {
	DB *gorm.DB
}

// NewRewardHandler membuat handler reward.
func NewRewardHandler(db *gorm.DB) *RewardHandler {
	return &RewardHandler{DB: db}
}

// List menampilkan semua reward (urut target poin naik).
func (h *RewardHandler) List(c *gin.Context) {
	var rewards []models.Reward
	if err := h.DB.Order("target_points ASC, id ASC").Find(&rewards).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal mengambil reward")
		return
	}
	helpers.Success(c, http.StatusOK, rewards)
}

// Create menambah reward baru.
func (h *RewardHandler) Create(c *gin.Context) {
	var input struct {
		Name         string `json:"name" binding:"required"`
		Description  string `json:"description"`
		TargetPoints int    `json:"target_points" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		helpers.Error(c, http.StatusBadRequest, "payload tidak valid: "+err.Error())
		return
	}
	if input.TargetPoints <= 0 {
		helpers.Error(c, http.StatusBadRequest, "target poin harus lebih dari 0")
		return
	}

	reward := models.Reward{
		Name:         input.Name,
		Description:  input.Description,
		TargetPoints: input.TargetPoints,
	}
	if err := h.DB.Create(&reward).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menyimpan reward")
		return
	}
	helpers.Success(c, http.StatusCreated, reward)
}

// Update mengubah reward.
func (h *RewardHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var reward models.Reward
	if err := h.DB.First(&reward, "id = ?", id).Error; err != nil {
		helpers.Error(c, http.StatusNotFound, "reward tidak ditemukan")
		return
	}

	var input struct {
		Name         *string `json:"name"`
		Description  *string `json:"description"`
		TargetPoints *int    `json:"target_points"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		helpers.Error(c, http.StatusBadRequest, "payload tidak valid: "+err.Error())
		return
	}
	if input.Name != nil {
		reward.Name = *input.Name
	}
	if input.Description != nil {
		reward.Description = *input.Description
	}
	if input.TargetPoints != nil {
		if *input.TargetPoints <= 0 {
			helpers.Error(c, http.StatusBadRequest, "target poin harus lebih dari 0")
			return
		}
		reward.TargetPoints = *input.TargetPoints
	}

	if err := h.DB.Save(&reward).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menyimpan reward")
		return
	}
	helpers.Success(c, http.StatusOK, reward)
}

// Delete menghapus reward.
func (h *RewardHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	var reward models.Reward
	if err := h.DB.First(&reward, "id = ?", id).Error; err != nil {
		helpers.Error(c, http.StatusNotFound, "reward tidak ditemukan")
		return
	}
	if err := h.DB.Delete(&reward).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menghapus reward")
		return
	}
	helpers.Success(c, http.StatusOK, gin.H{"deleted": true, "id": reward.ID})
}