// PATH: src/app_admin/domains/scores/utils/clinicPdfGenerator.ts
// 클리닉 대상자 안내 PDF — 3열 레이아웃 (시험+과제 | 시험 | 과제 미통과)

import type {
  ScoreBlock,
  SessionScoreRow,
  SessionScoreMeta,
} from "../api/sessionScores";
import { feedback } from "@/shared/ui/feedback/feedback";
import { deriveFinalPass } from "@/shared/scoring/achievement";
import { loadPdfModules } from "@/shared/utils/pdfModules";
import { isSessionRowProgressCompleted } from "./sessionScoreRowVerdict";

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
  return names.length >= 32 && maxNameLength <= 8;
}

type NameLayoutProfile = {
  fontSizePx: number;
  checkSizeMm: number;
  checkBorderMm: number;
  gapMm: number;
  padYmm: number;
  padXmm: number;
  lineHeight: number;
};

function getNameLayoutProfile(students: ClinicPrintStudent[]): NameLayoutProfile {
  const names = students.map((student) => student.name);
  const count = names.length;
  const maxNameLength = Math.max(0, ...names.map(printableLength));
  const paired = shouldUsePairedNameRows(names);

  if (paired) {
    if (count > 76) return { fontSizePx: 21, checkSizeMm: 3.6, checkBorderMm: 0.4, gapMm: 1, padYmm: 0.8, padXmm: 1.05, lineHeight: 1.02 };
    if (count > 64) return { fontSizePx: 23, checkSizeMm: 3.8, checkBorderMm: 0.42, gapMm: 1.05, padYmm: 0.9, padXmm: 1.15, lineHeight: 1.02 };
    if (count > 48) return { fontSizePx: 26, checkSizeMm: 4.1, checkBorderMm: 0.44, gapMm: 1.15, padYmm: 1.05, padXmm: 1.3, lineHeight: 1.02 };
    if (count > 32) return { fontSizePx: 28, checkSizeMm: 4.4, checkBorderMm: 0.46, gapMm: 1.25, padYmm: 1.15, padXmm: 1.45, lineHeight: 1.02 };
    return { fontSizePx: 32, checkSizeMm: 4.8, checkBorderMm: 0.48, gapMm: 1.45, padYmm: 1.45, padXmm: 1.8, lineHeight: 1.03 };
  }

  if (maxNameLength > 16) {
    if (count > 28) return { fontSizePx: 15.5, checkSizeMm: 3.2, checkBorderMm: 0.34, gapMm: 0.95, padYmm: 0.75, padXmm: 1.25, lineHeight: 1.04 };
    if (count > 18) return { fontSizePx: 18, checkSizeMm: 3.5, checkBorderMm: 0.36, gapMm: 1.1, padYmm: 1, padXmm: 1.55, lineHeight: 1.04 };
    if (count > 8) return { fontSizePx: 21, checkSizeMm: 3.9, checkBorderMm: 0.4, gapMm: 1.25, padYmm: 1.25, padXmm: 1.9, lineHeight: 1.05 };
    return { fontSizePx: 26, checkSizeMm: 4.4, checkBorderMm: 0.44, gapMm: 1.45, padYmm: 1.65, padXmm: 2.4, lineHeight: 1.05 };
  }

  if (maxNameLength > 12) {
    if (count > 28) return { fontSizePx: 16.5, checkSizeMm: 3.3, checkBorderMm: 0.36, gapMm: 1, padYmm: 0.85, padXmm: 1.35, lineHeight: 1.04 };
    if (count > 18) return { fontSizePx: 20, checkSizeMm: 3.7, checkBorderMm: 0.38, gapMm: 1.15, padYmm: 1.1, padXmm: 1.7, lineHeight: 1.04 };
    if (count > 8) return { fontSizePx: 23, checkSizeMm: 4.1, checkBorderMm: 0.42, gapMm: 1.35, padYmm: 1.4, padXmm: 2.1, lineHeight: 1.05 };
    return { fontSizePx: 30, checkSizeMm: 4.8, checkBorderMm: 0.48, gapMm: 1.65, padYmm: 2, padXmm: 2.8, lineHeight: 1.05 };
  }

  if (count > 46) return { fontSizePx: 17, checkSizeMm: 3.35, checkBorderMm: 0.36, gapMm: 1, padYmm: 0.85, padXmm: 1.35, lineHeight: 1.04 };
  if (count > 32) return { fontSizePx: 20, checkSizeMm: 3.8, checkBorderMm: 0.4, gapMm: 1.15, padYmm: 1.1, padXmm: 1.65, lineHeight: 1.04 };
  if (count > 24) return { fontSizePx: 25, checkSizeMm: 4.3, checkBorderMm: 0.44, gapMm: 1.35, padYmm: 1.45, padXmm: 2, lineHeight: 1.04 };
  if (count > 16) return { fontSizePx: 29, checkSizeMm: 4.7, checkBorderMm: 0.48, gapMm: 1.5, padYmm: 1.8, padXmm: 2.45, lineHeight: 1.04 };
  if (count > 10) return { fontSizePx: 34, checkSizeMm: 5.1, checkBorderMm: 0.5, gapMm: 1.75, padYmm: 2.35, padXmm: 3.2, lineHeight: 1.04 };
  return { fontSizePx: 40, checkSizeMm: 5.6, checkBorderMm: 0.52, gapMm: 1.4, padYmm: 3.1, padXmm: 3.8, lineHeight: 1.04 };
}

function formatCssNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function buildNameLayoutStyle(students: ClinicPrintStudent[]): string {
  if (students.length === 0) return "";
  const profile = getNameLayoutProfile(students);
  const lineHeight = Math.max(profile.lineHeight, profile.fontSizePx >= 20 ? 1.14 : 1.12);
  return [
    `--row-font-size:${formatCssNumber(profile.fontSizePx)}px`,
    `--row-check-size:${formatCssNumber(profile.checkSizeMm)}mm`,
    `--row-check-border:${formatCssNumber(profile.checkBorderMm)}mm`,
    `--row-gap:${formatCssNumber(profile.gapMm)}mm`,
    `--row-pad-y:${formatCssNumber(profile.padYmm)}mm`,
    `--row-pad-x:${formatCssNumber(profile.padXmm)}mm`,
    `--row-line-height:${formatCssNumber(lineHeight)}`,
  ].join(";");
}

export const BASE_STYLE = `
  @page { size: A3; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --clinic-ink: #17243a;
    --clinic-accent: #3f5fcb;
    --clinic-accent-soft: #e9eefc;
    --clinic-paper-soft: #f5f7fb;
    --clinic-line: #c8d1df;
    --clinic-muted: #596579;
  }
  html, body {
    width: ${CLINIC_PRINT_PAGE.width}; min-height: ${CLINIC_PRINT_PAGE.height};
  }
  body {
    font-family: 'Pretendard', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
    color: var(--clinic-ink); background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    text-rendering: geometricPrecision;
  }
  .page {
    width: ${CLINIC_PRINT_PAGE.width}; height: ${CLINIC_PRINT_PAGE.height}; min-height: ${CLINIC_PRINT_PAGE.height};
    margin: 0 auto; padding: 10mm 11mm 9mm 14mm;
    display: flex; flex-direction: column;
    overflow: hidden;
    background:
      linear-gradient(90deg, var(--clinic-accent) 0 3.2mm, transparent 3.2mm 100%),
      #fff;
  }

  /* ── Header: a clear clinic roster, readable from the classroom door ── */
  .header {
    display: grid;
    grid-template-columns: 34mm minmax(0, 1fr);
    grid-template-rows: auto auto;
    gap: 1.5mm 7mm;
    align-items: center;
    padding: 1.5mm 0 5mm;
    margin-bottom: 4mm;
    border-bottom: 0.7mm solid var(--clinic-ink);
    text-align: left;
  }
  .header .badge {
    grid-row: 1 / 3;
    align-self: stretch;
    display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
    min-height: 19mm;
    background: var(--clinic-ink); color: #fff;
    border-radius: 1.8mm;
    font-size: 12px; font-weight: 900; padding: 3.2mm;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .header .badge::after {
    content: "CHECK LIST";
    color: #bfcaf2;
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.14em;
  }
  .header h1 {
    grid-column: 2;
    font-size: 40px; font-weight: 900; color: var(--clinic-ink);
    line-height: 1.06; letter-spacing: -0.035em;
  }
  .header .sub {
    grid-column: 2;
    font-size: 14px; color: var(--clinic-muted); font-weight: 750;
    line-height: 1.3; letter-spacing: -0.01em;
    white-space: normal; word-break: keep-all; overflow-wrap: anywhere;
  }

  /* ── Tip box ── */
  .tip-box {
    background: var(--clinic-paper-soft);
    border: 0.3mm solid var(--clinic-line); border-radius: 1.8mm;
    padding: 2.8mm 3.6mm; margin-bottom: 4mm;
    display: flex; align-items: center; gap: 3mm;
  }
  .tip-box .icon {
    flex-shrink: 0; width: 5.7mm; height: 5.7mm;
    background: var(--clinic-accent); border-radius: 1.5mm;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 12px; font-weight: 900;
  }
  .tip-box .text {
    font-size: 13px; color: var(--clinic-ink); line-height: 1.36; font-weight: 750;
  }

  /* ── Name columns: max visibility ── */
  .columns {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3.6mm; flex: 1 1 0; min-height: 0;
  }
  .col {
    display: flex; flex-direction: column; min-width: 0; min-height: 0;
    border: 0.3mm solid var(--clinic-line);
    border-radius: 2mm;
    overflow: hidden;
    background: #fff;
  }

  .section-header {
    display: flex; align-items: baseline; justify-content: space-between; gap: 2mm;
    text-align: left; padding: 3mm 3.4mm;
    font-size: 15px; font-weight: 900;
    letter-spacing: -0.02em; border-bottom: 0.3mm solid var(--clinic-line);
    white-space: normal; word-break: keep-all;
  }
  .section-header.both { background: var(--clinic-ink); color: #fff; border-color: var(--clinic-ink); }
  .section-header.exam { background: var(--clinic-accent-soft); color: #243d91; border-color: #c7d1f4; }
  .section-header.hw { background: #eef1f5; color: #374255; border-color: #d7dde6; }
  .section-header .cnt {
    flex: 0 0 auto;
    font-weight: 850; font-size: 11.5px; opacity: 0.85;
    margin-left: 2mm;
  }

  .name-list {
    flex: 1 1 auto; min-height: 0;
    padding: 1mm 0;
    background: #fff;
    overflow: hidden;
    --row-font-size: 40px;
    --row-check-size: 5.6mm;
    --row-check-border: 0.52mm;
    --row-gap: 2mm;
    --row-pad-y: 3.1mm;
    --row-pad-x: 3.8mm;
    --row-line-height: 1.04;
  }
  /* ── Name rows ── */
  .name-row {
    display: flex; border-bottom: 0.25mm solid #dde2ea;
  }
  .name-row:last-child { border-bottom: none; }
  .name-row:nth-child(even) { background: #f7f8fa; }

  /* 1명/줄: 기본. 긴 이름과 실제 인쇄 안정성이 가장 좋다. */
  .name-row.single {
    display: grid;
    grid-template-columns: var(--row-check-size) minmax(0, 1fr) auto;
    align-items: center;
    column-gap: var(--row-gap);
    padding: var(--row-pad-y) var(--row-pad-x);
    font-size: var(--row-font-size); font-weight: 850;
    color: var(--clinic-ink);
    line-height: var(--row-line-height); white-space: normal;
    text-align: left;
    break-inside: avoid;
  }

  /* 짧은 이름이 많은 게시물은 2명/줄로 키워서 멀리서도 찾게 한다. */
  .name-cell {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: var(--row-check-size) minmax(0, 1fr) auto;
    align-items: center;
    column-gap: var(--row-gap);
    padding: var(--row-pad-y) var(--row-pad-x);
    font-size: var(--row-font-size); font-weight: 850;
    color: var(--clinic-ink);
    line-height: var(--row-line-height);
    white-space: normal;
    text-align: left;
    break-inside: avoid;
  }
  .name-text {
    display: block;
    min-width: 0; max-width: 100%;
    align-self: center;
    text-align: left;
    line-height: inherit;
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: anywhere;
    hyphens: none;
    overflow: visible;
    text-overflow: clip;
  }

  .checkbox {
    flex: 0 0 auto;
    width: var(--row-check-size); height: var(--row-check-size);
    align-self: center;
    justify-self: start;
    margin: 0;
    border: var(--row-check-border) solid #526077;
    border-radius: 1mm;
    color: transparent;
  }
  .highlight {
    background: #edf1ff !important;
    box-shadow: inset 1.1mm 0 0 var(--clinic-accent);
  }
  .star { flex: 0 0 auto; align-self: center; justify-self: end; color: var(--clinic-accent); font-size: 12px; font-weight: 900; margin-left: 0; }
  /* 수동 지정 학생 — 텍스트 딱지 없이 옅은 음영만. 학생에게 비노출, 선생님 식별용 */
  .manual-name {
    background: #f1f3f6 !important;
    box-shadow: inset 0.9mm 0 0 #78849a;
  }
  .empty-item {
    display: flex; align-items: center; justify-content: center;
    min-height: 18mm;
    padding: 3mm 4mm;
    color: #8a94a5; font-size: 14px; font-weight: 750;
  }

  /* ── Schedule box ── */
  .schedule-box {
    flex: 0 0 auto;
    margin-top: 4mm;
    display: grid; grid-template-columns: 32mm minmax(0, 1fr);
    min-height: 20mm;
    border: 0.3mm solid var(--clinic-line); border-radius: 2mm;
    background: var(--clinic-paper-soft);
    overflow: hidden;
  }
  .schedule-title {
    display: flex; align-items: center; justify-content: center;
    background: var(--clinic-accent); color: #fff;
    font-size: 13px; font-weight: 900;
    line-height: 1.08;
    letter-spacing: -0.01em;
    padding: 0 3mm 1.7mm;
  }
  .schedule-content {
    padding: 3.2mm 4.2mm;
    font-size: 15px; color: var(--clinic-ink); line-height: 1.38; font-weight: 800;
    white-space: normal; word-break: keep-all; overflow-wrap: anywhere;
  }
  .schedule-empty {
    display: flex; align-items: center;
    padding: 3.2mm 4.2mm;
    font-size: 14px; color: var(--clinic-muted); font-style: normal; font-weight: 750;
  }

  /* ── Footer ── */
  .footer {
    flex: 0 0 auto;
    margin-top: 3mm; padding-top: 2.5mm;
    border-top: 0.45mm solid var(--clinic-ink);
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .footer-left {
    font-size: 13px; color: var(--clinic-muted); line-height: 1.35; font-weight: 750;
  }
  .footer-left strong { color: var(--clinic-accent); font-size: 16px; font-weight: 900; }
  .footer-right {
    text-align: right; font-size: 14px; font-weight: 900;
    color: var(--clinic-ink); letter-spacing: 0.02em;
  }

  .page--compact .header { padding-bottom: 4.2mm; margin-bottom: 3.8mm; }
  .page--compact .header h1 { font-size: 35px; }
  .page--compact .header .sub { font-size: 13.5px; }
  .page--compact .tip-box { padding: 2.3mm 3.4mm; margin-bottom: 3.8mm; }
  .page--compact .tip-box .text { font-size: 12.5px; }
  .page--compact .section-header { padding: 2.2mm 2.8mm; font-size: 13.5px; }
  .page--compact .name-list {
    padding: 0.8mm 0;
    --row-font-size: 24px;
    --row-check-size: 4mm;
    --row-check-border: 0.42mm;
    --row-gap: 1.25mm;
    --row-pad-y: 1.35mm;
    --row-pad-x: 2mm;
    --row-line-height: 1.04;
  }
  .page--compact .schedule-box { margin-top: 4mm; min-height: 17mm; }
  .page--compact .schedule-content { padding: 2.5mm 3.5mm; font-size: 13.2px; line-height: 1.3; }
  .page--compact .footer { margin-top: 3mm; padding-top: 2.2mm; }

  .page--dense { padding: 8.5mm 9.5mm 8mm 12.5mm; }
  .page--dense .header {
    grid-template-columns: 30mm minmax(0, 1fr);
    padding: 1mm 0 3mm 6mm;
    margin-bottom: 2.8mm;
  }
  .page--dense .header h1 { font-size: 27px; }
  .page--dense .header .sub { font-size: 11.5px; }
  .page--dense .header .badge { font-size: 9px; }
  .page--dense .tip-box { padding: 1.8mm 2.6mm; margin-bottom: 2.8mm; }
  .page--dense .tip-box .icon { width: 4.8mm; height: 4.8mm; font-size: 10px; }
  .page--dense .tip-box .text { font-size: 10.8px; line-height: 1.22; }
  .page--dense .columns { gap: 3.5mm; }
  .page--dense .section-header { padding: 1.7mm 2.2mm; font-size: 11.5px; }
  .page--dense .section-header .cnt { font-size: 10px; }
  .page--dense .name-list {
    padding: 0.5mm 0;
    --row-font-size: 18px;
    --row-check-size: 3.4mm;
    --row-check-border: 0.36mm;
    --row-gap: 1mm;
    --row-pad-y: 0.85mm;
    --row-pad-x: 1.35mm;
    --row-line-height: 1.03;
  }
  .page--dense .star { font-size: 10px; }
  .page--dense .schedule-box { margin-top: 2.8mm; min-height: 14mm; grid-template-columns: 23mm minmax(0, 1fr); }
  .page--dense .schedule-title { font-size: 9.8px; line-height: 1.05; padding-bottom: 1.6mm; }
  .page--dense .schedule-content { padding: 1.8mm 2.8mm; font-size: 10.8px; line-height: 1.18; }
  .page--dense .schedule-empty { padding: 1.8mm 2.8mm; font-size: 10.5px; }
  .page--dense .footer { margin-top: 2.2mm; padding-top: 1.7mm; }
  .page--dense .footer-left,
  .page--dense .footer-right { font-size: 10.5px; }

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
    if (!doc) throw new Error("PDF 렌더링 화면을 열지 못했습니다.");
    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((resolve) => {
      const check = () => { if (doc.readyState === "complete") resolve(); else setTimeout(check, 50); };
      check();
    });
    await doc.fonts?.ready;
    await new Promise((r) => setTimeout(r, 200));

    // 2) 앱 번들에 포함된 렌더러 로드 — 외부 CDN 장애와 CSP 차단의 영향을 받지 않는다.
    const { html2canvas, jsPDF } = await loadPdfModules();

    // 3) 캡처
    const pageEl = (doc.querySelector(".page") as HTMLElement | null) ?? doc.body;
    const canvas = await html2canvas(pageEl, {
      // 96dpi CSS 캔버스를 2.75배로 캡처해 A3에서도 약 264dpi의 선명도를 확보한다.
      scale: 2.75,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: pageEl.scrollWidth,
      windowHeight: pageEl.scrollHeight,
    });
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("PDF 렌더링 결과가 비어 있습니다.");
    }

    // 4) PDF A3 세로. CSS에서 A3 비율을 고정하므로 PDF도 full-bleed로 고정한다.
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: CLINIC_PRINT_PAGE.jsPdfFormat });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    // 흰 배경의 인쇄물이라 고품질 JPEG가 글자 선명도를 유지하면서 PNG 대비 파일 크기를 크게 줄인다.
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
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

function isUnresolvedClinicBlock(block: ScoreBlock | null | undefined): boolean {
  if (!block) return false;
  if (block.meta?.status === "OMR_REVIEW_REQUIRED") return false;

  const finalPass = deriveFinalPass({
    achievement: block.achievement ?? null,
    is_pass: block.passed ?? null,
    final_pass: block.final_pass ?? null,
    remediated: block.remediated ?? null,
    meta_status: block.meta?.status ?? null,
  });
  if (finalPass === true) return false;
  if (finalPass === false) return true;

  return block.passed === false;
}

function hasCompletedScoreSignal(block: ScoreBlock | null | undefined): boolean {
  if (!block) return false;
  const finalPass = deriveFinalPass({
    achievement: block.achievement ?? null,
    is_pass: block.passed ?? null,
    final_pass: block.final_pass ?? null,
    remediated: block.remediated ?? null,
    meta_status: block.meta?.status ?? null,
  });
  return finalPass === true || block.passed === true || block.score != null;
}

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
    if (isSessionRowProgressCompleted(row)) {
      passed.push(row.student_name);
      continue;
    }

    const examFailed = allExams.some((e) => isUnresolvedClinicBlock(e.block));
    const hwFailed = allHws.some((h) => isUnresolvedClinicBlock(h.block));

    if (!examFailed && !hwFailed) {
      // 미입력/기준미설정만 있고 완료 신호가 없으면 통과로 카운트하지 않음
      const hasAnyDoneSignal = allExams.some((e) => hasCompletedScoreSignal(e.block)) || allHws.some((h) => hasCompletedScoreSignal(h.block));
      if (hasAnyDoneSignal) {
        passed.push(row.student_name);
      }
      continue;
    }

    let almostPassed = false;
    if (examFailed) {
      const failedExams = (row.exams ?? []).filter((e) => isUnresolvedClinicBlock(e.block));
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
    [contenteditable]:hover { outline: 1px dashed #7084c7; outline-offset: 2px; border-radius: 4px; cursor: text; }
    [contenteditable]:focus { outline: 2px solid var(--clinic-accent); outline-offset: 2px; border-radius: 4px; background: #f5f7ff; }
    .sub [contenteditable] { display: inline; min-width: 40px; }
    [data-placeholder]:empty:before { content: attr(data-placeholder); color: #7a8496; font-style: normal; font-weight: 650; }
    .name-list[contenteditable] { min-height: 40px; cursor: text; }
    .name-list[contenteditable]:empty:before { content: "해당 없음"; color: #8a94a5; font-size: 14px; font-weight: 650; padding: 7px 8px; display: flex; align-items: center; justify-content: center; }
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
  const listStyle = buildNameLayoutStyle(students);
  const styleAttr = listStyle ? ` style="${listStyle}"` : "";
  const listContent = students.length > 0 ? buildNameItems(students) : editable ? "" : emptyCell();
  return `<div class="col"><div class="section-header ${group.className}">${group.label} <span class="cnt">(${students.length}명)</span></div><div class="name-list"${styleAttr}${listAttrs}>${listContent}</div></div>`;
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
