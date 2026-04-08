/**
 * 성적 발송 메시지 본문 자동 생성
 * — 학생의 시험/과제 결과를 포매팅하여 SMS/알림톡 본문 텍스트를 반환
 *
 * generateScoreReport: SMS 본문용 (전체 텍스트)
 * buildScoreDetail: 알림톡 #{시험성적} 변수용 (시험/과제/요약 블록)
 */

import type {
  SessionScoreRow,
  SessionScoreMeta,
} from "../api/sessionScores";

export type ScoreReportOptions = {
  lectureName?: string;
  sessionTitle?: string;
  date?: string;
};

// ── helpers ──

function pct(score: number | null | undefined, max: number | null | undefined): string {
  if (score == null || max == null || max === 0) return "";
  return `${Math.round((score / max) * 100)}%`;
}

function pctNum(score: number | null | undefined, max: number | null | undefined): number | null {
  if (score == null || max == null || max === 0) return null;
  return Math.round((score / max) * 100);
}

function formatDate(iso?: string): string {
  try {
    const d = iso ? new Date(iso) : new Date();
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch {
    return "";
  }
}

/**
 * 시험/과제 공통: 한 항목을 1줄로 렌더링
 * 예: "- 단원평가 1: 92/100 (92%) 합격"
 * 예: "- 단원평가 2: 미응시"
 */
function formatScoreLine(
  title: string,
  score: number | null | undefined,
  maxScore: number | null | undefined,
  passed: boolean | null | undefined,
  absentLabel: string,
): string {
  if (score == null) return `- ${title}: ${absentLabel}`;
  const maxStr = maxScore != null ? `/${maxScore}` : "";
  const percent = pct(score, maxScore);
  const passStr = passed === true ? "합격" : passed === false ? "불합격" : "";
  return `- ${title}: ${score}${maxStr}${percent ? ` (${percent})` : ""} ${passStr}`.trimEnd();
}

type SummaryStats = {
  examScored: number;
  examTotal: number;
  examSumScore: number;
  examSumMax: number;
  examPassed: number;
  hwScored: number;
  hwTotal: number;
  hwSumScore: number;
  hwSumMax: number;
  hwPassed: number;
  failedItems: string[];
};

function collectStats(row: SessionScoreRow, meta: SessionScoreMeta | null): SummaryStats {
  const s: SummaryStats = {
    examScored: 0, examTotal: 0, examSumScore: 0, examSumMax: 0, examPassed: 0,
    hwScored: 0, hwTotal: 0, hwSumScore: 0, hwSumMax: 0, hwPassed: 0,
    failedItems: [],
  };

  for (const exam of row.exams ?? []) {
    s.examTotal++;
    const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
    const max = exam.block.max_score ?? metaExam?.max_score ?? 0;
    if (exam.block.score != null) {
      s.examScored++;
      s.examSumScore += exam.block.score;
      s.examSumMax += max;
      if (exam.block.passed === true) s.examPassed++;
    }
    if (exam.block.passed === false || exam.block.score == null) {
      s.failedItems.push(exam.title);
    }
  }

  for (const hw of row.homeworks ?? []) {
    s.hwTotal++;
    const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
    const max = hw.block.max_score ?? metaHw?.max_score ?? 0;
    if (hw.block.score != null) {
      s.hwScored++;
      s.hwSumScore += hw.block.score;
      s.hwSumMax += max;
      if (hw.block.passed === true) s.hwPassed++;
    }
    if (hw.block.passed === false || hw.block.score == null) {
      s.failedItems.push(hw.title);
    }
  }

  return s;
}

function renderExamLines(row: SessionScoreRow, meta: SessionScoreMeta | null): string[] {
  if (!row.exams || row.exams.length === 0) return [];
  const lines = ["[시험]"];
  for (const exam of row.exams) {
    const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
    const max = exam.block.max_score ?? metaExam?.max_score ?? null;
    lines.push(formatScoreLine(exam.title, exam.block.score, max, exam.block.passed, "미응시"));
  }
  return lines;
}

function renderHomeworkLines(row: SessionScoreRow, meta: SessionScoreMeta | null): string[] {
  if (!row.homeworks || row.homeworks.length === 0) return [];
  const lines = ["[과제]"];
  for (const hw of row.homeworks) {
    const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
    const max = hw.block.max_score ?? metaHw?.max_score ?? null;
    lines.push(formatScoreLine(hw.title, hw.block.score, max, hw.block.passed, "미제출"));
  }
  return lines;
}

function renderSummaryLines(s: SummaryStats): string[] {
  const totalItems = s.examTotal + s.hwTotal;
  if (totalItems === 0) return [];

  const lines = ["[요약]"];

  if (s.examTotal > 0) {
    const avgPct = s.examSumMax > 0 ? Math.round((s.examSumScore / s.examSumMax) * 100) : null;
    lines.push(`- 시험: ${s.examPassed}/${s.examTotal} 합격${avgPct != null ? ` (평균 ${avgPct}점)` : ""}`);
  }
  if (s.hwTotal > 0) {
    const avgPct = s.hwSumMax > 0 ? Math.round((s.hwSumScore / s.hwSumMax) * 100) : null;
    lines.push(`- 과제: ${s.hwPassed}/${s.hwTotal} 합격${avgPct != null ? ` (평균 ${avgPct}점)` : ""}`);
  }

  if (s.failedItems.length === 0) {
    lines.push("- 최종: 합격");
  } else {
    lines.push(`- 최종: 보충 필요`);
    lines.push(`- 보충 대상: ${s.failedItems.join(", ")}`);
  }

  return lines;
}

// ── public API ──

export function generateScoreReport(
  row: SessionScoreRow,
  meta: SessionScoreMeta | null,
  options: ScoreReportOptions = {},
): string {
  const lines: string[] = [];
  const date = formatDate(options.date);
  const header = [options.lectureName, options.sessionTitle].filter(Boolean).join(" · ");

  lines.push(`${row.student_name}님 성적표 안내드립니다.`);
  if (header) lines.push(header);
  lines.push(`${date} 성적`);
  lines.push("");

  const examLines = renderExamLines(row, meta);
  if (examLines.length > 0) lines.push(...examLines);

  const hwLines = renderHomeworkLines(row, meta);
  if (hwLines.length > 0) {
    if (examLines.length > 0) lines.push("");
    lines.push(...hwLines);
  }

  const stats = collectStats(row, meta);
  const summaryLines = renderSummaryLines(stats);
  if (summaryLines.length > 0) {
    lines.push("");
    lines.push(...summaryLines);
  }

  return lines.join("\n");
}

/**
 * 알림톡 #{시험성적} 변수에 넣을 성적 상세 블록.
 * 237 템플릿의 ━━ 구분선 사이에 들어감.
 *
 * 구조: [시험] → [과제] → [요약] (시험평균, 과제평균, 최종 합불, 보충 대상)
 */
/**
 * 템플릿 본문의 번호 변수(#{시험1}, #{시험1만점}, #{시험1명} 등)를 실제 성적 데이터로 치환.
 * 템플릿이 저장된 양식을 유지하면서 학생별 점수만 채워넣는다.
 *
 * 지원 변수:
 * - #{학생이름} → student_name
 * - #{강의명} → lectureName
 * - #{차시명} → sessionTitle
 * - #{날짜} → 오늘 날짜
 * - #{시험N} → exams[N-1].block.score (N=1~10)
 * - #{시험N만점} → exams[N-1] max_score
 * - #{시험N명} → exams[N-1].title
 * - #{과제N} → homeworks[N-1].block.score
 * - #{과제N만점} → homeworks[N-1] max_score
 * - #{과제N명} → homeworks[N-1].title
 * - #{시험총점} → 시험 점수 합계
 * - #{시험총만점} → 시험 만점 합계
 * - #{숙제완성도} → 과제 점수/만점 또는 "미제출"
 */
export function substituteScoreVars(
  templateBody: string,
  row: SessionScoreRow,
  meta: SessionScoreMeta | null,
  options: ScoreReportOptions = {},
): string {
  const vars: Record<string, string> = {};

  // 기본 변수
  const studentName = row.student_name || "";
  vars["학생이름"] = studentName;
  vars["학생이름2"] = studentName.length >= 2 ? studentName.slice(-2) : studentName;
  vars["학생이름3"] = studentName;
  vars["강의명"] = options.lectureName || (row as any).lecture_title || "";
  vars["차시명"] = options.sessionTitle || (row as any).session_title || "";
  vars["날짜"] = formatDate(options.date);

  // 시험/과제 슬롯 10개 미리 초기화 (미사용 슬롯에 #{시험6} 등이 원문 노출되지 않게)
  for (let n = 1; n <= 10; n++) {
    vars[`시험${n}`] = "-"; vars[`시험${n}만점`] = "-"; vars[`시험${n}명`] = "";
    vars[`과제${n}`] = "-"; vars[`과제${n}만점`] = "-"; vars[`과제${n}명`] = "";
  }

  // 시험 변수 (번호 기반, 실제 데이터로 덮어쓰기)
  const exams = row.exams ?? [];
  let examSumScore = 0;
  let examSumMax = 0;
  for (let i = 0; i < exams.length; i++) {
    const exam = exams[i];
    const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
    const max = exam.block.max_score ?? metaExam?.max_score ?? 0;
    const n = i + 1;
    vars[`시험${n}`] = exam.block.score != null ? String(exam.block.score) : "미응시";
    vars[`시험${n}만점`] = String(max);
    vars[`시험${n}명`] = exam.title || "";
    if (exam.block.score != null) {
      examSumScore += exam.block.score;
      examSumMax += max;
    }
  }
  vars["시험총점"] = String(examSumScore);
  vars["시험총만점"] = String(examSumMax);

  // 과제 변수 (번호 기반, 실제 데이터로 덮어쓰기)
  const homeworks = row.homeworks ?? [];
  for (let i = 0; i < homeworks.length; i++) {
    const hw = homeworks[i];
    const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
    const max = hw.block.max_score ?? metaHw?.max_score ?? 0;
    const n = i + 1;
    vars[`과제${n}`] = hw.block.score != null ? String(hw.block.score) : "미제출";
    vars[`과제${n}만점`] = String(max);
    vars[`과제${n}명`] = hw.title || "";
  }

  // 숙제완성도 (전체 과제 요약)
  if (row.homeworks && row.homeworks.length > 0) {
    const completed = row.homeworks.filter((h) => h.block.score != null).length;
    vars["숙제완성도"] = `${completed}/${row.homeworks.length} 완료`;
  } else {
    vars["숙제완성도"] = "-";
  }

  // ── 목록형 변수 (시험/과제 개수에 맞게 자동 생성) ──

  // #{시험목록} — 모든 시험을 한 줄씩 나열
  if (exams.length > 0) {
    const lines: string[] = [];
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];
      const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
      const max = exam.block.max_score ?? metaExam?.max_score ?? 0;
      const scoreStr = exam.block.score != null ? `${exam.block.score}/${max}` : "미응시";
      const pctStr = exam.block.score != null && max > 0 ? ` (${Math.round((exam.block.score / max) * 100)}%)` : "";
      const passStr = exam.block.passed === true ? " 합격" : exam.block.passed === false ? " 불합격" : "";
      lines.push(`- ${exam.title}: ${scoreStr}${pctStr}${passStr}`);
    }
    vars["시험목록"] = lines.join("\n");
  } else {
    vars["시험목록"] = "(시험 없음)";
  }

  // #{과제목록} — 모든 과제를 한 줄씩 나열
  if (homeworks.length > 0) {
    const lines: string[] = [];
    for (let i = 0; i < homeworks.length; i++) {
      const hw = homeworks[i];
      const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
      const max = hw.block.max_score ?? metaHw?.max_score ?? 0;
      const scoreStr = hw.block.score != null ? `${hw.block.score}/${max}` : "미제출";
      const pctStr = hw.block.score != null && max > 0 ? ` (${Math.round((hw.block.score / max) * 100)}%)` : "";
      lines.push(`- ${hw.title}: ${scoreStr}${pctStr}`);
    }
    vars["과제목록"] = lines.join("\n");
  } else {
    vars["과제목록"] = "";
  }

  // #{전체요약} — 시험+과제 통합 요약 블록
  {
    const stats = collectStats(row, meta);
    const lines: string[] = [];
    if (stats.examTotal > 0) {
      const avgPct = stats.examSumMax > 0 ? Math.round((stats.examSumScore / stats.examSumMax) * 100) : null;
      lines.push(`시험: ${stats.examPassed}/${stats.examTotal} 합격${avgPct != null ? ` (평균 ${avgPct}점)` : ""}`);
    }
    if (stats.hwTotal > 0) {
      const completed = row.homeworks?.filter((h) => h.block.score != null).length ?? 0;
      lines.push(`과제: ${completed}/${stats.hwTotal} 완료`);
    }
    if (stats.failedItems.length === 0 && (stats.examTotal + stats.hwTotal) > 0) {
      lines.push("최종: 합격");
    } else if (stats.failedItems.length > 0) {
      lines.push(`보충 대상: ${stats.failedItems.join(", ")}`);
    }
    vars["전체요약"] = lines.join("\n");
  }

  // 시험성적 블록 (기존 buildScoreDetail과 동일)
  vars["시험성적"] = buildScoreDetail(row, meta);

  // 알림톡 전용 변수 — SMS 본문에서는 성적 상세로 치환 (#{선생님메모}는 Solapi 래퍼 변수)
  vars["선생님메모"] = buildScoreDetail(row, meta);
  // 기타 알림톡 전용 변수 — SMS에서 빈 문자열로 치환하여 원문 노출 방지
  vars["내용"] = vars["내용"] ?? "";
  vars["사이트링크"] = vars["사이트링크"] ?? "";

  // 치환 수행
  let result = templateBody.replace(/#\{([^}]+)\}/g, (match, varName) => {
    return vars[varName] !== undefined ? vars[varName] : match;
  });

  // 미사용 시험/과제 행 제거 — 치환 후 빈 슬롯("- : -/-", ": -/-", ": -/") 줄 정리
  result = result
    .replace(/^[^\n]*: *-\/-\s*$/gm, "")  // "시험명: -/-" 패턴 줄 삭제
    .replace(/^- *: *-\s*$/gm, "")         // "- : -" 패턴 줄 삭제
    .replace(/^\s*$/gm, "")                // 빈 줄 제거
    .replace(/\n{3,}/g, "\n\n")            // 연속 빈 줄 → 최대 1줄
    .trim();

  return result;
}

export function buildScoreDetail(
  row: SessionScoreRow,
  meta: SessionScoreMeta | null,
): string {
  const lines: string[] = [];

  const examLines = renderExamLines(row, meta);
  if (examLines.length > 0) lines.push(...examLines);

  const hwLines = renderHomeworkLines(row, meta);
  if (hwLines.length > 0) {
    if (examLines.length > 0) lines.push("");
    lines.push(...hwLines);
  }

  const stats = collectStats(row, meta);
  const summaryLines = renderSummaryLines(stats);
  if (summaryLines.length > 0) {
    lines.push("");
    lines.push(...summaryLines);
  }

  return lines.join("\n");
}
