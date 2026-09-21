package handlers

import (
	"encoding/csv"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"flashcard/internal/helpers"
	"flashcard/internal/models"
)

// StudentHandler memuat dependensi handler mahasiswa.
type StudentHandler struct {
	DB *gorm.DB
}

// NewStudentHandler membuat handler mahasiswa.
func NewStudentHandler(db *gorm.DB) *StudentHandler {
	return &StudentHandler{DB: db}
}

// CreateStudent menambah satu mahasiswa.
// @Summary Tambah mahasiswa
// @Tags students
// @Accept json
// @Produce json
// @Param payload body object true "Data mahasiswa" SchemaExample({"nrp":"5025201001","name":"Andi Pratama","photo_path":"/uploads/x.png"})
// @Success 201 {object} map[string]interface{} "Mahasiswa dibuat"
// @Failure 400 {object} map[string]interface{} "Payload tidak valid"
// @Failure 409 {object} map[string]interface{} "NRP sudah terdaftar"
// @Router /students [post]
func (h *StudentHandler) CreateStudent(c *gin.Context) {
	var input struct {
		NRP       string `json:"nrp" binding:"required"`
		Name      string `json:"name" binding:"required"`
		PhotoPath string `json:"photo_path"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		helpers.Error(c, http.StatusBadRequest, "payload tidak valid: "+err.Error())
		return
	}

	student := models.Student{NRP: input.NRP, Name: input.Name, PhotoPath: input.PhotoPath}
	if err := h.DB.Create(&student).Error; err != nil {
		helpers.Error(c, http.StatusConflict, "gagal membuat mahasiswa (NRP mungkin sudah terdaftar): "+err.Error())
		return
	}
	helpers.Success(c, http.StatusCreated, student)
}

// ListStudents menampilkan daftar mahasiswa dengan pagination & pencarian.
// @Summary Daftar mahasiswa
// @Tags students
// @Produce json
// @Param page query int false "Halaman (default 1)"
// @Param limit query int false "Jumlah per halaman (default 10, maks 100)"
// @Param search query string false "Cari berdasarkan nama / NRP"
// @Success 200 {object} map[string]interface{} "Daftar mahasiswa + pagination"
// @Router /students [get]
func (h *StudentHandler) ListStudents(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	search := strings.TrimSpace(c.Query("search"))

	query := h.DB.Model(&models.Student{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("nrp ILIKE ? OR name ILIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menghitung data")
		return
	}

	var students []models.Student
	if err := query.Order("name ASC").Offset((page - 1) * limit).Limit(limit).Find(&students).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal mengambil data")
		return
	}

	helpers.Success(c, http.StatusOK, gin.H{
		"students": students,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetStudent menampilkan detail satu mahasiswa.
// @Summary Detail mahasiswa
// @Tags students
// @Produce json
// @Param id path int true "ID mahasiswa"
// @Success 200 {object} map[string]interface{} "Data mahasiswa"
// @Failure 404 {object} map[string]interface{} "Tidak ditemukan"
// @Router /students/{id} [get]
func (h *StudentHandler) GetStudent(c *gin.Context) {
	id := c.Param("id")
	var student models.Student
	if err := h.DB.First(&student, "id = ?", id).Error; err != nil {
		helpers.Error(c, http.StatusNotFound, "mahasiswa tidak ditemukan")
		return
	}
	helpers.Success(c, http.StatusOK, student)
}

// UpdateStudent mengubah data mahasiswa.
// @Summary Update mahasiswa
// @Tags students
// @Accept json
// @Produce json
// @Param id path int true "ID mahasiswa"
// @Param payload body object true "Field yang ingin diubah" SchemaExample({"name":"Andi Kurnia"})
// @Success 200 {object} map[string]interface{} "Data ter-update"
// @Failure 400 {object} map[string]interface{} "Payload tidak valid"
// @Failure 404 {object} map[string]interface{} "Tidak ditemukan"
// @Failure 409 {object} map[string]interface{} "NRP sudah terdaftar"
// @Router /students/{id} [put]
func (h *StudentHandler) UpdateStudent(c *gin.Context) {
	id := c.Param("id")
	var student models.Student
	if err := h.DB.First(&student, "id = ?", id).Error; err != nil {
		helpers.Error(c, http.StatusNotFound, "mahasiswa tidak ditemukan")
		return
	}

	var input struct {
		NRP       *string `json:"nrp"`
		Name      *string `json:"name"`
		PhotoPath *string `json:"photo_path"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		helpers.Error(c, http.StatusBadRequest, "payload tidak valid: "+err.Error())
		return
	}

	if input.NRP != nil {
		student.NRP = *input.NRP
	}
	if input.Name != nil {
		student.Name = *input.Name
	}
	if input.PhotoPath != nil {
		student.PhotoPath = *input.PhotoPath
	}

	if err := h.DB.Save(&student).Error; err != nil {
		helpers.Error(c, http.StatusConflict, "gagal menyimpan perubahan (NRP mungkin sudah terdaftar): "+err.Error())
		return
	}
	helpers.Success(c, http.StatusOK, student)
}

// DeleteStudent menghapus mahasiswa beserta file foto lokalnya (bila ada).
// @Summary Hapus mahasiswa
// @Tags students
// @Produce json
// @Param id path int true "ID mahasiswa"
// @Success 200 {object} map[string]interface{} "Mahasiswa terhapus"
// @Failure 404 {object} map[string]interface{} "Tidak ditemukan"
// @Router /students/{id} [delete]
func (h *StudentHandler) DeleteStudent(c *gin.Context) {
	id := c.Param("id")
	var student models.Student
	if err := h.DB.First(&student, "id = ?", id).Error; err != nil {
		helpers.Error(c, http.StatusNotFound, "mahasiswa tidak ditemukan")
		return
	}
	if err := h.DB.Delete(&student).Error; err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menghapus mahasiswa")
		return
	}

	// hapus file foto lokal bila tersimpan di /uploads/
	if strings.HasPrefix(student.PhotoPath, "/uploads/") {
		filename := filepath.Base(strings.TrimPrefix(student.PhotoPath, "/uploads/"))
		if filename != "." && filename != "" {
			uploadDir := os.Getenv("UPLOAD_DIR")
			if uploadDir == "" {
				uploadDir = "./uploads"
			}
			_ = os.Remove(filepath.Join(uploadDir, filename))
		}
	}

	helpers.Success(c, http.StatusOK, gin.H{"deleted": true, "id": student.ID})
}

// ImportStudents mengimport data massal dari file CSV (kolom: nrp,nama,photo_url).
// Semua-atau-tidak: jika ada baris gagal, seluruh import dibatalkan (rollback).
// @Summary Import mahasiswa (CSV)
// @Tags students
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "File CSV (kolom: nrp,nama,photo_url)"
// @Success 200 {object} map[string]interface{} "Ringkasan import"
// @Failure 400 {object} map[string]interface{} "Ada baris gagal → rollback / file tidak valid"
// @Router /students/import [post]
func (h *StudentHandler) ImportStudents(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		helpers.Error(c, http.StatusBadRequest, "file CSV diperlukan (field: file)")
		return
	}

	f, err := fileHeader.Open()
	if err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal membaca file")
		return
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = 3
	reader.TrimLeadingSpace = true

	// lewati baris header
	if _, err := reader.Read(); err != nil && err != io.EOF {
		helpers.Error(c, http.StatusBadRequest, "file CSV kosong atau tidak valid")
		return
	}

	type rowResult struct {
		Line  int    `json:"line"`
		NRP   string `json:"nrp"`
		Error string `json:"error,omitempty"`
	}

	var failedRows []rowResult
	totalRows := 0

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		line := 1 // baris header sudah dibaca
		for {
			record, readErr := reader.Read()
			if readErr == io.EOF {
				break
			}
			if readErr != nil {
				return readErr
			}
			line++
			totalRows++
			nrp := strings.TrimSpace(record[0])
			name := strings.TrimSpace(record[1])
			photo := strings.TrimSpace(record[2])

			if nrp == "" || name == "" {
				failedRows = append(failedRows, rowResult{Line: line, NRP: nrp, Error: "kolom nrp/nama tidak boleh kosong"})
				continue
			}

			student := models.Student{NRP: nrp, Name: name, PhotoPath: photo}
			if err := tx.Create(&student).Error; err != nil {
				failedRows = append(failedRows, rowResult{Line: line, NRP: nrp, Error: err.Error()})
				continue
			}
		}

		if len(failedRows) > 0 {
			return errors.New("terdapat baris yang gagal; seluruh import dibatalkan")
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Import dibatalkan: " + err.Error(),
			"data": gin.H{
				"imported":   0,
				"failed":     len(failedRows),
				"total_rows": totalRows,
				"detail":     failedRows,
			},
		})
		return
	}

	helpers.Success(c, http.StatusOK, gin.H{
		"imported":   totalRows,
		"failed":     0,
		"total_rows": totalRows,
	})
}