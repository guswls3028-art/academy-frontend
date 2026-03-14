// PATH: src/features/scores/utils/clinicPdfGenerator.ts
// 성적 현황 PDF — 통과 + 클리닉 대상자 통합 4열 레이아웃

import type {
  SessionScoreRow,
  SessionScoreMeta,
} from "../api/sessionScores";

// ── 공통 ──

const BASE_STYLE = `
  @page { size: A4; margin: 10mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
    color: #1a1a2e; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page {
    width: 210mm; min-height: 297mm;
    margin: 0 auto; padding: 10mm 14mm;
    display: flex; flex-direction: column;
  }
  .header {
    text-align: center; margin-bottom: 8px;
    padding-bottom: 6px; border-bottom: 3px solid #16213e;
  }
  .header .badge {
    display: inline-block; background: #16213e; color: #fff;
    font-size: 9px; font-weight: 700; padding: 3px 12px;
    border-radius: 20px; letter-spacing: 1.5px; margin-bottom: 4px;
  }
  .header h1 { font-size: 22px; font-weight: 900; color: #16213e; margin-bottom: 2px; }
  .header .sub { font-size: 11px; color: #4a4a6a; font-weight: 600; }
  .tip-box {
    background: linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%);
    border: 2px solid #f59e0b; border-radius: 10px;
    padding: 8px 14px; margin-bottom: 8px;
    display: flex; align-items: center; gap: 10px;
  }
  .tip-box .icon {
    flex-shrink: 0; width: 24px; height: 24px;
    background: #f59e0b; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 13px; font-weight: 900;
  }
  .tip-box .text { font-size: 11px; color: #78350f; line-height: 1.5; font-weight: 700; }
  .columns { display: flex; gap: 6px; flex: 1; }
  .col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .section-header {
    text-align: center; padding: 6px 0; border-radius: 8px 8px 0 0;
    color: #fff; font-size: 12px; font-weight: 800;
  }
  .section-header.pass { background: #10b981; }
  .section-header.both { background: #7c3aed; }
  .section-header.exam { background: #dc2626; }
  .section-header.hw { background: #2563eb; }
  .section-header .cnt { font-weight: 400; font-size: 11px; opacity: 0.85; }
  .name-list {
    flex: 1; border: 2px solid #e5e7eb; border-top: none;
    border-radius: 0 0 8px 8px; padding: 4px 0;
  }
  .name-item {
    display: flex; align-items: center; justify-content: center;
    padding: 5px 6px; font-size: 16px; font-weight: 700;
    color: #16213e; border-bottom: 1px solid #f0f0f0; gap: 4px;
  }
  .name-item:last-child { border-bottom: none; }
  .name-item:nth-child(even) { background: #f9fafb; }
  .highlight { background: #fffbeb !important; }
  .star { color: #f59e0b; font-size: 14px; font-weight: 900; }
  .empty-item { color: #9ca3af; font-size: 13px; }
  .schedule-box {
    margin-top: 8px; padding: 8px 14px;
    border: 2px solid #16213e; border-radius: 10px;
    background: #f8fafc;
  }
  .schedule-title {
    font-size: 12px; font-weight: 800; color: #16213e;
    margin-bottom: 4px; letter-spacing: 0.5px;
  }
  .schedule-content { font-size: 13px; color: #1a1a2e; line-height: 1.7; font-weight: 600; }
  .footer {
    margin-top: 8px; padding-top: 6px; border-top: 3px solid #16213e;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .footer-left { font-size: 10px; color: #4a4a6a; line-height: 1.6; }
  .footer-right { text-align: right; font-size: 11px; font-weight: 700; color: #16213e; }
  @media print {
    body { background: #fff; }
    .page { padding: 0; width: 100%; min-height: auto; }
  }
`;

async function htmlToPdfDownload(html: string, filename: string) {
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
    import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm"),
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
  return attendanceMap
    ? rows.filter((r) => attendanceMap[r.enrollment_id] === "present")
    : rows;
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
  for (const e of meta.exams) passScoreMap.set(e.exam_id, e.pass_score);

  const passed: string[] = [];
  const both: ClinicStudent[] = [];
  const examOnly: ClinicStudent[] = [];
  const hwOnly: ClinicStudent[] = [];
  const almostNames: string[] = [];
  const filteredRows = filterPresent(rows, attendanceMap);

  for (const row of filteredRows) {
    const examFailed = row.exams.some((e) => e.block.passed === false);
    const hwFailed = row.homeworks.some((h) => h.block.passed === false);

    if (!examFailed && !hwFailed) {
      passed.push(row.student_name);
      continue;
    }

    let almostPassed = false;
    if (examFailed) {
      const failedExams = row.exams.filter((e) => e.block.passed === false);
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

function buildNameItems(students: ClinicStudent[]): string {
  return students.map((s) => {
    const cls = s.almostPassed ? ' class="name-item highlight"' : ' class="name-item"';
    const star = s.almostPassed ? ' <span class="star">★</span>' : "";
    return `<div${cls}>${s.name}${star}</div>`;
  }).join("\n");
}

function buildPassedItems(names: string[]): string {
  return names.map((n) => `<div class="name-item">${n}</div>`).join("\n");
}

function emptyCell(): string {
  return '<div class="name-item empty-item">해당 없음</div>';
}

function buildHtml(data: AnalysisResult, sessionTitle: string, lectureTitle: string, date: string, schedule?: string): string {
  const almostLine = data.almostNames.length > 0
    ? `★ 표시 학생(${data.almostNames.join(", ")})은 <strong>틀린 문제만 다시 풀어서 제출</strong>하면 통과! 별도 클리닉 수업 없이 자율 보정 처리`
    : "모든 클리닉 대상자는 해당 항목을 반드시 보완해 주세요.";

  const almostFooter = data.almostNames.length > 0
    ? `<span style="color:#d97706;">★ 근접 미달</span> 학생은 틀린 문제 보정 제출 시 통과 &nbsp;|&nbsp; `
    : "";

  const scheduleHtml = schedule
    ? `<div class="schedule-box"><div class="schedule-title">클리닉 시간표</div><div class="schedule-content">${schedule.replace(/\n/g, "<br>")}</div></div>`
    : "";

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>성적 현황 안내</title>
<style>${BASE_STYLE}</style></head><body>
<div class="page">
  <div class="header"><div class="badge">SCORE REPORT</div><h1>성적 현황 안내</h1><div class="sub">${sessionTitle} &nbsp;|&nbsp; ${lectureTitle}</div></div>
  <div class="tip-box"><div class="icon">!</div><div class="text">${almostLine}</div></div>
  <div class="columns">
    <div class="col"><div class="section-header pass">통과 <span class="cnt">(${data.passed.length}명)</span></div><div class="name-list">${data.passed.length > 0 ? buildPassedItems(data.passed) : emptyCell()}</div></div>
    <div class="col"><div class="section-header both">시험+과제 미통과 <span class="cnt">(${data.both.length}명)</span></div><div class="name-list">${data.both.length > 0 ? buildNameItems(data.both) : emptyCell()}</div></div>
    <div class="col"><div class="section-header exam">시험 미통과 <span class="cnt">(${data.examOnly.length}명)</span></div><div class="name-list">${data.examOnly.length > 0 ? buildNameItems(data.examOnly) : emptyCell()}</div></div>
    <div class="col"><div class="section-header hw">과제 미통과 <span class="cnt">(${data.hwOnly.length}명)</span></div><div class="name-list">${data.hwOnly.length > 0 ? buildNameItems(data.hwOnly) : emptyCell()}</div></div>
  </div>
  ${scheduleHtml}
  <div class="footer"><div class="footer-left">${almostFooter}통과 <strong>${data.passed.length}명</strong> / 클리닉 <strong>${data.clinicTotal}명</strong> / 현장 출석 ${data.totalStudents}명</div><div class="footer-right">${date}</div></div>
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

export async function downloadClinicPdf(params: ClinicPdfParams): Promise<void> {
  const { rows, meta, sessionTitle, lectureTitle, date, attendanceMap, schedule } = params;
  const data = analyze(rows, meta, attendanceMap);
  if (data.totalStudents === 0) { alert("출석 학생이 없습니다."); return; }
  const html = buildHtml(data, sessionTitle, lectureTitle, resolveDate(date), schedule);
  const filename = `클리닉현황_${lectureTitle}_${sessionTitle}_${resolveDate(date).replace(/[.\s/]/g, "")}.pdf`;
  await htmlToPdfDownload(html, filename);
}

export function getClinicStats(rows: SessionScoreRow[], meta: SessionScoreMeta, attendanceMap?: Record<number, string>) {
  const data = analyze(rows, meta, attendanceMap);
  return { clinicCount: data.clinicTotal, passedCount: data.passed.length, totalPresent: data.totalStudents };
}
