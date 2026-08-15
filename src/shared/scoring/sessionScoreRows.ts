import type {
  SessionScoreRow,
  SessionScoresExamReviewFilter,
} from "@/shared/api/contracts/sessionScores";

const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
const HANGUL_INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function normalizeStudentSearch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function toHangulInitials(value: string): string {
  return Array.from(value).map((char) => {
    const code = char.charCodeAt(0);
    if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) return char;
    return HANGUL_INITIALS[Math.floor((code - HANGUL_SYLLABLE_START) / 588)] ?? char;
  }).join("");
}

/** 이름 일부와 한글 초성 검색을 성적표의 집계·필터·표에서 동일하게 적용한다. */
export function matchesSessionScoreStudentSearch(studentName: string, rawQuery: string): boolean {
  const query = normalizeStudentSearch(rawQuery);
  if (!query) return true;
  const name = normalizeStudentSearch(studentName);
  const initials = normalizeStudentSearch(toHangulInitials(studentName));
  return name.includes(query) || initials.includes(query);
}

export type SessionRowExamReviewSummary = {
  kind: "incomplete" | "complete" | "clear" | "pending" | "none";
  incompleteTitles: string[];
  completedTitles: string[];
  pendingTitles: string[];
  notRequiredTitles: string[];
};

/** 시험별 교사 오답 확인 저장 상태를 행 단위로 안전하게 집계한다. */
export function getSessionRowExamReviewSummary(row: SessionScoreRow): SessionRowExamReviewSummary {
  const exams = row.exams ?? [];
  if (exams.length === 0) {
    return {
      kind: "none",
      incompleteTitles: [],
      completedTitles: [],
      pendingTitles: [],
      notRequiredTitles: [],
    };
  }

  const incompleteTitles: string[] = [];
  const completedTitles: string[] = [];
  const pendingTitles: string[] = [];
  const notRequiredTitles: string[] = [];
  for (const exam of exams) {
    switch (exam.block.correction_status) {
      case "PENDING":
        incompleteTitles.push(exam.title);
        break;
      case "COMPLETED":
        completedTitles.push(exam.title);
        break;
      case "NOT_REQUIRED":
        notRequiredTitles.push(exam.title);
        break;
      default:
        pendingTitles.push(exam.title);
    }
  }

  const summary = { incompleteTitles, completedTitles, pendingTitles, notRequiredTitles };
  if (incompleteTitles.length > 0) return { kind: "incomplete", ...summary };
  if (pendingTitles.length > 0) return { kind: "pending", ...summary };
  if (completedTitles.length > 0) return { kind: "complete", ...summary };
  return { kind: "clear", ...summary };
}

export function matchesSessionRowExamReviewFilter(
  row: SessionScoreRow,
  filter: SessionScoresExamReviewFilter,
): boolean {
  if (filter === "all") return true;
  const kind = getSessionRowExamReviewSummary(row).kind;
  if (filter === "resolved") return kind === "complete" || kind === "clear";
  return kind === filter;
}
