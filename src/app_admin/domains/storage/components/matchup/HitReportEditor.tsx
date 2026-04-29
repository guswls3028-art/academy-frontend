// PATH: src/app_admin/domains/storage/components/matchup/HitReportEditor.tsx
// 큐레이션 적중 보고서 편집기.
// 비즈니스: 실장이 시험지 문항별로 후보 자료 중 적합한 것을 골라 코멘트를 작성 →
// 선생/학원장에게 제출 + PDF 출력. 자동 hit-report.pdf와 분리(자동=마케팅, 큐레이션=내부 보고서).

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Save, Send, FileText, ChevronLeft, ChevronRight, Plus, Check } from "lucide-react";
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

  const examProblems = data?.exam_problems || [];
  const active = examProblems[activeIndex] || null;
  const activeEntry = active ? entries[active.id] : null;
  const reportId = data?.report.id ?? 0;
  const isSubmitted = data?.report.status === "submitted";

  // 후보 메타 + extraMeta로 selected problem 정보 lookup
  const candidateMap = useMemo(() => {
    const m = new Map<number, HitReportCandidate | HitReportSelectedMeta>();
    for (const ep of examProblems) for (const c of ep.candidates) m.set(c.id, c);
    for (const v of Object.values(extraMeta)) m.set(v.id, v);
    return m;
  }, [examProblems, extraMeta]);

  const documentTitle = data?.report.document_title || "";
  const documentCategory = data?.report.document_category || "";

  // ── 편집 핸들러 ──

  const toggleSelect = useCallback(async (candidateId: number) => {
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
      // 미저장 변경 먼저 저장
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
          width: "min(1400px, 96vw)",
          height: "min(94vh, 1000px)",
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
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            로딩 중…
          </div>
        ) : examProblems.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>
            시험지에 등록된 문항이 없습니다.
          </div>
        ) : (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "200px 1fr 1fr", overflow: "hidden", minHeight: 0 }}>
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

            {/* 중: 시험지 이미지 + 네비 */}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid var(--color-border-divider)" }}>
              <div style={{
                padding: "10px 14px", borderBottom: "1px solid var(--color-border-divider)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--color-bg-surface)",
              }}>
                <button onClick={() => setActiveIndex((i) => Math.max(0, i - 1))} disabled={activeIndex === 0}
                  style={{ background: "transparent", border: "none", cursor: activeIndex === 0 ? "default" : "pointer", color: "var(--color-text-secondary)", padding: 4 }}>
                  <ChevronLeft size={18} />
                </button>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {active ? `시험지 Q${active.number}` : ""}  ·  {activeIndex + 1} / {examProblems.length}
                </div>
                <button onClick={() => setActiveIndex((i) => Math.min(examProblems.length - 1, i + 1))} disabled={activeIndex >= examProblems.length - 1}
                  style={{ background: "transparent", border: "none", cursor: activeIndex >= examProblems.length - 1 ? "default" : "pointer", color: "var(--color-text-secondary)", padding: 4 }}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 12, background: "#f8fafc", display: "flex", justifyContent: "center" }}>
                {active?.image_url ? (
                  <img src={active.image_url} alt={`Q${active.number}`}
                    style={{ maxWidth: "100%", height: "auto", borderRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }} />
                ) : (
                  <div style={{ color: "var(--color-text-muted)", fontSize: 12, padding: 24 }}>
                    이미지가 없습니다
                  </div>
                )}
              </div>
              {active?.text_preview && (
                <div style={{
                  padding: "8px 14px", borderTop: "1px solid var(--color-border-divider)",
                  background: "var(--color-bg-surface)", fontSize: 11,
                  color: "var(--color-text-secondary)", maxHeight: 80, overflow: "auto",
                }}>
                  {active.text_preview}
                </div>
              )}
            </div>

            {/* 우: 후보 + 선택 + 코멘트 */}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <CuratePanel
                active={active}
                entry={activeEntry}
                onToggle={toggleSelect}
                onComment={setComment}
                disabled={isSubmitted}
                candidateMap={candidateMap}
              />
            </div>
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

// 우측 큐레이션 패널 — 자동 후보 그리드 + 선택된 자료 + 코멘트
function CuratePanel({
  active,
  entry,
  onToggle,
  onComment,
  disabled,
  candidateMap,
}: {
  active: HitReportExamProblem | null;
  entry: EntryDraft | null;
  onToggle: (candidateId: number) => void;
  onComment: (value: string) => void;
  disabled: boolean;
  candidateMap: Map<number, HitReportCandidate | HitReportSelectedMeta>;
}) {
  if (!active) return null;
  const selectedSet = new Set(entry?.selectedProblemIds ?? []);
  // selected 중 자동 후보에 없는 것 (사용자가 이전에 선택한 자료, 후보 컷 밖)
  const extraSelected = (entry?.selectedProblemIds ?? []).filter(
    (pid) => !active.candidates.some((c) => c.id === pid),
  );

  return (
    <>
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
          학원 자료 후보 ({active.candidates.length})
        </div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
          체크박스로 다중 선택
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
        {active.candidates.length === 0 && extraSelected.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)", fontSize: 12 }}>
            카테고리 내 유사 자료가 없습니다
          </div>
        ) : null}
        {active.candidates.map((c) => {
          const checked = selectedSet.has(c.id);
          return (
            <CandidateRow
              key={c.id}
              checked={checked}
              disabled={disabled}
              onToggle={() => onToggle(c.id)}
              imageUrl={c.image_url}
              title={`자료 ${c.document_id}번  ·  Q${c.number}`}
              meta={`유사도 ${(c.similarity * 100).toFixed(1)}%`}
              text={c.text_preview}
            />
          );
        })}
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
                <CandidateRow
                  key={pid}
                  checked={true}
                  disabled={disabled}
                  onToggle={() => onToggle(pid)}
                  imageUrl={meta.image_url}
                  title={`자료 ${meta.document_id}번  ·  Q${meta.number}`}
                  meta="수동 추가"
                  text={meta.text_preview}
                />
              );
            })}
          </div>
        )}
      </div>
      <div style={{
        padding: 10, borderTop: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: 4,
      }}>
        <label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>
          지도 코멘트 / 해설
        </label>
        <textarea
          value={entry?.comment ?? ""}
          onChange={(e) => onComment(e.target.value)}
          disabled={disabled}
          placeholder="이 문항을 어떻게 다뤘는지, 학생이 알아둘 점은 무엇인지 작성하세요"
          rows={5}
          style={{
            fontSize: 12, padding: 8,
            border: "1px solid var(--color-border-divider)", borderRadius: 4,
            resize: "vertical", outline: "none",
            background: "var(--color-bg-canvas)", color: "var(--color-text-primary)",
            minHeight: 80,
          }}
        />
      </div>
    </>
  );
}

function CandidateRow({
  checked, disabled, onToggle, imageUrl, title, meta, text,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  imageUrl?: string;
  title: string;
  meta: string;
  text: string;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "stretch", gap: 8,
        width: "100%", padding: 8, marginBottom: 6,
        border: `1px solid ${checked ? "var(--color-brand-primary)" : "var(--color-border-divider)"}`,
        borderRadius: 6,
        background: checked ? "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)" : "var(--color-bg-canvas)",
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 3, flexShrink: 0,
        border: `2px solid ${checked ? "var(--color-brand-primary)" : "var(--color-border-strong)"}`,
        background: checked ? "var(--color-brand-primary)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginTop: 2,
      }}>
        {checked && <Check size={12} color="white" />}
      </div>
      {imageUrl ? (
        <img src={imageUrl} alt={title}
          style={{
            width: 80, height: 100, objectFit: "cover", borderRadius: 4,
            border: "1px solid var(--color-border-divider)", flexShrink: 0,
          }} />
      ) : (
        <div style={{
          width: 80, height: 100, borderRadius: 4, flexShrink: 0,
          background: "var(--color-bg-surface-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-text-muted)", fontSize: 9,
        }}>
          이미지 없음
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>
          {title}
        </div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{meta}</div>
        <div style={{
          fontSize: 11, color: "var(--color-text-secondary)",
          maxHeight: 60, overflow: "hidden",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
        }}>
          {text}
        </div>
      </div>
    </button>
  );
}
