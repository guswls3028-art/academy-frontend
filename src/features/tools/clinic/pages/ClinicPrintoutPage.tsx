// PATH: src/features/tools/clinic/pages/ClinicPrintoutPage.tsx
// 클리닉 대상자 인쇄물 도구 — iframe 기반 미리보기 (원본 CSS 100% 동일) + 데이터 복붙 파서 + PDF 다운로드

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { parseClinicData } from "../utils/clinicDataParser";
import {
  BASE_STYLE,
  htmlToPdfDownload,
  formatName,
} from "@/features/scores/utils/clinicPdfGenerator";

// ── 이름 목록 HTML 빌드 (clinicPdfGenerator 내부 함수와 동일) ──

function buildNameSingle(name: string): string {
  return `<div class="name-row single"><span class="checkbox">☐</span>${formatName(name)}</div>`;
}
function buildNameCell(name: string): string {
  return `<div class="name-cell"><span class="checkbox">☐</span>${formatName(name)}</div>`;
}
function buildNameItems(names: string[]): string {
  if (names.length <= 15) return names.map(buildNameSingle).join("\n");
  const rows: string[] = [];
  for (let i = 0; i < names.length; i += 2) {
    const c1 = buildNameCell(names[i]);
    const c2 = i + 1 < names.length ? buildNameCell(names[i + 1]) : '<div class="name-cell"></div>';
    rows.push(`<div class="name-row">${c1}${c2}</div>`);
  }
  return rows.join("\n");
}
function emptyCell(): string { return '<div class="empty-item">해당 없음</div>'; }

// ── 편집 가능 HTML 빌드 (BASE_STYLE 100% 사용 + contentEditable) ──

function buildEditableHtml(p: {
  both: string[]; examOnly: string[]; hwOnly: string[];
  sessionTitle: string; lectureTitle: string; date: string;
  schedule: string; totalPresent: number;
}): string {
  const clinicTotal = p.both.length + p.examOnly.length + p.hwOnly.length;
  const tipText = "아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.";

  const scheduleContent = p.schedule
    ? `<div class="schedule-content" contenteditable="true" data-field="schedule">${p.schedule.replace(/\n/g, "<br>")}</div>`
    : `<div class="schedule-content" contenteditable="true" data-field="schedule" data-placeholder="클리닉 일정을 입력하세요..."></div>`;

  const bothHtml = p.both.length > 0 ? buildNameItems(p.both) : "";
  const examHtml = p.examOnly.length > 0 ? buildNameItems(p.examOnly) : "";
  const hwHtml = p.hwOnly.length > 0 ? buildNameItems(p.hwOnly) : "";

  // 편집 가능 영역 스타일 + placeholder
  const editStyle = `
    [contenteditable]:hover { outline: 1px dashed #94a3b8; outline-offset: 2px; border-radius: 4px; cursor: text; }
    [contenteditable]:focus { outline: 2px solid #3b82f6; outline-offset: 2px; border-radius: 4px; background: #fefce8; }
    .sub [contenteditable] { display: inline; min-width: 40px; }
    [data-placeholder]:empty:before { content: attr(data-placeholder); color: #94a3b8; font-style: italic; }
    .name-list[contenteditable] { min-height: 40px; cursor: text; font-size: 20px; font-weight: 800; color: #0f172a; text-align: center; line-height: 1.3; letter-spacing: 0.5px; }
    .name-list[contenteditable]:empty:before { content: "해당 없음"; color: #94a3b8; font-size: 14px; font-weight: 500; padding: 7px 8px; display: flex; align-items: center; justify-content: center; }
    .name-list[contenteditable] div { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
  `;

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>클리닉 대상자 안내</title>
<style>${BASE_STYLE}${editStyle}</style></head><body>
<div class="page">
  <div class="header">
    <div class="badge">CLINIC</div>
    <h1>클리닉 대상자 안내</h1>
    <div class="sub"><span contenteditable="true" data-field="lectureTitle" data-placeholder="강의명">${p.lectureTitle}</span> &nbsp;|&nbsp; <span contenteditable="true" data-field="sessionTitle" data-placeholder="차시명">${p.sessionTitle}</span></div>
  </div>
  <div class="tip-box"><div class="icon">!</div><div class="text">${tipText}</div></div>
  <div class="columns">
    <div class="col"><div class="section-header both">시험+과제 미통과 <span class="cnt">(${p.both.length}명)</span></div><div class="name-list" contenteditable="true" data-field="both">${bothHtml}</div></div>
    <div class="col"><div class="section-header exam">시험 미통과 <span class="cnt">(${p.examOnly.length}명)</span></div><div class="name-list" contenteditable="true" data-field="examOnly">${examHtml}</div></div>
    <div class="col"><div class="section-header hw">과제 미통과 <span class="cnt">(${p.hwOnly.length}명)</span></div><div class="name-list" contenteditable="true" data-field="hwOnly">${hwHtml}</div></div>
  </div>
  <div class="schedule-box"><div class="schedule-title">클리닉 일정</div>${scheduleContent}</div>
  <div class="footer">
    <div class="footer-left">클리닉 대상 <strong>${clinicTotal}명</strong> / 전체 출석 <span contenteditable="true" data-field="totalPresent">${p.totalPresent ?? clinicTotal}</span>명</div>
    <div class="footer-right"><span contenteditable="true" data-field="date">${p.date}</span></div>
  </div>
</div></body></html>`;
}

// ── PDF 전용 이름 빌더 (html2canvas가 <span class="suffix"> 렌더링 실패 → 접미사 분리 안 함) ──

function buildPdfNameSingle(name: string): string {
  return `<div class="name-row single"><span class="checkbox">☐</span>${name}</div>`;
}
function buildPdfNameCell(name: string): string {
  return `<div class="name-cell"><span class="checkbox">☐</span>${name}</div>`;
}
function buildPdfNameItems(names: string[]): string {
  if (names.length <= 15) return names.map(buildPdfNameSingle).join("\n");
  const rows: string[] = [];
  for (let i = 0; i < names.length; i += 2) {
    const c1 = buildPdfNameCell(names[i]);
    const c2 = i + 1 < names.length ? buildPdfNameCell(names[i + 1]) : '<div class="name-cell"></div>';
    rows.push(`<div class="name-row">${c1}${c2}</div>`);
  }
  return rows.join("\n");
}

// ── PDF 전용 HTML 빌드 (contentEditable 없음, 원본과 100% 동일) ──

function buildPdfHtml(p: {
  both: string[]; examOnly: string[]; hwOnly: string[];
  sessionTitle: string; lectureTitle: string; date: string;
  schedule: string; totalPresent: number;
}): string {
  const clinicTotal = p.both.length + p.examOnly.length + p.hwOnly.length;
  const tipText = "아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.";
  const sub = [p.lectureTitle, p.sessionTitle].filter(Boolean).join(" &nbsp;|&nbsp; ");

  const scheduleContent = p.schedule
    ? `<div class="schedule-content">${p.schedule.replace(/\n/g, "<br>")}</div>`
    : `<div class="schedule-empty">아직 개설된 클리닉 일정이 없습니다.</div>`;

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>클리닉 대상자 안내</title>
<style>${BASE_STYLE}</style></head><body>
<div class="page">
  <div class="header"><div class="badge">CLINIC</div><h1>클리닉 대상자 안내</h1><div class="sub">${sub}</div></div>
  <div class="tip-box"><div class="icon">!</div><div class="text">${tipText}</div></div>
  <div class="columns">
    <div class="col"><div class="section-header both">시험+과제 미통과 <span class="cnt">(${p.both.length}명)</span></div><div class="name-list">${p.both.length > 0 ? buildPdfNameItems(p.both) : emptyCell()}</div></div>
    <div class="col"><div class="section-header exam">시험 미통과 <span class="cnt">(${p.examOnly.length}명)</span></div><div class="name-list">${p.examOnly.length > 0 ? buildPdfNameItems(p.examOnly) : emptyCell()}</div></div>
    <div class="col"><div class="section-header hw">과제 미통과 <span class="cnt">(${p.hwOnly.length}명)</span></div><div class="name-list">${p.hwOnly.length > 0 ? buildPdfNameItems(p.hwOnly) : emptyCell()}</div></div>
  </div>
  <div class="schedule-box"><div class="schedule-title">클리닉 일정</div>${scheduleContent}</div>
  <div class="footer"><div class="footer-left">클리닉 대상 <strong>${clinicTotal}명</strong> / 전체 출석 ${p.totalPresent ?? clinicTotal}명</div><div class="footer-right">${p.date}</div></div>
</div></body></html>`;
}

// ── 컴포넌트 ──

export default function ClinicPrintoutPage() {
  const [both, setBoth] = useState<string[]>([]);
  const [examOnly, setExamOnly] = useState<string[]>([]);
  const [hwOnly, setHwOnly] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  });
  const [schedule, setSchedule] = useState("");
  const [totalPresent, setTotalPresent] = useState(0);
  const [pasteText, setPasteText] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── iframe에 HTML 주입 ──

  const injectHtml = useCallback(() => {
    if (!iframeRef.current) return;
    const html = buildEditableHtml({
      both, examOnly, hwOnly, sessionTitle, lectureTitle, date, schedule, totalPresent,
    });
    const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [both, examOnly, hwOnly, sessionTitle, lectureTitle, date, schedule, totalPresent]);

  useEffect(() => { injectHtml(); }, [injectHtml]);

  // ── iframe에서 편집된 값 읽기 ──

  /** iframe DOM에서 현재 편집 상태를 직접 읽어 반환 (setState 없이) */
  const readIframeValues = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return null;

    const readNames = (field: string): string[] => {
      const el = doc.querySelector(`[data-field="${field}"]`);
      if (!el) return [];
      const text = (el as HTMLElement).innerText || el.textContent || "";
      return text.split("\n").map((l: string) => l.replace(/☐/g, "").trim()).filter(Boolean);
    };

    const readText = (field: string) => {
      const el = doc.querySelector(`[data-field="${field}"]`);
      return el?.textContent?.trim() || "";
    };

    const scheduleEl = doc.querySelector('[data-field="schedule"]');
    const scheduleText = scheduleEl
      ? scheduleEl.innerHTML.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim()
      : "";

    const tpText = readText("totalPresent");
    const tp = parseInt(tpText || "0", 10);

    return {
      both: readNames("both"),
      examOnly: readNames("examOnly"),
      hwOnly: readNames("hwOnly"),
      sessionTitle: readText("sessionTitle"),
      lectureTitle: readText("lectureTitle"),
      date: readText("date"),
      schedule: scheduleText,
      totalPresent: isNaN(tp) ? 0 : tp,
    };
  }, []);

  /** iframe 편집 값을 React state에 동기화 */
  const readIframeEdits = useCallback(() => {
    const vals = readIframeValues();
    if (!vals) return;
    setBoth(vals.both);
    setExamOnly(vals.examOnly);
    setHwOnly(vals.hwOnly);
    setSchedule(vals.schedule);
    setSessionTitle(vals.sessionTitle);
    setLectureTitle(vals.lectureTitle);
    setDate(vals.date);
    setTotalPresent(vals.totalPresent);
  }, [readIframeValues]);

  // ── 파싱 ──

  const generateFromText = useCallback((text: string) => {
    const r = parseClinicData(text);
    const total = r.both.length + r.examOnly.length + r.hwOnly.length;
    if (total === 0) { feedback.warning("파싱 가능한 학생 데이터를 찾지 못했습니다."); return; }
    setBoth(r.both);
    setExamOnly(r.examOnly);
    setHwOnly(r.hwOnly);
    if (r.sessionTitle) setSessionTitle(r.sessionTitle);
    if (r.lectureTitle) setLectureTitle(r.lectureTitle);
    if (r.date) setDate(r.date);
    setTotalPresent(r.totalPresent);
    feedback.success(`클리닉 대상자 ${total}명 파싱 완료`);
  }, []);

  const handlePaste = useCallback(() => {
    setTimeout(() => {
      const el = document.getElementById("clinic-paste-ta") as HTMLTextAreaElement | null;
      if (el) { setPasteText(el.value); generateFromText(el.value); }
    }, 0);
  }, [generateFromText]);

  // ── PDF 다운로드 ──

  const handleDownload = async () => {
    // iframe DOM에서 직접 현재 값을 읽음 (setState 클로저 문제 회피)
    const vals = readIframeValues();
    const bNames = vals?.both ?? both;
    const eNames = vals?.examOnly ?? examOnly;
    const hNames = vals?.hwOnly ?? hwOnly;
    const curSession = vals?.sessionTitle || sessionTitle;
    const curLecture = vals?.lectureTitle || lectureTitle;
    const curDate = vals?.date || date;
    const curSchedule = vals?.schedule || schedule;
    const curPresent = vals?.totalPresent ?? totalPresent;

    if (bNames.length + eNames.length + hNames.length === 0) {
      feedback.warning("학생 이름을 입력하세요.");
      return;
    }

    // state도 동기화
    setBoth(bNames); setExamOnly(eNames); setHwOnly(hNames);
    if (curSession) setSessionTitle(curSession);
    if (curLecture) setLectureTitle(curLecture);
    if (curDate) setDate(curDate);
    if (curSchedule) setSchedule(curSchedule);
    setTotalPresent(curPresent);

    setPdfLoading(true);
    try {
      const html = buildPdfHtml({
        both: bNames, examOnly: eNames, hwOnly: hNames,
        sessionTitle: curSession, lectureTitle: curLecture,
        date: curDate, schedule: curSchedule,
        totalPresent: curPresent ?? (bNames.length + eNames.length + hNames.length),
      });
      const fname = `클리닉대상자_${curSession || "인쇄물"}_${curDate.replace(/\//g, "")}.pdf`;
      await htmlToPdfDownload(html, fname);
      feedback.success("PDF 다운로드 완료");
    } catch {
      feedback.error("PDF 다운로드 실패");
    } finally {
      setPdfLoading(false);
    }
  };

  // ── 초기화 ──

  const handleReset = () => {
    setBoth([]); setExamOnly([]); setHwOnly([]);
    setSessionTitle(""); setLectureTitle(""); setDate(
      `${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(new Date().getDate()).padStart(2, "0")}`
    );
    setSchedule(""); setTotalPresent(0); setPasteText("");
  };

  const clinicTotal = both.length + examOnly.length + hwOnly.length;

  return (
    <div className="flex gap-4">
      {/* ── 좌측: iframe 미리보기 (원본 CSS 100% 동일) ── */}
      <div className="flex-1" style={{ background: "#e5e7eb", borderRadius: 8, padding: 16 }}>
        <div
          className="mx-auto bg-white shadow-lg"
          style={{ width: "210mm", minHeight: "297mm" }}
        >
          <iframe
            id="cprev"
            ref={iframeRef}
            title="클리닉 대상자 미리보기"
            style={{ width: "100%", minHeight: "297mm", border: "none" }}
          />
        </div>
      </div>

      {/* ── 우측: 데이터 입력 패널 ── */}
      <div
        className="w-[300px] flex-shrink-0 flex flex-col gap-3"
        style={{ position: "sticky", top: 16, alignSelf: "flex-start", maxHeight: "calc(100vh - 200px)" }}
      >
        <section className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 flex flex-col gap-3 flex-1 overflow-auto">
          <div className="text-sm font-semibold text-[var(--text-primary)]">데이터 붙여넣기</div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            성적 탭에서 표 전체를 복사하여 아래에 붙여넣으면 자동으로 클리닉 대상자를 분류합니다.
            미리보기에서 직접 편집도 가능합니다.
          </p>
          <textarea
            id="clinic-paste-ta"
            className="flex-1 rounded border border-[var(--border-divider)] px-3 py-2 text-xs font-mono leading-relaxed resize-none"
            style={{ minHeight: 200 }}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onPaste={handlePaste}
            placeholder={"성적 탭 데이터를 붙여넣으세요.\n\n또는 카테고리 형식:\n시험+과제: 이름1, 이름2\n시험: 이름3\n과제: 이름4, 이름5"}
          />
          <Button
            intent="primary"
            onClick={() => generateFromText(pasteText)}
            disabled={!pasteText.trim()}
          >
            생성
          </Button>
        </section>

        <div className="flex gap-2">
          <Button
            intent="primary"
            onClick={handleDownload}
            disabled={pdfLoading || clinicTotal === 0}
            className="flex-1"
          >
            {pdfLoading ? "생성 중..." : "PDF 다운로드"}
          </Button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-[var(--border-divider)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            초기화
          </button>
        </div>
      </div>
    </div>
  );
}
