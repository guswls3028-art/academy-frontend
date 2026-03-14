// PATH: src/features/scores/utils/clinicPdfGenerator.ts
// 클리닉 대상자 PDF 생성 — 성적 데이터 기반 자동 분류 + 인쇄용 HTML → print dialog

import type {
  SessionScoreRow,
  SessionScoreMeta,
} from "../api/sessionScores";

type ClinicStudent = {
  name: string;
  reason: "exam" | "homework" | "both";
  /** 60점대 등 pass_score 미만이지만 보정 통과 가능한 학생 */
  almostPassed: boolean;
};

type ClinicData = {
  both: ClinicStudent[];
  examOnly: ClinicStudent[];
  hwOnly: ClinicStudent[];
  almostNames: string[];
  total: number;
  totalStudents: number;
};

function analyzeClinic(
  rows: SessionScoreRow[],
  meta: SessionScoreMeta,
): ClinicData {
  const passScoreMap = new Map<number, number>();
  for (const e of meta.exams) passScoreMap.set(e.exam_id, e.pass_score);

  const both: ClinicStudent[] = [];
  const examOnly: ClinicStudent[] = [];
  const hwOnly: ClinicStudent[] = [];
  const almostNames: string[] = [];

  for (const row of rows) {
    const examFailed = row.exams.some((e) => e.block.passed === false);
    const hwFailed = row.homeworks.some((h) => h.block.passed === false);

    if (!examFailed && !hwFailed) continue;

    // 60점대 판정: pass_score 기준 10점 이내 미달이고 시험만 미통과
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

    const student: ClinicStudent = {
      name: row.student_name,
      reason,
      almostPassed,
    };

    if (reason === "both") both.push(student);
    else if (reason === "exam") examOnly.push(student);
    else hwOnly.push(student);

    if (almostPassed) almostNames.push(row.student_name);
  }

  // 가나다순 정렬
  const sort = (arr: ClinicStudent[]) => arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  sort(both);
  sort(examOnly);
  sort(hwOnly);

  return {
    both,
    examOnly,
    hwOnly,
    almostNames,
    total: both.length + examOnly.length + hwOnly.length,
    totalStudents: rows.length,
  };
}

function buildNameItems(students: ClinicStudent[]): string {
  return students
    .map((s) => {
      const cls = s.almostPassed ? ' class="name-item highlight"' : ' class="name-item"';
      const star = s.almostPassed ? ' <span class="star">★</span>' : "";
      return `<div${cls}>${s.name}${star}</div>`;
    })
    .join("\n        ");
}

function buildHtml(
  data: ClinicData,
  sessionTitle: string,
  lectureTitle: string,
  date: string,
): string {
  const almostLine =
    data.almostNames.length > 0
      ? `★ 표시 학생(${data.almostNames.join(", ")})은<br><strong>틀린 문제만 다시 풀어서 제출</strong>하면 통과!<br>별도 클리닉 수업 없이 자율 보정 처리`
      : "모든 클리닉 대상자는 해당 항목을 반드시 보완해 주세요.";

  const almostFooter =
    data.almostNames.length > 0
      ? `<span style="color:#d97706;">★ 근접 미달</span> 학생은 틀린 문제 보정 제출 시 통과 &nbsp;|&nbsp; `
      : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>클리닉 대상자 안내</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
    color: #1a1a2e;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm; height: 297mm;
    margin: 0 auto; padding: 10mm 14mm;
    overflow: hidden; display: flex; flex-direction: column;
  }
  .header {
    text-align: center; margin-bottom: 10px;
    padding-bottom: 8px; border-bottom: 3px solid #16213e;
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
    padding: 10px 16px; margin-bottom: 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .tip-box .icon {
    flex-shrink: 0; width: 26px; height: 26px;
    background: #f59e0b; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 14px; font-weight: 900;
  }
  .tip-box .text { font-size: 11px; color: #78350f; line-height: 1.5; font-weight: 700; }
  .columns { display: flex; gap: 10px; flex: 1; }
  .col { flex: 1; display: flex; flex-direction: column; }
  .section-header {
    text-align: center; padding: 7px 0; border-radius: 8px 8px 0 0;
    color: #fff; font-size: 13px; font-weight: 800;
  }
  .section-header.both { background: #7c3aed; }
  .section-header.exam { background: #dc2626; }
  .section-header.hw { background: #2563eb; }
  .section-header .cnt { font-weight: 400; font-size: 12px; opacity: 0.85; }
  .name-list {
    flex: 1; border: 2px solid #e5e7eb; border-top: none;
    border-radius: 0 0 8px 8px; padding: 6px 0;
  }
  .name-item {
    display: flex; align-items: center; justify-content: center;
    padding: 7px 10px; font-size: 18px; font-weight: 700;
    color: #16213e; border-bottom: 1px solid #f0f0f0; gap: 6px;
  }
  .name-item:last-child { border-bottom: none; }
  .name-item:nth-child(even) { background: #f9fafb; }
  .highlight { background: #fffbeb !important; }
  .star { color: #f59e0b; font-size: 16px; font-weight: 900; }
  .footer {
    margin-top: 10px; padding-top: 8px; border-top: 3px solid #16213e;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .footer-left { font-size: 10px; color: #4a4a6a; line-height: 1.6; }
  .footer-right { text-align: right; font-size: 11px; font-weight: 700; color: #16213e; }
  @media print {
    body { background: #fff; }
    .page { padding: 0; width: 100%; height: auto; overflow: visible; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="badge">CLINIC NOTICE</div>
    <h1>클리닉 대상자 안내</h1>
    <div class="sub">${sessionTitle} &nbsp;|&nbsp; ${lectureTitle}</div>
  </div>

  <div class="tip-box">
    <div class="icon">!</div>
    <div class="text">${almostLine}</div>
  </div>

  <div class="columns">
    <div class="col">
      <div class="section-header both">시험 + 과제 미통과 <span class="cnt">(${data.both.length}명)</span></div>
      <div class="name-list">
        ${data.both.length > 0 ? buildNameItems(data.both) : '<div class="name-item" style="color:#9ca3af;font-size:14px;">해당 없음</div>'}
      </div>
    </div>
    <div class="col">
      <div class="section-header exam">시험 미통과 <span class="cnt">(${data.examOnly.length}명)</span></div>
      <div class="name-list">
        ${data.examOnly.length > 0 ? buildNameItems(data.examOnly) : '<div class="name-item" style="color:#9ca3af;font-size:14px;">해당 없음</div>'}
      </div>
    </div>
    <div class="col">
      <div class="section-header hw">과제 미통과 <span class="cnt">(${data.hwOnly.length}명)</span></div>
      <div class="name-list">
        ${data.hwOnly.length > 0 ? buildNameItems(data.hwOnly) : '<div class="name-item" style="color:#9ca3af;font-size:14px;">해당 없음</div>'}
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-left">
      ${almostFooter}클리닉 대상 총 <strong>${data.total}명</strong> / 전체 ${data.totalStudents}명
    </div>
    <div class="footer-right">${date}</div>
  </div>
</div>
</body>
</html>`;
}

export function downloadClinicPdf(
  rows: SessionScoreRow[],
  meta: SessionScoreMeta,
  sessionTitle: string,
  lectureTitle: string,
  date?: string,
): void {
  const data = analyzeClinic(rows, meta);

  if (data.total === 0) {
    alert("클리닉 대상자가 없습니다.");
    return;
  }

  const today = date || new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\. /g, ". ");

  const html = buildHtml(data, sessionTitle, lectureTitle, today);

  // iframe으로 인쇄 다이얼로그 열기 (PDF 저장 선택 가능)
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "-9999px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // 렌더링 완료 대기 후 print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      // 인쇄 다이얼로그 닫힌 후 iframe 제거
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  };

  // onload가 이미 발생한 경우 대비
  if (doc.readyState === "complete") {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  }
}
