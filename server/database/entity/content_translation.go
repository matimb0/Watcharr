package entity

// ContentTranslation stores user-facing metadata for one content item and language.
type ContentTranslation struct {
	ID        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ContentID int    `json:"contentId" gorm:"uniqueIndex:contenttranslationidx;not null"`
	Language  string `json:"language" gorm:"uniqueIndex:contenttranslationidx;not null"`
	Title     string `json:"title"`
	Overview  string `json:"overview"`
}