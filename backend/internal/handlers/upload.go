package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"flashcard/internal/helpers"
)

const maxUploadSize = 5 * 1024 * 1024 // 5 MB

var allowedExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
}

// UploadPhoto menyimpan foto ke UPLOAD_DIR dan mengembalikan path publik.
func UploadPhoto(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)

	file, err := c.FormFile("file")
	if err != nil {
		helpers.Error(c, http.StatusBadRequest, "file diperlukan (field: file)")
		return
	}

	if file.Size > maxUploadSize {
		helpers.Error(c, http.StatusBadRequest, "ukuran file melebihi 5 MB")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExtensions[ext] {
		helpers.Error(c, http.StatusBadRequest, "format file tidak didukung (jpg, jpeg, png, webp)")
		return
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal membuat folder upload")
		return
	}

	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dest := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, dest); err != nil {
		helpers.Error(c, http.StatusInternalServerError, "gagal menyimpan file")
		return
	}

	helpers.Success(c, http.StatusOK, gin.H{
		"photo_path": "/uploads/" + filename,
		"filename":   filename,
	})
}