// 익명 성적 빌보드 PDF — 이름 없이 등수와 점수만 공개하는 게시용 순위표

import type {
  SessionScoreMeta,
  SessionScoreRow,
} from "../api/sessionScores";
import { feedback } from "@/shared/ui/feedback/feedback";

export type AnonymousBillboardEntry = {
  rank: number;
  score: number;
  maxScore: number;
};

export type AnonymousBillboardDocument = {
  lectureTitle: string;
  sessionTitle: string;
  date: string;
  examTitles: string[];
  totalMaxScore: number;
  averageScore: number;
  participantCount: number;
  rows: AnonymousBillboardEntry[];
};

export type AnonymousBillboardPdfParams = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta;
  sessionTitle: string;
  lectureTitle: string;
  date?: string;
  attendanceMap?: Record<number, string>;
};

export const BILLBOARD_PRINT_PAGE = {
  label: "A4 세로",
  jsPdfFormat: "a4",
  widthMm: 210,
  heightMm: 297,
  width: "210mm",
  height: "297mm",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveDate(date?: string) {
  return date || new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/\. /g, ". ");
}

function filterPresent(rows: SessionScoreRow[], attendanceMap?: Record<number, string>) {
  if (!attendanceMap || Object.keys(attendanceMap).length === 0) return rows;
  return rows.filter((row) => {
    const status = (attendanceMap[row.enrollment_id] ?? "").toUpperCase();
    return status === "PRESENT" || status === "ONLINE" || status === "SUPPLEMENT" || status === "LATE";
  });
}

function toFiniteScore(value: number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatScore(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatAverage(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function buildTitle(document: AnonymousBillboardDocument): string {
  if (document.examTitles.length === 1) return document.examTitles[0];
  return `${document.sessionTitle} 종합 순위표`;
}

function getPageSize(totalRows: number): number {
  if (totalRows <= 20) return 20;
  if (totalRows <= 32) return 32;
  return 36;
}

function getDensity(totalRows: number): "comfortable" | "compact" | "dense" {
  if (totalRows <= 20) return "comfortable";
  if (totalRows <= 32) return "compact";
  return "dense";
}

function chunkRows(rows: AnonymousBillboardEntry[], size: number) {
  const chunks: AnonymousBillboardEntry[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function renderScoreCell(entry: AnonymousBillboardEntry | undefined, side: "left" | "right") {
  if (!entry) {
    return `
      <td class="rank-cell rank-cell--empty"></td>
      <td class="score-cell score-cell--empty"></td>
    `;
  }
  return `
    <td class="rank-cell rank-cell--${side}">${entry.rank}</td>
    <td class="score-cell score-cell--${side}">${formatScore(entry.score)}</td>
  `;
}

function renderTableRows(entries: AnonymousBillboardEntry[]) {
  const leftCount = Math.ceil(entries.length / 2);
  const left = entries.slice(0, leftCount);
  const right = entries.slice(leftCount);
  return Array.from({ length: leftCount }, (_, index) => `
    <tr>
      ${renderScoreCell(left[index], "left")}
      ${renderScoreCell(right[index], "right")}
    </tr>
  `).join("");
}

function renderPage(
  document: AnonymousBillboardDocument,
  entries: AnonymousBillboardEntry[],
  index: number,
  pageCount: number,
  density: "comfortable" | "compact" | "dense",
) {
  const title = buildTitle(document);
  const examSummary = document.examTitles.length > 1
    ? document.examTitles.join(" · ")
    : document.sessionTitle;
  const pageLabel = pageCount > 1 ? `${index + 1} / ${pageCount}` : "";

  return `
    <section class="billboard-page billboard-page--${density}">
      <header class="billboard-header">
        <div class="billboard-kicker">
          <span>${escapeHtml(document.lectureTitle)}</span>
          <span>${escapeHtml(document.date)}</span>
        </div>
        <div class="billboard-title-row">
          <h1>${escapeHtml(title)}</h1>
          <div class="billboard-average">
            평균 : <strong>${formatAverage(document.averageScore)} / ${formatScore(document.totalMaxScore)}</strong> (점)
          </div>
        </div>
        <div class="billboard-sub-row">
          <span>${escapeHtml(examSummary)}</span>
          <span>응시 ${document.participantCount}명${pageLabel ? ` · ${pageLabel}` : ""}</span>
        </div>
      </header>
      <table class="billboard-table" aria-label="익명 성적 순위표">
        <thead>
          <tr>
            <th>등수</th>
            <th>점수</th>
            <th>등수</th>
            <th>점수</th>
          </tr>
        </thead>
        <tbody>
          ${renderTableRows(entries)}
        </tbody>
      </table>
      <footer class="billboard-footer">
        <span>익명 공개용</span>
        <span>동점은 공동 등수로 표시</span>
      </footer>
    </section>
  `;
}

export const BILLBOARD_BASE_STYLE = `
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${BILLBOARD_PRINT_PAGE.width}; min-height: ${BILLBOARD_PRINT_PAGE.height};
  }
  body {
    font-family: 'Pretendard', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
    color: #111827; background: #eef1f4;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .billboard-page {
    width: ${BILLBOARD_PRINT_PAGE.width}; height: ${BILLBOARD_PRINT_PAGE.height};
    margin: 0 auto 12px; padding: 14mm 15mm 12mm;
    display: flex; flex-direction: column;
    overflow: hidden; background: #fff;
  }
  .billboard-page:last-child { margin-bottom: 0; }
  .billboard-header {
    padding-bottom: 7mm; border-bottom: 0.5mm solid #111827;
  }
  .billboard-kicker {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8mm; color: #6b7280; font-size: 11px; font-weight: 800;
    letter-spacing: 0; line-height: 1.25;
  }
  .billboard-title-row {
    display: grid; grid-template-columns: minmax(0, 1fr) auto;
    gap: 8mm; align-items: end; margin-top: 4mm;
  }
  .billboard-title-row h1 {
    color: #111827; font-size: 28px; line-height: 1.14; font-weight: 900;
    letter-spacing: 0; word-break: keep-all; overflow-wrap: anywhere;
  }
  .billboard-average {
    min-width: 43mm; padding: 2.5mm 3.5mm;
    border: 0.35mm solid #111827; background: #f4f6f8;
    color: #111827; font-size: 14px; line-height: 1.2; font-weight: 800;
    text-align: center; white-space: nowrap;
  }
  .billboard-average strong { font-size: 18px; font-weight: 900; }
  .billboard-sub-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 6mm; margin-top: 3mm; color: #4b5563;
    font-size: 12px; line-height: 1.25; font-weight: 800;
    word-break: keep-all; overflow-wrap: anywhere;
  }
  .billboard-table {
    width: 100%; margin-top: 7mm; border-collapse: collapse; table-layout: fixed;
    border: 0.5mm solid #111827; flex: 1 1 auto;
  }
  .billboard-table th {
    background: #d9dee7; color: #111827; border: 0.35mm solid #111827;
    height: 10mm; font-size: 16px; line-height: 1; font-weight: 900;
    letter-spacing: 0; text-align: center;
  }
  .billboard-table td {
    border: 0.35mm solid #111827; text-align: center; vertical-align: middle;
    color: #111827; line-height: 1; font-weight: 900; letter-spacing: 0;
  }
  .rank-cell { width: 24%; background: #f8fafc; font-size: 33px; }
  .score-cell { width: 26%; background: #fff; font-size: 41px; }
  .rank-cell--empty, .score-cell--empty { background: #fff; }
  .billboard-page--comfortable .rank-cell { font-size: 38px; }
  .billboard-page--comfortable .score-cell { font-size: 48px; }
  .billboard-page--compact .rank-cell { font-size: 31px; }
  .billboard-page--compact .score-cell { font-size: 39px; }
  .billboard-page--dense .rank-cell { font-size: 27px; }
  .billboard-page--dense .score-cell { font-size: 35px; }
  .billboard-footer {
    display: flex; align-items: center; justify-content: space-between;
    gap: 6mm; padding-top: 4mm; color: #6b7280;
    font-size: 10px; line-height: 1.2; font-weight: 800;
  }
  @media print {
    body { background: #fff; }
    .billboard-page { margin: 0; }
  }
`;

export function buildAnonymousBillboardDocument(params: AnonymousBillboardPdfParams): AnonymousBillboardDocument {
  const exams = [...(params.meta.exams ?? [])].sort((a, b) => a.display_order - b.display_order);
  const totalMaxScore = exams.reduce((sum, exam) => sum + (toFiniteScore(exam.max_score) ?? 0), 0);
  const examIds = new Set(exams.map((exam) => exam.exam_id));

  const entries = filterPresent(params.rows, params.attendanceMap)
    .map((row, sourceIndex) => {
      const examsById = new Map((row.exams ?? []).map((exam) => [exam.exam_id, exam]));
      let score = 0;
      let hasScoredExam = false;
      for (const examId of examIds) {
        const examScore = toFiniteScore(examsById.get(examId)?.block?.score);
        if (examScore != null) {
          score += examScore;
          hasScoredExam = true;
        }
      }
      return hasScoredExam ? { sourceIndex, score } : null;
    })
    .filter((entry): entry is { sourceIndex: number; score: number } => entry != null)
    .sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex);

  let previousScore: number | null = null;
  let currentRank = 0;
  const rankedRows = entries.map((entry, index) => {
    if (previousScore == null || entry.score !== previousScore) {
      currentRank = index + 1;
      previousScore = entry.score;
    }
    return {
      rank: currentRank,
      score: entry.score,
      maxScore: totalMaxScore,
    };
  });

  const participantCount = rankedRows.length;
  const totalScore = rankedRows.reduce((sum, row) => sum + row.score, 0);

  return {
    lectureTitle: params.lectureTitle,
    sessionTitle: params.sessionTitle,
    date: resolveDate(params.date),
    examTitles: exams.map((exam) => exam.title),
    totalMaxScore,
    averageScore: participantCount > 0 ? totalScore / participantCount : 0,
    participantCount,
    rows: rankedRows,
  };
}

export function buildAnonymousBillboardHtml(document: AnonymousBillboardDocument): string {
  const perPage = getPageSize(document.rows.length);
  const density = getDensity(document.rows.length);
  const pages = chunkRows(document.rows, perPage);
  return `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(buildTitle(document))}</title>
  <style>${BILLBOARD_BASE_STYLE}</style>
</head>
<body>
  ${pages.map((entries, index) => renderPage(document, entries, index, pages.length, density)).join("")}
</body>
</html>`;
}

export function buildAnonymousBillboardPdfHtml(params: AnonymousBillboardPdfParams): string {
  return buildAnonymousBillboardHtml(buildAnonymousBillboardDocument(params));
}

type Html2Canvas = (element: HTMLElement, options: {
  scale: number;
  useCORS: boolean;
  backgroundColor: string;
  logging: boolean;
  windowWidth: number;
  windowHeight: number;
}) => Promise<HTMLCanvasElement>;

type JsPdfDocument = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addPage: () => void;
  addImage: (imageData: string, format: "PNG", x: number, y: number, width: number, height: number) => void;
  save: (filename: string) => void;
};

type JsPdfConstructor = new (options: {
  orientation: "portrait";
  unit: "mm";
  format: typeof BILLBOARD_PRINT_PAGE.jsPdfFormat;
}) => JsPdfDocument;

export async function htmlToBillboardPdfDownload(html: string, filename: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${BILLBOARD_PRINT_PAGE.width};height:${BILLBOARD_PRINT_PAGE.height};border:0;pointer-events:none;z-index:-1`;
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
    await new Promise((resolve) => setTimeout(resolve, 200));

    const [h2cMod, jpMod] = await Promise.all([
      // @ts-expect-error CDN dynamic import
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm"),
      // @ts-expect-error CDN dynamic import
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"),
    ]);
    const html2canvas = h2cMod.default as Html2Canvas;
    const { jsPDF } = jpMod as { jsPDF: JsPdfConstructor };

    const pageEls = Array.from(doc.querySelectorAll<HTMLElement>(".billboard-page"));
    if (pageEls.length === 0) return;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: BILLBOARD_PRINT_PAGE.jsPdfFormat });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    for (const [index, pageEl] of pageEls.entries()) {
      if (index > 0) pdf.addPage();
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: pageEl.scrollWidth,
        windowHeight: pageEl.scrollHeight,
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfW, pdfH);
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(iframe);
  }
}

export async function downloadAnonymousBillboardPdf(params: AnonymousBillboardPdfParams): Promise<boolean> {
  const document = buildAnonymousBillboardDocument(params);
  if (document.rows.length === 0) {
    feedback.warning("출력할 시험 점수가 없습니다.");
    return false;
  }
  const html = buildAnonymousBillboardHtml(document);
  const filenameDate = document.date.replace(/[.\s/]/g, "");
  const filename = `익명순위표_${params.lectureTitle}_${params.sessionTitle}_${filenameDate}.pdf`;
  await htmlToBillboardPdfDownload(html, filename);
  return true;
}

export function getAnonymousBillboardStats(
  rows: SessionScoreRow[],
  meta: SessionScoreMeta,
  attendanceMap?: Record<number, string>,
) {
  const document = buildAnonymousBillboardDocument({
    rows,
    meta,
    sessionTitle: "",
    lectureTitle: "",
    attendanceMap,
  });
  return {
    participantCount: document.participantCount,
    averageScore: document.averageScore,
    totalMaxScore: document.totalMaxScore,
  };
}
