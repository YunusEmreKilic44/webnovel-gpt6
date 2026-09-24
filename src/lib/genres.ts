// Turkish categories adapted from SFACG's catalog and Webnovel's genres.
// https://book.sfacg.com/List/
// https://en.webnovel.com/category/0_8_1_2_3_10
// https://www.webnovel.com/genres/isekai-novels
// https://www.webnovel.com/genres/cultivation-novels
// Keep existing labels stable: books store these values directly.
export const bookGenres = [
  "Fantastik",
  "Bilim Kurgu",
  "Romantik",
  "Gizem",
  "Macera",
  "Dram",
  "Aksiyon",
  "Komedi",
  "Korku",
  "Gerilim",
  "Doğaüstü",
  "Tarihi Kurgu",
  "Savaş",
  "Şehir Yaşamı",
  "Okul Hayatı",
  "Günlük Yaşam",
  "Spor",
  "Oyun",
  "LitRPG",
  "Doğu Fantastiği",
  "Dövüş Sanatları",
  "Yetişim (Xianxia)",
  "Isekai",
  "Kıyamet Sonrası",
  "Fan Kurgu",
  "Diğer",
] as const;

export type BookGenre = (typeof bookGenres)[number];
export const MAX_BOOK_GENRES = 5;

// "Tümü" is a discovery filter, never a category that can be saved on a book.
export const genres = ["Tümü", ...bookGenres] as const;
