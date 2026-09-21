package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"flashcard/internal/database"
	"flashcard/internal/handlers"
	"flashcard/internal/middlewares"
)

func main() {
	// muat .env bila tersedia (tidak fatal jika tidak ada)
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db := database.Connect()

	r := gin.Default()

	origin := os.Getenv("CORS_ORIGIN")
	if origin == "" {
		origin = "http://localhost:3000"
	}
	r.Use(middlewares.CORS(origin))

	// sajikan foto statis dari UPLOAD_DIR
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	r.Static("/uploads", uploadDir)

	studentHandler := handlers.NewStudentHandler(db)
	playHandler := handlers.NewPlayHandler(db)
	rewardHandler := handlers.NewRewardHandler(db)
	rankHandler := handlers.NewRankHandler(db)

	api := r.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "timestamp": time.Now().Format(time.RFC3339)})
		})

		api.POST("/upload", handlers.UploadPhoto)

		api.POST("/students", studentHandler.CreateStudent)
		api.GET("/students", studentHandler.ListStudents)
		api.GET("/students/:id", studentHandler.GetStudent)
		api.PUT("/students/:id", studentHandler.UpdateStudent)
		api.DELETE("/students/:id", studentHandler.DeleteStudent)
		api.POST("/students/import", studentHandler.ImportStudents)

		// Fase 2: permainan flashcard
		api.GET("/play/round", playHandler.Round)
		api.POST("/play/answer", playHandler.Answer)
		api.POST("/play/end", playHandler.End)

		// Fase 3: reward, progress, klaim, statistik
		api.GET("/rewards", rewardHandler.List)
		api.POST("/rewards", rewardHandler.Create)
		api.PUT("/rewards/:id", rewardHandler.Update)
		api.DELETE("/rewards/:id", rewardHandler.Delete)
		api.GET("/progress", rankHandler.Progress)
		api.POST("/rewards/:id/claim", rankHandler.Claim)
		api.GET("/sessions", rankHandler.Sessions)
	}

	log.Printf("FlashCard backend berjalan di http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("gagal menjalankan server: %v", err)
	}
}