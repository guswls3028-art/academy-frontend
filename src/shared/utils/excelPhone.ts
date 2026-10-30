// Shared roster preview/JSON import grammar. Keep aligned with the backend parser.
const RELATION = "아버지|어머니|학부모|보호자|아빠|엄마|부친|모친|부모|학생|본인|부|모|father|mother|parent|guardian";
const LABEL = `(?:\\(\\s*(?:${RELATION})\\s*\\)|\\[\\s*(?:${RELATION})\\s*\\]|(?:${RELATION}))`;
const PREFIX = new RegExp(`^${LABEL}\\s*:?\\s*`, "i");
const SUFFIX = new RegExp(`\\s*${LABEL}$`, "i");
const PHONE = /^(?:(?:0?10|\(010\))(?:\s*[-.]?\s*)[0-9]{4}(?:\s*[-.]?\s*)[0-9]{4}|[0-9]{8})$/;

/** Invalid input stays nonempty so callers cannot mistake it for an omitted phone. */
export function normalizeExcelPhone(input: unknown): string {
  const original = String(input ?? "").trim();
  const folded = original
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\u2010-\u2015\u2212]/g, "-");
  const value = PREFIX.test(folded)
    ? folded.replace(PREFIX, "").trim()
    : folded.replace(SUFFIX, "").trim();
  if (!PHONE.test(value)) return original;
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 && digits.startsWith("10") ? `0${digits}` : digits;
}
