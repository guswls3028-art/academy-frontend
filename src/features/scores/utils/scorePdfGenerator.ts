// PATH: src/features/scores/utils/scorePdfGenerator.ts
// 성적 테이블 PDF — 흑백 최적화, A4 가로, 인쇄용

import type {
  SessionScoreRow,
  SessionScoreMeta,
} from "../api/sessionScores";

// ── 공통 스타일 (흑백 최적화) ──

const BW_STYLE = `
  @page { size: A4 landscape; margin: 8mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
    color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page {
    width: 100%; margin: 0 auto;
    display: flex; flex-direction: column;
  }
  .header {
    display: flex; justify-content: space-between; align-items: flex-end;
    margin-bottom: 6px; padding-bottom: 4px;
    border-bottom: 2px solid #000;
  }
  .header h1 { font-size: 16px; font-weight: 900; }
  .header .sub { font-size: 10px; color: #333; }
  .header .date { font-size: 10px; color: #333; text-align: right; }

  table {
    width: 100%; border-collapse: collapse;
    font-size: 10px; line-height: 1.3;
  }
  th, td {
    border: 1px solid #333; padding: 4px 6px;
    text-align: center; vertical-align: middle;
  }
  th {
    background: #e8e8e8; font-weight: 700;
    font-size: 9px; white-space: nowrap;
  }
  th.group-header {
    background: #d0d0d0; font-weight: 800;
    font-size: 10px; border-bottom: 2px solid #333;
  }
  td.name {
    text-align: left; font-weight: 600;
    white-space: nowrap; font-size: 11px;
    min-width: 60px;
  }
  td.num { font-variant-numeric: tabular-nums; }
  td.pass { font-weight: 700; }
  td.pass-y { }
  td.pass-n { font-weight: 800; text-decoration: underline; }
  td.no-score { color: #999; }
  td.attendance { font-size: 9px; }

  .footer {
    margin-top: 4px; padding-top: 3px; border-top: 1px solid #999;
    display: flex; justify-content: space-between;
    font-size: 9px; color: #666;
  }

  .summary-row td { background: #f0f0f0; font-weight: 700; }

  @media print {
    body { background: #fff; }
    .page { width: 100%; min-height: auto; }
  }
  @media screen {
    .page { max-width: 1100px; padding: 20px; }
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

// ── 빌드 ──

export type ScorePdfParams = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta;
  sessionTitle: string;
  lectureTitle: string;
  date?: string;
  attendanceMap?: Record<number, string>;
};

function resolveDate(date?: string) {
  return date || new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/\. /g, ". ");
}

function fmtScore(score: number | null | undefined): string {
  if (score == null) return "-";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function passText(passed: boolean | null | undefined): string {
  if (passed == null) return "";
  return passed ? "O" : "X";
}

export function buildScorePdfHtml(params: ScorePdfParams): string {
  const { rows, meta, sessionTitle, lectureTitle, date, attendanceMap } = params;

  const exams = meta.exams ?? [];
  const homeworks = meta.homeworks ?? [];
  const hasAttendance = attendanceMap && Object.keys(attendanceMap).length > 0;

  // 컬럼 수 계산 (번호 + 이름 + 출결 + 시험들 + 과제들 + 판정)
  const colCount = 2 + (hasAttendance ? 1 : 0) + exams.length * 2 + homeworks.length + 1;

  // Group headers
  let groupRow = "";
  groupRow += `<th class="group-header" rowspan="2" style="width:30px">No</th>`;
  groupRow += `<th class="group-header" rowspan="2" style="min-width:60px">이름</th>`;
  if (hasAttendance) groupRow += `<th class="group-header" rowspan="2" style="width:36px">출결</th>`;
  if (exams.length > 0) groupRow += `<th class="group-header" colspan="${exams.length * 2}">시험</th>`;
  if (homeworks.length > 0) groupRow += `<th class="group-header" colspan="${homeworks.length}">과제</th>`;
  groupRow += `<th class="group-header" rowspan="2" style="width:36px">판정</th>`;

  // Sub headers (exam title + pass, homework title)
  let subRow = "";
  for (const exam of exams) {
    const title = exam.title.length > 6 ? exam.title.slice(0, 6) + "…" : exam.title;
    subRow += `<th>${title}<br><span style="font-weight:400;font-size:8px">(${exam.max_score}점)</span></th>`;
    subRow += `<th style="width:24px">P/F</th>`;
  }
  for (const hw of homeworks) {
    const title = hw.title.length > 6 ? hw.title.slice(0, 6) + "…" : hw.title;
    subRow += `<th>${title}<br><span style="font-weight:400;font-size:8px">(${hw.max_score}점)</span></th>`;
  }

  // Body rows
  const bodyRows = rows.map((row, i) => {
    const cells: string[] = [];
    cells.push(`<td class="num">${i + 1}</td>`);
    cells.push(`<td class="name">${row.student_name}</td>`);

    if (hasAttendance) {
      const status = attendanceMap?.[row.enrollment_id] ?? "";
      cells.push(`<td class="attendance">${ATTENDANCE_LABEL[status] ?? "-"}</td>`);
    }

    // Exams
    for (const examMeta of exams) {
      const entry = row.exams?.find((e) => e.exam_id === examMeta.exam_id);
      if (entry && entry.block.score != null) {
        cells.push(`<td class="num">${fmtScore(entry.block.score)}</td>`);
        const passClass = entry.block.passed === false ? "pass pass-n" : "pass pass-y";
        cells.push(`<td class="${passClass}">${passText(entry.block.passed)}</td>`);
      } else {
        cells.push(`<td class="no-score">-</td>`);
        cells.push(`<td class="no-score">-</td>`);
      }
    }

    // Homeworks
    for (const hwMeta of homeworks) {
      const entry = row.homeworks?.find((h) => h.homework_id === hwMeta.homework_id);
      if (entry && entry.block.score != null) {
        cells.push(`<td class="num">${fmtScore(entry.block.score)}</td>`);
      } else {
        cells.push(`<td class="no-score">-</td>`);
      }
    }

    // 판정
    const allPassed = row.exams.every((e) => e.block.passed !== false)
      && row.homeworks.every((h) => h.block.passed !== false);
    const hasAnyScore = row.exams.some((e) => e.block.score != null)
      || row.homeworks.some((h) => h.block.score != null);
    let verdict = "-";
    if (hasAnyScore) verdict = allPassed ? "통과" : "미달";
    const verdictClass = verdict === "미달" ? "pass pass-n" : "pass";
    cells.push(`<td class="${verdictClass}">${verdict}</td>`);

    return `<tr>${cells.join("")}</tr>`;
  }).join("\n");

  // Summary row
  const summaryStats: string[] = [];
  summaryStats.push(`<td class="num" colspan="2" style="text-align:right">합계 ${rows.length}명</td>`);
  if (hasAttendance) summaryStats.push(`<td></td>`);
  for (const examMeta of exams) {
    const scores = rows.map((r) => r.exams?.find((e) => e.exam_id === examMeta.exam_id)?.block.score).filter((s): s is number => s != null);
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    summaryStats.push(`<td class="num">${avg != null ? avg.toFixed(1) : "-"}</td>`);
    const passCount = rows.filter((r) => r.exams?.find((e) => e.exam_id === examMeta.exam_id)?.block.passed === true).length;
    summaryStats.push(`<td class="num">${passCount}/${scores.length}</td>`);
  }
  for (const hwMeta of homeworks) {
    const scores = rows.map((r) => r.homeworks?.find((h) => h.homework_id === hwMeta.homework_id)?.block.score).filter((s): s is number => s != null);
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    summaryStats.push(`<td class="num">${avg != null ? avg.toFixed(1) : "-"}</td>`);
  }
  const totalPassed = rows.filter((r) =>
    r.exams.every((e) => e.block.passed !== false) && r.homeworks.every((h) => h.block.passed !== false)
    && (r.exams.some((e) => e.block.score != null) || r.homeworks.some((h) => h.block.score != null))
  ).length;
  summaryStats.push(`<td class="num">${totalPassed}/${rows.length}</td>`);

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>성적표 — ${lectureTitle} ${sessionTitle}</title>
<style>${BW_STYLE}</style></head><body>
<div class="page">
  <div class="header">
    <div><h1>${lectureTitle} — ${sessionTitle} 성적표</h1><div class="sub">${rows.length}명 | 시험 ${exams.length}건 · 과제 ${homeworks.length}건</div></div>
    <div class="date">${resolveDate(date)}</div>
  </div>
  <table>
    <thead>
      <tr>${groupRow}</tr>
      <tr>${subRow}</tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr class="summary-row">${summaryStats.join("")}</tr>
    </tbody>
  </table>
  <div class="footer">
    <span>평균 = 응시자 기준 | P/F = O 통과, X 미달 (밑줄)</span>
    <span>${resolveDate(date)} 출력</span>
  </div>
</div></body></html>`;
}

// ── Export ──

export function printScorePdf(params: ScorePdfParams): void {
  const html = buildScorePdfHtml(params);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const doPrint = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    }, 300);
  };
  iframe.onload = doPrint;
  if (doc.readyState === "complete") doPrint();
}
