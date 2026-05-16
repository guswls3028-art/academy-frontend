// PATH: src/app_admin/domains/tools/clinic/pages/ClinicPrintoutPage.tsx
// 클리닉 대상자 인쇄물 도구 — iframe 기반 미리보기 (원본 CSS 100% 동일) + 데이터 복붙 파서 + PDF 다운로드

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Plus, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { parseClinicData } from "../utils/clinicDataParser";
import {
  BASE_STYLE,
  htmlToPdfDownload,
  formatName,
} from "@admin/domains/scores/utils/clinicPdfGenerator";

type ClinicCategory = "both" | "examOnly" | "hwOnly";
type ManualTarget = { name: string; category: ClinicCategory; note?: string };
type RemovedTarget = { name: string; category: ClinicCategory };

const CATEGORY_META: Record<ClinicCategory, { label: string; short: string }> = {
  both: { label: "시험+과제", short: "둘 다" },
  examOnly: { label: "시험", short: "시험" },
  hwOnly: { label: "과제", short: "과제" },
};
const CATEGORY_ORDER: ClinicCategory[] = ["both", "examOnly", "hwOnly"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripNameCellText(text: string): string {
  return text
    .replace(/[☐□]/g, "")
    .replace(/\[수동\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeNameFromLists(lists: Record<ClinicCategory, string[]>, name: string) {
  const target = name.trim();
  return {
    both: lists.both.filter((n) => n.trim() !== target),
    examOnly: lists.examOnly.filter((n) => n.trim() !== target),
    hwOnly: lists.hwOnly.filter((n) => n.trim() !== target),
  };
}

function findNameCategory(lists: Record<ClinicCategory, string[]>, name: string): ClinicCategory | null {
  const target = name.trim();
  for (const category of CATEGORY_ORDER) {
    if (lists[category].some((n) => n.trim() === target)) return category;
  }
  return null;
}

// ── 이름 목록 HTML 빌드 (clinicPdfGenerator 내부 함수와 동일) ──

function buildNameSingle(name: string, manualNames: Set<string>): string {
  const formatted = formatName(name);
  const manual = manualNames.has(name.trim());
  return `<div class="name-row single${manual ? " manual-name" : ""}"><span class="checkbox">☐</span><span class="name-text">${escapeHtml(formatted)}</span>${manual ? '<span class="manual-mark">[수동]</span>' : ""}</div>`;
}
function buildNameCell(name: string, manualNames: Set<string>): string {
  const formatted = formatName(name);
  const manual = manualNames.has(name.trim());
  return `<div class="name-cell${manual ? " manual-name" : ""}"><span class="checkbox">☐</span><span class="name-text">${escapeHtml(formatted)}</span>${manual ? '<span class="manual-mark">[수동]</span>' : ""}</div>`;
}
function buildNameItems(names: string[], manualNames: Set<string>): string {
  if (names.length <= 15) return names.map((name) => buildNameSingle(name, manualNames)).join("\n");
  const rows: string[] = [];
  for (let i = 0; i < names.length; i += 2) {
    const c1 = buildNameCell(names[i], manualNames);
    const c2 = i + 1 < names.length ? buildNameCell(names[i + 1], manualNames) : '<div class="name-cell"></div>';
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
  manualNames: string[];
}): string {
  const clinicTotal = p.both.length + p.examOnly.length + p.hwOnly.length;
  const manualNameSet = new Set(p.manualNames.map((n) => n.trim()).filter(Boolean));
  const manualCount = p.both.concat(p.examOnly, p.hwOnly).filter((name) => manualNameSet.has(name.trim())).length;
  const tipText = manualCount > 0
    ? "아래 학생들은 클리닉 수업 대상입니다. [수동] 표시는 선생님이 재량으로 지정한 대상입니다."
    : "아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.";

  const scheduleContent = p.schedule
    ? `<div class="schedule-content" contenteditable="true" data-field="schedule">${escapeHtml(p.schedule).replace(/\n/g, "<br>")}</div>`
    : `<div class="schedule-content" contenteditable="true" data-field="schedule" data-placeholder="클리닉 일정을 입력하세요..."></div>`;

  const bothHtml = p.both.length > 0 ? buildNameItems(p.both, manualNameSet) : "";
  const examHtml = p.examOnly.length > 0 ? buildNameItems(p.examOnly, manualNameSet) : "";
  const hwHtml = p.hwOnly.length > 0 ? buildNameItems(p.hwOnly, manualNameSet) : "";

  // 편집 가능 영역 스타일 + placeholder
  const editStyle = `
    [contenteditable]:hover { outline: 1px dashed #94a3b8; outline-offset: 2px; border-radius: 4px; cursor: text; }
    [contenteditable]:focus { outline: 2px solid #111827; outline-offset: 2px; border-radius: 4px; background: #f5f5f5; }
    .sub [contenteditable] { display: inline; min-width: 40px; }
    [data-placeholder]:empty:before { content: attr(data-placeholder); color: #737373; font-style: italic; }
    .name-list[contenteditable] { min-height: 40px; cursor: text; font-size: 20px; font-weight: 800; color: #0f172a; text-align: center; line-height: 1.3; }
    .name-list[contenteditable]:empty:before { content: "해당 없음"; color: #737373; font-size: 14px; font-weight: 500; padding: 7px 8px; display: flex; align-items: center; justify-content: center; }
  `;

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>클리닉 대상자 안내</title>
<style>${BASE_STYLE}${editStyle}</style></head><body>
<div class="page">
  <div class="header">
    <div class="badge">CLINIC</div>
    <h1>클리닉 대상자 안내</h1>
    <div class="sub"><span contenteditable="true" data-field="lectureTitle" data-placeholder="강의명">${escapeHtml(p.lectureTitle)}</span> &nbsp;|&nbsp; <span contenteditable="true" data-field="sessionTitle" data-placeholder="차시명">${escapeHtml(p.sessionTitle)}</span></div>
  </div>
  <div class="tip-box"><div class="icon">!</div><div class="text">${tipText}</div></div>
  <div class="columns">
    <div class="col"><div class="section-header both">시험+과제 미통과 <span class="cnt">(${p.both.length}명)</span></div><div class="name-list" contenteditable="true" data-field="both">${bothHtml}</div></div>
    <div class="col"><div class="section-header exam">시험 미통과 <span class="cnt">(${p.examOnly.length}명)</span></div><div class="name-list" contenteditable="true" data-field="examOnly">${examHtml}</div></div>
    <div class="col"><div class="section-header hw">과제 미통과 <span class="cnt">(${p.hwOnly.length}명)</span></div><div class="name-list" contenteditable="true" data-field="hwOnly">${hwHtml}</div></div>
  </div>
  <div class="schedule-box"><div class="schedule-title">클리닉 일정</div>${scheduleContent}</div>
  <div class="footer">
    <div class="footer-left">클리닉 대상 <strong>${clinicTotal}명</strong> / 전체 출석 <span contenteditable="true" data-field="totalPresent">${p.totalPresent ?? clinicTotal}</span>명${manualCount > 0 ? ` / 수동 지정 ${manualCount}명` : ""}</div>
    <div class="footer-right"><span contenteditable="true" data-field="date">${escapeHtml(p.date)}</span></div>
  </div>
</div></body></html>`;
}

// ── PDF 전용 이름 빌더 (html2canvas가 <span class="suffix"> 렌더링 실패 → 접미사 분리 안 함) ──

function buildPdfNameSingle(name: string, manualNames: Set<string>): string {
  const manual = manualNames.has(name.trim());
  return `<div class="name-row single${manual ? " manual-name" : ""}"><span class="checkbox">☐</span><span class="name-text">${escapeHtml(name)}</span>${manual ? '<span class="manual-mark">[수동]</span>' : ""}</div>`;
}
function buildPdfNameCell(name: string, manualNames: Set<string>): string {
  const manual = manualNames.has(name.trim());
  return `<div class="name-cell${manual ? " manual-name" : ""}"><span class="checkbox">☐</span><span class="name-text">${escapeHtml(name)}</span>${manual ? '<span class="manual-mark">[수동]</span>' : ""}</div>`;
}
function buildPdfNameItems(names: string[], manualNames: Set<string>): string {
  if (names.length <= 15) return names.map((name) => buildPdfNameSingle(name, manualNames)).join("\n");
  const rows: string[] = [];
  for (let i = 0; i < names.length; i += 2) {
    const c1 = buildPdfNameCell(names[i], manualNames);
    const c2 = i + 1 < names.length ? buildPdfNameCell(names[i + 1], manualNames) : '<div class="name-cell"></div>';
    rows.push(`<div class="name-row">${c1}${c2}</div>`);
  }
  return rows.join("\n");
}

// ── PDF 전용 HTML 빌드 (contentEditable 없음, 원본과 100% 동일) ──

function buildPdfHtml(p: {
  both: string[]; examOnly: string[]; hwOnly: string[];
  sessionTitle: string; lectureTitle: string; date: string;
  schedule: string; totalPresent: number;
  manualNames: string[];
}): string {
  const clinicTotal = p.both.length + p.examOnly.length + p.hwOnly.length;
  const manualNameSet = new Set(p.manualNames.map((n) => n.trim()).filter(Boolean));
  const manualCount = p.both.concat(p.examOnly, p.hwOnly).filter((name) => manualNameSet.has(name.trim())).length;
  const tipText = manualCount > 0
    ? "아래 학생들은 클리닉 수업 대상입니다. [수동] 표시는 선생님이 재량으로 지정한 대상입니다."
    : "아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.";
  const sub = [p.lectureTitle, p.sessionTitle].filter(Boolean).map(escapeHtml).join(" &nbsp;|&nbsp; ");

  const scheduleContent = p.schedule
    ? `<div class="schedule-content">${escapeHtml(p.schedule).replace(/\n/g, "<br>")}</div>`
    : `<div class="schedule-empty">아직 개설된 클리닉 일정이 없습니다.</div>`;

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>클리닉 대상자 안내</title>
<style>${BASE_STYLE}</style></head><body>
<div class="page">
  <div class="header"><div class="badge">CLINIC</div><h1>클리닉 대상자 안내</h1><div class="sub">${sub}</div></div>
  <div class="tip-box"><div class="icon">!</div><div class="text">${tipText}</div></div>
  <div class="columns">
    <div class="col"><div class="section-header both">시험+과제 미통과 <span class="cnt">(${p.both.length}명)</span></div><div class="name-list">${p.both.length > 0 ? buildPdfNameItems(p.both, manualNameSet) : emptyCell()}</div></div>
    <div class="col"><div class="section-header exam">시험 미통과 <span class="cnt">(${p.examOnly.length}명)</span></div><div class="name-list">${p.examOnly.length > 0 ? buildPdfNameItems(p.examOnly, manualNameSet) : emptyCell()}</div></div>
    <div class="col"><div class="section-header hw">과제 미통과 <span class="cnt">(${p.hwOnly.length}명)</span></div><div class="name-list">${p.hwOnly.length > 0 ? buildPdfNameItems(p.hwOnly, manualNameSet) : emptyCell()}</div></div>
  </div>
  <div class="schedule-box"><div class="schedule-title">클리닉 일정</div>${scheduleContent}</div>
  <div class="footer"><div class="footer-left">클리닉 대상 <strong>${clinicTotal}명</strong> / 전체 출석 ${p.totalPresent ?? clinicTotal}명${manualCount > 0 ? ` / 수동 지정 ${manualCount}명` : ""}</div><div class="footer-right">${escapeHtml(p.date)}</div></div>
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
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState<ClinicCategory>("examOnly");
  const [manualNote, setManualNote] = useState("");
  const [excludeName, setExcludeName] = useState("");
  const [manualTargets, setManualTargets] = useState<ManualTarget[]>([]);
  const [removedTargets, setRemovedTargets] = useState<RemovedTarget[]>([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const manualNames = useMemo(() => manualTargets.map((target) => target.name), [manualTargets]);
  const currentTargets = useMemo(
    () => CATEGORY_ORDER.flatMap((category) => {
      const names = category === "both" ? both : category === "examOnly" ? examOnly : hwOnly;
      return names.map((name) => ({ name, category }));
    }),
    [both, examOnly, hwOnly],
  );
  // 명시적 redraw trigger — paste/reset 시에만 증가시켜 iframe 재작성.
  // 사용자의 contentEditable 편집 중에는 redraw가 일어나면 안 된다.
  const [redrawSeq, setRedrawSeq] = useState(0);
  // 최신 state를 inject 함수에서 ref로 읽기 (redraw effect의 stale closure 회피)
  const stateRef = useRef({ both, examOnly, hwOnly, sessionTitle, lectureTitle, date, schedule, totalPresent, manualNames });
  stateRef.current = { both, examOnly, hwOnly, sessionTitle, lectureTitle, date, schedule, totalPresent, manualNames };

  // ── iframe에 HTML 주입 ── mount + 명시적 redrawSeq 증가 시에만 호출.
  useEffect(() => {
    if (!iframeRef.current) return;
    const html = buildEditableHtml(stateRef.current);
    const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    // 편집 즉시 React state로 흘려보내기 → clinicTotal/다운로드 disabled 실시간 반영.
    const sync = () => {
      const f = iframeRef.current;
      const d = f?.contentDocument;
      if (!d) return;
      const readNames = (field: string): string[] => {
        const el = d.querySelector(`[data-field="${field}"]`);
        if (!el) return [];
        const cells = el.querySelectorAll(".name-cell, .name-row.single");
        if (cells.length > 0) {
          const names: string[] = [];
          cells.forEach((cell) => {
            const t = stripNameCellText(cell.textContent || "");
            if (t) names.push(t);
          });
          return names;
        }
        const text = (el as HTMLElement).innerText || el.textContent || "";
        return text.split("\n").map(stripNameCellText).filter(Boolean);
      };
      const readText = (field: string) => {
        const el = d.querySelector(`[data-field="${field}"]`);
        return el?.textContent?.trim() || "";
      };
      const scheduleEl = d.querySelector('[data-field="schedule"]');
      const scheduleText = scheduleEl
        ? scheduleEl.innerHTML.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim()
        : "";
      const tp = parseInt(readText("totalPresent") || "0", 10);
      setBoth(readNames("both"));
      setExamOnly(readNames("examOnly"));
      setHwOnly(readNames("hwOnly"));
      setSchedule(scheduleText);
      setSessionTitle(readText("sessionTitle"));
      setLectureTitle(readText("lectureTitle"));
      setDate(readText("date"));
      setTotalPresent(isNaN(tp) ? 0 : tp);
    };
    doc.addEventListener("input", sync);
    doc.addEventListener("blur", sync, true);
    return () => {
      doc.removeEventListener("input", sync);
      doc.removeEventListener("blur", sync, true);
    };
  }, [redrawSeq]);

  // ── iframe에서 편집된 값 읽기 ──

  /** iframe DOM에서 현재 편집 상태를 직접 읽어 반환 (setState 없이) */
  const readIframeValues = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return null;

    const readNames = (field: string): string[] => {
      const el = doc.querySelector(`[data-field="${field}"]`);
      if (!el) return [];
      // name-cell 단위로 읽어야 함 — innerText + split("\n")은
      // display:flex 내부의 <span class="suffix">가 별도 줄로 분리되는 버그 발생
      const cells = el.querySelectorAll(".name-cell, .name-row.single");
      if (cells.length > 0) {
        const names: string[] = [];
        cells.forEach((cell) => {
          const t = stripNameCellText(cell.textContent || "");
          if (t) names.push(t);
        });
        return names;
      }
      // 사용자가 contenteditable에서 직접 편집한 경우 fallback
      const text = (el as HTMLElement).innerText || el.textContent || "";
      return text.split("\n").map(stripNameCellText).filter(Boolean);
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

  const getCurrentLists = useCallback(() => {
    const vals = readIframeValues();
    return {
      both: vals?.both ?? both,
      examOnly: vals?.examOnly ?? examOnly,
      hwOnly: vals?.hwOnly ?? hwOnly,
    };
  }, [both, examOnly, hwOnly, readIframeValues]);

  const applyLists = useCallback((lists: Record<ClinicCategory, string[]>) => {
    setBoth(lists.both);
    setExamOnly(lists.examOnly);
    setHwOnly(lists.hwOnly);
    setRedrawSeq((s) => s + 1);
  }, []);

  const handleAddManualTarget = useCallback(() => {
    const name = manualName.trim();
    if (!name) {
      feedback.warning("수동 추가할 학생 이름을 입력하세요.");
      return;
    }

    const current = getCurrentLists();
    const withoutName = removeNameFromLists(current, name);
    const next = {
      ...withoutName,
      [manualCategory]: [...withoutName[manualCategory], name],
    };

    applyLists(next);
    setManualTargets((items) => [
      ...items.filter((item) => item.name.trim() !== name),
      { name, category: manualCategory, note: manualNote.trim() || undefined },
    ]);
    setRemovedTargets((items) => items.filter((item) => item.name.trim() !== name));
    setManualName("");
    setManualNote("");
    feedback.success(`${name} 학생을 ${CATEGORY_META[manualCategory].label} 대상에 추가했습니다.`);
  }, [applyLists, getCurrentLists, manualCategory, manualName, manualNote]);

  const handleExcludeTarget = useCallback((nameOverride?: string) => {
    const name = (nameOverride ?? excludeName).trim();
    if (!name) {
      feedback.warning("제외할 학생 이름을 입력하세요.");
      return;
    }

    const current = getCurrentLists();
    const category = findNameCategory(current, name);
    if (!category) {
      feedback.warning("현재 대상자 목록에서 찾지 못했습니다.");
      return;
    }

    applyLists(removeNameFromLists(current, name));
    setManualTargets((items) => items.filter((item) => item.name.trim() !== name));
    setRemovedTargets((items) => [
      ...items.filter((item) => item.name.trim() !== name),
      { name, category },
    ]);
    setExcludeName("");
    feedback.success(`${name} 학생을 이번 출력 대상에서 제외했습니다.`);
  }, [applyLists, excludeName, getCurrentLists]);

  // ── 파싱 ──

  const generateFromText = useCallback((text: string) => {
    const r = parseClinicData(text);
    const total = r.both.length + r.examOnly.length + r.hwOnly.length;
    if (total === 0) {
      feedback.warning(
        "데이터를 인식하지 못했습니다. 성적 탭에서 표 전체를 복사하거나, 입력란 안내된 카테고리 형식(예: \"시험: 홍길동, 김철수\") 또는 한 줄에 한 명씩 이름을 넣어주세요.",
      );
      return;
    }
    setBoth(r.both);
    setExamOnly(r.examOnly);
    setHwOnly(r.hwOnly);
    if (r.sessionTitle) setSessionTitle(r.sessionTitle);
    if (r.lectureTitle) setLectureTitle(r.lectureTitle);
    if (r.date) setDate(r.date);
    setTotalPresent(r.totalPresent);
    setManualTargets([]);
    setRemovedTargets([]);
    setManualName("");
    setManualNote("");
    setExcludeName("");
    setRedrawSeq((s) => s + 1);
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
        manualNames,
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
    setManualName(""); setManualNote(""); setExcludeName("");
    setManualTargets([]); setRemovedTargets([]);
    setRedrawSeq((s) => s + 1);
  };

  const clinicTotal = both.length + examOnly.length + hwOnly.length;
  const adjustmentTotal = manualTargets.length + removedTargets.length;

  return (
    <div className="flex gap-4">
      {/* ── 좌측: iframe 미리보기 (원본 CSS 100% 동일) ── */}
      <div className="flex-1 rounded-lg bg-slate-200 p-4">
        <div
          className="mx-auto min-h-[297mm] w-[210mm] bg-white shadow-lg"
        >
          <iframe
            id="cprev"
            ref={iframeRef}
            title="클리닉 대상자 미리보기"
            className="min-h-[297mm] w-full border-0"
          />
        </div>
      </div>

      {/* ── 우측: 데이터 입력 패널 ── */}
      <div
        className="sticky top-4 max-h-[calc(100vh-160px)] w-[340px] flex-shrink-0 self-start overflow-y-auto pr-0.5 flex flex-col gap-3"
      >
        <section className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">데이터 붙여넣기</div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            성적 탭에서 표 전체를 복사하여 아래에 붙여넣으면 자동으로 클리닉 대상자를 분류합니다.
            미리보기에서 직접 편집도 가능합니다.
          </p>
          <textarea
            id="clinic-paste-ta"
            className="min-h-[180px] flex-1 rounded border border-[var(--border-divider)] px-3 py-2 text-xs font-mono leading-relaxed resize-none"
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

        <section className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <SlidersHorizontal size={16} />
              수동 조정
            </div>
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">
              {adjustmentTotal > 0 ? `${adjustmentTotal}건` : "대기"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">대상 추가</div>
            <div className="grid grid-cols-3 gap-1">
              {CATEGORY_ORDER.map((category) => {
                const active = manualCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setManualCategory(category)}
                    className={[
                      "rounded border px-2 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-[var(--border-divider)] bg-[var(--bg-surface)] text-[var(--text-secondary)]",
                    ].join(" ")}
                  >
                    {CATEGORY_META[category].short}
                  </button>
                );
              })}
            </div>
            <input
              className="rounded border border-[var(--border-divider)] px-3 py-2 text-sm"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddManualTarget();
              }}
              placeholder="학생 이름"
            />
            <input
              className="rounded border border-[var(--border-divider)] px-3 py-2 text-xs"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="메모"
            />
            <Button
              intent="primary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={handleAddManualTarget}
              disabled={!manualName.trim()}
            >
              수동 대상 추가
            </Button>
          </div>

          <div className="my-0.5 h-px bg-[var(--border-divider)]" />

          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">대상 제외</div>
            <input
              list="clinic-current-targets"
              className="rounded border border-[var(--border-divider)] px-3 py-2 text-sm"
              value={excludeName}
              onChange={(e) => setExcludeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExcludeTarget();
              }}
              placeholder="학생 이름"
            />
            <datalist id="clinic-current-targets">
              {currentTargets.map((target) => (
                <option key={`${target.category}-${target.name}`} value={target.name}>
                  {CATEGORY_META[target.category].label}
                </option>
              ))}
            </datalist>
            <Button
              intent="danger"
              size="sm"
              leftIcon={<X size={14} />}
              onClick={() => handleExcludeTarget()}
              disabled={!excludeName.trim()}
            >
              이번 출력에서 제외
            </Button>
            {currentTargets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentTargets.map((target) => (
                  <button
                    key={`${target.category}-${target.name}`}
                    type="button"
                    onClick={() => handleExcludeTarget(target.name)}
                    className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    title="이번 출력에서 제외"
                  >
                    {target.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {adjustmentTotal > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-[var(--border-divider)] pt-3">
              {manualTargets.map((target) => (
                <div key={`manual-${target.name}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-[var(--text-primary)]">
                    + {target.name} · {CATEGORY_META[target.category].label}
                    {target.note ? ` · ${target.note}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExcludeTarget(target.name)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="수동 추가 취소"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {removedTargets.map((target) => (
                <div key={`removed-${target.name}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-[var(--text-muted)]">
                    - {target.name} · {CATEGORY_META[target.category].label}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setManualName(target.name);
                      setManualCategory(target.category);
                      setRemovedTargets((items) => items.filter((item) => item.name !== target.name));
                    }}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="다시 추가 준비"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
