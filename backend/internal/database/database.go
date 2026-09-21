package database

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"flashcard/internal/models"
)

// Connect membuka koneksi PostgreSQL dan menjalankan AutoMigrate.
func Connect() *gorm.DB {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Jakarta",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("gagal konek ke database: %v", err)
	}

	if err := db.AutoMigrate(
		&models.Student{},
		&models.Reward{},
		&models.UserProgress{},
		&models.PlaySession{},
		&models.ClaimedReward{},
	); err != nil {
		log.Fatalf("gagal menjalankan migrasi: %v", err)
	}

	log.Println("Database terhubung dan migrasi selesai.")
	return db
}