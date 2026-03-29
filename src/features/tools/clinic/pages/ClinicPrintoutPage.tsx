// PATH: src/features/tools/clinic/pages/ClinicPrintoutPage.tsx
// 클리닉 대상자 인쇄물 도구 — 편집 가능 미리보기 + 데이터 복붙 파서 + PDF 다운로드

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type KeyboardEvent } from "react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { parseClinicData } from "../utils/clinicDataParser";
import {
  BASE_STYLE,
  htmlToPdfDownload,
  formatName as formatNameHtml,
} from "@/features/scores/utils/clinicPdfGenerator";

// ── 타입 ──

type ColumnKey = "both" | "examOnly" | "hwOnly";

const COL_META: Record<ColumnKey, { label: string; cssClass: string }> = {
  both: { label: "시험+과제 미통과", cssClass: "both" },
  examOnly: { label: "시험 미통과", cssClass: "exam" },
  hwOnly: { label: "과제 미통과", cssClass: "hw" },
};

// ── 미리보기 스코프 CSS ──

const SCOPE = "cprev";

const PREVIEW_CSS = `
  #${SCOPE} {
    width: 794px; margin: 0 auto; padding: 38px 45px;
    background: #fff; font-family: 'Pretendard','Malgun Gothic','맑은 고딕',sans-serif;
    color: #0f172a;
    box-shadow: 0 2px 24px rgba(0,0,0,0.10);
  }
  #${SCOPE} .header {
    text-align: center; margin-bottom: 10px; padding: 12px 0 10px;
    border-bottom: 4px solid #0f172a;
    background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  }
  #${SCOPE} .badge {
    display: inline-block; background: #0f172a; color: #fff;
    font-size: 8px; font-weight: 800; padding: 3px 14px;
    border-radius: 20px; letter-spacing: 2.5px; margin-bottom: 6px;
    text-transform: uppercase;
  }
  #${SCOPE} .header h1 {
    font-size: 26px; font-weight: 900; color: #0f172a;
    margin: 0 0 3px; letter-spacing: -0.5px;
  }
  #${SCOPE} .sub { font-size: 12px; color: #475569; font-weight: 600; letter-spacing: 0.3px; }
  #${SCOPE} .edit-input {
    border: none; outline: none; background: transparent;
    font: inherit; color: inherit; text-align: center;
    border-bottom: 1px dashed transparent; transition: border-color 0.15s;
  }
  #${SCOPE} .edit-input:hover,
  #${SCOPE} .edit-input:focus { border-bottom-color: #94a3b8; }
  #${SCOPE} .edit-input::placeholder { color: #cbd5e1; }

  #${SCOPE} .tip-box {
    background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
    border: 1.5px solid #eab308; border-radius: 8px;
    padding: 8px 14px; margin-bottom: 10px;
    display: flex; align-items: center; gap: 10px;
  }
  #${SCOPE} .tip-icon {
    flex-shrink: 0; width: 22px; height: 22px;
    background: #eab308; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 12px; font-weight: 900;
  }
  #${SCOPE} .tip-text { font-size: 11px; color: #713f12; line-height: 1.5; font-weight: 600; }

  #${SCOPE} .columns { display: flex; gap: 8px; align-items: flex-start; }
  #${SCOPE} .col { flex: 1; min-width: 0; }

  #${SCOPE} .section-hdr {
    text-align: center; padding: 8px 0; border-radius: 10px 10px 0 0;
    color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.5px;
  }
  #${SCOPE} .section-hdr.both { background: linear-gradient(135deg, #7c3aed, #6d28d9); }
  #${SCOPE} .section-hdr.exam { background: linear-gradient(135deg, #ef4444, #dc2626); }
  #${SCOPE} .section-hdr.hw { background: linear-gradient(135deg, #3b82f6, #2563eb); }
  #${SCOPE} .section-hdr .cnt { font-weight: 500; font-size: 11px; opacity: 0.9; margin-left: 4px; }

  #${SCOPE} .name-list {
    border: 2px solid #e2e8f0; border-top: none;
    border-radius: 0 0 10px 10px; padding: 3px 0; min-height: 60px;
  }
  #${SCOPE} .name-row {
    display: flex; align-items: center; justify-content: center;
    padding: 7px 8px; border-bottom: 1px solid #f1f5f9;
    gap: 5px;
  }
  #${SCOPE} .name-row:last-child { border-bottom: none; }
  #${SCOPE} .name-row:nth-child(even) { background: #f8fafc; }
  #${SCOPE} .checkbox { font-size: 16px; color: #cbd5e1; font-weight: 400; line-height: 1; flex-shrink: 0; }
  #${SCOPE} .name-input {
    border: none; outline: none; background: transparent;
    font-size: 20px; font-weight: 800; color: #0f172a;
    text-align: center; width: 100%; letter-spacing: 0.5px;
    line-height: 1.3; padding: 0;
  }
  #${SCOPE} .name-input::placeholder { color: #e2e8f0; font-weight: 500; font-size: 14px; }
  #${SCOPE} .name-input:focus { background: #fefce8; border-radius: 4px; }
  #${SCOPE} .empty-hint {
    display: flex; align-items: center; justify-content: center;
    padding: 7px 8px; color: #94a3b8; font-size: 14px; font-weight: 500;
  }

  /* 2명/줄 (16명 이상) */
  #${SCOPE} .name-row-double { display: flex; border-bottom: 1px solid #f1f5f9; }
  #${SCOPE} .name-row-double:last-child { border-bottom: none; }
  #${SCOPE} .name-row-double:nth-child(even) { background: #f8fafc; }
  #${SCOPE} .name-cell {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 7px 8px; gap: 5px;
  }

  #${SCOPE} .schedule-box {
    margin-top: 10px; padding: 10px 16px;
    border: 2px solid #0f172a; border-radius: 10px;
    background: linear-gradient(180deg, #f8fafc, #fff);
  }
  #${SCOPE} .schedule-title {
    font-size: 12px; font-weight: 800; color: #0f172a;
    margin-bottom: 4px; letter-spacing: 1px; text-transform: uppercase;
  }
  #${SCOPE} .schedule-ta {
    font-size: 14px; color: #0f172a; line-height: 1.7; font-weight: 600;
    border: none; outline: none; background: transparent; width: 100%;
    resize: none; font-family: inherit; min-height: 28px;
    overflow: hidden; white-space: pre-wrap; word-wrap: break-word;
    padding: 4px 0;
  }
  #${SCOPE} .schedule-ta::placeholder { color: #94a3b8; font-style: italic; font-weight: 400; }
  #${SCOPE} .schedule-ta:focus { background: #f8fafc; border-radius: 4px; }
  #${SCOPE} .schedule-ta:hover { background: #f8fafc; border-radius: 4px; }

  #${SCOPE} .footer {
    margin-top: 10px; padding-top: 8px; border-top: 4px solid #0f172a;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  #${SCOPE} .footer-left { font-size: 11px; color: #475569; line-height: 1.6; font-weight: 500; }
  #${SCOPE} .footer-left strong { font-weight: 800; color: #0f172a; }
  #${SCOPE} .footer-right { text-align: right; }
  #${SCOPE} .date-input {
    border: none; outline: none; background: transparent;
    font-size: 12px; font-weight: 700; color: #0f172a;
    text-align: right; width: 100px; letter-spacing: 0.3px;
  }
  #${SCOPE} .date-input:focus { background: #f8fafc; border-radius: 4px; }
  #${SCOPE} .date-input::placeholder { color: #cbd5e1; }
  #${SCOPE} .total-input {
    border: none; outline: none; background: transparent;
    font-size: 11px; font-weight: 500; color: #475569;
    width: 30px; text-align: center;
  }
  #${SCOPE} .total-input:focus { background: #f8fafc; border-radius: 4px; }
`;

// ── PDF 빌드 (clinicPdfGenerator와 동일 출력) ──

function buildNameCell(name: string): string {
  return `<div class="name-cell"><span class="checkbox">&#9744;</span>${formatNameHtml(name)}</div>`;
}
function buildNameSingle(name: string): string {
  return `<div class="name-row single"><span class="checkbox">&#9744;</span>${formatNameHtml(name)}</div>`;
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

function buildPdfHtml(p: {
  both: string[]; examOnly: string[]; hwOnly: string[];
  sessionTitle: string; lectureTitle: string; date: string;
  schedule: string; totalPresent: number;
}): string {
  const clinicTotal = p.both.length + p.examOnly.length + p.hwOnly.length;
  const tipText = "아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.";
  const scheduleContent = p.schedule
    ? `<div class="schedule-content">${p.schedule.replace(/\n/g, "<br>")}</div>`
    : `<div class="schedule-empty">아직 개설된 클리닉 일정이 없습니다.</div>`;
  const sub = [p.sessionTitle, p.lectureTitle].filter(Boolean).join(" &nbsp;|&nbsp; ");

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>클리닉 대상자 안내</title>
<style>${BASE_STYLE}</style></head><body>
<div class="page">
  <div class="header"><div class="badge">CLINIC</div><h1>클리닉 대상자 안내</h1><div class="sub">${sub}</div></div>
  <div class="tip-box"><div class="icon">!</div><div class="text">${tipText}</div></div>
  <div class="columns">
    <div class="col"><div class="section-header both">시험+과제 미통과 <span class="cnt">(${p.both.length}명)</span></div><div class="name-list">${p.both.length > 0 ? buildNameItems(p.both) : emptyCell()}</div></div>
    <div class="col"><div class="section-header exam">시험 미통과 <span class="cnt">(${p.examOnly.length}명)</span></div><div class="name-list">${p.examOnly.length > 0 ? buildNameItems(p.examOnly) : emptyCell()}</div></div>
    <div class="col"><div class="section-header hw">과제 미통과 <span class="cnt">(${p.hwOnly.length}명)</span></div><div class="name-list">${p.hwOnly.length > 0 ? buildNameItems(p.hwOnly) : emptyCell()}</div></div>
  </div>
  <div class="schedule-box"><div class="schedule-title">클리닉 일정</div>${scheduleContent}</div>
  <div class="footer"><div class="footer-left">클리닉 대상 <strong>${clinicTotal}명</strong> / 전체 출석 ${p.totalPresent || clinicTotal}명</div><div class="footer-right">${p.date}</div></div>
</div></body></html>`;
}

// ── 컴포넌트 ──

export default function ClinicPrintoutPage() {
  const [both, setBoth] = useState<string[]>([""]);
  const [examOnly, setExamOnly] = useState<string[]>([""]);
  const [hwOnly, setHwOnly] = useState<string[]>([""]);
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

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const scheduleRef = useRef<HTMLTextAreaElement>(null);

  // ── 열별 state 접근 ──

  const colState: Record<ColumnKey, [string[], React.Dispatch<React.SetStateAction<string[]>>]> = {
    both: [both, setBoth],
    examOnly: [examOnly, setExamOnly],
    hwOnly: [hwOnly, setHwOnly],
  };

  const setRef = (col: ColumnKey, idx: number) => (el: HTMLInputElement | null) => {
    const key = `${col}-${idx}`;
    if (el) inputRefs.current.set(key, el);
    else inputRefs.current.delete(key);
  };

  const focusInput = (col: ColumnKey, idx: number) => {
    requestAnimationFrame(() => inputRefs.current.get(`${col}-${idx}`)?.focus());
  };

  const handleNameChange = (col: ColumnKey, idx: number, value: string) => {
    const [, setter] = colState[col];
    setter((prev) => {
      const next = [...prev];
      next[idx] = value;
      // 마지막 행에 입력 시 새 빈 행 추가
      if (idx === next.length - 1 && value.trim()) next.push("");
      return next;
    });
  };

  const handleNameKeyDown = (col: ColumnKey, idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    const [names, setter] = colState[col];
    if (e.key === "Enter") {
      e.preventDefault();
      setter((prev) => { const n = [...prev]; n.splice(idx + 1, 0, ""); return n; });
      focusInput(col, idx + 1);
    }
    if (e.key === "Backspace" && !names[idx] && names.length > 1) {
      e.preventDefault();
      setter((prev) => prev.filter((_, i) => i !== idx));
      focusInput(col, Math.max(0, idx - 1));
    }
  };

  // ── 파싱 ──

  const generateFromText = useCallback((text: string) => {
    const r = parseClinicData(text);
    const total = r.both.length + r.examOnly.length + r.hwOnly.length;
    if (total === 0) { feedback.warning("파싱 가능한 학생 데이터를 찾지 못했습니다."); return; }
    setBoth([...r.both, ""]);
    setExamOnly([...r.examOnly, ""]);
    setHwOnly([...r.hwOnly, ""]);
    if (r.sessionTitle) setSessionTitle(r.sessionTitle);
    if (r.date) setDate(r.date);
    setTotalPresent(r.totalPresent);
    feedback.success(`클리닉 대상자 ${total}명 파싱 완료`);
  }, []);

  const handlePaste = useCallback(() => {
    setTimeout(() => {
      const el = document.getElementById("clinic-paste-ta") as HTMLTextAreaElement | null;
      if (el) {
        setPasteText(el.value);
        generateFromText(el.value);
      }
    }, 0);
  }, [generateFromText]);

  // ── PDF 다운로드 ──

  const handleDownload = async () => {
    const bNames = both.filter((n) => n.trim());
    const eNames = examOnly.filter((n) => n.trim());
    const hNames = hwOnly.filter((n) => n.trim());
    if (bNames.length + eNames.length + hNames.length === 0) {
      feedback.warning("학생 이름을 입력하세요.");
      return;
    }
    setPdfLoading(true);
    try {
      const html = buildPdfHtml({
        both: bNames, examOnly: eNames, hwOnly: hNames,
        sessionTitle, lectureTitle, date, schedule,
        totalPresent: totalPresent || bNames.length + eNames.length + hNames.length,
      });
      const fname = `클리닉대상자_${sessionTitle || "인쇄물"}_${date.replace(/\//g, "")}.pdf`;
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
    setBoth([""]); setExamOnly([""]); setHwOnly([""]);
    setSessionTitle(""); setLectureTitle(""); setDate(
      `${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(new Date().getDate()).padStart(2, "0")}`
    );
    setSchedule(""); setTotalPresent(0); setPasteText("");
  };

  // ── 스케줄 textarea 자동 높이 ──

  const autoGrowSchedule = useCallback(() => {
    const ta = scheduleRef.current;
    if (!ta) return;
    ta.style.height = "0";
    ta.style.height = Math.max(28, ta.scrollHeight) + "px";
  }, []);

  useEffect(() => { autoGrowSchedule(); }, [schedule, autoGrowSchedule]);

  // ── 렌더링 헬퍼 ──

  const clinicTotal = both.filter((n) => n.trim()).length
    + examOnly.filter((n) => n.trim()).length
    + hwOnly.filter((n) => n.trim()).length;

  const renderColumn = (col: ColumnKey) => {
    const [names] = colState[col];
    const meta = COL_META[col];
    const filled = names.filter((n) => n.trim());
    const useDouble = filled.length > 15;

    return (
      <div className="col" key={col}>
        <div className={`section-hdr ${meta.cssClass}`}>
          {meta.label} <span className="cnt">({filled.length}명)</span>
        </div>
        <div className="name-list">
          {names.length === 0 && <div className="empty-hint">해당 없음</div>}
          {!useDouble && names.map((name, i) => (
            <div className="name-row" key={i}>
              <span className="checkbox">&#9744;</span>
              <input
                ref={setRef(col, i)}
                className="name-input"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleNameChange(col, i, e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleNameKeyDown(col, i, e)}
                placeholder={i === names.length - 1 ? "이름 입력" : ""}
              />
            </div>
          ))}
          {useDouble && (() => {
            const rows: React.ReactNode[] = [];
            for (let i = 0; i < names.length; i += 2) {
              rows.push(
                <div className="name-row-double" key={i}>
                  <div className="name-cell">
                    <span className="checkbox">&#9744;</span>
                    <input
                      ref={setRef(col, i)}
                      className="name-input"
                      value={names[i]}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleNameChange(col, i, e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleNameKeyDown(col, i, e)}
                      placeholder={i >= names.length - 1 ? "이름" : ""}
                    />
                  </div>
                  {i + 1 < names.length && (
                    <div className="name-cell">
                      <span className="checkbox">&#9744;</span>
                      <input
                        ref={setRef(col, i + 1)}
                        className="name-input"
                        value={names[i + 1]}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleNameChange(col, i + 1, e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleNameKeyDown(col, i + 1, e)}
                        placeholder={i + 1 >= names.length - 1 ? "이름" : ""}
                      />
                    </div>
                  )}
                </div>
              );
            }
            return rows;
          })()}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-4">
      {/* ── 좌측: 편집 가능 미리보기 ── */}
      <div className="flex-1" style={{ background: "#e2e8f0", borderRadius: 8, padding: 16 }}>
        <style>{PREVIEW_CSS}</style>
        <div id={SCOPE}>
          {/* Header */}
          <div className="header">
            <div className="badge">CLINIC</div>
            <h1 style={{ margin: 0 }}>클리닉 대상자 안내</h1>
            <div className="sub">
              <input
                className="edit-input"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="차시명"
                style={{ width: Math.max(60, sessionTitle.length * 10 + 20) }}
              />
              {" | "}
              <input
                className="edit-input"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                placeholder="강의명"
                style={{ width: Math.max(60, lectureTitle.length * 10 + 20) }}
              />
            </div>
          </div>

          {/* Tip */}
          <div className="tip-box">
            <div className="tip-icon">!</div>
            <div className="tip-text">
              아래 학생들은 클리닉 수업 대상입니다. 해당 시간에 참석하여 미통과 항목을 보완하세요.
            </div>
          </div>

          {/* Columns */}
          <div className="columns">
            {(["both", "examOnly", "hwOnly"] as ColumnKey[]).map(renderColumn)}
          </div>

          {/* Schedule */}
          <div className="schedule-box">
            <div className="schedule-title">클리닉 일정</div>
            <textarea
              ref={scheduleRef}
              className="schedule-ta"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="클리닉 일정을 입력하세요... (Enter로 줄바꿈)"
              rows={1}
            />
          </div>

          {/* Footer */}
          <div className="footer">
            <div className="footer-left">
              클리닉 대상 <strong>{clinicTotal}명</strong> / 전체 출석{" "}
              <input
                className="total-input"
                value={totalPresent || ""}
                onChange={(e) => setTotalPresent(Number(e.target.value) || 0)}
                placeholder="0"
              />명
            </div>
            <div className="footer-right">
              <input
                className="date-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="MM/DD"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 우측: 데이터 입력 패널 ── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col gap-3" style={{ position: "sticky", top: 16, alignSelf: "flex-start", maxHeight: "calc(100vh - 200px)" }}>
        <section className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 flex flex-col gap-3 flex-1">
          <div className="text-sm font-semibold text-[var(--text-primary)]">데이터 붙여넣기</div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            성적 탭에서 표 전체를 복사하여 아래에 붙여넣으면 자동으로 클리닉 대상자를 분류합니다.
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
            onClick={() => generateFromText(pasteText)}
            disabled={!pasteText.trim()}
          >
            생성
          </Button>
        </section>

        <div className="flex gap-2">
          <Button
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
