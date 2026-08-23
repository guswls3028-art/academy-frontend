import type {
  ScoreBlock,
  SessionScoreMeta,
  SessionScoreRow,
} from "@/shared/api/contracts/sessionScores";
import type {
  StudentExamGrade,
  StudentExamTrendPoint,
  StudentGradesResponse,
} from "@/shared/api/contracts/studentGrades";
import { deriveFinalPass } from "@/shared/scoring/achievement";
import {
  ALL_LECTURES,
  filterStudentScoreTrend,
  summarizeStudentScoreTrend,
} from "@/shared/scoring/studentScoreTrend";
import { downloadBlob } from "@/shared/utils/safeDownload";
import { getScoreBlockOmrReviewStatus } from "./sessionScoreRowVerdict";
import {
  resolveStudentScoreReportTheme,
  type StudentScoreReportTheme,
} from "./studentScoreReportTheme";

export type StudentScoreReportMode = "summary" | "detailed";

export type StudentScoreReportParams = {
  row: SessionScoreRow;
  meta: SessionScoreMeta;
  grades?: StudentGradesResponse | null;
  sessionTitle: string;
  lectureTitle: string;
  attendanceStatus?: string | null;
  date?: string;
  tenantName?: string;
  tenantCode?: string;
  tenantLogoUrl?: string;
  primaryColor?: string;
  mode?: StudentScoreReportMode;
};

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: "출석",
  ONLINE: "영상",
  LATE: "지각",
  ABSENT: "결석",
  EARLY_LEAVE: "조퇴",
  SUPPLEMENT: "보강",
  RUNAWAY: "출튀",
  MATERIAL: "자료",
  INACTIVE: "부재",
  SECESSION: "퇴원",
};

const REPORT_STYLE = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #d9e1ec;
    color: #172033;
    font-family: "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .student-report-page {
    position: relative;
    width: 210mm;
    height: 297mm;
    margin: 0 auto 8mm;
    padding: 0 14mm 12mm;
    overflow: hidden;
    background: #fff;
    page-break-after: always;
  }
  .student-report-page:last-child { margin-bottom: 0; page-break-after: auto; }
  .report-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 14mm;
    margin: 0 -14mm;
    padding: 3.5mm 14mm;
    border-bottom: 1.1mm solid var(--report-accent);
    background: var(--report-primary);
    color: var(--report-on-primary);
    font-size: 9px;
    letter-spacing: 0.03em;
  }
  .report-brand {
    display: inline-flex;
    align-items: center;
    gap: 2.5mm;
    font-weight: 800;
    color: var(--report-on-primary);
    min-width: 0;
  }
  .report-brand-symbol {
    position: relative;
    display: inline-flex;
    min-width: 8mm;
    height: 8mm;
    max-width: 28mm;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 0.8mm 1.2mm;
    border-radius: 1.8mm;
    background: #fff;
  }
  .report-brand-logo {
    position: absolute;
    inset: 0;
    display: block;
    width: auto;
    max-width: 25mm;
    height: 6.2mm;
    margin: auto;
    background: #fff;
    object-fit: contain;
  }
  .report-brand-mark {
    display: inline-flex;
    width: 6.2mm;
    height: 6.2mm;
    align-items: center;
    justify-content: center;
    border-radius: 1.2mm;
    background: var(--report-accent);
    color: var(--report-on-accent);
    font-size: 9px;
    letter-spacing: -0.04em;
  }
  .report-brand-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .report-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8mm;
    padding: 7mm 0 5mm;
  }
  .report-eyebrow {
    display: inline-flex;
    margin-bottom: 1.5mm;
    padding: 1mm 2.4mm;
    border-left: 1.1mm solid var(--report-accent);
    background: var(--report-tint);
    color: var(--report-primary);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }
  h1 {
    margin: 0;
    color: #111827;
    font-size: 25px;
    line-height: 1.1;
    letter-spacing: -0.045em;
    overflow-wrap: anywhere;
  }
  .report-student-meta {
    margin-top: 2.5mm;
    color: #667085;
    font-size: 10px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .report-session-stamp {
    min-width: 47mm;
    padding: 3mm 4mm;
    border: 0.3mm solid var(--report-primary);
    border-top: 1.1mm solid var(--report-accent);
    border-radius: 2mm;
    text-align: right;
    color: #334155;
  }
  .report-session-stamp strong {
    display: block;
    margin-bottom: 1mm;
    color: #172033;
    font-size: 11px;
  }
  .report-session-stamp span { font-size: 9px; }
  .flow-band {
    display: grid;
    grid-template-columns: 34mm repeat(4, 1fr);
    min-height: 22mm;
    margin-bottom: 6mm;
    overflow: hidden;
    border: 0.35mm solid var(--report-primary);
    border-radius: 2mm;
  }
  .flow-label {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 4mm;
    background: var(--report-primary);
    color: var(--report-on-primary);
  }
  .flow-label strong { font-size: 11px; }
  .flow-label span { margin-top: 1mm; color: var(--report-on-primary); font-size: 8px; opacity: 0.74; }
  .flow-metric {
    position: relative;
    display: grid;
    grid-template-rows: 8mm 1fr;
    border-left: 0.25mm solid #d9e0e8;
  }
  .flow-metric span {
    display: flex;
    align-items: center;
    padding: 0 3mm;
    border-bottom: 0.25mm solid var(--report-accent);
    background: var(--report-tint);
    color: #5f6470;
    font-size: 8px;
  }
  .flow-metric strong {
    display: flex;
    align-items: center;
    padding: 0 3mm;
    color: #172033;
    font-size: 17px;
    letter-spacing: -0.03em;
  }
  .flow-metric strong.positive { color: #0f766e; }
  .flow-metric strong.negative { color: #c2413b; }
  .section { margin-top: 5mm; }
  .section-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 4mm;
    margin-bottom: 2.5mm;
  }
  .section-heading h2 {
    display: inline-flex;
    align-items: center;
    gap: 2mm;
    margin: 0;
    color: #172033;
    font-size: 12px;
    letter-spacing: -0.02em;
  }
  .section-heading h2::before {
    width: 2.8mm;
    height: 2.8mm;
    flex: 0 0 auto;
    background: var(--report-primary);
    content: "";
  }
  .section-heading span { color: #7b8798; font-size: 8px; }
  .current-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 47mm;
    overflow: hidden;
    border: 0.35mm solid var(--report-primary);
    border-radius: 2mm;
  }
  .assessment-list { min-width: 0; }
  .assessment-table-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 23mm 24mm;
    min-height: 8mm;
    align-items: center;
    border-bottom: 0.3mm solid var(--report-accent);
    background: var(--report-tint);
    color: #283044;
    font-size: 8px;
    font-weight: 800;
  }
  .assessment-table-head span { padding: 0 3mm; }
  .assessment-table-head span:not(:first-child) { text-align: right; }
  .assessment-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 23mm 24mm;
    align-items: center;
    min-height: 11mm;
    border-bottom: 0.25mm solid #e2e8f0;
    font-size: 9px;
  }
  .assessment-row:last-child { border-bottom: 0; }
  .assessment-title { padding: 0 3mm; min-width: 0; }
  .assessment-title strong {
    display: -webkit-box;
    overflow: hidden;
    color: #1f2937;
    font-size: 10px;
    line-height: 1.35;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .assessment-title span {
    display: block;
    margin-top: 0.5mm;
    color: #77859a;
    font-size: 8px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .assessment-score {
    color: #172033;
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .assessment-score small { color: #8a96a8; font-size: 7px; font-weight: 500; }
  .status {
    justify-self: end;
    min-width: 18mm;
    padding: 1.1mm 1.6mm;
    border-radius: 99px;
    background: #edf2f7;
    color: #516078;
    font-size: 7.5px;
    font-weight: 800;
    text-align: center;
  }
  .status--pass { background: #dcfce7; color: #166534; }
  .status--warn { background: #fff1e8; color: #b54708; }
  .status--missing { background: #f1f5f9; color: #64748b; }
  .session-summary {
    display: grid;
    align-content: start;
    border-left: 0.25mm solid #cbd5e1;
    background: #f7f9fc;
  }
  .session-summary-title {
    display: flex;
    min-height: 8mm;
    align-items: center;
    justify-content: center;
    border-bottom: 0.3mm solid var(--report-accent);
    background: var(--report-tint);
    color: #283044;
    font-size: 8px;
    font-weight: 800;
  }
  .session-fact {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 9mm;
    padding: 0 3mm;
    border-bottom: 0.25mm solid #e2e8f0;
    color: #68758a;
    font-size: 8px;
  }
  .session-fact:last-child { border-bottom: 0; }
  .session-fact strong { color: #172033; font-size: 9px; }
  .trend-panel {
    min-height: 67mm;
    padding: 4mm 4mm 2mm;
    border: 0.35mm solid var(--report-primary);
    border-radius: 2mm;
    background: #fff;
  }
  .trend-empty {
    display: flex;
    min-height: 55mm;
    align-items: center;
    justify-content: center;
    color: #8a96a8;
    font-size: 9px;
  }
  .trend-chart { width: 100%; height: 52mm; overflow: visible; }
  .trend-chart text { font-family: "Malgun Gothic", sans-serif; }
  .trend-note {
    margin-top: 1mm;
    color: #7b8798;
    font-size: 7.5px;
    text-align: right;
  }
  .history-table, .item-table {
    width: 100%;
    border-collapse: collapse;
    border-top: 0.45mm solid #172033;
    font-size: 8px;
  }
  .history-table { table-layout: fixed; }
  .history-table col:nth-child(1) { width: 41%; }
  .history-table col:nth-child(2) { width: 31%; }
  .history-table col:nth-child(3) { width: 11%; }
  .history-table col:nth-child(4) { width: 8%; }
  .history-table col:nth-child(5) { width: 9%; }
  .history-table th, .item-table th {
    padding: 2.2mm 2mm;
    border-bottom: 0.3mm solid var(--report-accent);
    background: var(--report-tint);
    color: #283044;
    font-weight: 800;
    text-align: left;
  }
  .history-table td, .item-table td {
    padding: 2.2mm 2mm;
    border-bottom: 0.22mm solid #e2e8f0;
    color: #334155;
  }
  .history-table th { white-space: nowrap; }
  .history-table td {
    line-height: 1.4;
    overflow-wrap: anywhere;
    vertical-align: top;
  }
  .history-table td:nth-child(n + 3) {
    white-space: nowrap;
    vertical-align: middle;
  }
  .history-table th.num, .history-table td.num,
  .item-table th.num, .item-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .history-table td strong, .item-table td strong { color: #172033; }
  .history-result { font-weight: 800; }
  .history-result--pass { color: #15803d; }
  .history-result--warn { color: #c2413b; }
  .detail-grid {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 6mm;
  }
  .detail-grid--single { grid-template-columns: minmax(0, 1fr); }
  .detail-grid .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 1mm;
  }
  .detail-grid .section-heading span { padding-left: 4.8mm; }
  .coaching-box {
    margin-top: 5mm;
    padding: 4mm 5mm;
    border: 0.3mm solid var(--report-accent);
    border-left: 1.2mm solid var(--report-accent);
    background: var(--report-tint);
  }
  .coaching-box h3 {
    margin: 0 0 2mm;
    color: var(--report-primary);
    font-size: 10px;
  }
  .coaching-box ul {
    margin: 0;
    padding-left: 4mm;
    color: #40506a;
    font-size: 8.5px;
    line-height: 1.65;
  }
  .empty-cell { color: #8a96a8 !important; text-align: center !important; }
  .report-footer {
    position: absolute;
    right: 14mm;
    bottom: 7mm;
    left: 14mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 2.5mm;
    border-top: 0.25mm solid #cbd5e1;
    color: #7b8798;
    font-size: 7.5px;
  }
  @media screen and (max-width: 600px) {
    body { background: #e9eef4; }
    .student-report-page {
      width: 100%;
      height: auto;
      min-height: 0;
      margin: 0 0 10px;
      padding: 0 18px 24px;
      overflow: visible;
    }
    .report-topline {
      min-height: 56px;
      margin: 0 -18px;
      padding: 10px 18px;
      gap: 12px;
      font-size: 10px;
    }
    .report-brand { max-width: 72%; }
    .report-brand-symbol { min-width: 34px; height: 34px; max-width: 112px; padding: 4px 6px; }
    .report-brand-logo { max-width: 100px; height: 26px; }
    .report-brand-mark { width: 26px; height: 26px; }
    .report-title-row {
      align-items: stretch;
      flex-direction: column;
      gap: 14px;
      padding: 24px 0 18px;
    }
    .report-eyebrow { align-self: flex-start; margin-bottom: 7px; padding: 5px 9px; font-size: 10px; }
    h1 { font-size: clamp(27px, 9vw, 36px); }
    .report-student-meta { margin-top: 8px; font-size: 12px; }
    .report-session-stamp {
      display: flex;
      width: 100%;
      min-width: 0;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      text-align: left;
    }
    .report-session-stamp strong { margin: 0; font-size: 12px; overflow-wrap: anywhere; }
    .report-session-stamp span { flex: 0 0 auto; font-size: 10px; }
    .flow-band {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      min-height: 0;
      margin-bottom: 24px;
      border-radius: 9px;
    }
    .flow-label {
      grid-column: 1 / -1;
      min-height: 58px;
      padding: 12px 14px;
    }
    .flow-label strong { font-size: 13px; }
    .flow-label span { font-size: 10px; }
    .flow-metric {
      min-height: 70px;
      grid-template-rows: 30px 1fr;
      border-top: 1px solid #d9e0e8;
    }
    .flow-metric:nth-child(even) { border-left: 0; }
    .flow-metric span { padding: 0 12px; font-size: 10px; }
    .flow-metric strong { padding: 0 12px; font-size: 19px; }
    .section { margin-top: 24px; }
    .section-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 10px;
    }
    .section-heading h2 { gap: 8px; font-size: 15px; }
    .section-heading h2::before { width: 10px; height: 10px; }
    .section-heading span { padding-left: 18px; font-size: 10px; line-height: 1.4; }
    .current-grid {
      grid-template-columns: minmax(0, 1fr);
      border-radius: 9px;
    }
    .assessment-table-head,
    .assessment-row {
      grid-template-columns: minmax(0, 1fr) 64px 70px;
    }
    .assessment-table-head { min-height: 34px; font-size: 10px; }
    .assessment-table-head span { padding: 0 10px; }
    .assessment-row { min-height: 58px; font-size: 10px; }
    .assessment-title { padding: 9px 10px; }
    .assessment-title strong { font-size: 12px; }
    .assessment-title span { font-size: 9px; }
    .assessment-score { padding-right: 4px; font-size: 13px; }
    .status { min-width: 0; margin-right: 8px; padding: 5px 6px; font-size: 9px; }
    .session-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-top: 1px solid #cbd5e1;
      border-left: 0;
    }
    .session-summary-title { grid-column: 1 / -1; min-height: 34px; font-size: 10px; }
    .session-fact {
      min-height: 38px;
      padding: 0 10px;
      font-size: 10px;
    }
    .session-fact:nth-child(even) { border-right: 1px solid #e2e8f0; }
    .session-fact strong { font-size: 11px; }
    .trend-panel { min-height: 0; padding: 14px 10px 8px; border-radius: 9px; }
    .trend-chart { height: auto; }
    .trend-note { margin-top: 4px; font-size: 9px; }
    .detail-grid { grid-template-columns: minmax(0, 1fr); gap: 24px; }
    .history-table, .item-table { border-top: 0; font-size: 11px; }
    .history-table thead, .item-table thead { display: none; }
    .history-table tbody, .item-table tbody { display: grid; gap: 9px; }
    .history-table tr, .item-table tr {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      overflow: hidden;
      border: 1px solid #dce3eb;
      border-top: 3px solid var(--report-accent);
      border-radius: 8px;
      background: #fff;
    }
    .history-table td, .item-table td {
      display: flex;
      min-width: 0;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 10px;
      border-bottom: 1px solid #eef2f6;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .history-table td::before, .item-table td::before {
      flex: 0 0 auto;
      color: #7b8798;
      font-size: 9px;
      font-weight: 700;
      content: attr(data-label);
    }
    .history-table td:nth-last-child(-n + 2),
    .item-table td:nth-last-child(-n + 2) { border-bottom: 0; }
    .empty-cell { grid-column: 1 / -1; justify-content: center !important; }
    .empty-cell::before { display: none; }
    .coaching-box { margin-top: 0; padding: 15px 16px; }
    .coaching-box h3 { margin-bottom: 8px; font-size: 12px; }
    .coaching-box ul { padding-left: 18px; font-size: 11px; line-height: 1.7; }
    .report-footer {
      position: static;
      gap: 12px;
      margin-top: 30px;
      padding-top: 12px;
      font-size: 9px;
    }
  }
  @media print {
    body { background: #fff; }
    .student-report-page { margin: 0; }
  }
`;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${formatNumber(value, Number.isInteger(value) ? 0 : 1)}%`;
}

function resolveDate(date?: string): string {
  return date || new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function scorePercent(score: number | null | undefined, maxScore: number | null | undefined): number | null {
  if (score == null || maxScore == null || maxScore <= 0) return null;
  return Math.round((score / maxScore) * 1000) / 10;
}

function resultLabel(block: ScoreBlock | null | undefined): { text: string; className: string } {
  if (!block) return { text: "미응시", className: "status--missing" };
  if (getScoreBlockOmrReviewStatus(block) === "review") {
    return { text: "검토중", className: "status--warn" };
  }
  if (block.score == null) return { text: "미응시", className: "status--missing" };
  const finalPass = deriveFinalPass({
    achievement: block.achievement ?? null,
    is_pass: block.passed ?? null,
    final_pass: block.final_pass ?? null,
    remediated: block.remediated ?? null,
    meta_status: block.meta?.status ?? null,
  });
  if (block.remediated && finalPass) return { text: "보강통과", className: "status--pass" };
  if (finalPass === true) return { text: "통과", className: "status--pass" };
  if (finalPass === false) return { text: "보완필요", className: "status--warn" };
  return { text: "입력됨", className: "" };
}

function scopeGrades(grades: StudentGradesResponse | null | undefined, lectureId: number | null | undefined) {
  if (!grades) return { exams: [], trend: [] };
  const lectureFilter = lectureId == null ? ALL_LECTURES : lectureId;
  return {
    exams: lectureId == null
      ? grades.exams
      : grades.exams.filter((item) => item.lecture_id === lectureId),
    trend: filterStudentScoreTrend(grades.exam_trend, lectureFilter),
  };
}

function buildTrendSvg(points: StudentExamTrendPoint[], theme: StudentScoreReportTheme): string {
  const ordered = [...points]
    .sort((a, b) => a.round_index - b.round_index)
    .slice(-4);
  if (ordered.length === 0) {
    return `<div class="trend-empty">누적 시험 점수가 쌓이면 변화 추이가 표시됩니다.</div>`;
  }

  const width = 640;
  const height = 178;
  const left = 38;
  const right = 18;
  const top = 15;
  const bottom = 36;
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const x = (index: number) => left + (ordered.length === 1 ? chartW / 2 : (index / (ordered.length - 1)) * chartW);
  const y = (value: number) => top + ((100 - Math.max(0, Math.min(100, value))) / 100) * chartH;
  const path = ordered.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.score_pct)}`).join(" ");
  const guides = [100, 75, 50, 25, 0].map((value) => `
    <line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#dbe3ed" stroke-width="1" />
    <text x="${left - 8}" y="${y(value) + 3}" text-anchor="end" fill="#8a96a8" font-size="9">${value}</text>
  `).join("");
  const pointsMarkup = ordered.map((point, index) => {
    const label = point.session_title || `${point.round_index}회`;
    const shortLabel = label.length > 8 ? `${label.slice(0, 8)}…` : label;
    return `
      <circle cx="${x(index)}" cy="${y(point.score_pct)}" r="4" fill="${theme.accent}" stroke="${theme.primary}" stroke-width="3" />
      <text x="${x(index)}" y="${Math.max(10, y(point.score_pct) - 9)}" text-anchor="middle" fill="${theme.primary}" font-size="9" font-weight="700">${formatNumber(point.score_pct, Number.isInteger(point.score_pct) ? 0 : 1)}</text>
      <text x="${x(index)}" y="${height - 9}" text-anchor="middle" fill="#68758a" font-size="8">${escapeHtml(shortLabel)}</text>
    `;
  }).join("");

  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="최근 시험 점수 변화">
      ${guides}
      <path d="${path}" fill="none" stroke="${theme.primary}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${pointsMarkup}
    </svg>
    <div class="trend-note">최근 ${ordered.length}회 · 100점 환산 기준</div>
  `;
}

function buildCurrentAssessments(row: SessionScoreRow, meta: SessionScoreMeta) {
  const examRows = (meta.exams ?? []).map((exam) => {
    const entry = row.exams.find((item) => item.exam_id === exam.exam_id);
    const score = entry?.block.score;
    const maxScore = entry?.block.max_score ?? exam.max_score;
    const result = resultLabel(entry?.block);
    const scoreParts = [
      "시험",
      `통과 ${formatNumber(exam.pass_score)}점`,
      entry?.block.objective_score != null ? `객관 ${formatNumber(entry.block.objective_score)}점` : null,
      entry?.block.subjective_score != null ? `주관 ${formatNumber(entry.block.subjective_score)}점` : null,
    ].filter(Boolean).join(" · ");
    return `
      <div class="assessment-row">
        <div class="assessment-title"><strong>${escapeHtml(exam.title)}</strong><span>${scoreParts}</span></div>
        <div class="assessment-score">${formatNumber(score, score != null && !Number.isInteger(score) ? 1 : 0)} <small>/ ${formatNumber(maxScore)}</small></div>
        <span class="status ${result.className}">${result.text}</span>
      </div>
    `;
  });
  const homeworkRows = (meta.homeworks ?? []).map((homework) => {
    const entry = row.homeworks.find((item) => item.homework_id === homework.homework_id);
    const score = entry?.block.score;
    const maxScore = entry?.block.max_score ?? homework.max_score;
    const result = resultLabel(entry?.block);
    return `
      <div class="assessment-row">
        <div class="assessment-title"><strong>${escapeHtml(homework.title)}</strong><span>과제${homework.unit ? ` · ${escapeHtml(homework.unit)}` : ""}</span></div>
        <div class="assessment-score">${formatNumber(score, score != null && !Number.isInteger(score) ? 1 : 0)} <small>/ ${formatNumber(maxScore)}</small></div>
        <span class="status ${result.className}">${result.text}</span>
      </div>
    `;
  });
  const rows = [...examRows, ...homeworkRows];
  if (rows.length === 0) {
    return `<div class="assessment-row"><div class="assessment-title"><strong>등록된 평가가 없습니다.</strong></div></div>`;
  }
  const visibleRows = rows.slice(0, 6);
  if (rows.length > visibleRows.length) {
    visibleRows[visibleRows.length - 1] = `
      <div class="assessment-row">
        <div class="assessment-title"><strong>외 ${rows.length - visibleRows.length + 1}건의 평가</strong><span>전체 점수는 성적 입력 화면에서 확인</span></div>
        <div class="assessment-score"></div>
        <span class="status">더보기</span>
      </div>
    `;
  }
  return visibleRows.join("");
}

function selectHistoryRows(exams: StudentExamGrade[]): StudentExamGrade[] {
  return [...exams]
    .sort((a, b) => {
      const left = a.recorded_at || a.submitted_at || a.session_date || "";
      const right = b.recorded_at || b.submitted_at || b.session_date || "";
      return right.localeCompare(left);
    })
    .slice(0, 9);
}

function buildHistoryRows(rows: StudentExamGrade[]): string {
  if (rows.length === 0) {
    return `<tr><td class="empty-cell" colspan="5">누적 시험 기록이 없습니다.</td></tr>`;
  }
  return rows.map((exam) => {
    const pct = scorePercent(exam.total_score, exam.max_score);
    const passed = exam.final_pass === true || exam.is_pass === true || exam.achievement === "PASS" || exam.achievement === "REMEDIATED";
    const missing = exam.total_score == null || exam.achievement === "NOT_SUBMITTED";
    const result = missing ? "미응시" : passed ? "통과" : "보완필요";
    const resultClass = passed ? "history-result--pass" : missing ? "" : "history-result--warn";
    return `
      <tr>
        <td data-label="차시">${escapeHtml(exam.session_title || "-")}</td>
        <td data-label="시험"><strong>${escapeHtml(exam.title)}</strong></td>
        <td class="num" data-label="점수">${formatNumber(exam.total_score)} / ${formatNumber(exam.max_score)}</td>
        <td class="num" data-label="환산">${formatPercent(pct)}</td>
        <td class="history-result ${resultClass}" data-label="판정">${result}</td>
      </tr>
    `;
  }).join("");
}

function buildItemAnalysis(
  row: SessionScoreRow,
  meta: SessionScoreMeta,
): { examTitle: string; rows: string; hasItems: boolean; itemCount: number } {
  const exam = row.exams.find((entry) => (entry.items?.length ?? 0) > 0);
  const items = exam?.items ?? [];
  if (!exam || items.length === 0) {
    return {
      examTitle: "",
      rows: "",
      hasItems: false,
      itemCount: 0,
    };
  }
  const questionNumbers = new Map(
    (meta.exams.find((entry) => entry.exam_id === exam.exam_id)?.questions ?? [])
      .map((question) => [question.question_id, question.number]),
  );
  const numberedItems = items
    .map((item) => ({
      item,
      questionNumber: item.question_number ?? questionNumbers.get(item.question_id) ?? null,
    }))
    .sort((a, b) => (a.questionNumber ?? Number.MAX_SAFE_INTEGER) - (b.questionNumber ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 16);
  return {
    examTitle: exam.title,
    hasItems: true,
    itemCount: numberedItems.length,
    rows: numberedItems.map(({ item, questionNumber }) => {
      const ratio = item.max_score > 0 ? item.score / item.max_score : 0;
      const result = ratio >= 1 ? "만점" : ratio > 0 ? "부분득점" : "0점";
      const resultClass = ratio >= 1 ? "history-result--pass" : "history-result--warn";
      return `
        <tr>
          <td data-label="문항">${questionNumber != null ? `${questionNumber}번` : "번호 미확인"}</td>
          <td data-label="유형">${item.question_kind === "essay" ? "주관식" : "객관식"}</td>
          <td class="num" data-label="득점"><strong>${formatNumber(item.score)}</strong> / ${formatNumber(item.max_score)}</td>
          <td class="history-result ${resultClass}" data-label="결과">${result}</td>
        </tr>
      `;
    }).join(""),
  };
}

function shouldSplitDetailedPage(
  historyRows: StudentExamGrade[],
  itemCount: number,
): boolean {
  if (itemCount === 0 || historyRows.length === 0) return false;
  const historyTextLength = historyRows.reduce(
    (total, exam) => total + String(exam.session_title ?? "").length + String(exam.title ?? "").length,
    0,
  );
  return (itemCount >= 8 && historyRows.length >= 7)
    || (itemCount >= 12 && historyRows.length >= 4)
    || (itemCount >= 6 && historyTextLength >= 300);
}

function buildCoachingPoints(
  row: SessionScoreRow,
  trend: StudentExamTrendPoint[],
  summary: ReturnType<typeof summarizeStudentScoreTrend>,
): string[] {
  const points: string[] = [];
  const missingCount = [
    ...row.exams.map((entry) => entry.block.score),
    ...row.homeworks.map((entry) => entry.block.score),
  ].filter((score) => score == null).length;
  const retakeCount = row.exams.reduce((sum, entry) => sum + Math.max(0, Number(entry.attempt_count ?? 0) - 1), 0);

  if (summary.latest != null && summary.average != null) {
    const gap = summary.latest - summary.average;
    if (gap >= 5) points.push(`최근 시험이 누적 평균보다 ${formatNumber(gap, 1)}%p 높아 상승 흐름입니다.`);
    else if (gap <= -5) points.push(`최근 시험이 누적 평균보다 ${formatNumber(Math.abs(gap), 1)}%p 낮아 오답 점검이 필요합니다.`);
    else points.push("최근 시험 점수가 누적 평균 범위 안에서 안정적으로 유지되고 있습니다.");
  } else if (trend.length === 1) {
    points.push("시험 기록이 1회 쌓였습니다. 다음 결과부터 변화 폭을 함께 확인할 수 있습니다.");
  } else {
    points.push("누적 시험 기록이 충분하지 않아 현재 차시 결과를 중심으로 확인합니다.");
  }

  if (missingCount > 0) points.push(`현재 차시에 미응시·미입력 평가가 ${missingCount}건 있습니다.`);
  if (row.clinic_required) points.push("현재 차시 기준 클리닉 보완 대상으로 표시되어 있습니다.");
  if (retakeCount > 0) points.push(`현재 차시에서 재응시 ${retakeCount}회가 기록되어 있습니다.`);
  if (missingCount === 0 && !row.clinic_required && retakeCount === 0) {
    points.push("현재 차시의 등록된 평가가 모두 입력되어 있습니다.");
  }
  return points.slice(0, 4);
}

function buildBrandIdentity(tenantName: string, theme: StudentScoreReportTheme): string {
  const displayName = tenantName || "ACADEMY";
  const mark = Array.from(displayName.trim())[0]?.toLocaleUpperCase("ko-KR") || "A";
  const logo = theme.logoUrl
    ? `<img class="report-brand-logo" src="${escapeHtml(theme.logoUrl)}" alt="" crossorigin="anonymous" onerror="this.remove()" />`
    : "";
  const identity = `<span class="report-brand-symbol"><span class="report-brand-mark">${escapeHtml(mark)}</span>${logo}</span>`;

  return `<div class="report-brand">${identity}<span class="report-brand-name">${escapeHtml(displayName)}</span></div>`;
}

function buildThemeStyle(theme: StudentScoreReportTheme): string {
  return [
    `--report-primary:${theme.primary}`,
    `--report-accent:${theme.accent}`,
    `--report-tint:${theme.tint}`,
    `--report-on-primary:${theme.onPrimary}`,
    `--report-on-accent:${theme.onAccent}`,
  ].join(";");
}

function buildFooter(tenantName: string, date: string, page: number, total: number): string {
  return `
    <footer class="report-footer">
      <span>${escapeHtml(tenantName || "Academy")} · 학생 개인 성적표</span>
      <span>${escapeHtml(date)} · ${page} / ${total}</span>
    </footer>
  `;
}

function resolveDetailedLayout(params: StudentScoreReportParams) {
  const scoped = scopeGrades(params.grades, params.meta.lecture_id);
  const historyRows = selectHistoryRows(scoped.exams);
  const itemAnalysis = buildItemAnalysis(params.row, params.meta);
  const splitDetailPage = shouldSplitDetailedPage(historyRows, itemAnalysis.itemCount);
  return {
    scoped,
    historyRows,
    itemAnalysis,
    splitDetailPage,
    totalPages: splitDetailPage ? 3 : 2,
  };
}

export function getStudentScoreReportPageCount(params: StudentScoreReportParams): number {
  if ((params.mode ?? "detailed") === "summary") return 1;
  return resolveDetailedLayout(params).totalPages;
}

export function buildStudentScoreReportHtml(params: StudentScoreReportParams): string {
  const mode = params.mode ?? "detailed";
  const date = resolveDate(params.date);
  const tenantName = (params.tenantName ?? "").trim();
  const theme = resolveStudentScoreReportTheme({
    tenantCode: params.tenantCode,
    primaryColor: params.primaryColor,
    logoUrl: params.tenantLogoUrl,
  });
  const { row, meta } = params;
  const detailedLayout = resolveDetailedLayout(params);
  const { scoped, historyRows, itemAnalysis, splitDetailPage } = detailedLayout;
  const totalPages = mode === "detailed" ? detailedLayout.totalPages : 1;
  const recentTrend = [...scoped.trend]
    .sort((a, b) => a.round_index - b.round_index)
    .slice(-4);
  const summary = summarizeStudentScoreTrend(recentTrend);
  const currentExamScores = row.exams
    .map((entry) => scorePercent(entry.block.score, entry.block.max_score))
    .filter((value): value is number => value != null);
  const currentExamAverage = currentExamScores.length > 0
    ? currentExamScores.reduce((sum, value) => sum + value, 0) / currentExamScores.length
    : null;
  const currentHomeworkScores = row.homeworks
    .map((entry) => scorePercent(entry.block.score, entry.block.max_score))
    .filter((value): value is number => value != null);
  const currentHomeworkAverage = currentHomeworkScores.length > 0
    ? currentHomeworkScores.reduce((sum, value) => sum + value, 0) / currentHomeworkScores.length
    : null;
  const retakeCount = row.exams.reduce((sum, entry) => sum + Math.max(0, Number(entry.attempt_count ?? 0) - 1), 0);
  const changeClass = summary.change == null ? "" : summary.change >= 0 ? "positive" : "negative";
  const changeText = summary.change == null
    ? "-"
    : `${summary.change > 0 ? "+" : ""}${formatNumber(summary.change, 1)}%p`;
  const coachingPoints = buildCoachingPoints(row, recentTrend, summary);

  const pageOne = `
    <section class="student-report-page" data-page="1">
      <div class="report-topline">
        ${buildBrandIdentity(tenantName, theme)}
        <span>학생 개인 성적표</span>
      </div>
      <div class="report-title-row">
        <div>
          <div class="report-eyebrow">학습 성적표</div>
          <h1>${escapeHtml(row.student_name)}</h1>
          <div class="report-student-meta">${escapeHtml(params.lectureTitle)}</div>
        </div>
        <div class="report-session-stamp">
          <strong>${escapeHtml(params.sessionTitle)}</strong>
          <span>${escapeHtml(date)} 기준</span>
        </div>
      </div>
      <div class="flow-band">
        <div class="flow-label"><strong>최근 4회</strong><span>같은 강의 시험 기준</span></div>
        <div class="flow-metric"><span>최근</span><strong>${formatPercent(summary.latest)}</strong></div>
        <div class="flow-metric"><span>평균</span><strong>${formatPercent(summary.average)}</strong></div>
        <div class="flow-metric"><span>최고</span><strong>${formatPercent(summary.best)}</strong></div>
        <div class="flow-metric"><span>직전 대비</span><strong class="${changeClass}">${changeText}</strong></div>
      </div>
      <div class="section">
        <div class="section-heading"><h2>현재 차시 결과</h2><span>입력된 원점수와 최종 판정</span></div>
        <div class="current-grid">
          <div class="assessment-list">
            <div class="assessment-table-head"><span>현재 평가</span><span>점수</span><span>판정</span></div>
            ${buildCurrentAssessments(row, meta)}
          </div>
          <aside class="session-summary">
            <div class="session-summary-title">현재 차시 요약</div>
            <div class="session-fact"><span>시험 평균</span><strong>${formatPercent(currentExamAverage)}</strong></div>
            <div class="session-fact"><span>과제 평균</span><strong>${formatPercent(currentHomeworkAverage)}</strong></div>
            <div class="session-fact"><span>출결</span><strong>${ATTENDANCE_LABEL[params.attendanceStatus ?? ""] ?? "-"}</strong></div>
            <div class="session-fact"><span>재응시</span><strong>${retakeCount}회</strong></div>
          </aside>
        </div>
      </div>
      <div class="section">
        <div class="section-heading"><h2>최근 4회 학습 흐름</h2><span>같은 강의의 확정 성적</span></div>
        <div class="trend-panel">${buildTrendSvg(recentTrend, theme)}</div>
      </div>
      ${buildFooter(tenantName, date, 1, totalPages)}
    </section>
  `;

  const detailSection = `
    <div class="section detail-grid${itemAnalysis.hasItems ? "" : " detail-grid--single"}">
      ${itemAnalysis.hasItems ? `<div>
        <div class="section-heading"><h2>현재 시험 문항별 득점</h2><span>${itemAnalysis.examTitle ? `${escapeHtml(itemAnalysis.examTitle)} · ` : ""}최대 16문항</span></div>
        <table class="item-table">
          <thead><tr><th>문항</th><th>유형</th><th class="num">득점</th><th>결과</th></tr></thead>
          <tbody>${itemAnalysis.rows}</tbody>
        </table>
      </div>` : ""}
      <div>
        <div class="section-heading"><h2>상담 체크포인트</h2><span>입력 데이터 자동 요약</span></div>
        <div class="coaching-box">
          <h3>다음 상담에서 확인해 보세요</h3>
          <ul>${coachingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
  `;

  const pageTwo = mode === "detailed" ? `
    <section class="student-report-page" data-page="2">
      <div class="report-topline">
        ${buildBrandIdentity(tenantName, theme)}
        <span>${escapeHtml(row.student_name)} · 상세 학습 기록</span>
      </div>
      <div class="section" style="margin-top:7mm">
        <div class="section-heading"><h2>최근 시험 기록</h2><span>최신순 최대 9건</span></div>
        <table class="history-table">
          <colgroup><col /><col /><col /><col /><col /></colgroup>
          <thead><tr><th>차시</th><th>시험</th><th class="num">점수</th><th class="num">환산</th><th>판정</th></tr></thead>
          <tbody>${buildHistoryRows(historyRows)}</tbody>
        </table>
      </div>
      ${splitDetailPage ? "" : detailSection}
      ${buildFooter(tenantName, date, 2, totalPages)}
    </section>
  ` : "";

  const pageThree = mode === "detailed" && splitDetailPage ? `
    <section class="student-report-page" data-page="3">
      <div class="report-topline">
        ${buildBrandIdentity(tenantName, theme)}
        <span>${escapeHtml(row.student_name)} · 문항 분석과 상담</span>
      </div>
      ${detailSection}
      ${buildFooter(tenantName, date, 3, totalPages)}
    </section>
  ` : "";

  return `<!doctype html>
<html lang="ko" style="${buildThemeStyle(theme)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(row.student_name)} 개인 성적표</title>
    <style>${REPORT_STYLE}</style>
  </head>
  <body>${pageOne}${pageTwo}${pageThree}</body>
</html>`;
}

function safeFilenamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

async function waitForIframeDocument(doc: Document): Promise<void> {
  await new Promise<void>((resolve) => {
    const check = () => {
      if (doc.readyState === "complete") resolve();
      else window.setTimeout(check, 50);
    };
    check();
  });
  if ("fonts" in doc) {
    await (doc as Document & { fonts: FontFaceSet }).fonts.ready;
  }
  await new Promise((resolve) => window.setTimeout(resolve, 150));
}

function assertPageContentFits(page: HTMLElement): void {
  if (page.scrollWidth > page.clientWidth + 1 || page.scrollHeight > page.clientHeight + 1) {
    throw new Error("성적표 내용이 A4 범위를 넘어 PDF를 만들지 않았습니다. 평가명을 줄이거나 요약 1쪽을 이용해 주세요.");
  }
  const footer = page.querySelector<HTMLElement>(".report-footer");
  if (!footer) return;
  const footerTop = footer.getBoundingClientRect().top;
  const contentBottom = Array.from(page.querySelectorAll<HTMLElement>(":scope > :not(.report-footer)"))
    .reduce((bottom, child) => Math.max(bottom, child.getBoundingClientRect().bottom), 0);
  if (contentBottom > footerTop + 1) {
    throw new Error("성적표 내용이 A4 범위를 넘어 PDF를 만들지 않았습니다. 평가명을 줄이거나 요약 1쪽을 이용해 주세요.");
  }
}

async function isolatePageForCapture(pages: HTMLElement[], targetIndex: number): Promise<void> {
  pages.forEach((page, index) => {
    page.style.display = index === targetIndex ? "block" : "none";
    page.style.marginBottom = "0";
  });
  const captureWindow = pages[targetIndex]?.ownerDocument.defaultView;
  await new Promise<void>((resolve) => {
    if (!captureWindow) {
      resolve();
      return;
    }
    captureWindow.requestAnimationFrame(() => resolve());
  });
}

export async function downloadStudentScoreReportPdf(params: StudentScoreReportParams): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await appendStudentScoreReportPages(pdf, params, html2canvas, false);

  const reportDate = resolveDate(params.date).replace(/[.\s/]/g, "");
  const filename = [
    "개인성적표",
    params.tenantName,
    params.lectureTitle,
    params.row.student_name,
    reportDate,
  ].filter(Boolean).map((part) => safeFilenamePart(String(part))).join("_");
  downloadBlob(pdf.output("blob"), `${filename}.pdf`);
}

export async function downloadStudentScoreReportsPdf(
  paramsList: StudentScoreReportParams[],
): Promise<void> {
  if (paramsList.length === 0) {
    throw new Error("PDF로 만들 학생을 한 명 이상 선택해 주세요.");
  }
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  for (let index = 0; index < paramsList.length; index += 1) {
    await appendStudentScoreReportPages(
      pdf,
      paramsList[index],
      html2canvas,
      index > 0,
    );
  }

  const first = paramsList[0];
  const reportDate = resolveDate(first.date).replace(/[.\s/]/g, "");
  const filename = [
    "개인성적표",
    first.tenantName,
    first.lectureTitle,
    `${paramsList.length}명`,
    reportDate,
  ].filter(Boolean).map((part) => safeFilenamePart(String(part))).join("_");
  downloadBlob(pdf.output("blob"), `${filename}.pdf`);
}

async function appendStudentScoreReportPages(
  pdf: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  params: StudentScoreReportParams,
  html2canvas: (typeof import("html2canvas"))["default"],
  addPageBefore: boolean,
): Promise<void> {
  const html = buildStudentScoreReportHtml(params);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:0;top:0;width:794px;height:2400px;opacity:0;pointer-events:none;z-index:-1";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) throw new Error("PDF 미리보기 문서를 만들지 못했습니다.");
    doc.open();
    doc.write(html);
    doc.close();
    await waitForIframeDocument(doc);

    const pageElements = Array.from(doc.querySelectorAll<HTMLElement>(".student-report-page"));
    if (pageElements.length === 0) throw new Error("PDF로 변환할 성적표 페이지가 없습니다.");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let index = 0; index < pageElements.length; index += 1) {
      await isolatePageForCapture(pageElements, index);
      assertPageContentFits(pageElements[index]);
      const canvas = await html2canvas(pageElements[index], {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: doc.documentElement.scrollWidth,
        windowHeight: doc.documentElement.scrollHeight,
      });
      if (addPageBefore || index > 0) pdf.addPage();
      addPageBefore = false;
      const imageData = canvas.toDataURL("image/jpeg", 0.94);
      const ratio = canvas.width / canvas.height;
      let drawWidth = pdfWidth;
      let drawHeight = pdfWidth / ratio;
      if (drawHeight > pdfHeight) {
        drawHeight = pdfHeight;
        drawWidth = pdfHeight * ratio;
      }
      pdf.addImage(imageData, "JPEG", (pdfWidth - drawWidth) / 2, 0, drawWidth, drawHeight, undefined, "FAST");
    }
  } finally {
    document.body.removeChild(iframe);
  }
}
