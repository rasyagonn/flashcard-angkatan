package helpers

import "github.com/gin-gonic/gin"

// Success mengirim respons JSON sukses.
func Success(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{"success": true, "data": data})
}

// Error mengirim respons JSON error.
func Error(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"success": false, "error": message})
}