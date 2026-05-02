// PATH: src/app_admin/domains/storage/components/matchup/HitReportEditor.tsx
// 큐레이션 적중 보고서 편집기.
// 비즈니스: 실장이 시험지 문항별로 후보 자료 중 적합한 것을 골라 코멘트를 작성 →
// 선생/학원장에게 제출 + PDF 출력.
//
// UI SSOT: 미리보기는 PDF 출력과 동일한 양식.
//   다크 헤더(Q번호 + 적중 라벨 + 유사도) + 좌/우 2-pane + 하단 코멘트 band.
//   사용자는 우측 후보 리스트 클릭으로 active 후보를 바꿔가며 비교 미리보기,
//   체크박스로 PDF에 들어갈 후보를 선택. 같은 양식이 그대로 PDF에 출력됨.
//
// 인라인 스타일은 PDF pane 색상/사이즈 토큰을 동적으로 매핑(적중분류색·캡션톤)하기 위해
// 의도적으로 사용. CSS 모듈로 옮기면 색상 매핑 함수 + className 조합이 더 복잡해지고
// PDF SSOT(_pane_color_for_class)와 동기화 비용 증가. 따라서 파일 단위 lint 예외.
/* eslint-disable no-restricted-syntax */

import { useEffect, useMemo, useState, useCallback } from "react";
import { X, Save, Send, FileText, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import {
  fetchHitReportDraft,
  updateHitReport,
  upsertHitReportEntries,
  submitHitReport,
  type HitReportDraftResponse,
  type HitReportExamProblem,
  type HitReportSelectedMeta,
  type HitReportCandidate,
} from "../../api/matchup.api";

type Props = {
  docId: number;
  onClose: () => void;
};

type EntryDraft = {
  examProblemId: number;
  selectedProblemIds: number[];
  comment: string;
  order: number;
  dirty: boolean;
};

// 적중 분류 — pdf_report.py와 동일 임계값 (직접/유형/개념/없음)
const SIM_DIRECT = 0.85;
const SIM_TYPE = 0.75;
const SIM_CONCEPT = 0.60;

type Tier = "direct" | "type" | "concept" | "miss";
function classifyMatch(sim: number): Tier {
  if (sim >= SIM_DIRECT) return "direct";
  if (sim >= SIM_TYPE) return "type";
  if (sim >= SIM_CONCEPT) return "concept";
  return "miss";
}
const TIER_COLOR: Record<Tier, string> = {
  direct: "#16A34A",   // green-600
  type: "#0891B2",     // cyan-600
  concept: "#7C3AED",  // violet-600
  miss: "#94A3B8",     // slate-400
};
const TIER_BG: Record<Tier, string> = {
  direct: "#DCFCE7",
  type: "#CFFAFE",
  concept: "#EDE9FE",
  miss: "#F1F5F9",
};
const TIER_LABEL: Record<Tier, string> = {
  direct: "직접 적중",
  type: "유형 적중",
  concept: "개념 커버",
  miss: "유사 자료 없음",
};
const SOURCE_PANE_COLOR = "#D97706";  // amber-600 — 시험지(원본)
const SOURCE_PANE_BG = "#FEF3C7";     // amber-100

type CandidateMeta = HitReportCandidate | HitReportSelectedMeta;

export default function HitReportEditor({ docId, onClose }: Props) {
  const [data, setData] = useState<HitReportDraftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [entries, setEntries] = useState<Record<number, EntryDraft>>({});
  const [reportTitle, setReportTitle] = useState("");
  const [reportSummary, setReportSummary] = useState("");
  const [headerDirty, setHeaderDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 사용자 선택 problem 메타 (자동 후보에 없는 것까지 보강 캐시)
  const [extraMeta, setExtraMeta] = useState<Record<number, HitReportSelectedMeta>>({});
  // 미리보기 active 후보 — 우측 리스트에서 클릭한 항목. 선택과는 분리.
  const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetchHitReportDraft(docId);
      setData(resp);
      setReportTitle(resp.report.title || "");
      setReportSummary(resp.report.summary || "");
      setHeaderDirty(false);

      const next: Record<number, EntryDraft> = {};
      for (const ep of resp.exam_problems) {
        next[ep.id] = {
          examProblemId: ep.id,
          selectedProblemIds: ep.entry?.selected_problem_ids || [],
          comment: ep.entry?.comment || "",
          order: ep.entry?.order ?? 0,
          dirty: false,
        };
      }
      setEntries(next);

      const m: Record<number, HitReportSelectedMeta> = {};
      for (const meta of resp.selected_problem_meta) m[meta.id] = meta;
      setExtraMeta(m);
    } catch (e) {
      console.error(e);
      feedback.error("보고서 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { void load(); }, [load]);

  // useMemo로 array identity 안정화 — react-hooks/exhaustive-deps 경고 회피.
  const examProblems = useMemo(() => data?.exam_problems || [], [data]);
  const active = examProblems[activeIndex] || null;
  const activeEntry = active ? entries[active.id] : null;
  const reportId = data?.report.id ?? 0;
  const isSubmitted = data?.report.status === "submitted";

  // 후보 메타 + extraMeta로 selected problem 정보 lookup
  const candidateMap = useMemo(() => {
    const m = new Map<number, CandidateMeta>();
    for (const ep of examProblems) for (const c of ep.candidates) m.set(c.id, c);
    for (const v of Object.values(extraMeta)) m.set(v.id, v);
    return m;
  }, [examProblems, extraMeta]);

  const documentTitle = data?.report.document_title || "";
  const documentCategory = data?.report.document_category || "";

  // active Q 변경 시 → activeCandidateId 자동 설정 (선택된 첫번째 우선, 없으면 첫 후보)
  useEffect(() => {
    if (!active) {
      setActiveCandidateId(null);
      return;
    }
    const sel = activeEntry?.selectedProblemIds ?? [];
    if (sel.length > 0) {
      setActiveCandidateId(sel[0]);
    } else if (active.candidates.length > 0) {
      setActiveCandidateId(active.candidates[0].id);
    } else {
      setActiveCandidateId(null);
    }
    // active.id 변할 때만 — entry 갱신 시는 유지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // ── 편집 핸들러 ──

  const toggleSelect = useCallback((candidateId: number) => {
    if (isSubmitted || !active) return;
    setEntries((prev) => {
      const cur = prev[active.id];
      if (!cur) return prev;
      const has = cur.selectedProblemIds.includes(candidateId);
      const next = has
        ? cur.selectedProblemIds.filter((x) => x !== candidateId)
        : [...cur.selectedProblemIds, candidateId];
      return {
        ...prev,
        [active.id]: { ...cur, selectedProblemIds: next, dirty: true },
      };
    });
    // 신규 선택은 active로 끌어올림 (사용자가 방금 고른 자료 즉시 미리보기)
    setActiveCandidateId(candidateId);
  }, [active, isSubmitted]);

  const setComment = useCallback((value: string) => {
    if (isSubmitted || !active) return;
    setEntries((prev) => {
      const cur = prev[active.id];
      if (!cur) return prev;
      return { ...prev, [active.id]: { ...cur, comment: value, dirty: true } };
    });
  }, [active, isSubmitted]);

  // ── 저장 ──

  const dirtyEntries = useMemo(
    () => Object.values(entries).filter((e) => e.dirty),
    [entries],
  );
  const dirtyCount = dirtyEntries.length + (headerDirty ? 1 : 0);

  const saveAll = useCallback(async (): Promise<boolean> => {
    if (!reportId) return false;
    if (isSubmitted) return false;
    setSaving(true);
    try {
      if (headerDirty) {
        await updateHitReport(reportId, {
          title: reportTitle,
          summary: reportSummary,
        });
        setHeaderDirty(false);
      }
      if (dirtyEntries.length > 0) {
        await upsertHitReportEntries(
          reportId,
          dirtyEntries.map((e) => ({
            exam_problem_id: e.examProblemId,
            selected_problem_ids: e.selectedProblemIds,
            comment: e.comment,
            order: e.order,
          })),
        );
        setEntries((prev) => {
          const next = { ...prev };
          for (const e of dirtyEntries) {
            const cur = next[e.examProblemId];
            if (cur) next[e.examProblemId] = { ...cur, dirty: false };
          }
          return next;
        });
      }
      feedback.success("보고서 저장 완료");
      return true;
    } catch (e) {
      console.error(e);
      feedback.error("저장 실패 — 다시 시도해 주세요");
      return false;
    } finally {
      setSaving(false);
    }
  }, [dirtyEntries, headerDirty, isSubmitted, reportId, reportTitle, reportSummary]);

  // 자동 저장 — dirty 후 1.5초 동안 추가 변경 없으면 자동 백엔드 동기화. 데이터 손실 방지.
  useEffect(() => {
    if (isSubmitted || !reportId) return;
    const dirtyAnyEntries = Object.values(entries).some((e) => e.dirty);
    if (!dirtyAnyEntries && !headerDirty) return;
    const timer = setTimeout(() => {
      void saveAll();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, headerDirty, isSubmitted, reportId]);

  // ── 제출 ──

  const submit = useCallback(async () => {
    if (!reportId) return;
    if (isSubmitted) {
      feedback.info("이미 제출된 보고서입니다.");
      return;
    }
    if (!confirm("보고서를 제출하시겠습니까? 제출 후에는 수정이 잠깁니다.")) return;
    setSubmitting(true);
    try {
      if (dirtyCount > 0) {
        const ok = await saveAll();
        if (!ok) {
          setSubmitting(false);
          return;
        }
      }
      const r = await submitHitReport(reportId);
      setData((prev) => (prev ? { ...prev, report: r } : prev));
      feedback.success("선생에게 보고서가 제출되었습니다");
    } catch (e) {
      console.error(e);
      feedback.error("제출 실패");
    } finally {
      setSubmitting(false);
    }
  }, [dirtyCount, isSubmitted, reportId, saveAll]);

  const downloadPdf = useCallback(async () => {
    if (!reportId) return;
    if (dirtyCount > 0) {
      const ok = await saveAll();
      if (!ok) return;
    }
    try {
      const resp = await api.get(`/matchup/hit-reports/${reportId}/curated.pdf`, {
        responseType: "blob",
        timeout: 5 * 60_000,
      });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportTitle || documentTitle || "matchup"}-큐레이션보고서.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      feedback.error("PDF 생성 실패");
    }
  }, [dirtyCount, documentTitle, reportId, reportTitle, saveAll]);

  // 키보드 네비
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") setActiveIndex((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setActiveIndex((i) => Math.min(examProblems.length - 1, i + 1));
      else if (e.key === "Escape") {
        if (dirtyCount > 0) {
          if (confirm("저장하지 않은 변경이 있습니다. 닫으시겠습니까?")) onClose();
        } else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [examProblems.length, dirtyCount, onClose]);

  const headerStyle: React.CSSProperties = {
    padding: "12px 18px",
    borderBottom: "1px solid var(--color-border-divider)",
    background: "var(--color-bg-surface)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="적중 보고서 작성"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 110,
        display: "flex", alignItems: "stretch", justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (dirtyCount > 0) {
            if (confirm("저장하지 않은 변경이 있습니다. 닫으시겠습니까?")) onClose();
          } else onClose();
        }
      }}
    >
      <div
        style={{
          width: "min(1500px, 97vw)",
          height: "min(95vh, 1040px)",
          margin: "auto 0",
          background: "var(--color-bg-canvas)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(15,23,42,0.32)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={headerStyle}>
          <FileText size={18} color="var(--color-status-success)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {documentCategory || "미분류"}  ·  큐레이션 적중 보고서
              {isSubmitted && (
                <span style={{
                  marginLeft: 8, padding: "1px 8px", borderRadius: 999,
                  background: "var(--color-status-success-bg, #dcfce7)",
                  color: "var(--color-status-success)", fontSize: 10, fontWeight: 700,
                }}>
                  제출됨
                </span>
              )}
            </div>
            <input
              value={reportTitle}
              placeholder={documentTitle || "보고서 제목"}
              onChange={(e) => { setReportTitle(e.target.value); setHeaderDirty(true); }}
              disabled={isSubmitted}
              style={{
                fontSize: 16, fontWeight: 700,
                border: "none", background: "transparent",
                color: "var(--color-text-primary)", outline: "none", padding: 0,
                width: "100%",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: dirtyCount > 0 ? "var(--color-status-warning)" : "var(--color-text-muted)" }}>
              {dirtyCount > 0 ? `미저장 ${dirtyCount}건` : "저장됨"}
            </span>
            <Button size="sm" intent="ghost" onClick={() => void saveAll()} disabled={saving || isSubmitted || dirtyCount === 0}>
              <Save size={12} style={{ marginRight: 4 }} />
              저장
            </Button>
            <Button size="sm" intent="ghost" onClick={() => void downloadPdf()} disabled={saving}>
              <FileText size={12} style={{ marginRight: 4 }} />
              PDF 다운로드
            </Button>
            <Button size="sm" intent="primary" onClick={() => void submit()} disabled={submitting || isSubmitted}>
              <Send size={12} style={{ marginRight: 4 }} />
              {isSubmitted ? "제출 완료" : "선생에게 제출"}
            </Button>
            <button
              onClick={() => {
                if (dirtyCount > 0) {
                  if (confirm("저장하지 않은 변경이 있습니다. 닫으시겠습니까?")) onClose();
                } else onClose();
              }}
              aria-label="닫기"
              style={{
                marginLeft: 4, padding: 6, border: "none", background: "transparent",
                cursor: "pointer", color: "var(--color-text-secondary)",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            color: "var(--color-text-secondary)",
          }}>
            <div style={{
              width: 28, height: 28,
              border: "3px solid var(--color-border-divider)",
              borderTopColor: "var(--color-brand-primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              시험지 문항별 학원 자료를 검색하고 있습니다
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>
              문항 수에 따라 10~30초 소요 (자동 매칭 후보 최대 15건/문항).
              검색 결과는 보고서 작성 후 자동 저장됩니다.
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : examProblems.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>
            시험지에 등록된 문항이 없습니다.
          </div>
        ) : (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "180px 1fr 360px", overflow: "hidden", minHeight: 0 }}>
            {/* 좌: 문항 사이드 — 번호+썸네일 리스트 */}
            <div style={{
              borderRight: "1px solid var(--color-border-divider)",
              overflow: "auto",
              background: "var(--color-bg-surface-soft)",
            }}>
              <div style={{ padding: "10px 12px", fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600 }}>
                문항 ({examProblems.length})
              </div>
              {examProblems.map((ep, i) => {
                const ent = entries[ep.id];
                const cnt = ent?.selectedProblemIds.length ?? 0;
                const hasComment = !!(ent?.comment.trim());
                const isActive = i === activeIndex;
                return (
                  <button
                    key={ep.id}
                    onClick={() => setActiveIndex(i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "8px 12px",
                      background: isActive ? "var(--color-bg-active)" : "transparent",
                      border: "none",
                      borderLeft: isActive
                        ? "3px solid var(--color-brand-primary)"
                        : "3px solid transparent",
                      cursor: "pointer", textAlign: "left",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <span style={{
                      minWidth: 28, fontSize: 12, fontWeight: 700,
                      color: isActive ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
                    }}>
                      Q{ep.number}
                    </span>
                    <span style={{ fontSize: 10, color: cnt > 0 ? "var(--color-status-success)" : "var(--color-text-muted)" }}>
                      {cnt > 0 ? `자료 ${cnt}` : "선택 없음"}
                    </span>
                    {hasComment && (
                      <Check size={10} color="var(--color-status-success)" />
                    )}
                    {ent?.dirty && (
                      <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "var(--color-status-warning)" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 중: 2-pane 미리보기 (PDF 양식과 동일) + 코멘트 */}
            <PreviewPane
              active={active}
              activeIndex={activeIndex}
              examProblemsCount={examProblems.length}
              documentTitle={documentTitle}
              activeCandidateId={activeCandidateId}
              candidateMap={candidateMap}
              comment={activeEntry?.comment ?? ""}
              onComment={setComment}
              disabled={isSubmitted}
              onPrev={() => setActiveIndex((i) => Math.max(0, i - 1))}
              onNext={() => setActiveIndex((i) => Math.min(examProblems.length - 1, i + 1))}
            />

            {/* 우: 후보 선택 리스트 — 행 클릭 = 미리보기 active / "+PDF에 추가" 버튼 = 선택 토글 */}
            <SelectionPanel
              active={active}
              activeCandidateId={activeCandidateId}
              selectedIds={activeEntry?.selectedProblemIds ?? []}
              candidateMap={candidateMap}
              onToggle={toggleSelect}
              onSetActive={setActiveCandidateId}
              disabled={isSubmitted}
            />
          </div>
        )}

        {/* 하단 요약 입력 */}
        <div style={{
          padding: "10px 18px", borderTop: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)", flexShrink: 0,
          display: "flex", gap: 12, alignItems: "stretch",
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 600 }}>
              보고서 요약 (선택) — PDF 표지에 노출
            </label>
            <textarea
              value={reportSummary}
              onChange={(e) => { setReportSummary(e.target.value); setHeaderDirty(true); }}
              disabled={isSubmitted}
              placeholder="예: 1학기 중간고사 대비 반영률 종합 분석"
              rows={2}
              style={{
                fontSize: 12, padding: 6,
                border: "1px solid var(--color-border-divider)",
                borderRadius: 4, resize: "vertical",
                background: "var(--color-bg-canvas)",
                color: "var(--color-text-primary)", outline: "none",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 중앙 미리보기 — PDF 양식과 동일한 다크 헤더 + 좌/우 2-pane + 코멘트 ──
function PreviewPane({
  active, activeIndex, examProblemsCount, documentTitle,
  activeCandidateId, candidateMap, comment, onComment, disabled,
  onPrev, onNext,
}: {
  active: HitReportExamProblem | null;
  activeIndex: number;
  examProblemsCount: number;
  documentTitle: string;
  activeCandidateId: number | null;
  candidateMap: Map<number, CandidateMeta>;
  comment: string;
  onComment: (v: string) => void;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!active) return null;

  const activeCand = activeCandidateId != null ? candidateMap.get(activeCandidateId) : null;
  const sim: number = activeCand && "similarity" in activeCand
    ? (activeCand as HitReportCandidate).similarity
    : 0;
  const tier: Tier = activeCand ? classifyMatch(sim) : "miss";
  const labelText = activeCand
    ? (tier === "miss"
        ? `유사도 ${(sim * 100).toFixed(1)}%`
        : `${TIER_LABEL[tier]}  ·  ${(sim * 100).toFixed(1)}%`)
    : "후보 없음";
  const tierColor = TIER_COLOR[tier];
  const tierBg = TIER_BG[tier];

  const candDocTitle = activeCand
    ? ("document_title" in activeCand && activeCand.document_title)
      ? activeCand.document_title
      : ("document_id" in activeCand ? `자료 ${activeCand.document_id}번` : "")
    : "";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      borderRight: "1px solid var(--color-border-divider)",
      overflow: "hidden", minHeight: 0,
    }}>
      {/* 다크 헤더 — PDF 페이지 헤더와 동일 */}
      <div style={{
        background: "#0F172A", color: "white",
        padding: "10px 14px", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={onPrev}
          disabled={activeIndex === 0}
          aria-label="이전 문항"
          style={{
            background: "transparent", border: "none",
            color: activeIndex === 0 ? "rgba(255,255,255,0.3)" : "white",
            cursor: activeIndex === 0 ? "default" : "pointer",
            padding: 4, display: "flex", alignItems: "center",
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>Q{active.number}</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            {activeIndex + 1} / {examProblemsCount}
          </span>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: activeCand ? tierColor : "#94A3B8",
        }}>
          {labelText}
        </span>
        <button
          onClick={onNext}
          disabled={activeIndex >= examProblemsCount - 1}
          aria-label="다음 문항"
          style={{
            background: "transparent", border: "none",
            color: activeIndex >= examProblemsCount - 1 ? "rgba(255,255,255,0.3)" : "white",
            cursor: activeIndex >= examProblemsCount - 1 ? "default" : "pointer",
            padding: 4, display: "flex", alignItems: "center",
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 2-pane 본문 */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
        padding: 4, background: "#f1f5f9",
      }}>
        {/* 좌 — 시험지 (warning 톤 cap, PDF와 동일) */}
        <PreviewSubPane
          captionLabel="실제 시험"
          captionSub={`${documentTitle || "시험지"}  ·  ${active.number}번`}
          captionColor={SOURCE_PANE_COLOR}
          captionBg={SOURCE_PANE_BG}
          imageUrl={active.image_url || null}
          placeholderText="시험지 이미지가 없습니다"
        />
        {/* 우 — active 후보 (적중 분류 색 cap) */}
        <PreviewSubPane
          captionLabel="큐레이션 자료"
          captionSub={activeCand
            ? `${candDocTitle}  ·  Q${activeCand.number}`
            : "우측 후보 목록에서 선택하세요"}
          captionColor={activeCand ? tierColor : "#94A3B8"}
          captionBg={activeCand ? tierBg : "#F1F5F9"}
          imageUrl={activeCand?.image_url || null}
          placeholderText={activeCand ? "이미지가 없습니다" : "후보를 클릭하면 미리보기"}
        />
      </div>

      {/* 코멘트 — PDF 코멘트 band와 동일 위치/역할 */}
      <div style={{
        padding: 10, borderTop: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)", flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>
          지도 코멘트 / 해설  <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>· PDF 각 후보 페이지 하단에 노출</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          disabled={disabled}
          placeholder="이 문항을 어떻게 다뤘는지, 학생이 알아둘 점은 무엇인지 작성하세요"
          rows={3}
          style={{
            fontSize: 12, padding: 8,
            border: "1px solid var(--color-border-divider)", borderRadius: 4,
            resize: "vertical", outline: "none",
            background: "var(--color-bg-canvas)", color: "var(--color-text-primary)",
            minHeight: 60,
          }}
        />
      </div>
    </div>
  );
}

function PreviewSubPane({
  captionLabel, captionSub, captionColor, captionBg, imageUrl, placeholderText,
}: {
  captionLabel: string;
  captionSub: string;
  captionColor: string;
  captionBg: string;
  imageUrl: string | null;
  placeholderText: string;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "white", border: "1px solid var(--color-border-divider)",
      borderRadius: 4, overflow: "hidden", minHeight: 0,
    }}>
      <div style={{
        padding: "6px 10px", background: captionBg,
        display: "flex", flexDirection: "column", gap: 1, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: captionColor, letterSpacing: 0.3 }}>
          {captionLabel}
        </span>
        <span style={{
          fontSize: 10, color: "#475569",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {captionSub}
        </span>
      </div>
      <div style={{
        flex: 1, minHeight: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 6, overflow: "auto",
      }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={captionLabel}
            style={{
              maxWidth: "100%", maxHeight: "100%",
              objectFit: "contain", background: "white",
            }}
          />
        ) : (
          <span style={{ color: "#94A3B8", fontSize: 12 }}>{placeholderText}</span>
        )}
      </div>
    </div>
  );
}

// ── 우측 후보 선택 패널 — 클릭 = active / 체크박스 = 선택 ──
function SelectionPanel({
  active, activeCandidateId, selectedIds, candidateMap,
  onToggle, onSetActive, disabled,
}: {
  active: HitReportExamProblem | null;
  activeCandidateId: number | null;
  selectedIds: number[];
  candidateMap: Map<number, CandidateMeta>;
  onToggle: (id: number) => void;
  onSetActive: (id: number) => void;
  disabled: boolean;
}) {
  if (!active) return null;
  const selectedSet = new Set(selectedIds);
  // selected 중 자동 후보에 없는 것 (사용자가 이전에 선택한 자료, 후보 컷 밖)
  const extraSelected = selectedIds.filter(
    (pid) => !active.candidates.some((c) => c.id === pid),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{
        padding: "10px 12px", borderBottom: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)", flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>
            학원 자료 후보 ({active.candidates.length})
          </span>
          {selectedIds.length > 0 && (
            <span style={{
              padding: "1px 7px", borderRadius: 999,
              background: "var(--color-brand-primary)", color: "white",
              fontSize: 10, fontWeight: 700,
            }}>
              {selectedIds.length} 선택
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
          행 클릭 = 미리보기 / "+ PDF에 추가" 버튼 = 보고서에 포함
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
        {active.candidates.length === 0 && extraSelected.length === 0 ? (
          <div style={{
            padding: 16, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 12,
            background: "var(--color-bg-surface-soft)",
            border: "1px dashed var(--color-border-divider)",
            borderRadius: 6, lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: "var(--color-text-primary)" }}>
              유사 자료가 없습니다
            </div>
            <div style={{ fontSize: 11 }}>
              매치업 페이지에서 자료를 매뉴얼 크롭/paste로 추가하면 자동 매칭됩니다.
            </div>
          </div>
        ) : null}
        {active.candidates.map((c) => (
          <SelectRow
            key={c.id}
            isActive={c.id === activeCandidateId}
            isSelected={selectedSet.has(c.id)}
            disabled={disabled}
            onClick={() => onSetActive(c.id)}
            onToggle={() => onToggle(c.id)}
            imageUrl={c.image_url}
            title={`자료 ${c.document_id}번  ·  Q${c.number}`}
            meta={`유사도 ${(c.similarity * 100).toFixed(1)}%`}
            tier={classifyMatch(c.similarity)}
            text={c.text_preview}
          />
        ))}
        {extraSelected.length > 0 && (
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: "1px dashed var(--color-border-divider)",
          }}>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 6, fontWeight: 600 }}>
              사용자 선택 (자동 후보 외)
            </div>
            {extraSelected.map((pid) => {
              const meta = candidateMap.get(pid);
              if (!meta) return null;
              return (
                <SelectRow
                  key={pid}
                  isActive={pid === activeCandidateId}
                  isSelected={true}
                  disabled={disabled}
                  onClick={() => onSetActive(pid)}
                  onToggle={() => onToggle(pid)}
                  imageUrl={meta.image_url}
                  title={`자료 ${meta.document_id}번  ·  Q${meta.number}`}
                  meta="수동 추가"
                  tier="miss"
                  text={meta.text_preview}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectRow({
  isActive, isSelected, disabled, onClick, onToggle,
  imageUrl, title, meta, tier, text,
}: {
  isActive: boolean;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
  onToggle: () => void;
  imageUrl?: string;
  title: string;
  meta: string;
  tier: Tier;
  text: string;
}) {
  const tierColor = TIER_COLOR[tier];
  // 행 클릭 = 미리보기 active, 우측 명시적 버튼 = PDF 포함/제외 토글.
  // 이전 22x22 체크박스가 클릭 어렵고 의도 불분명 → 텍스트 버튼으로 명료화.
  // 선택된 행은 좌측 컬러 바 + 살짝 다른 배경으로 시각 분리 (active와 구분).
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        position: "relative",
        display: "flex", alignItems: "stretch", gap: 8,
        padding: 6, paddingLeft: 12, marginBottom: 6,
        border: `2px solid ${isActive ? "var(--color-brand-primary)" : (isSelected ? "color-mix(in srgb, var(--color-status-success) 30%, transparent)" : "transparent")}`,
        borderRadius: 6,
        background: isSelected
          ? "color-mix(in srgb, var(--color-status-success) 6%, var(--color-bg-canvas))"
          : isActive
            ? "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)"
            : "var(--color-bg-canvas)",
        cursor: "pointer",
        boxShadow: isActive ? "0 1px 4px rgba(37,99,235,0.15)" : "none",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      {isSelected && (
        <span aria-hidden style={{
          position: "absolute", left: 0, top: 6, bottom: 6, width: 4,
          borderRadius: "0 3px 3px 0",
          background: "var(--color-status-success)",
        }} />
      )}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          style={{
            width: 80, height: 100, objectFit: "contain",
            objectPosition: "top center",
            borderRadius: 3, background: "white",
            border: "1px solid var(--color-border-divider)", flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: 80, height: 100, borderRadius: 3, flexShrink: 0,
          background: "var(--color-bg-surface-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-text-muted)", fontSize: 10,
        }}>
          이미지 없음
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-primary)" }}>
            {title}
          </span>
          {isSelected && (
            <span aria-label="PDF에 포함됨" style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px",
              borderRadius: 3, background: "var(--color-status-success)",
              color: "white",
            }}>
              ✓ PDF
            </span>
          )}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: tier === "miss" ? "var(--color-text-muted)" : tierColor,
        }}>
          {meta}
        </div>
        <div style={{
          fontSize: 11, color: "var(--color-text-secondary)",
          maxHeight: 48, overflow: "hidden",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
        }}>
          {text}
        </div>
        {/* 명시적 토글 버튼 — row 클릭과 분리. 텍스트로 의도 명확화. */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          disabled={disabled}
          aria-label={isSelected ? "PDF에서 제외" : "PDF에 포함"}
          style={{
            alignSelf: "flex-start",
            marginTop: 2, padding: "4px 10px",
            fontSize: 11, fontWeight: 700,
            border: `1px solid ${isSelected ? "var(--color-status-success)" : "var(--color-brand-primary)"}`,
            borderRadius: 4,
            background: isSelected
              ? "color-mix(in srgb, var(--color-status-success) 12%, white)"
              : "var(--color-brand-primary)",
            color: isSelected ? "var(--color-status-success)" : "white",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {isSelected ? "✕ PDF에서 제외" : "+ PDF에 추가"}
        </button>
      </div>
    </div>
  );
}
