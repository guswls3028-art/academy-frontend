export function normalizeLectureChipText(value?: string | null): string {
  if (!value) return "";
  return Array.from(String(value).trim().replace(/\s+/g, "")).slice(0, 2).join("");
}
