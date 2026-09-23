const INTERNAL_TEACHER_MEMO_TOKEN = /#\{선생님메모\}/g;

export function hideInternalAlimtalkMemoToken(value: string, replacement = "안내문"): string {
  return value.replace(INTERNAL_TEACHER_MEMO_TOKEN, replacement);
}

export function stripInternalAlimtalkMemoToken(value: string): string {
  return hideInternalAlimtalkMemoToken(value, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
