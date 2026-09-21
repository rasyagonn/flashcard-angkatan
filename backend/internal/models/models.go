package models

import "time"

// Student merepresentasikan data mahasiswa.
type Student struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	NRP       string    `json:"nrp" gorm:"uniqueIndex;size:64;not null"`
	Name      string    `json:"name" gorm:"not null"`
	PhotoPath string    `json:"photo_path"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Reward mendefinisikan self-reward dengan target poin masing-masing.
type Reward struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Name         string    `json:"name" gorm:"not null"`
	Description  string    `json:"description"`
	TargetPoints int       `json:"target_points" gorm:"not null;default:100"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UserProgress menyimpan poin berjalan user tunggal (selalu satu baris, id=1).
type UserProgress struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	CurrentPoints int       `json:"current_points" gorm:"not null;default:0"`
	TotalPoints   int       `json:"total_points" gorm:"not null;default:0"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// PlaySession merekam satu sesi permainan untuk statistik.
type PlaySession struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	PlayedAt     time.Time `json:"played_at"`
	TotalCards   int       `json:"total_cards" gorm:"not null"`
	CorrectCount int       `json:"correct_count" gorm:"not null"`
	WrongCount   int       `json:"wrong_count" gorm:"not null"`
	Accuracy     float64   `json:"accuracy" gorm:"not null"`
	PointsEarned int       `json:"points_earned" gorm:"not null"`
}

// ClaimedReward merekam riwayat klaim reward (snapshot poin saat klaim).
type ClaimedReward struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	RewardID      uint      `json:"reward_id" gorm:"not null"`
	PointsAtClaim int       `json:"points_at_claim" gorm:"not null"`
	ClaimedAt     time.Time `json:"claimed_at"`
}

// SessionAnswer merekam satu jawaban dalam sesi permainan (untuk evaluasi
// setelah game selesai: kelihatan kartu mana yang salah dan jawaban yang benar).
type SessionAnswer struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	SessionID   uint      `json:"session_id" gorm:"not null;index"`
	StudentID   uint      `json:"student_id" gorm:"not null"`
	StudentName string    `json:"student_name" gorm:"not null"`
	PhotoPath   string    `json:"photo_path"`
	ChosenName  string    `json:"chosen_name" gorm:"not null"`
	Correct     bool      `json:"correct" gorm:"not null"`
	PointsDelta int       `json:"points_delta" gorm:"not null;default:0"`
	AnsweredAt  time.Time `json:"answered_at"`
}