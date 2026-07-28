// PATH: src/app_admin/domains/tools/clinic/pages/ClinicPrintoutPage.tsx
// 클리닉 대상자 인쇄물 도구 — iframe 기반 미리보기 (원본 CSS 100% 동일) + 데이터 복붙 파서 + PDF 다운로드

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ClipboardPaste,
  Download,
  FileCheck2,
  FileText,
  PencilLine,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { parseClinicData } from "../utils/clinicDataParser";
import {
  buildClinicPrintHtml,
  htmlToPdfDownload,
  type ClinicPrintDocument,
  type ClinicPrintStudent,
} from "@admin/domains/scores/utils/clinicPdfGenerator";
import styles from "./ClinicPrintoutPage.module.css";

type ClinicCategory = "both" | "examOnly" | "hwOnly";
type ManualTarget = { name: string; category: ClinicCategory; note?: string };
type RemovedTarget = { name: string; category: ClinicCategory };

const CATEGORY_META: Record<ClinicCategory, { label: string; short: string }> = {
  both: { label: "시험+과제", short: "둘 다" },
  examOnly: { label: "시험", short: "시험" },
  hwOnly: { label: "과제", short: "과제" },
};
const CATEGORY_ORDER: ClinicCategory[] = ["both", "examOnly", "hwOnly"];

function stripNameCellText(text: string): string {
  return text
    .replace(/[☐□]/g, "")
    .replace(/\[수동\]/g, "")
    .replace(/\s*수동\s*$/g, "")
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

type ToolPrintState = {
  both: string[];
  examOnly: string[];
  hwOnly: string[];
  sessionTitle: string;
  lectureTitle: string;
  date: string;
  schedule: string;
  totalPresent: number;
  manualNames: string[];
};

function toPrintStudents(names: string[], manualNameSet: Set<string>): ClinicPrintStudent[] {
  return names.map((name) => ({
    name,
    manual: manualNameSet.has(name.trim()) || undefined,
  }));
}

function buildToolPrintDocument(p: ToolPrintState): ClinicPrintDocument {
  const clinicTotal = p.both.length + p.examOnly.length + p.hwOnly.length;
  const manualNameSet = new Set(p.manualNames.map((n) => n.trim()).filter(Boolean));
  return {
    lectureTitle: p.lectureTitle,
    sessionTitle: p.sessionTitle,
    date: p.date,
    schedule: p.schedule,
    totalPresent: p.totalPresent > 0 ? p.totalPresent : clinicTotal,
    groups: {
      both: toPrintStudents(p.both, manualNameSet),
      examOnly: toPrintStudents(p.examOnly, manualNameSet),
      hwOnly: toPrintStudents(p.hwOnly, manualNameSet),
    },
  };
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
    const html = buildClinicPrintHtml(buildToolPrintDocument(stateRef.current), { editable: true });
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
            const t = stripNameCellText(cell.querySelector(".name-text")?.textContent || cell.textContent || "");
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
          const t = stripNameCellText(cell.querySelector(".name-text")?.textContent || cell.textContent || "");
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
      const html = buildClinicPrintHtml(buildToolPrintDocument({
        both: bNames, examOnly: eNames, hwOnly: hNames,
        sessionTitle: curSession, lectureTitle: curLecture,
        date: curDate, schedule: curSchedule,
        totalPresent: curPresent ?? (bNames.length + eNames.length + hNames.length),
        manualNames,
      }));
      const fname = `클리닉대상자_${curSession || "인쇄물"}_${curDate.replace(/\//g, "")}.pdf`;
      await htmlToPdfDownload(html, fname);
      feedback.success("PDF 다운로드 완료");
    } catch (error) {
      console.error("Clinic PDF download failed", error);
      feedback.error("PDF 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
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
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <FileText size={ICON.sm} aria-hidden />
            A3 명단 인쇄
          </div>
          <h2>클리닉 대상자 명단 만들기</h2>
          <p>성적표를 붙여넣으면 미통과 항목별로 정리하고, 바로 인쇄할 수 있는 명단으로 만듭니다.</p>
        </div>
        <div className={styles.heroMetrics} aria-label="현재 분류 결과">
          <div className={styles.heroMetric}>
            <span>전체 대상</span>
            <strong>{clinicTotal}<small>명</small></strong>
          </div>
          <div className={styles.metricDivider} aria-hidden />
          <div className={styles.categoryMetric}>
            <span>시험+과제</span>
            <strong>{both.length}</strong>
          </div>
          <div className={styles.categoryMetric}>
            <span>시험</span>
            <strong>{examOnly.length}</strong>
          </div>
          <div className={styles.categoryMetric}>
            <span>과제</span>
            <strong>{hwOnly.length}</strong>
          </div>
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.previewArea} aria-labelledby="clinic-preview-heading">
          <div className={styles.previewToolbar}>
            <div className={styles.previewTitle}>
              <span className={styles.previewStatusDot} aria-hidden />
              <div>
                <h3 id="clinic-preview-heading">인쇄 미리보기</h3>
                <span>A3 세로 · 고화질 PDF</span>
              </div>
            </div>
            <div className={styles.editHint}>
              <PencilLine size={ICON.sm} aria-hidden />
              미리보기의 글자를 눌러 바로 수정할 수 있어요
            </div>
          </div>
          <div className={styles.previewCanvas}>
            <div className={styles.previewScaleBox}>
              <div className={styles.previewPaper}>
                <iframe
                  id="cprev"
                  ref={iframeRef}
                  title="클리닉 대상자 미리보기"
                  className={styles.previewIframe}
                />
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.editor} aria-label="명단 만들기 설정">
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <span className={styles.stepNumber}>1</span>
              <div>
                <h3>성적표 붙여넣기</h3>
                <p>표 전체를 복사해 붙여넣으면 자동으로 분류합니다.</p>
              </div>
            </div>
            <label className={styles.srOnly} htmlFor="clinic-paste-ta">성적표 데이터</label>
            <textarea
              id="clinic-paste-ta"
              className={styles.pasteArea}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={handlePaste}
              placeholder={"성적 탭 데이터를 붙여넣으세요.\n\n또는 직접 입력:\n시험+과제: 이름1, 이름2\n시험: 이름3\n과제: 이름4, 이름5"}
            />
            <Button
              intent="primary"
              leftIcon={<ClipboardPaste size={ICON_FOR_BUTTON.md} />}
              onClick={() => generateFromText(pasteText)}
              disabled={!pasteText.trim()}
            >
              명단 만들기
            </Button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <span className={styles.stepNumber}>2</span>
              <div>
                <h3>
                  <SlidersHorizontal size={ICON.sm} aria-hidden />
                  명단 조정
                </h3>
                <p>자동 분류 결과에 학생을 더하거나 뺄 수 있습니다.</p>
              </div>
              <span className={styles.adjustmentCount}>
                {adjustmentTotal > 0 ? `${adjustmentTotal}건 변경` : "변경 없음"}
              </span>
            </div>

            <div className={styles.adjustmentGroup}>
              <div className={styles.groupTitle}>대상 추가</div>
              <div className={styles.categoryPicker} aria-label="추가할 분류">
                {CATEGORY_ORDER.map((category) => {
                  const active = manualCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setManualCategory(category)}
                      className={styles.categoryButton}
                    >
                      {CATEGORY_META[category].short}
                    </button>
                  );
                })}
              </div>
              <label className={styles.fieldLabel}>
                <span>학생 이름</span>
                <input
                  className={styles.textField}
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddManualTarget();
                  }}
                  placeholder="학생 이름"
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>메모 <em>선택</em></span>
                <input
                  className={styles.textField}
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="조정 사유 메모"
                />
              </label>
              <Button
                intent="secondary"
                size="sm"
                leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />}
                onClick={handleAddManualTarget}
                disabled={!manualName.trim()}
              >
                대상 추가
              </Button>
            </div>

            <div className={styles.panelDivider} />

            <div className={styles.adjustmentGroup}>
              <div className={styles.groupTitle}>대상 제외</div>
              <label className={styles.fieldLabel}>
                <span>학생 이름</span>
                <input
                  list="clinic-current-targets"
                  className={styles.textField}
                  value={excludeName}
                  onChange={(e) => setExcludeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleExcludeTarget();
                  }}
                  placeholder="현재 명단에서 선택"
                />
              </label>
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
                leftIcon={<X size={ICON_FOR_BUTTON.sm} />}
                onClick={() => handleExcludeTarget()}
                disabled={!excludeName.trim()}
              >
                이번 출력에서 제외
              </Button>
              {currentTargets.length > 0 && (
                <div className={styles.targetChips} aria-label="현재 대상자 바로 제외">
                  {currentTargets.map((target) => (
                    <button
                      key={`${target.category}-${target.name}`}
                      type="button"
                      onClick={() => handleExcludeTarget(target.name)}
                      className={styles.targetChip}
                      title={`${target.name} 학생을 이번 출력에서 제외`}
                    >
                      {target.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {adjustmentTotal > 0 && (
              <div className={styles.adjustmentLog}>
                <div className={styles.groupTitle}>이번 변경</div>
                {manualTargets.map((target) => (
                  <div key={`manual-${target.name}`} className={styles.adjustmentRow}>
                    <span>
                      <b>추가</b> {target.name} · {CATEGORY_META[target.category].label}
                      {target.note ? ` · ${target.note}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExcludeTarget(target.name)}
                      className={styles.iconButton}
                      title="수동 추가 취소"
                      aria-label={`${target.name} 수동 추가 취소`}
                    >
                      <X size={ICON.xs} />
                    </button>
                  </div>
                ))}
                {removedTargets.map((target) => (
                  <div key={`removed-${target.name}`} className={`${styles.adjustmentRow} ${styles.adjustmentRowMuted}`}>
                    <span><b>제외</b> {target.name} · {CATEGORY_META[target.category].label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setManualName(target.name);
                        setManualCategory(target.category);
                        setRemovedTargets((items) => items.filter((item) => item.name !== target.name));
                      }}
                      className={styles.iconButton}
                      title="다시 추가 준비"
                      aria-label={`${target.name} 다시 추가 준비`}
                    >
                      <RotateCcw size={ICON.xs} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.downloadPanel}>
            <div className={styles.downloadReadiness}>
              <FileCheck2 size={ICON.md} aria-hidden />
              <div>
                <strong>{clinicTotal > 0 ? `${clinicTotal}명 명단 준비됨` : "명단을 먼저 만들어 주세요"}</strong>
                <span>{clinicTotal > 0 ? "A3 고화질 PDF로 저장합니다." : "성적표를 붙여넣으면 다운로드할 수 있어요."}</span>
              </div>
            </div>
            <Button
              intent="primary"
              size="lg"
              loading={pdfLoading}
              leftIcon={<Download size={ICON_FOR_BUTTON.lg} />}
              onClick={handleDownload}
              disabled={clinicTotal === 0}
              className={styles.downloadButton}
            >
              PDF 다운로드
            </Button>
            <button
              type="button"
              onClick={handleReset}
              className={styles.resetButton}
            >
              <RotateCcw size={ICON.sm} aria-hidden />
              처음부터 다시
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
