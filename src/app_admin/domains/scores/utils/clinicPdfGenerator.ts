// PATH: src/app_admin/domains/scores/utils/clinicPdfGenerator.ts
// 클리닉 대상자 안내 PDF — 3열 레이아웃 (시험+과제 | 시험 | 과제 미통과)

import type {
  SessionScoreRow,
  SessionScoreMeta,
} from "../api/sessionScores";
import { feedback } from "@/shared/ui/feedback/feedback";

// ── 공통 ──

export type ClinicPrintDensity = "comfortable" | "compact" | "dense";

export const CLINIC_PRINT_PAGE = {
  label: "A3 세로",
  jsPdfFormat: "a3",
  widthMm: 297,
  heightMm: 420,
  width: "297mm",
  height: "420mm",
} as const;

export type ClinicPrintCategory = "both" | "examOnly" | "hwOnly";

export type ClinicPrintStudent = {
  name: string;
  manual?: boolean;
  almostPassed?: boolean;
};

export type ClinicPrintDocument = {
  lectureTitle: string;
  sessionTitle: string;
  date: string;
  schedule?: string;
  totalPresent: number;
  groups: {
    both: ClinicPrintStudent[];
    examOnly: ClinicPrintStudent[];
    hwOnly: ClinicPrintStudent[];
  };
};

export type ClinicPrintHtmlOptions = {
  editable?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function printableLength(value: string): number {
  return Array.from(value.trim()).length;
}

export function getClinicPrintDensity(groups: string[][]): ClinicPrintDensity {
  const names = groups.flat().filter(Boolean);
  const maxGroupCount = Math.max(0, ...groups.map((group) => group.length));
  const maxNameLength = Math.max(0, ...names.map(printableLength));
  const total = names.length;

  if (maxGroupCount > 46 || total > 92) return "dense";
  if (maxGroupCount > 32 || total > 68 || maxNameLength > 12) return "compact";
  return "comfortable";
}

export function getClinicPrintPageClass(density: ClinicPrintDensity): string {
  return `page page--${density}`;
}

export function shouldUsePairedNameRows(names: string[]): boolean {
  const maxNameLength = Math.max(0, ...names.map(printableLength));
  return names.length > 44 && maxNameLength <= 8;
}

export const BASE_STYLE = `
  @page { size: A3; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${CLINIC_PRINT_PAGE.width}; min-height: ${CLINIC_PRINT_PAGE.height};
  }
  body {
    font-family: 'Pretendard', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
    color: #111827; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page {
    width: ${CLINIC_PRINT_PAGE.width}; height: ${CLINIC_PRINT_PAGE.height}; min-height: ${CLINIC_PRINT_PAGE.height};
    margin: 0 auto; padding: 13mm 15mm;
    display: flex; flex-direction: column;
    overflow: hidden;
    background:
      linear-gradient(90deg, #111827 0 5.5mm, transparent 5.5mm 100%),
      #fff;
  }

  /* ── Header: print-stable editorial sheet ── */
  .header {
    display: grid;
    grid-template-columns: 42mm minmax(0, 1fr);
    grid-template-rows: auto auto;
    gap: 3mm 8mm;
    align-items: end;
    padding: 2.5mm 0 7mm 8mm;
    margin-bottom: 6mm;
    border-bottom: 0.55mm solid #111827;
    text-align: left;
  }
  .header .badge {
    grid-row: 1 / 3;
    align-self: stretch;
    display: flex; align-items: center; justify-content: center;
    background: #111827; color: #fff;
    border-radius: 4px;
    font-size: 12px; font-weight: 900; padding: 0 4mm;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .header h1 {
    grid-column: 2;
    font-size: 42px; font-weight: 900; color: #111827;
    line-height: 1.16; letter-spacing: 0;
  }
  .header .sub {
    grid-column: 2;
    font-size: 16px; color: #475569; font-weight: 700;
    line-height: 1.35; letter-spacing: 0;
    white-space: normal; word-break: keep-all; overflow-wrap: anywhere;
  }

  /* ── Tip box ── */
  .tip-box {
    background: #f8fafc;
    border: 0.35mm solid #cbd5e1; border-left: 1.8mm solid #111827; border-radius: 4px;
    padding: 4mm 5mm; margin-bottom: 6mm;
    display: flex; align-items: center; gap: 14px;
  }
  .tip-box .icon {
    flex-shrink: 0; width: 7mm; height: 7mm;
    background: #111827; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 14px; font-weight: 900;
  }
  .tip-box .text {
    font-size: 15px; color: #1f2937; line-height: 1.45; font-weight: 700;
  }

  /* ── Name columns: max visibility ── */
  .columns {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5mm; flex: 1 1 auto; min-height: 0;
  }
  .col { display: flex; flex-direction: column; min-width: 0; min-height: 0; }

  .section-header {
    text-align: left; padding: 3.2mm 4mm; border-radius: 4px 4px 0 0;
    font-size: 15px; font-weight: 900;
    letter-spacing: 0; border: 0.36mm solid #111827; border-bottom: none;
    white-space: normal; word-break: keep-all;
  }
  .section-header.both { background: #111827; color: #fff; border-color: #111827; }
  .section-header.exam { background: #eff6ff; color: #1e3a8a; border-color: #93c5fd; }
  .section-header.hw { background: #ecfdf5; color: #065f46; border-color: #6ee7b7; }
  .section-header .cnt {
    font-weight: 800; font-size: 12px; opacity: 0.9;
    margin-left: 6px;
  }

  .name-list {
    flex: 1 1 auto; min-height: 0;
    border: 0.36mm solid #111827; border-top: none;
    border-radius: 0 0 4px 4px; padding: 1.8mm 0;
    background: #fff;
    overflow: hidden;
  }
  .section-header.exam + .name-list { border-color: #93c5fd; }
  .section-header.hw + .name-list { border-color: #6ee7b7; }

  /* ── Name rows ── */
  .name-row {
    display: flex; border-bottom: 0.24mm solid #e5e7eb;
  }
  .name-row:last-child { border-bottom: none; }
  .name-row:nth-child(even) { background: #f8fafc; }

  /* 1명/줄: 기본. 긴 이름과 실제 인쇄 안정성이 가장 좋다. */
  .name-row.single {
    display: flex; align-items: flex-start; gap: 2.8mm;
    padding: 3mm 4mm;
    font-size: 19px; font-weight: 800;
    color: #111827;
    line-height: 1.28; white-space: normal;
    text-align: left;
  }

  /* 매우 많은 짧은 이름만 2명/줄 */
  .name-cell {
    flex: 1;
    min-width: 0;
    display: flex; align-items: flex-start; gap: 2mm;
    padding: 2.2mm 2.8mm;
    font-size: 16px; font-weight: 800;
    color: #111827;
    line-height: 1.24;
    white-space: normal;
    text-align: left;
  }
  .name-text {
    flex: 1 1 auto; min-width: 0;
    text-align: left;
    line-height: inherit;
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: anywhere;
    overflow: visible;
    text-overflow: clip;
  }

  .checkbox {
    flex: 0 0 auto;
    width: 4mm; height: 4mm;
    margin-top: 0.35mm;
    border: 0.38mm solid #111827;
    border-radius: 1px;
    color: transparent;
  }
  .highlight {
    background: #fff7ed !important;
    box-shadow: inset 1.1mm 0 0 #f97316;
  }
  .star { flex: 0 0 auto; color: #9a3412; font-size: 13px; font-weight: 900; }
  /* 수동 지정 학생 — 텍스트 딱지 없이 옅은 음영만. 학생에게 비노출, 선생님 식별용 */
  .manual-name {
    background: #f8fafc !important;
    box-shadow: inset 1mm 0 0 #64748b;
  }
  .empty-item {
    display: flex; align-items: center; justify-content: center;
    min-height: 18mm;
    padding: 3mm 4mm;
    color: #94a3b8; font-size: 15px; font-weight: 700;
  }

  /* ── Schedule box ── */
  .schedule-box {
    flex: 0 0 auto;
    margin-top: 7mm;
    display: grid; grid-template-columns: 35mm minmax(0, 1fr);
    min-height: 25mm;
    border: 0.4mm solid #111827; border-radius: 4px;
    background: #fff;
    overflow: hidden;
  }
  .schedule-title {
    display: flex; align-items: center; justify-content: center;
    background: #111827; color: #fff;
    font-size: 14px; font-weight: 900;
    line-height: 1.08;
    letter-spacing: 0; text-transform: uppercase;
    padding: 0 3mm 2.2mm;
  }
  .schedule-content {
    padding: 4.5mm 5.5mm;
    font-size: 16px; color: #111827; line-height: 1.55; font-weight: 800;
    white-space: normal; word-break: keep-all; overflow-wrap: anywhere;
  }
  .schedule-empty {
    display: flex; align-items: center;
    padding: 4.5mm 5.5mm;
    font-size: 15px; color: #94a3b8; font-style: normal; font-weight: 700;
  }

  /* ── Footer: clean & professional ── */
  .footer {
    flex: 0 0 auto;
    margin-top: 5mm; padding-top: 3.5mm;
    border-top: 0.55mm solid #111827;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .footer-left {
    font-size: 14px; color: #475569; line-height: 1.5; font-weight: 700;
  }
  .footer-right {
    text-align: right; font-size: 16px; font-weight: 900;
    color: #111827; letter-spacing: 0;
  }

  .page--compact .header { padding-bottom: 5.5mm; margin-bottom: 4.5mm; }
  .page--compact .header h1 { font-size: 36px; }
  .page--compact .header .sub { font-size: 14px; }
  .page--compact .tip-box { padding: 3mm 4mm; margin-bottom: 4.5mm; }
  .page--compact .tip-box .text { font-size: 13px; }
  .page--compact .section-header { padding: 2.6mm 3.2mm; font-size: 13.5px; }
  .page--compact .name-list { padding: 1.2mm 0; }
  .page--compact .name-row.single { padding: 2mm 3mm; font-size: 16.5px; line-height: 1.22; }
  .page--compact .name-cell { padding: 1.5mm 2.2mm; font-size: 14.5px; line-height: 1.18; }
  .page--compact .schedule-box { margin-top: 5mm; min-height: 20mm; }
  .page--compact .schedule-content { padding: 3mm 4.5mm; font-size: 14px; line-height: 1.42; }
  .page--compact .footer { margin-top: 4mm; padding-top: 2.8mm; }

  .page--dense {
    padding: 10mm 12mm;
  }
  .page--dense .header {
    grid-template-columns: 34mm minmax(0, 1fr);
    padding: 1.6mm 0 4mm 7mm;
    margin-bottom: 3.5mm;
  }
  .page--dense .header h1 { font-size: 30px; }
  .page--dense .header .sub { font-size: 12.5px; }
  .page--dense .header .badge { font-size: 10px; }
  .page--dense .tip-box { padding: 2.4mm 3.2mm; margin-bottom: 3.5mm; }
  .page--dense .tip-box .icon { width: 5.5mm; height: 5.5mm; font-size: 11px; }
  .page--dense .tip-box .text { font-size: 11.5px; line-height: 1.32; }
  .page--dense .section-header { padding: 2mm 2.6mm; font-size: 12px; }
  .page--dense .section-header .cnt { font-size: 10.5px; }
  .page--dense .name-list { padding: 0.8mm 0; }
  .page--dense .name-row.single { padding: 1.35mm 2.4mm; font-size: 13.2px; line-height: 1.15; }
  .page--dense .name-cell { padding: 1mm 1.6mm; font-size: 12px; line-height: 1.12; }
  .page--dense .checkbox { width: 2.8mm; height: 2.8mm; border-width: 0.3mm; }
  .page--dense .schedule-box { margin-top: 3.5mm; min-height: 16mm; grid-template-columns: 25mm minmax(0, 1fr); }
  .page--dense .schedule-title { font-size: 10.5px; line-height: 1.08; padding-bottom: 2mm; }
  .page--dense .schedule-content { padding: 2.2mm 3.5mm; font-size: 11.5px; line-height: 1.28; }
  .page--dense .schedule-empty { padding: 2.2mm 3.5mm; font-size: 11px; }
  .page--dense .footer { margin-top: 2.8mm; padding-top: 2mm; }
  .page--dense .footer-left,
  .page--dense .footer-right { font-size: 11px; }

  @media screen {
    body { background: #f1f5f9; }
  }

  @media print {
    body { background: #fff; }
    .page { margin: 0; box-shadow: none; }
  }
`;

export async function htmlToPdfDownload(html: string, filename: string) {
  // 1) hidden iframe 렌더
  const iframe = document.createElement("iframe");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${CLINIC_PRINT_PAGE.width};height:${CLINIC_PRINT_PAGE.height};border:0;pointer-events:none;z-index:-1`;
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((resolve) => {
      const check = () => { if (doc.readyState === "complete") resolve(); else setTimeout(check, 50); };
      check();
    });
    await doc.fonts?.ready;
    await new Promise((r) => setTimeout(r, 200));

    // 2) CDN 로드
    const [h2cMod, jpMod] = await Promise.all([
      // @ts-expect-error CDN dynamic import
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm"),
      // @ts-expect-error CDN dynamic import
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"),
    ]);
    const html2canvas = h2cMod.default;
    const { jsPDF } = jpMod;

    // 3) 캡처
    const pageEl = (doc.querySelector(".page") as HTMLElement | null) ?? doc.body;
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: pageEl.scrollWidth,
      windowHeight: pageEl.scrollHeight,
    });

    // 4) PDF A3 세로. CSS에서 A3 비율을 고정하므로 PDF도 full-bleed로 고정한다.
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: CLINIC_PRINT_PAGE.jsPdfFormat });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(filename);
  } finally {
    document.body.removeChild(iframe);
  }
}

function filterPresent(rows: SessionScoreRow[], attendanceMap?: Record<number, string>) {
  if (!attendanceMap || Object.keys(attendanceMap).length === 0) return rows;
  return rows.filter((r) => {
    const s = (attendanceMap[r.enrollment_id] ?? "").toUpperCase();
    return s === "PRESENT" || s === "ONLINE" || s === "SUPPLEMENT" || s === "LATE";
  });
}

function resolveDate(date?: string) {
  return date || new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/\. /g, ". ");
}

// ── 분석 ──

type ClinicStudent = {
  name: string;
  reason: "exam" | "homework" | "both";
  almostPassed: boolean;
};

type AnalysisResult = {
  passed: string[];
  both: ClinicStudent[];
  examOnly: ClinicStudent[];
  hwOnly: ClinicStudent[];
  clinicTotal: number;
  totalStudents: number;
};

function analyze(rows: SessionScoreRow[], meta: SessionScoreMeta, attendanceMap?: Record<number, string>): AnalysisResult {
  const passScoreMap = new Map<number, number>();
  for (const e of meta?.exams ?? []) passScoreMap.set(e.exam_id, e.pass_score);

  const passed: string[] = [];
  const both: ClinicStudent[] = [];
  const examOnly: ClinicStudent[] = [];
  const hwOnly: ClinicStudent[] = [];
  const filteredRows = filterPresent(rows, attendanceMap);

  for (const row of filteredRows) {
    const allExams = row.exams ?? [];
    const allHws = row.homeworks ?? [];
    const examFailed = allExams.some((e) => e.block.passed === false);
    const hwFailed = allHws.some((h) => h.block.passed === false);

    if (!examFailed && !hwFailed) {
      // passed===null(미입력/기준미설정)만 있고 passed===true가 없으면 통과로 카운트하지 않음
      const hasAnyTruePass = allExams.some((e) => e.block.passed === true) || allHws.some((h) => h.block.passed === true);
      const hasAnyScore = allExams.some((e) => e.block.score != null) || allHws.some((h) => h.block.score != null);
      if (hasAnyTruePass || hasAnyScore) {
        passed.push(row.student_name);
      }
      continue;
    }

    let almostPassed = false;
    if (examFailed) {
      const failedExams = (row.exams ?? []).filter((e) => e.block.passed === false);
      almostPassed = failedExams.every((e) => {
        const ps = passScoreMap.get(e.exam_id) ?? 70;
        const score = e.block.score;
        return score != null && score >= ps - 10 && score < ps;
      });
    }

    const reason: "exam" | "homework" | "both" =
      examFailed && hwFailed ? "both" : examFailed ? "exam" : "homework";
    const student: ClinicStudent = { name: row.student_name, reason, almostPassed };

    if (reason === "both") both.push(student);
    else if (reason === "exam") examOnly.push(student);
    else hwOnly.push(student);
  }

  const sort = (arr: ClinicStudent[]) => arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  sort(both); sort(examOnly); sort(hwOnly);
  passed.sort((a, b) => a.localeCompare(b, "ko"));

  return {
    passed, both, examOnly, hwOnly,
    clinicTotal: both.length + examOnly.length + hwOnly.length,
    totalStudents: filteredRows.length,
  };
}

// ── HTML 빌드 ──

/** 이름 포맷 — 접미사(A, B) 분리 없이 그대로 출력 */
export function formatName(name: string): string {
  return name;
}

function getStudentClass(baseClass: "name-cell" | "name-row single", student?: ClinicPrintStudent): string {
  const classes: string[] = [baseClass];
  if (student?.almostPassed) classes.push("highlight");
  if (student?.manual) classes.push("manual-name");
  return classes.join(" ");
}

function buildNameCell(student?: ClinicPrintStudent): string {
  if (!student) return '<div class="name-cell"></div>';
  const star = student.almostPassed ? ' <span class="star">★</span>' : "";
  return `<div class="${getStudentClass("name-cell", student)}"><span class="checkbox"></span><span class="name-text">${escapeHtml(formatName(student.name))}</span>${star}</div>`;
}

function buildNameSingle(student: ClinicPrintStudent): string {
  const star = student.almostPassed ? ' <span class="star">★</span>' : "";
  return `<div class="${getStudentClass("name-row single", student)}"><span class="checkbox"></span><span class="name-text">${escapeHtml(formatName(student.name))}</span>${star}</div>`;
}

/** 기본은 1명/줄, 매우 많은 짧은 이름만 2명/줄 */
function buildNameItems(students: ClinicPrintStudent[]): string {
  if (!shouldUsePairedNameRows(students.map((student) => student.name))) {
    return students.map((s) => buildNameSingle(s)).join("\n");
  }
  const rows: string[] = [];
  for (let i = 0; i < students.length; i += 2) {
    const cell1 = buildNameCell(students[i]);
    const cell2 = buildNameCell(students[i + 1]);
    rows.push(`<div class="name-row">${cell1}${cell2}</div>`);
  }
  return rows.join("\n");
}

function emptyCell(): string {
  return '<div class="empty-item">해당 없음</div>';
}

const CLINIC_PRINT_GROUPS: Array<{
  key: ClinicPrintCategory;
  label: string;
  className: "both" | "exam" | "hw";
}> = [
  { key: "both", label: "시험+과제 미통과", className: "both" },
  { key: "examOnly", label: "시험 미통과", className: "exam" },
  { key: "hwOnly", label: "과제 미통과", className: "hw" },
];

const EDITABLE_STYLE = `
    [contenteditable]:hover { outline: 1px dashed #94a3b8; outline-offset: 2px; border-radius: 4px; cursor: text; }
    [contenteditable]:focus { outline: 2px solid #111827; outline-offset: 2px; border-radius: 4px; background: #f5f5f5; }
    .sub [contenteditable] { display: inline; min-width: 40px; }
    [data-placeholder]:empty:before { content: attr(data-placeholder); color: #737373; font-style: italic; }
    .name-list[contenteditable] { min-height: 40px; cursor: text; }
    .name-list[contenteditable]:empty:before { content: "해당 없음"; color: #737373; font-size: 14px; font-weight: 500; padding: 7px 8px; display: flex; align-items: center; justify-content: center; }
`;

function getClinicTotal(document: ClinicPrintDocument): number {
  return document.groups.both.length + document.groups.examOnly.length + document.groups.hwOnly.length;
}

function buildClinicPrintSection(
  document: ClinicPrintDocument,
  group: (typeof CLINIC_PRINT_GROUPS)[number],
  editable: boolean,
): string {
  const students = document.groups[group.key];
  const listAttrs = editable ? ` contenteditable="true" data-field="${group.key}"` : "";
  const listContent = students.length > 0 ? buildNameItems(students) : editable ? "" : emptyCell();
  return `<div class="col"><div class="section-header ${group.className}">${group.label} <span class="cnt">(${students.length}명)</span></div><div class="name-list"${listAttrs}>${listContent}</div></div>`;
}

function buildClinicPrintSubTitle(document: ClinicPrintDocument, editable: boolean): string {
  if (editable) {
    return `<span contenteditable="true" data-field="lectureTitle" data-placeholder="강의명">${escapeHtml(document.lectureTitle)}</span> &nbsp;|&nbsp; <span contenteditable="true" data-field="sessionTitle" data-placeholder="차시명">${escapeHtml(document.sessionTitle)}</span>`;
  }
  return [document.lectureTitle, document.sessionTitle]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" &nbsp;|&nbsp; ");
}

function buildClinicPrintSchedule(document: ClinicPrintDocument, editable: boolean): string {
  if (editable) {
    const content = document.schedule
      ? `${escapeHtml(document.schedule).replace(/\n/g, "<br>")}`
      : "";
    const placeholder = document.schedule ? "" : ' data-placeholder="클리닉 일정을 입력하세요..."';
    return `<div class="schedule-box"><div class="schedule-title">클리닉 일정</div><div class="schedule-content" contenteditable="true" data-field="schedule"${placeholder}>${content}</div></div>`;
  }
  const scheduleContent = document.schedule
    ? `<div class="schedule-content">${escapeHtml(document.schedule).replace(/\n/g, "<br>")}</div>`
    : `<div class="schedule-empty">아직 개설된 클리닉 일정이 없습니다.</div>`;
  return `<div class="schedule-box"><div class="schedule-title">클리닉 일정</div>${scheduleContent}</div>`;
}

export function buildClinicPrintHtml(document: ClinicPrintDocument, options: ClinicPrintHtmlOptions = {}): string {
  const editable = options.editable === true;
  const density = getClinicPrintDensity([
    document.groups.both.map((student) => student.name),
    document.groups.examOnly.map((student) => student.name),
    document.groups.hwOnly.map((student) => student.name),
  ]);
  const hasAlmostPassed = [
    ...document.groups.both,
    ...document.groups.examOnly,
    ...document.groups.hwOnly,
  ].some((student) => student.almostPassed);
  const tipText = hasAlmostPassed
    ? `아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.<br>★ 표시 학생은 보정 제출로 통과 가능합니다.`
    : "아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.";
  const clinicTotal = getClinicTotal(document);
  const totalPresent = document.totalPresent ?? clinicTotal;
  const date = escapeHtml(document.date);

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>클리닉 대상자 안내</title>
<style>${BASE_STYLE}${editable ? EDITABLE_STYLE : ""}</style></head><body>
<div class="${getClinicPrintPageClass(density)}">
  <div class="header"><div class="badge">CLINIC</div><h1>클리닉 대상자 안내</h1><div class="sub">${buildClinicPrintSubTitle(document, editable)}</div></div>
  <div class="tip-box"><div class="icon">!</div><div class="text">${tipText}</div></div>
  <div class="columns">
    ${CLINIC_PRINT_GROUPS.map((group) => buildClinicPrintSection(document, group, editable)).join("\n    ")}
  </div>
  ${buildClinicPrintSchedule(document, editable)}
  <div class="footer"><div class="footer-left">클리닉 대상 <strong>${clinicTotal}명</strong> / 전체 출석 ${editable ? `<span contenteditable="true" data-field="totalPresent">${totalPresent}</span>` : totalPresent}명</div><div class="footer-right">${editable ? `<span contenteditable="true" data-field="date">${date}</span>` : date}</div></div>
</div></body></html>`;
}

// ── Export ──

export type ClinicPdfParams = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta;
  sessionTitle: string;
  lectureTitle: string;
  date?: string;
  attendanceMap?: Record<number, string>;
  schedule?: string;
};

function toClinicPrintDocument(
  data: AnalysisResult,
  sessionTitle: string,
  lectureTitle: string,
  date: string,
  schedule?: string,
): ClinicPrintDocument {
  return {
    lectureTitle,
    sessionTitle,
    date,
    schedule,
    totalPresent: data.totalStudents,
    groups: {
      both: data.both,
      examOnly: data.examOnly,
      hwOnly: data.hwOnly,
    },
  };
}

export function buildClinicPdfHtml(params: ClinicPdfParams): string {
  const { rows, meta, sessionTitle, lectureTitle, date, attendanceMap, schedule } = params;
  const data = analyze(rows, meta, attendanceMap);
  return buildClinicPrintHtml(toClinicPrintDocument(data, sessionTitle, lectureTitle, resolveDate(date), schedule));
}

export async function downloadClinicPdf(params: ClinicPdfParams): Promise<void> {
  const { rows, meta, sessionTitle, lectureTitle, date, attendanceMap, schedule } = params;
  const data = analyze(rows, meta, attendanceMap);
  if (data.totalStudents === 0) { feedback.warning("출석 학생이 없습니다."); return; }
  const html = buildClinicPrintHtml(toClinicPrintDocument(data, sessionTitle, lectureTitle, resolveDate(date), schedule));
  const filename = `클리닉현황_${lectureTitle}_${sessionTitle}_${resolveDate(date).replace(/[.\s/]/g, "")}.pdf`;
  await htmlToPdfDownload(html, filename);
}

export function getClinicStats(rows: SessionScoreRow[], meta: SessionScoreMeta, attendanceMap?: Record<number, string>) {
  const data = analyze(rows, meta, attendanceMap);
  return { clinicCount: data.clinicTotal, passedCount: data.passed.length, totalPresent: data.totalStudents };
}
