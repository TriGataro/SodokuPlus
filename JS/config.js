/**
 * Opciones visuales y niveles derivados del número de casillas vacías.
 */
export const SYMBOL_SETS = {
  numbers: ["", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  letters: ["", "A", "B", "C", "D", "E", "F", "G", "H", "I"],
  emojis:  ["", "🍎", "🍌", "🍇", "🍒", "🍋", "🍉", "🍓", "🥝", "🥑"],
  animals: ["", "🐶", "🐱", "🐸", "🐷", "🐰", "🦊", "🐻", "🐼", "🐨"],
  japanese: ["", "あ", "い", "う", "え", "お", "か", "き", "く", "け"],
  chinese: ["", "日", "月", "火", "水", "木", "金", "土", "山", "川"]
};

export const DIFFICULTY_EMPTY_CELLS = {
  "very-easy": { min: 20, max: 29 },
  "easy":      { min: 30, max: 39 },
  "medium":    { min: 40, max: 47 },
  "hard":      { min: 48, max: 54 }
};

export const DIFFICULTY_NAMES = {
  "very-easy": "Muy Fácil",
  "easy":      "Fácil",
  "medium":    "Medio",
  "hard":      "Difícil"
};

export const THEME_NAMES = {
  light:    "Modo Claro",
  dark:     "Modo Oscuro",
  sepia:    "Tono Sepia",
  contrast: "Alto Contraste"
};

export const SYMBOL_MODE_NAMES = {
  numbers: { label: "Números (1-9)", icon: "bi-123" },
  letters: { label: "Letras (A-I)", icon: "bi-fonts" },
  emojis:  { label: "Frutas", icon: "bi-emoji-smile" },
  animals: { label: "Animales", icon: "bi-heart" },
  japanese: { label: "Japonés", icon: "bi-translate" },
  chinese: { label: "Chino", icon: "bi-translate" }
};
