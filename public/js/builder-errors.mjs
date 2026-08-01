export function builderErrorMessage({ status, data = {}, language = "en", fallback = "Generation failed." } = {}) {
  const he = language === "he";
  if (status === 401) return he ? "פג תוקף החיבור. התחברו מחדש ונסו שוב." : "Your session expired. Sign in again and try once more.";
  if (status === 403) return he ? "נדרש אימות חשבון או שאין הרשאה לפעולה זו." : "Account verification or permission is required for this action.";
  if (status === 429) return he ? "נשלחו יותר מדי בקשות. המתינו רגע ונסו שוב." : "Too many requests. Wait a moment and try again.";
  if (status === 502) return he ? "שירות יצירת התוכנית אינו זמין כרגע." : "The plan-generation service is temporarily unavailable.";
  if (status === 503 && data.code === "local_demo_unavailable") return he ? "מצב הדמו המקומי אינו זמין בשרת זה." : "Local demo generation is unavailable on this server.";
  return data.error || fallback;
}
