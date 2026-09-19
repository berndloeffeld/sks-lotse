// The one place the frontend knows how a question's streak maps to
// progress. The UI only ever draws the 0–1 value from streakProgress(), never
// the count itself — learners shouldn't see at a glance how many correct
// answers "gelernt" takes, and the method is expected to change.

// Mirrors LEARNED_STREAK_THRESHOLD in backend/app/core/progress.py.
const LEARNED_STREAK = 3

export function isLearned(streak: number): boolean {
  return streak >= LEARNED_STREAK
}

export function streakProgress(streak: number): number {
  return Math.min(Math.max(streak, 0) / LEARNED_STREAK, 1)
}
