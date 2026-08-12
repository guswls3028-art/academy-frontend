import type { SessionScoreRow } from "@/shared/api/contracts/sessionScores";

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

export type SessionRowExamWrongSummary = {
  kind: "wrong" | "clear" | "pending" | "none";
  wrongTitles: string[];
  pendingTitles: string[];
};

/** 시험 점수가 만점보다 낮은지로 오답 여부를 읽는다. 합격선과 과제는 포함하지 않는다. */
export function getSessionRowExamWrongSummary(row: SessionScoreRow): SessionRowExamWrongSummary {
  const exams = row.exams ?? [];
  if (exams.length === 0) {
    return { kind: "none", wrongTitles: [], pendingTitles: [] };
  }

  const wrongTitles: string[] = [];
  const pendingTitles: string[] = [];
  for (const exam of exams) {
    const { block } = exam;
    const score = Number(block.score);
    const maxScore = Number(block.max_score);
    const unavailable = block.meta?.status === "NOT_SUBMITTED"
      || block.meta?.status === "OMR_REVIEW_REQUIRED"
      || block.score == null
      || !Number.isFinite(score)
      || !Number.isFinite(maxScore)
      || maxScore <= 0;
    if (unavailable) {
      pendingTitles.push(exam.title);
    } else if (score < maxScore) {
      wrongTitles.push(exam.title);
    }
  }

  if (wrongTitles.length > 0) return { kind: "wrong", wrongTitles, pendingTitles };
  if (pendingTitles.length > 0) return { kind: "pending", wrongTitles, pendingTitles };
  return { kind: "clear", wrongTitles, pendingTitles };
}
