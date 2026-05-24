// PATH: src/app_admin/domains/tools/problem-studio/utils/worksheetPdf.ts
// 문제 제작 스튜디오: 초안 → 학원 양식 PDF HTML/다운로드.

export type WorksheetAttachment = {
  id: string;
  name: string;
  dataUrl: string;
  pageLabel?: string;
};

export type WorksheetQuestion = {
  id: string;
  prompt: string;
  choices: string;
  answer: string;
  explanation: string;
  attachments: WorksheetAttachment[];
};

export type WorksheetDraft = {
  title: string;
  className: string;
  subject: string;
  date: string;
  teacher: string;
  instructions: string;
  questions: WorksheetQuestion[];
};

export type WorksheetPdfKind = "questions" | "answers" | "explanations";

const KIND_LABEL: Record<WorksheetPdfKind, string> = {
  questions: "문제지",
  answers: "정답표",
  explanations: "해설지",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textBlock(value: string): string {
  const lines = value.split(/\r?\n/).map((line) => line.trimEnd());
  return lines.map((line) => escapeHtml(line)).join("<br />");
}

function nonEmptyLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function renderMeta(draft: WorksheetDraft, kind: WorksheetPdfKind): string {
  const meta = [
    draft.subject ? `과목 ${draft.subject}` : "",
    draft.className ? `반 ${draft.className}` : "",
    draft.teacher ? `담당 ${draft.teacher}` : "",
    draft.date ? draft.date : "",
  ].filter(Boolean);

  return `
    <header class="sheet-header">
      <div>
        <p class="sheet-kicker">${KIND_LABEL[kind]}</p>
        <h1>${escapeHtml(draft.title || "문제지")}</h1>
      </div>
      <div class="student-box">
        <span>이름</span>
        <strong></strong>
      </div>
    </header>
    <div class="sheet-meta">
      ${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
    ${
      draft.instructions.trim()
        ? `<div class="instructions">${textBlock(draft.instructions)}</div>`
        : ""
    }
  `;
}

function renderAttachments(q: WorksheetQuestion): string {
  if (q.attachments.length === 0) return "";
  return `
    <div class="attachments">
      ${q.attachments.map((att) => `
        <figure class="scan-figure">
          <img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" />
          <figcaption>${escapeHtml(att.pageLabel || att.name)}</figcaption>
        </figure>
      `).join("")}
    </div>
  `;
}

function renderQuestion(q: WorksheetQuestion, index: number, kind: WorksheetPdfKind): string {
  const choices = nonEmptyLines(q.choices);
  const showAnswer = kind === "answers" || kind === "explanations";
  const showExplanation = kind === "explanations";

  return `
    <article class="question">
      <div class="question-head">
        <span class="q-number">${index + 1}</span>
        ${showAnswer && q.answer.trim() ? `<span class="q-answer">정답 ${escapeHtml(q.answer.trim())}</span>` : ""}
      </div>
      ${
        q.prompt.trim()
          ? `<div class="prompt">${textBlock(q.prompt)}</div>`
          : ""
      }
      ${kind !== "answers" ? renderAttachments(q) : ""}
      ${
        kind !== "answers" && choices.length > 0
          ? `<ol class="choices">${choices.map((choice) => `<li>${escapeHtml(choice)}</li>`).join("")}</ol>`
          : ""
      }
      ${
        showExplanation && q.explanation.trim()
          ? `<section class="explanation"><strong>해설</strong><p>${textBlock(q.explanation)}</p></section>`
          : ""
      }
    </article>
  `;
}

function renderAnswerTable(draft: WorksheetDraft): string {
  return `
    <section class="answer-grid">
      ${draft.questions.map((q, index) => `
        <div class="answer-cell">
          <span>${index + 1}</span>
          <strong>${escapeHtml(q.answer.trim() || "-")}</strong>
        </div>
      `).join("")}
    </section>
  `;
}

export function buildWorksheetPdfHtml(draft: WorksheetDraft, kind: WorksheetPdfKind): string {
  const questions = draft.questions.length > 0 ? draft.questions : [];
  const body = kind === "answers"
    ? renderAnswerTable(draft)
    : questions.map((q, index) => renderQuestion(q, index, kind)).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(buildWorksheetFilename(draft, kind))}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: "Pretendard", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .worksheet-doc {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      padding: 14mm 15mm 16mm;
    }
    .sheet-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 42mm;
      gap: 9mm;
      align-items: end;
      border-bottom: 0.55mm solid #111827;
      padding-bottom: 5mm;
    }
    .sheet-kicker {
      margin: 0 0 2mm;
      color: #2563eb;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0;
    }
    h1 {
      margin: 0;
      color: #111827;
      font-size: 27px;
      line-height: 1.18;
      font-weight: 900;
      letter-spacing: 0;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }
    .student-box {
      display: grid;
      grid-template-columns: 12mm minmax(0, 1fr);
      align-items: end;
      gap: 2mm;
      color: #111827;
      font-size: 13px;
      font-weight: 800;
    }
    .student-box strong {
      display: block;
      height: 9mm;
      border-bottom: 0.35mm solid #111827;
    }
    .sheet-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
      margin: 4mm 0 0;
      color: #374151;
      font-size: 11.5px;
      font-weight: 800;
    }
    .sheet-meta span {
      border: 0.25mm solid #cbd5e1;
      border-radius: 1.5mm;
      padding: 1.2mm 2.4mm;
      background: #f8fafc;
    }
    .instructions {
      margin-top: 4mm;
      padding: 3mm 3.5mm;
      border: 0.28mm solid #bfdbfe;
      border-left: 1.1mm solid #2563eb;
      background: #eff6ff;
      color: #1f2937;
      font-size: 12.5px;
      line-height: 1.58;
      font-weight: 700;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }
    .question {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-top: 7mm;
      padding-bottom: 5mm;
      border-bottom: 0.24mm solid #e5e7eb;
    }
    .question-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 3mm;
      margin-bottom: 3mm;
    }
    .q-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 8mm;
      height: 8mm;
      border-radius: 50%;
      background: #111827;
      color: #fff;
      font-size: 13px;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
    }
    .q-answer {
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 900;
    }
    .prompt {
      color: #111827;
      font-size: 14px;
      line-height: 1.72;
      font-weight: 700;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }
    .attachments {
      display: grid;
      gap: 3mm;
      margin-top: 3mm;
    }
    .scan-figure {
      margin: 0;
      border: 0.28mm solid #d1d5db;
      background: #fff;
      padding: 2mm;
      break-inside: avoid;
    }
    .scan-figure img {
      display: block;
      width: 100%;
      max-height: 170mm;
      object-fit: contain;
    }
    .scan-figure figcaption {
      margin-top: 1.5mm;
      color: #6b7280;
      font-size: 10px;
      font-weight: 700;
      text-align: right;
    }
    .choices {
      display: grid;
      gap: 1.6mm;
      margin: 4mm 0 0;
      padding-left: 8mm;
      color: #111827;
      font-size: 13.2px;
      line-height: 1.5;
      font-weight: 650;
    }
    .choices li {
      padding-left: 1mm;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }
    .explanation {
      margin-top: 4mm;
      padding: 3.2mm 3.5mm;
      border: 0.28mm solid #dbeafe;
      background: #f8fafc;
      break-inside: avoid;
    }
    .explanation strong {
      display: block;
      margin-bottom: 1.5mm;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 900;
    }
    .explanation p {
      margin: 0;
      color: #1f2937;
      font-size: 12.5px;
      line-height: 1.62;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }
    .answer-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 2.4mm;
      margin-top: 7mm;
    }
    .answer-cell {
      display: grid;
      grid-template-columns: 10mm minmax(0, 1fr);
      align-items: center;
      min-height: 12mm;
      border: 0.28mm solid #cbd5e1;
      background: #fff;
    }
    .answer-cell span {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: #f1f5f9;
      color: #111827;
      font-size: 12px;
      font-weight: 900;
      border-right: 0.28mm solid #cbd5e1;
      font-variant-numeric: tabular-nums;
    }
    .answer-cell strong {
      padding: 2mm;
      color: #1d4ed8;
      font-size: 13px;
      line-height: 1.35;
      font-weight: 900;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }
    .footer-note {
      margin-top: 8mm;
      padding-top: 3mm;
      border-top: 0.25mm solid #e5e7eb;
      color: #6b7280;
      font-size: 10.5px;
      font-weight: 700;
      text-align: right;
    }
    @media screen {
      body { background: #e5e7eb; }
      .worksheet-doc { box-shadow: 0 20px 70px rgba(15, 23, 42, 0.18); }
    }
    @media print {
      body { background: #fff; }
      .worksheet-doc { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="worksheet-doc">
    <section class="sheet">
      ${renderMeta(draft, kind)}
      ${body}
      <div class="footer-note">HakwonPlus 문제 제작 스튜디오</div>
    </section>
  </main>
</body>
</html>`;
}

const PREVIEW_STYLE = `
    @media screen {
      html, body {
        width: 100%;
        overflow-x: hidden;
      }
      body {
        background: #f8fafc;
      }
      .worksheet-doc {
        width: 100%;
        min-height: 0;
        box-shadow: none;
      }
      .sheet {
        width: 100%;
        min-height: 0;
        padding: 24px;
      }
      .sheet-header {
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
        padding-bottom: 18px;
      }
      h1 {
        font-size: 26px;
      }
      .student-box {
        width: min(220px, 100%);
      }
      .sheet-meta span {
        max-width: 100%;
      }
      .answer-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
`;

export function buildWorksheetPreviewHtml(draft: WorksheetDraft, kind: WorksheetPdfKind): string {
  return buildWorksheetPdfHtml(draft, kind).replace("</style>", `${PREVIEW_STYLE}\n  </style>`);
}

export function buildWorksheetFilename(draft: WorksheetDraft, kind: WorksheetPdfKind): string {
  const pieces = [
    draft.date || new Date().toISOString().slice(0, 10),
    draft.className || "반명",
    draft.title || "문제지",
    KIND_LABEL[kind],
  ];
  return `${pieces.join("_").replace(/[\\/:*?"<>|]+/g, "-")}.pdf`;
}

type Html2Canvas = (
  element: HTMLElement,
  options: {
    scale: number;
    useCORS: boolean;
    backgroundColor: string;
    logging: boolean;
    windowWidth: number;
    windowHeight: number;
  },
) => Promise<HTMLCanvasElement>;

type JsPdfInstance = {
  internal: {
    pageSize: {
      getWidth: () => number;
      getHeight: () => number;
    };
  };
  addImage: (imageData: string, format: "PNG", x: number, y: number, width: number, height: number) => void;
  addPage: () => void;
  save: (filename: string) => void;
};

type JsPdfCtor = new (options: {
  orientation: "portrait";
  unit: "mm";
  format: "a4";
}) => JsPdfInstance;

function waitForDocument(doc: Document): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (doc.readyState === "complete") resolve();
      else window.setTimeout(check, 50);
    };
    check();
  });
}

async function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  await Promise.all(images.map(async (img) => {
    if (img.complete && img.naturalWidth > 0) return;
    try {
      await img.decode();
    } catch {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }
  }));
}

export async function downloadWorksheetPdf(draft: WorksheetDraft, kind: WorksheetPdfKind): Promise<void> {
  const html = buildWorksheetPdfHtml(draft, kind);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;pointer-events:none;z-index:-1";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) throw new Error("PDF 렌더링 문서를 만들 수 없습니다.");
    doc.open();
    doc.write(html);
    doc.close();
    await waitForDocument(doc);
    await doc.fonts?.ready;
    await waitForImages(doc);
    await new Promise((resolve) => window.setTimeout(resolve, 180));

    const [h2cMod, jpMod] = await Promise.all([
      // @ts-expect-error CDN dynamic import
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm"),
      // @ts-expect-error CDN dynamic import
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"),
    ]);
    const html2canvas = (h2cMod as { default: Html2Canvas }).default;
    const { jsPDF } = jpMod as { jsPDF: JsPdfCtor };

    const target = doc.querySelector(".worksheet-doc") as HTMLElement | null;
    if (!target) throw new Error("PDF 렌더링 대상을 찾을 수 없습니다.");

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const pageHeightPx = Math.floor(canvas.width * (pdfH / pdfW));
    const pageCanvas = document.createElement("canvas");
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) throw new Error("PDF 페이지 캔버스를 만들 수 없습니다.");
    pageCanvas.width = canvas.width;

    let pageIndex = 0;
    for (let y = 0; y < canvas.height; y += pageHeightPx) {
      const sliceHeight = Math.min(pageHeightPx, canvas.height - y);
      pageCanvas.height = sliceHeight;
      ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      if (pageIndex > 0) pdf.addPage();
      const imgData = pageCanvas.toDataURL("image/png");
      const drawHeight = (sliceHeight / canvas.width) * pdfW;
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, drawHeight);
      pageIndex += 1;
    }

    pdf.save(buildWorksheetFilename(draft, kind));
  } finally {
    document.body.removeChild(iframe);
  }
}

export function openWorksheetPrintWindow(draft: WorksheetDraft, kind: WorksheetPdfKind): void {
  const html = buildWorksheetPdfHtml(draft, kind);
  const win = window.open("", "_blank", "noopener,noreferrer,width=980,height=1100");
  if (!win) {
    throw new Error("인쇄 창을 열 수 없습니다. 브라우저 팝업 차단을 확인하세요.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    try {
      win.print();
    } catch {
      // print fallback is best-effort.
    }
  }, 400);
}
