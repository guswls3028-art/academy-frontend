// PATH: src/app_admin/domains/scores/utils/clinicPdfGenerator.ts
// 클리닉 대상자 안내 PDF — 3열 레이아웃 (시험+과제 | 시험 | 과제 미통과)

import type {
  SessionScoreRow,
  SessionScoreMeta,
} from "../api/sessionScores";
import { feedback } from "@/shared/ui/feedback/feedback";

// ── 공통 ──

export const BASE_STYLE = `
  @page { size: A4; margin: 8mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Pretendard', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
    color: #0f172a; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page {
    width: 210mm; min-height: 297mm;
    margin: 0 auto; padding: 10mm 12mm;
    display: flex; flex-direction: column;
  }

  /* ── Header: Premium brand feel ── */
  .header {
    text-align: center; margin-bottom: 10px;
    padding: 12px 0 10px; border-bottom: 4px solid #0f172a;
    background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  }
  .header .badge {
    display: inline-block; background: #0f172a; color: #fff;
    font-size: 8px; font-weight: 800; padding: 3px 14px;
    border-radius: 20px; letter-spacing: 2.5px; margin-bottom: 6px;
    text-transform: uppercase;
  }
  .header h1 {
    font-size: 26px; font-weight: 900; color: #0f172a;
    margin-bottom: 3px; letter-spacing: -0.5px;
  }
  .header .sub {
    font-size: 12px; color: #475569; font-weight: 600;
    letter-spacing: 0.3px;
  }

  /* ── Tip box ── */
  .tip-box {
    background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
    border: 1.5px solid #eab308; border-radius: 8px;
    padding: 8px 14px; margin-bottom: 10px;
    display: flex; align-items: center; gap: 10px;
  }
  .tip-box .icon {
    flex-shrink: 0; width: 22px; height: 22px;
    background: #eab308; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 12px; font-weight: 900;
  }
  .tip-box .text {
    font-size: 11px; color: #713f12; line-height: 1.5; font-weight: 600;
  }

  /* ── Name columns: max visibility ── */
  .columns { display: flex; gap: 8px; flex: 1; }
  .col { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  .section-header {
    text-align: center; padding: 8px 0; border-radius: 10px 10px 0 0;
    color: #fff; font-size: 13px; font-weight: 800;
    letter-spacing: 0.5px;
  }
  .section-header.both { background: linear-gradient(135deg, #7c3aed, #6d28d9); }
  .section-header.exam { background: linear-gradient(135deg, #ef4444, #dc2626); }
  .section-header.hw { background: linear-gradient(135deg, #3b82f6, #2563eb); }
  .section-header .cnt {
    font-weight: 500; font-size: 11px; opacity: 0.9;
    margin-left: 4px;
  }

  .name-list {
    flex: 1; border: 2px solid #e2e8f0; border-top: none;
    border-radius: 0 0 10px 10px; padding: 3px 0;
  }

  /* ── Name rows ── */
  .name-row {
    display: flex; border-bottom: 1px solid #f1f5f9;
  }
  .name-row:last-child { border-bottom: none; }
  .name-row:nth-child(even) { background: #f8fafc; }

  /* 1명/줄 (15명 이하) */
  .name-row.single {
    padding: 8px 12px;
    font-size: 18px; font-weight: 700;
    color: #0f172a;
    line-height: 1.4; white-space: nowrap;
    text-align: center;
  }

  /* 2명/줄 (16명 이상) */
  .name-cell {
    flex: 1;
    padding: 6px 8px;
    font-size: 16px; font-weight: 700;
    color: #0f172a;
    line-height: 1.4;
    white-space: nowrap;
    text-align: center;
  }

  .checkbox {
    color: #94a3b8; margin-right: 6px;
    font-weight: 400;
  }
  .highlight { background: #fefce8 !important; }
  .star { color: #eab308; font-size: 16px; font-weight: 900; }
  .empty-item {
    display: flex; align-items: center; justify-content: center;
    padding: 7px 8px;
    color: #94a3b8; font-size: 14px; font-weight: 500;
  }

  /* ── Schedule box ── */
  .schedule-box {
    margin-top: 10px; padding: 10px 16px;
    border: 2px solid #0f172a; border-radius: 10px;
    background: linear-gradient(180deg, #f8fafc, #fff);
  }
  .schedule-title {
    font-size: 12px; font-weight: 800; color: #0f172a;
    margin-bottom: 4px; letter-spacing: 1px; text-transform: uppercase;
  }
  .schedule-content {
    font-size: 14px; color: #0f172a; line-height: 1.7; font-weight: 600;
  }
  .schedule-empty {
    font-size: 12px; color: #94a3b8; font-style: italic;
  }

  /* ── Footer: clean & professional ── */
  .footer {
    margin-top: 10px; padding-top: 8px;
    border-top: 4px solid #0f172a;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .footer-left {
    font-size: 11px; color: #475569; line-height: 1.6; font-weight: 500;
  }
  .footer-right {
    text-align: right; font-size: 12px; font-weight: 700;
    color: #0f172a; letter-spacing: 0.3px;
  }

  @media print {
    body { background: #fff; }
    .page { padding: 0; width: 100%; min-height: auto; }
  }
`;

export async function htmlToPdfDownload(html: string, filename: string) {
  // 1) hidden iframe 렌더
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:0;top:0;width:794px;height:1123px;opacity:0;pointer-events:none;z-index:-1";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    const check = () => { if (doc.readyState === "complete") resolve(); else setTimeout(check, 50); };
    check();
  });
  await new Promise((r) => setTimeout(r, 300));

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
  const pageEl = doc.querySelector(".page") as HTMLElement ?? doc.body;
  const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });

  // 4) PDF A4 세로
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL("image/png");
  const imgRatio = canvas.width / canvas.height;
  let drawW = pdfW;
  let drawH = pdfW / imgRatio;
  if (drawH > pdfH) { drawH = pdfH; drawW = pdfH * imgRatio; }
  pdf.addImage(imgData, "PNG", 0, 0, drawW, drawH);
  pdf.save(filename);

  document.body.removeChild(iframe);
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
  almostNames: string[];
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
  const almostNames: string[] = [];
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
    if (almostPassed) almostNames.push(row.student_name);
  }

  const sort = (arr: ClinicStudent[]) => arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  sort(both); sort(examOnly); sort(hwOnly);
  passed.sort((a, b) => a.localeCompare(b, "ko"));

  return {
    passed, both, examOnly, hwOnly, almostNames,
    clinicTotal: both.length + examOnly.length + hwOnly.length,
    totalStudents: filteredRows.length,
  };
}

// ── HTML 빌드 ──

/** 이름 포맷 — 접미사(A, B) 분리 없이 그대로 출력 */
export function formatName(name: string): string {
  return name;
}

function buildNameCell(s: ClinicStudent): string {
  const cls = s.almostPassed ? ' class="name-cell highlight"' : ' class="name-cell"';
  const star = s.almostPassed ? ' <span class="star">★</span>' : "";
  return `<div${cls}><span class="checkbox">☐</span>${formatName(s.name)}${star}</div>`;
}

function buildNameSingle(s: ClinicStudent): string {
  const cls = s.almostPassed ? ' class="name-row single highlight"' : ' class="name-row single"';
  const star = s.almostPassed ? ' <span class="star">★</span>' : "";
  return `<div${cls}><span class="checkbox">☐</span>${formatName(s.name)}${star}</div>`;
}

/** 15명 이하: 1명/줄 큰글씨, 16명 이상: 2명/줄 */
function buildNameItems(students: ClinicStudent[]): string {
  if (students.length <= 15) {
    return students.map((s) => buildNameSingle(s)).join("\n");
  }
  const rows: string[] = [];
  for (let i = 0; i < students.length; i += 2) {
    const cell1 = buildNameCell(students[i]);
    const cell2 = i + 1 < students.length ? buildNameCell(students[i + 1]) : '<div class="name-cell"></div>';
    rows.push(`<div class="name-row">${cell1}${cell2}</div>`);
  }
  return rows.join("\n");
}

function emptyCell(): string {
  return '<div class="empty-item">해당 없음</div>';
}

function buildHtml(data: AnalysisResult, sessionTitle: string, lectureTitle: string, date: string, schedule?: string): string {
  const tipText = data.almostNames.length > 0
    ? `아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.<br>★ 표시 학생은 보정 제출로 통과 가능합니다.`
    : "아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.";

  const scheduleContent = schedule
    ? `<div class="schedule-content">${schedule.replace(/\n/g, "<br>")}</div>`
    : `<div class="schedule-empty">아직 개설된 클리닉 일정이 없습니다.</div>`;

  const scheduleHtml = `<div class="schedule-box"><div class="schedule-title">클리닉 일정</div>${scheduleContent}</div>`;

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>클리닉 대상자 안내</title>
<style>${BASE_STYLE}</style></head><body>
<div class="page">
  <div class="header"><div class="badge">CLINIC</div><h1>클리닉 대상자 안내</h1><div class="sub">${sessionTitle} &nbsp;|&nbsp; ${lectureTitle}</div></div>
  <div class="tip-box"><div class="icon">!</div><div class="text">${tipText}</div></div>
  <div class="columns">
    <div class="col"><div class="section-header both">시험+과제 미통과 <span class="cnt">(${data.both.length}명)</span></div><div class="name-list">${data.both.length > 0 ? buildNameItems(data.both) : emptyCell()}</div></div>
    <div class="col"><div class="section-header exam">시험 미통과 <span class="cnt">(${data.examOnly.length}명)</span></div><div class="name-list">${data.examOnly.length > 0 ? buildNameItems(data.examOnly) : emptyCell()}</div></div>
    <div class="col"><div class="section-header hw">과제 미통과 <span class="cnt">(${data.hwOnly.length}명)</span></div><div class="name-list">${data.hwOnly.length > 0 ? buildNameItems(data.hwOnly) : emptyCell()}</div></div>
  </div>
  ${scheduleHtml}
  <div class="footer"><div class="footer-left">클리닉 대상 <strong>${data.clinicTotal}명</strong> / 전체 출석 ${data.totalStudents}명</div><div class="footer-right">${date}</div></div>
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

export function buildClinicPdfHtml(params: ClinicPdfParams): string {
  const { rows, meta, sessionTitle, lectureTitle, date, attendanceMap, schedule } = params;
  const data = analyze(rows, meta, attendanceMap);
  return buildHtml(data, sessionTitle, lectureTitle, resolveDate(date), schedule);
}

export async function downloadClinicPdf(params: ClinicPdfParams): Promise<void> {
  const { rows, meta, sessionTitle, lectureTitle, date, attendanceMap, schedule } = params;
  const data = analyze(rows, meta, attendanceMap);
  if (data.totalStudents === 0) { feedback.warning("출석 학생이 없습니다."); return; }
  const html = buildHtml(data, sessionTitle, lectureTitle, resolveDate(date), schedule);
  const filename = `클리닉현황_${lectureTitle}_${sessionTitle}_${resolveDate(date).replace(/[.\s/]/g, "")}.pdf`;
  await htmlToPdfDownload(html, filename);
}

export function getClinicStats(rows: SessionScoreRow[], meta: SessionScoreMeta, attendanceMap?: Record<number, string>) {
  const data = analyze(rows, meta, attendanceMap);
  return { clinicCount: data.clinicTotal, passedCount: data.passed.length, totalPresent: data.totalStudents };
}
