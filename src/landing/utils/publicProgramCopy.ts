import type { ProgramItem } from "../types";

const OPENING_DATE_PATTERN = /(^|[^0-9])(\d{1,2})\/(\d{1,2})\s*개강/g;

export type PublicProgramCopy = ProgramItem & {
  scheduleNeedsConfirmation: boolean;
};

function isPastOpeningDate(month: number, day: number, now: Date): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const opening = new Date(now.getFullYear(), month - 1, day, 23, 59, 59, 999);
  return opening.getMonth() === month - 1 && opening.getDate() === day && opening < now;
}

function hasPastOpeningDate(value: string, now: Date): boolean {
  OPENING_DATE_PATTERN.lastIndex = 0;
  for (const match of value.matchAll(OPENING_DATE_PATTERN)) {
    if (isPastOpeningDate(Number(match[2]), Number(match[3]), now)) return true;
  }
  return false;
}

function removePastOpeningDates(value: string, now: Date): string {
  OPENING_DATE_PATTERN.lastIndex = 0;
  return value
    .replace(OPENING_DATE_PATTERN, (full, prefix: string, month: string, day: string) => (
      isPastOpeningDate(Number(month), Number(day), now) ? prefix : full
    ))
    .replace(/\s*,\s*,/g, ", ")
    .replace(/^\s*[,·]\s*|\s*[,·]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 편집기에 남은 월/일 개강일이 이미 지났다면 방문자에게 지난 날짜를 약속처럼
 * 노출하지 않는다. 원본 데이터는 보존하고, 공개 화면에서만 상담 안내로 바꾼다.
 */
export function resolvePublicProgramCopy(program: ProgramItem | undefined, now = new Date()): PublicProgramCopy | null {
  if (!program) return null;
  const badge = program.badge || "";
  const description = program.description || "";
  const scheduleNeedsConfirmation = hasPastOpeningDate(`${badge} ${description}`, now);

  if (!scheduleNeedsConfirmation) return { ...program, scheduleNeedsConfirmation: false };

  return {
    ...program,
    badge: hasPastOpeningDate(badge, now) ? "개강 일정 문의" : badge,
    description: removePastOpeningDates(description, now),
    scheduleNeedsConfirmation: true,
  };
}
