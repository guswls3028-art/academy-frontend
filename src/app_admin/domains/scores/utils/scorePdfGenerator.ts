// PATH: src/app_admin/domains/scores/utils/scorePdfGenerator.ts
// 교사용 차시 성적표 — A4 가로, 테넌트 브랜딩, 안전한 다중 페이지 출력

import type {
  SessionScoreMeta,
  SessionScoreRow,
} from "../api/sessionScores";
import { getSessionScoresTableVerdict } from "./sessionScoreRowVerdict";
import { resolveStudentScoreReportTheme } from "./studentScoreReportTheme";

const ROWS_PER_PAGE = 12;

const SCORE_REPORT_STYLE = `
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #dce3ec;
    color: #182234;
    font-family: "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .score-report-page {
    position: relative;
    display: flex;
    width: 297mm;
    height: 210mm;
    min-height: 210mm;
    flex-direction: column;
    margin: 0 auto 8mm;
    overflow: hidden;
    background: #fff;
    break-after: page;
  }
  .score-report-page:last-child { margin-bottom: 0; break-after: auto; }
  .report-topline {
    display: flex;
    min-height: 18mm;
    align-items: center;
    justify-content: space-between;
    padding: 3mm 11mm;
    border-bottom: 1.2mm solid var(--score-report-accent);
    background: var(--score-report-primary);
    color: var(--score-report-on-primary);
  }
  .report-brand {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 3mm;
  }
  .report-brand-symbol {
    position: relative;
    display: inline-flex;
    width: 12mm;
    height: 10mm;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 2mm;
    background: #fff;
    color: var(--score-report-primary);
    font-size: 15px;
    font-weight: 900;
  }
  .report-brand-logo {
    position: absolute;
    inset: 1.1mm;
    display: block;
    width: calc(100% - 2.2mm);
    height: calc(100% - 2.2mm);
    object-fit: contain;
  }
  .report-brand-copy {
    display: grid;
    min-width: 0;
    gap: 0.6mm;
  }
  .report-brand-copy strong {
    overflow: hidden;
    font-size: 12px;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .report-brand-copy span {
    color: var(--score-report-on-primary);
    font-size: 8px;
    font-weight: 700;
    opacity: 0.76;
  }
  .report-date {
    display: grid;
    justify-items: end;
    gap: 0.8mm;
    font-size: 8px;
    font-weight: 700;
  }
  .report-date strong { font-size: 10px; font-weight: 900; }
  .report-content {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    padding: 6mm 10mm 5mm;
  }
  .report-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8mm;
    margin-bottom: 4mm;
  }
  .report-heading h1 {
    margin: 0;
    color: #182234;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.04em;
  }
  .report-heading p {
    margin: 1.2mm 0 0;
    color: #667287;
    font-size: 8.5px;
    font-weight: 700;
  }
  .report-heading__session {
    max-width: 78mm;
    color: #415069;
    font-size: 9px;
    font-weight: 800;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .summary-band {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: 4mm;
    overflow: hidden;
    border: 0.3mm solid #ccd5e1;
    border-radius: 2.2mm;
    background: #f7f9fc;
  }
  .summary-metric {
    display: grid;
    min-height: 15mm;
    align-content: center;
    gap: 1mm;
    padding: 2.2mm 4mm;
    border-right: 0.3mm solid #d9e0e9;
  }
  .summary-metric:last-child { border-right: 0; }
  .summary-metric span {
    color: #69768a;
    font-size: 7.5px;
    font-weight: 750;
  }
  .summary-metric strong {
    color: #202d43;
    font-size: 15px;
    font-weight: 900;
    line-height: 1;
  }
  .summary-metric.is-clinic strong { color: #a35408; }
  .score-table-wrap {
    min-height: 0;
    overflow: hidden;
    border: 0.35mm solid #344157;
    border-radius: 1.5mm;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8.4px;
    line-height: 1.25;
  }
  th, td {
    height: 8.2mm;
    padding: 1.2mm 1.5mm;
    border-right: 0.25mm solid #c6cfdb;
    border-bottom: 0.25mm solid #c6cfdb;
    text-align: center;
    vertical-align: middle;
  }
  tr > :last-child { border-right: 0; }
  tbody tr:last-child td { border-bottom: 0; }
  th {
    background: #eef2f7;
    color: #2a374d;
    font-size: 7.7px;
    font-weight: 850;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  th.group-header {
    height: 7.6mm;
    border-color: var(--score-report-primary);
    background: var(--score-report-primary);
    color: var(--score-report-on-primary);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.04em;
  }
  th small {
    display: block;
    margin-top: 0.6mm;
    color: #718096;
    font-size: 6.5px;
    font-weight: 700;
  }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  td.name {
    padding-left: 2.5mm;
    color: #172033;
    font-size: 9px;
    font-weight: 850;
    text-align: left;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  td.num { font-variant-numeric: tabular-nums; font-weight: 700; }
  td.no-score { color: #9aa5b5; }
  td.verdict-pass { color: #15613e; font-weight: 900; }
  td.verdict-fail { background: #fff1f0 !important; color: #a32622; font-weight: 900; }
  td.verdict-clinic { background: #fff6e8 !important; color: #9b5207; font-weight: 900; }
  td.verdict-review { background: #fff9e8 !important; color: #8a5708; font-weight: 900; }
  td.verdict-missing { background: #f4f6f9 !important; color: #5e6979; font-weight: 900; }
  .summary-row td {
    height: 8mm;
    border-color: #3a4659;
    background: #2b374b !important;
    color: #fff;
    font-size: 8px;
    font-weight: 850;
  }
  .density-compact table { font-size: 7.6px; }
  .density-compact th { font-size: 7px; }
  .density-dense table { font-size: 6.8px; }
  .density-dense th { font-size: 6.3px; }
  .report-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6mm;
    margin-top: auto;
    padding-top: 3mm;
    border-top: 0.3mm solid #cbd4e0;
    color: #657187;
    font-size: 7.4px;
    font-weight: 700;
  }
  .report-footer__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4mm;
  }
  .report-footer__page {
    flex: 0 0 auto;
    color: #354157;
    font-weight: 850;
  }
  @media print {
    body { background: #fff; }
    .score-report-page { margin: 0; }
  }
`;

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

export type ScorePdfParams = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta;
  sessionTitle: string;
  lectureTitle: string;
  date?: string;
  attendanceMap?: Record<number, string>;
  tenantName?: string;
  tenantCode?: string;
  tenantLogoUrl?: string;
  primaryColor?: string;
};

function resolveDate(date?: string): string {
  return date || new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\. /g, ". ");
}

function fmtScore(score: number | null | undefined): string {
  if (score == null) return "-";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function passText(passed: boolean | null | undefined): string {
  if (passed == null) return "-";
  return passed ? "O" : "X";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFilenamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function chunkRows(rows: SessionScoreRow[]): SessionScoreRow[][] {
  if (rows.length === 0) return [[]];
  const chunks: SessionScoreRow[][] = [];
  for (let index = 0; index < rows.length; index += ROWS_PER_PAGE) {
    chunks.push(rows.slice(index, index + ROWS_PER_PAGE));
  }
  return chunks;
}

export function getScorePdfPageCount(params: Pick<ScorePdfParams, "rows">): number {
  return chunkRows(params.rows).length;
}

function buildBrandIdentity(params: ScorePdfParams): string {
  const theme = resolveStudentScoreReportTheme({
    tenantCode: params.tenantCode,
    primaryColor: params.primaryColor,
    logoUrl: params.tenantLogoUrl,
  });
  const tenantName = params.tenantName?.trim() || "Academy";
  const mark = Array.from(tenantName)[0]?.toLocaleUpperCase("ko-KR") || "A";
  const logo = theme.logoUrl
    ? `<img class="report-brand-logo" src="${escapeHtml(theme.logoUrl)}" alt="" crossorigin="anonymous" onerror="this.remove()" />`
    : "";
  return `
    <div class="report-brand">
      <span class="report-brand-symbol"><span>${escapeHtml(mark)}</span>${logo}</span>
      <span class="report-brand-copy">
        <strong>${escapeHtml(tenantName)}</strong>
        <span>ACADEMIC SCORE RECORD</span>
      </span>
    </div>
  `;
}

function buildTableHeader(params: ScorePdfParams, hasAttendance: boolean): string {
  const exams = params.meta.exams ?? [];
  const homeworks = params.meta.homeworks ?? [];
  const groupCells = [
    '<th class="group-header" rowspan="2" style="width:9mm">No</th>',
    '<th class="group-header" rowspan="2" style="width:24mm">이름</th>',
    hasAttendance ? '<th class="group-header" rowspan="2" style="width:13mm">출결</th>' : "",
    exams.length > 0 ? `<th class="group-header" colspan="${exams.length * 2}">시험</th>` : "",
    homeworks.length > 0 ? `<th class="group-header" colspan="${homeworks.length}">과제</th>` : "",
    '<th class="group-header" rowspan="2" style="width:15mm">판정</th>',
  ].join("");
  const detailCells = [
    ...exams.flatMap((exam) => [
      `<th>${escapeHtml(exam.title)}<small>${fmtScore(exam.max_score)}점</small></th>`,
      '<th style="width:9mm">P/F</th>',
    ]),
    ...homeworks.map(
      (homework) =>
        `<th>${escapeHtml(homework.title)}<small>${fmtScore(homework.max_score)}점</small></th>`,
    ),
  ].join("");
  return `<thead><tr>${groupCells}</tr><tr>${detailCells}</tr></thead>`;
}

function buildBodyRows(
  rows: SessionScoreRow[],
  params: ScorePdfParams,
  indexOffset: number,
  hasAttendance: boolean,
): string {
  const exams = params.meta.exams ?? [];
  const homeworks = params.meta.homeworks ?? [];
  return rows.map((row, index) => {
    const cells = [
      `<td class="num">${indexOffset + index + 1}</td>`,
      `<td class="name">${escapeHtml(row.student_name)}</td>`,
    ];
    if (hasAttendance) {
      const status = params.attendanceMap?.[row.enrollment_id] ?? "";
      cells.push(`<td>${escapeHtml(ATTENDANCE_LABEL[status] ?? "-")}</td>`);
    }
    for (const exam of exams) {
      const entry = row.exams?.find((item) => item.exam_id === exam.exam_id);
      cells.push(
        entry?.block.score != null
          ? `<td class="num">${fmtScore(entry.block.score)}</td>`
          : '<td class="no-score">-</td>',
      );
      cells.push(
        entry?.block.score != null
          ? `<td class="num">${passText(entry.block.passed)}</td>`
          : '<td class="no-score">-</td>',
      );
    }
    for (const homework of homeworks) {
      const entry = row.homeworks?.find((item) => item.homework_id === homework.homework_id);
      cells.push(
        entry?.block.score != null
          ? `<td class="num">${fmtScore(entry.block.score)}</td>`
          : '<td class="no-score">-</td>',
      );
    }
    const verdict = getSessionScoresTableVerdict(row);
    const verdictMeta = verdict === "clinic_target"
      ? ["클리닉", "verdict-clinic"]
      : verdict === "review"
        ? ["검수 대기", "verdict-review"]
        : verdict === "incomplete"
          ? ["미입력", "verdict-missing"]
          : verdict === "fail"
            ? ["미달", "verdict-fail"]
            : verdict === "pass"
              ? ["통과", "verdict-pass"]
              : ["-", ""];
    cells.push(`<td class="${verdictMeta[1]}">${verdictMeta[0]}</td>`);
    return `<tr>${cells.join("")}</tr>`;
  }).join("");
}

function buildSummaryRow(params: ScorePdfParams, hasAttendance: boolean): string {
  const { rows, meta } = params;
  const cells = [`<td colspan="2" style="text-align:right">전체 ${rows.length}명</td>`];
  if (hasAttendance) cells.push("<td></td>");
  for (const exam of meta.exams ?? []) {
    const scores = rows
      .map((row) => row.exams?.find((item) => item.exam_id === exam.exam_id)?.block.score)
      .filter((score): score is number => score != null);
    const average = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null;
    const passed = rows.filter(
      (row) => row.exams?.find((item) => item.exam_id === exam.exam_id)?.block.passed === true,
    ).length;
    cells.push(`<td class="num">${average == null ? "-" : average.toFixed(1)}</td>`);
    cells.push(`<td class="num">${passed}/${scores.length}</td>`);
  }
  for (const homework of meta.homeworks ?? []) {
    const scores = rows
      .map((row) => row.homeworks?.find((item) => item.homework_id === homework.homework_id)?.block.score)
      .filter((score): score is number => score != null);
    const average = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null;
    cells.push(`<td class="num">${average == null ? "-" : average.toFixed(1)}</td>`);
  }
  const passed = rows.filter((row) => getSessionScoresTableVerdict(row) === "pass").length;
  cells.push(`<td class="num">${passed}/${rows.length}</td>`);
  return `<tr class="summary-row">${cells.join("")}</tr>`;
}

function buildSummaryBand(params: ScorePdfParams): string {
  const passed = params.rows.filter((row) => getSessionScoresTableVerdict(row) === "pass").length;
  const clinic = params.rows.filter((row) => getSessionScoresTableVerdict(row) === "clinic_target").length;
  const evaluationCount = (params.meta.exams?.length ?? 0) + (params.meta.homeworks?.length ?? 0);
  const passRate = params.rows.length > 0 ? Math.round((passed / params.rows.length) * 100) : 0;
  return `
    <div class="summary-band">
      <div class="summary-metric"><span>수강생</span><strong>${params.rows.length}명</strong></div>
      <div class="summary-metric"><span>평가 항목</span><strong>${evaluationCount}건</strong></div>
      <div class="summary-metric"><span>최종 통과</span><strong>${passed}명 · ${passRate}%</strong></div>
      <div class="summary-metric is-clinic"><span>클리닉 대상</span><strong>${clinic}명</strong></div>
    </div>
  `;
}

export function buildScorePdfHtml(params: ScorePdfParams): string {
  const theme = resolveStudentScoreReportTheme({
    tenantCode: params.tenantCode,
    primaryColor: params.primaryColor,
    logoUrl: params.tenantLogoUrl,
  });
  const pages = chunkRows(params.rows);
  const hasAttendance = Boolean(
    params.attendanceMap && Object.keys(params.attendanceMap).length > 0,
  );
  const columnCount = 3
    + ((params.meta.exams?.length ?? 0) * 2)
    + (params.meta.homeworks?.length ?? 0)
    + (hasAttendance ? 1 : 0);
  const density = columnCount > 12 ? "density-dense" : columnCount > 9 ? "density-compact" : "";
  const date = resolveDate(params.date);
  const tableHeader = buildTableHeader(params, hasAttendance);
  const pageMarkup = pages.map((pageRows, pageIndex) => {
    const isLastPage = pageIndex === pages.length - 1;
    return `
      <section class="score-report-page ${density}" data-score-report-page="${pageIndex + 1}">
        <header class="report-topline">
          ${buildBrandIdentity(params)}
          <span class="report-date"><span>출력일</span><strong>${escapeHtml(date)}</strong></span>
        </header>
        <main class="report-content">
          <div class="report-heading">
            <div>
              <h1>차시 성적 현황</h1>
              <p>점수·통과 여부·클리닉 판정을 한 장에서 확인합니다.</p>
            </div>
            <div class="report-heading__session">${escapeHtml(params.lectureTitle)} · ${escapeHtml(params.sessionTitle)}</div>
          </div>
          ${pageIndex === 0 ? buildSummaryBand(params) : ""}
          <div class="score-table-wrap">
            <table>
              ${tableHeader}
              <tbody>
                ${buildBodyRows(pageRows, params, pageIndex * ROWS_PER_PAGE, hasAttendance)}
                ${isLastPage ? buildSummaryRow(params, hasAttendance) : ""}
              </tbody>
            </table>
          </div>
          <footer class="report-footer">
            <span class="report-footer__legend">
              <span><b>O</b> 통과</span>
              <span><b>X</b> 미달</span>
              <span>평균은 점수가 입력된 학생 기준</span>
            </span>
            <span class="report-footer__page">${pageIndex + 1} / ${pages.length}쪽</span>
          </footer>
        </main>
      </section>
    `;
  }).join("");

  return `<!doctype html>
<html lang="ko" style="--score-report-primary:${theme.primary};--score-report-accent:${theme.accent};--score-report-on-primary:${theme.onPrimary}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.lectureTitle)} ${escapeHtml(params.sessionTitle)} 성적표</title>
    <style>${SCORE_REPORT_STYLE}</style>
  </head>
  <body data-score-report-page-count="${pages.length}">${pageMarkup}</body>
</html>`;
}

async function waitForReportDocument(doc: Document): Promise<void> {
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
  await new Promise((resolve) => window.setTimeout(resolve, 180));
}

export async function downloadScorePdf(params: ScorePdfParams): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:1123px;height:2400px;border:0;pointer-events:none;z-index:-1";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) throw new Error("성적표 미리보기 문서를 만들지 못했습니다.");
    doc.open();
    doc.write(buildScorePdfHtml(params));
    doc.close();
    await waitForReportDocument(doc);

    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".score-report-page"));
    if (pages.length === 0) throw new Error("PDF로 변환할 성적표 페이지가 없습니다.");
    const overflowed = pages.some(
      (page) => page.scrollHeight > page.clientHeight + 2 || page.scrollWidth > page.clientWidth + 2,
    );
    if (overflowed) {
      throw new Error("성적표 내용이 A4 범위를 넘어 PDF를 만들지 않았습니다.");
    }

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      // Stacked A4 nodes can make html2canvas inherit a later page's document
      // offset and crop its header. Capture each page at document origin.
      pages.forEach((candidate, candidateIndex) => {
        candidate.style.display = candidateIndex === pageIndex ? "flex" : "none";
      });
      page.style.margin = "0";
      const canvas = await html2canvas(page, {
        scale: 2.25,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: page.clientWidth,
        windowHeight: page.clientHeight,
      });
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("PDF 렌더링 결과가 비어 있습니다.");
      }
      if (pageIndex > 0) pdf.addPage();
      const imageData = canvas.toDataURL("image/png");
      pdf.addImage({
        imageData,
        format: "PNG",
        x: 0,
        y: 0,
        width: pdfWidth,
        height: pdfHeight,
        compression: "FAST",
      });
    }

    const filename = [
      "성적표",
      params.tenantName,
      params.lectureTitle,
      params.sessionTitle,
      resolveDate(params.date).replace(/[.\s/]/g, ""),
    ].filter(Boolean).map((part) => safeFilenamePart(String(part))).join("_");
    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
