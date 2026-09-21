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
	seedDefaultRewards(db)
	return db
}

// seedDefaultRewards mengisi reward awal bila tabel rewards masih kosong.
func seedDefaultRewards(db *gorm.DB) {
	var count int64
	if err := db.Model(&models.Reward{}).Count(&count).Error; err != nil {
		log.Printf("gagal menghitung reward: %v", err)
		return
	}
	if count > 0 {
		return
	}
	defaults := []models.Reward{
		{Name: "Nonton 1 episode anime", Description: "Santai sebentar", TargetPoints: 50},
		{Name: "Jajan kopi", Description: "Traktir diri sendiri", TargetPoints: 100},
		{Name: "Liburan akhir pekan", Description: "Jalan-jalan sebentar", TargetPoints: 200},
	}
	if err := db.Create(&defaults).Error; err != nil {
		log.Printf("gagal seed reward awal: %v", err)
		return
	}
	log.Println("Seed reward awal dibuat (3 reward default).")
}