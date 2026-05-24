// PATH: src/app_admin/domains/tools/problem-studio/utils/worksheetDocument.ts
// 문제 제작 스튜디오: 초안 → 한글/워드 호환 검수 문서(.doc) 다운로드.

import type { WorksheetDraft, WorksheetQuestion } from "./worksheetPdf";

export type HangulSourceFile = {
  name: string;
  kind: string;
  sizeLabel: string;
};

export type HangulDraftOptions = {
  sourceFiles: HangulSourceFile[];
  templateName?: string;
  variantLabel: string;
  notePolicy: string;
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
  return value
    .split(/\r?\n/)
    .map((line) => escapeHtml(line.trimEnd()))
    .join("<br />");
}

function nonEmptyLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function hasContent(q: WorksheetQuestion): boolean {
  return Boolean(q.prompt.trim() || q.choices.trim() || q.attachments.length > 0);
}

function renderQuestion(q: WorksheetQuestion, index: number): string {
  const choices = nonEmptyLines(q.choices);
  const noteNumber = index + 1;
  return `
    <section class="question">
      <p class="question-title">
        <strong>${noteNumber}.</strong>
        <a class="endnote-ref" href="#_edn${noteNumber}" name="_ednref${noteNumber}"><sup>[${noteNumber}]</sup></a>
      </p>
      ${q.prompt.trim() ? `<p class="prompt">${textBlock(q.prompt)}</p>` : "<p class=\"prompt muted\">원본에서 추출된 문제 이미지 또는 텍스트가 들어갑니다.</p>"}
      ${
        q.attachments.length > 0
          ? `<div class="attachments">${q.attachments.map((att) => `
              <figure>
                <img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" />
                <figcaption>${escapeHtml(att.pageLabel || att.name)}</figcaption>
              </figure>
            `).join("")}</div>`
          : ""
      }
      ${
        choices.length > 0
          ? `<ol class="choices">${choices.map((choice) => `<li>${escapeHtml(choice)}</li>`).join("")}</ol>`
          : ""
      }
    </section>
  `;
}

function renderEndnote(q: WorksheetQuestion, index: number): string {
  const noteNumber = index + 1;
  const answer = q.answer.trim() || "검수 필요";
  const explanation = q.explanation.trim() || "교과서 개념 중심의 짧은 해설을 입력합니다.";
  return `
    <p class="endnote-text">
      <a href="#_ednref${noteNumber}" name="_edn${noteNumber}"><sup>[${noteNumber}]</sup></a>
      <strong>정답</strong> ${escapeHtml(answer)}
      <br />
      <strong>해설</strong> ${textBlock(explanation)}
    </p>
  `;
}

function buildHangulDraftHtml(draft: WorksheetDraft, options: HangulDraftOptions): string {
  const questions = draft.questions.filter(hasContent);
  const safeQuestions = questions.length > 0 ? questions : draft.questions;
  const sourceRows = options.sourceFiles.length > 0
    ? options.sourceFiles.map((file) => `
        <tr>
          <td>${escapeHtml(file.name)}</td>
          <td>${escapeHtml(file.kind)}</td>
          <td>${escapeHtml(file.sizeLabel)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="3">소스 파일 미등록</td></tr>`;

  return `<!doctype html>
<html lang="ko" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(buildHangulDraftFilename(draft))}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    body {
      margin: 0;
      color: #111827;
      font-family: "Malgun Gothic", "맑은 고딕", "Batang", "바탕", serif;
      font-size: 10.5pt;
      line-height: 1.55;
    }
    h1 {
      margin: 0 0 8pt;
      padding-bottom: 8pt;
      border-bottom: 1.5pt solid #111827;
      font-size: 20pt;
      line-height: 1.25;
    }
    h2 {
      margin: 18pt 0 8pt;
      font-size: 13pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0 14pt;
    }
    th, td {
      border: 0.5pt solid #cbd5e1;
      padding: 5pt 6pt;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #eef2ff;
      font-weight: 700;
    }
    .meta {
      margin: 0 0 12pt;
      color: #374151;
    }
    .policy {
      padding: 8pt 10pt;
      border-left: 3pt solid #2563eb;
      background: #eff6ff;
      margin-bottom: 14pt;
    }
    .question {
      margin: 0 0 15pt;
      page-break-inside: avoid;
    }
    .question-title {
      margin: 0 0 4pt;
      font-weight: 700;
    }
    .prompt {
      margin: 0 0 7pt;
    }
    .muted {
      color: #6b7280;
    }
    .choices {
      margin: 4pt 0 0 18pt;
      padding: 0;
    }
    .attachments figure {
      margin: 6pt 0;
      page-break-inside: avoid;
    }
    .attachments img {
      display: block;
      max-width: 100%;
      max-height: 210mm;
    }
    .attachments figcaption {
      margin-top: 3pt;
      color: #6b7280;
      font-size: 8.5pt;
      text-align: right;
    }
    .endnotes {
      margin-top: 22pt;
      padding-top: 10pt;
      border-top: 1pt solid #111827;
      mso-element: endnote-list;
    }
    .endnote-text {
      margin: 0 0 7pt;
      mso-element: endnote;
    }
    .endnote-ref {
      color: #1d4ed8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(draft.title || "문제&정답지 초안")}</h1>
  <p class="meta">
    과목: ${escapeHtml(draft.subject || "-")} · 반명: ${escapeHtml(draft.className || "-")}
    · 담당: ${escapeHtml(draft.teacher || "-")} · 날짜: ${escapeHtml(draft.date || "-")}
  </p>
  <div class="policy">
    <strong>생성 기준</strong><br />
    ${escapeHtml(options.variantLabel)} · 정답과 해설은 문항 번호 미주 형태로 배치합니다.<br />
    ${escapeHtml(options.notePolicy)}
  </div>

  <h2>소스 자료</h2>
  <table>
    <thead><tr><th>파일명</th><th>유형</th><th>크기</th></tr></thead>
    <tbody>${sourceRows}</tbody>
  </table>
  <p class="meta">양식 기준: ${escapeHtml(options.templateName || "매치업 기존 양식 + 업로드 샘플 기준")}</p>

  <h2>문제</h2>
  ${safeQuestions.map((q, index) => renderQuestion(q, index)).join("")}

  <section class="endnotes">
    <h2>미주 - 정답 및 해설</h2>
    ${safeQuestions.map((q, index) => renderEndnote(q, index)).join("")}
  </section>
</body>
</html>`;
}

export function buildHangulDraftFilename(draft: WorksheetDraft): string {
  const pieces = [
    draft.date || new Date().toISOString().slice(0, 10),
    draft.className || "반명",
    draft.title || "문제정답지",
    "한글초안",
  ];
  return `${pieces.join("_").replace(/[\\/:*?"<>|]+/g, "-")}.doc`;
}

export function downloadHangulDraft(draft: WorksheetDraft, options: HangulDraftOptions): void {
  const html = buildHangulDraftHtml(draft, options);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildHangulDraftFilename(draft);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
