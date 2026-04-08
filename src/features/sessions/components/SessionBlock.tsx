// PATH: src/features/sessions/components/SessionBlock.tsx
// 차시 = 세션 — lecture 기준 세션 목록 + 추가 (LectureLayout, SessionLayout 공용). 차시 블록 SSOT 사용

import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Settings, BookOpen, Stethoscope, ArrowRightLeft, Layers } from "lucide-react";

import { fetchSessions, sortSessionsByDateDesc, updateSession, deleteSession, type Session } from "@/features/lectures/api/sessions";
import { fetchSections, createSection, type Section as SectionType } from "@/features/lectures/api/sections";
import SessionCreateModal from "@/features/lectures/components/SessionCreateModal";
import { SessionBlockView, isSupplement, formatSessionOrderLabel } from "@/shared/ui/session-block";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { useSectionMode } from "@/shared/hooks/useSectionMode";

interface Props {
  lectureId: number;
  /** 현재 세션 ID (SessionLayout일 때 활성 표시용) */
  currentSessionId?: number;
}

type SessionItem = { id: number; order?: number; date?: string | null; title?: string | null; section?: number | null };

/** 차시 블록 우상단 톱니바퀴 → 수정/삭제/반변경 팝오버 */
function SessionGearMenu({
  session,
  sections,
  onDone,
}: {
  session: SessionItem;
  sections?: SectionType[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title ?? "");
  const [editDate, setEditDate] = useState(session.date ?? "");
  const [busy, setBusy] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const confirm = useConfirm();

  useLayoutEffect(() => {
    if (!open || !gearRef.current) { setAnchor(null); return; }
    const rect = gearRef.current.getBoundingClientRect();
    setAnchor({ left: rect.right, top: rect.bottom + 4 });
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (gearRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setEditing(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: "차시 삭제",
      message: `이 차시를 삭제하시겠습니까? 관련된 시험, 과제, 출결 데이터가 모두 삭제됩니다.`,
      confirmText: "삭제",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteSession(session.id);
      feedback.success("차시가 삭제되었습니다.");
      setOpen(false);
      onDone();
    } catch {
      feedback.error("차시 삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() && !editDate.trim()) return;
    setBusy(true);
    try {
      const payload: Record<string, string> = {};
      if (editTitle.trim()) payload.title = editTitle.trim();
      if (editDate.trim()) payload.date = editDate.trim();
      await updateSession(session.id, payload);
      feedback.success("차시가 수정되었습니다.");
      setOpen(false);
      setEditing(false);
      onDone();
    } catch {
      feedback.error("차시 수정에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const dropdownContent = open && anchor ? (
    <>
      {!editing && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] rounded-lg shadow-lg py-1 min-w-[120px]"
          style={{ left: anchor.left, top: anchor.top, transform: "translateX(-100%)", zIndex: 10000 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]" onClick={() => setEditing(true)}>수정</button>
          {sections && sections.length > 0 && (
            <>
              <div className="border-t my-0.5" style={{ borderColor: "var(--color-border-divider)" }} />
              <div className="px-3 py-1 text-[11px] text-[var(--color-text-muted)]">반 이동</div>
              {session.section && (
                <button type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]" onClick={async () => { setBusy(true); try { await updateSession(session.id, { section: null }); feedback.success("반 미지정으로 이동"); setOpen(false); onDone(); } catch { feedback.error("이동 실패"); } setBusy(false); }} disabled={busy}>미지정</button>
              )}
              {sections.filter(s => s.id !== session.section).map(s => (
                <button key={s.id} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]" onClick={async () => { setBusy(true); try { await updateSession(session.id, { section: s.id }); feedback.success(`${s.label}반으로 이동`); setOpen(false); onDone(); } catch { feedback.error("이동 실패"); } setBusy(false); }} disabled={busy}>{s.section_type === "CLASS" ? "수업" : "클리닉"} {s.label}반</button>
              ))}
              <div className="border-t my-0.5" style={{ borderColor: "var(--color-border-divider)" }} />
            </>
          )}
          <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-error)] hover:bg-[var(--color-bg-surface-hover)]" onClick={handleDelete} disabled={busy}>삭제</button>
        </div>,
        document.body
      )}
      {editing && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] rounded-lg shadow-lg p-3 min-w-[200px]"
          style={{ left: anchor.left, top: anchor.top, transform: "translateX(-100%)", zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">제목</label>
            <input className="ds-input text-sm" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="차시 제목" autoFocus />
            <label className="text-xs font-medium text-[var(--color-text-muted)]">날짜</label>
            <input type="date" className="ds-input text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <div className="flex justify-end gap-1 mt-1">
              <button type="button" className="px-2.5 py-1 text-xs rounded bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)]" onClick={() => { setEditing(false); setOpen(false); }}>취소</button>
              <button type="button" className="px-2.5 py-1 text-xs rounded bg-[var(--color-brand-primary)] text-white font-medium" onClick={handleSaveEdit} disabled={busy}>저장</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  ) : null;

  return (
    <div className="absolute top-1 right-1 z-10" style={{ opacity: open ? 1 : undefined }}>
      <button ref={gearRef} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setEditing(false); }} className="session-block__gear" aria-label="차시 설정">
        <Settings size={14} strokeWidth={2.5} />
      </button>
      {dropdownContent}
    </div>
  );
}

/** 다음 반 이름 자동 생성: 기존 A,B가 있으면 → C */
function nextSectionLabel(existing: SectionType[], type: "CLASS" | "CLINIC"): string {
  const used = new Set(existing.filter((s) => s.section_type === type).map((s) => s.label));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const ch of letters) {
    if (!used.has(ch)) return ch;
  }
  return `${type === "CLASS" ? "수" : "클"}${used.size + 1}`;
}

export default function SessionBlock({ lectureId, currentSessionId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [createForSection, setCreateForSection] = useState<{ id: number | null; label: string | null } | null>(null);
  const { sectionMode, clinicMode } = useSectionMode();

  const { data: rawSessions = [], isLoading } = useQuery({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  const { data: sections = [] } = useQuery<SectionType[]>({
    queryKey: ["lecture-sections", lectureId],
    queryFn: () => fetchSections(lectureId),
    enabled: Number.isFinite(lectureId) && sectionMode,
  });

  const sessions = sortSessionsByDateDesc(rawSessions);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["lecture-sessions", lectureId] });
    qc.invalidateQueries({ queryKey: ["lecture-sections", lectureId] });
    qc.invalidateQueries({ queryKey: ["session"] });
  }, [qc, lectureId]);

  const handleClose = () => {
    setCreateForSection(null);
    invalidate();
  };
  const showCreate = createForSection !== null;

  // 반 빠른 추가 mutation
  const addSectionMut = useMutation({
    mutationFn: (params: { type: "CLASS" | "CLINIC"; day: number; time: string }) =>
      createSection({
        lecture: lectureId,
        label: nextSectionLabel(sections, params.type),
        section_type: params.type,
        day_of_week: params.day,
        start_time: params.time,
      }),
    onSuccess: () => {
      invalidate();
      feedback.success("반이 추가되었습니다.");
    },
    onError: () => feedback.error("반 추가 실패"),
  });

  // 인라인 반 추가 폼 상태
  const [addingType, setAddingType] = useState<"CLASS" | "CLINIC" | null>(null);
  const [addDay, setAddDay] = useState(0);
  const [addTime, setAddTime] = useState("17:00");
  const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

  const handleQuickAddSection = () => {
    if (addingType == null) return;
    addSectionMut.mutate({ type: addingType, day: addDay, time: addTime });
    setAddingType(null);
  };

  // section_mode 분기
  // 반별 행 데이터: 반이 있는 세션 + 공통(section=null) 세션
  const sectionRows = useMemo(() => {
    if (!sectionMode) return null;

    const activeSections = sections
      .filter((s) => s.is_active)
      .sort((a, b) => {
        const typeOrder = (a.section_type === "CLASS" ? 0 : 1) - (b.section_type === "CLASS" ? 0 : 1);
        if (typeOrder !== 0) return typeOrder;
        return a.label.localeCompare(b.label);
      });

    // 공통 차시 (section=null)
    const commonSessions = (rawSessions as Session[])
      .filter((s) => !s.section)
      .sort((a, b) => a.order - b.order);

    // 반별 차시
    const rows = activeSections.map((sec) => ({
      section: sec,
      sessions: (rawSessions as Session[])
        .filter((s) => s.section === sec.id)
        .sort((a, b) => a.order - b.order),
    }));

    return { commonSessions, rows };
  }, [sectionMode, sections, rawSessions]);

  // --- 렌더: section_mode ---
  if (sectionMode && sectionRows) {
    const { commonSessions, rows } = sectionRows;
    const hasAnySections = rows.length > 0;

    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            paddingBottom: "var(--space-4)",
            marginBottom: "var(--space-4)",
            borderBottom: "1px solid var(--color-border-divider)",
          }}
        >
          {isLoading ? (
            <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>불러오는 중…</span>
          ) : (
            <>
              {/* 반 미지정 차시 (section=null) — 기존 차시 보존 */}
              {commonSessions.length > 0 && (
                <SessionRow
                  label={hasAnySections ? "반 미지정" : "전체"}
                  labelBg="color-mix(in srgb, var(--color-text-muted) 10%, var(--color-bg-surface))"
                  labelColor="var(--color-text-muted)"
                  sessions={commonSessions}
                  sections={sections}
                  lectureId={lectureId}
                  currentSessionId={currentSessionId}
                  navigate={navigate}
                  invalidate={invalidate}
                  onAdd={() => setCreateForSection({ id: null, label: null })}
                  isUnassigned={hasAnySections}
                />
              )}

              {/* 반별 차시 */}
              {rows.map(({ section: sec, sessions: secSessions }) => {
                // remediation 모드: 차시 없는 클리닉 반은 숨김
                // regular 모드: 클리닉 반은 항상 표시 (필수이므로)
                if (secSessions.length === 0 && sec.section_type === "CLINIC" && clinicMode !== "regular") return null;
                const isClinic = sec.section_type === "CLINIC";
                const clinicTag = isClinic && clinicMode === "regular" ? " 필수" : "";
                return (
                  <SessionRow
                    key={sec.id}
                    label={`${isClinic ? "클리닉 " : ""}${sec.label}반${clinicTag}`}
                    sublabel={`${sec.day_of_week_display} ${sec.start_time?.slice(0, 5) ?? ""}`}
                    labelBg={sec.section_type === "CLASS"
                      ? "color-mix(in srgb, var(--color-brand-primary) 12%, var(--color-bg-surface))"
                      : "color-mix(in srgb, var(--color-warning) 12%, var(--color-bg-surface))"}
                    labelColor={sec.section_type === "CLASS" ? "var(--color-brand-primary)" : "var(--color-warning, #d97706)"}
                    sessions={secSessions}
                    sections={sections}
                    lectureId={lectureId}
                    currentSessionId={currentSessionId}
                    navigate={navigate}
                    invalidate={invalidate}
                    onAdd={() => setCreateForSection({ id: sec.id, label: `${sec.label}반` })}
                    sectionType={sec.section_type}
                  />
                );
              })}

              {/* 반 추가 — 차시블록 영역 안, 마지막 줄 */}
              {!addingType ? (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <SessionBlockView
                    variant="add"
                    compact
                    onClick={() => { setAddingType("CLASS"); setAddDay(2); setAddTime("17:00"); }}
                    ariaLabel="수업 반 추가"
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                      <Plus size={14} strokeWidth={2.5} /> 수업반
                    </span>
                  </SessionBlockView>
                  {clinicMode === "regular" && (
                    <SessionBlockView
                      variant="add"
                      compact
                      onClick={() => { setAddingType("CLINIC"); setAddDay(5); setAddTime("19:00"); }}
                      ariaLabel="클리닉 반 추가"
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: "var(--color-warning, #d97706)" }}>
                        <Plus size={14} strokeWidth={2.5} /> 클리닉반
                      </span>
                    </SessionBlockView>
                  )}
                </div>
              ) : (
                /* 인라인 반 추가 폼 */
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: 10,
                  background: "var(--color-bg-surface-sunken)",
                }}>
                  {/* 타입 토글 — remediation 모드에서는 CLASS만 */}
                  <div style={{ display: "flex", gap: 2, borderRadius: 6, background: "var(--color-bg-surface)", padding: 2 }}>
                    {(clinicMode === "regular" ? (["CLASS", "CLINIC"] as const) : (["CLASS"] as const)).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setAddingType(t);
                          if (t === "CLASS") { setAddDay(2); setAddTime("17:00"); }
                          else { setAddDay(5); setAddTime("19:00"); }
                        }}
                        style={{
                          fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 5,
                          border: "none", cursor: "pointer",
                          background: addingType === t ? (t === "CLASS" ? "var(--color-brand-primary)" : "var(--color-warning, #d97706)") : "transparent",
                          color: addingType === t ? "#fff" : "var(--color-text-muted)",
                          transition: "all 120ms",
                        }}
                      >
                        {t === "CLASS" ? "수업" : "클리닉"}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
                    {nextSectionLabel(sections, addingType)}반
                  </span>
                  <select className="ds-input" value={addDay} onChange={(e) => setAddDay(Number(e.target.value))} style={{ width: 58, fontSize: 12, padding: "3px 4px" }}>
                    {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <input className="ds-input" type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} style={{ width: 90, fontSize: 12, padding: "3px 4px" }} />
                  <button onClick={handleQuickAddSection} disabled={addSectionMut.isPending} style={{
                    fontSize: 12, fontWeight: 600, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer",
                    background: addingType === "CLASS" ? "var(--color-brand-primary)" : "var(--color-warning, #d97706)",
                    opacity: addSectionMut.isPending ? 0.5 : 1,
                  }}>
                    {addSectionMut.isPending ? "..." : "추가"}
                  </button>
                  <button onClick={() => setAddingType(null)} style={{ fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" }}>취소</button>
                </div>
              )}
            </>
          )}
        </div>

        {showCreate && <SessionCreateModal lectureId={lectureId} sectionId={createForSection?.id} sectionLabel={createForSection?.label} onClose={handleClose} />}
      </>
    );
  }

  // --- 렌더: 기존 (section_mode OFF) ---
  return (
    <>
      <div
        style={{
          display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap",
          paddingBottom: "var(--space-4)", marginBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border-divider)",
        }}
      >
        {isLoading ? (
          <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>불러오는 중…</span>
        ) : (
          <>
            {(sessions as SessionItem[]).map((s) => {
              const isActive = currentSessionId != null && Number(s.id) === Number(currentSessionId);
              const supplement = isSupplement(s.title);
              return (
                <div key={s.id} className="relative group">
                  <SessionBlockView variant={supplement ? "supplement" : "n1"} compact selected={isActive} title={formatSessionOrderLabel(s.order, s.title)} desc={s.date ?? "-"} onClick={() => navigate(`/admin/lectures/${lectureId}/sessions/${s.id}`)} />
                  <SessionGearMenu session={s} onDone={() => { invalidate(); if (currentSessionId === s.id) navigate(`/admin/lectures/${lectureId}`); }} />
                </div>
              );
            })}
            <SessionBlockView variant="add" compact onClick={() => setCreateForSection({ id: null, label: null })} ariaLabel="차시 추가">
              <Plus size={22} strokeWidth={2.5} />
            </SessionBlockView>
          </>
        )}
      </div>
      {showCreate && <SessionCreateModal lectureId={lectureId} sectionId={createForSection?.id} sectionLabel={createForSection?.label} onClose={handleClose} />}
    </>
  );
}

/** 한 줄: 라벨 + 차시 블록들 + 추가 버튼 */
function SessionRow({
  label, sublabel, labelBg, labelColor, sessions, sections, lectureId, currentSessionId, navigate, invalidate, onAdd,
  sectionType, isUnassigned,
}: {
  label: string;
  sublabel?: string;
  labelBg: string;
  labelColor: string;
  sessions: Session[];
  sections?: SectionType[];
  lectureId: number;
  currentSessionId?: number;
  navigate: (path: string) => void;
  invalidate: () => void;
  onAdd: () => void;
  sectionType?: "CLASS" | "CLINIC";
  isUnassigned?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const LabelIcon = sectionType === "CLINIC" ? Stethoscope : isUnassigned ? Layers : BookOpen;
  const iconSize = 13;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        flexWrap: "wrap",
        padding: "8px 10px",
        borderRadius: 10,
        background: hovered ? "var(--color-bg-surface-hover)" : "transparent",
        transition: "background 160ms ease",
        marginLeft: -10,
        marginRight: -10,
      }}
    >
      {/* Lane header: icon + label + schedule */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: isUnassigned ? 80 : 120,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 8,
            background: labelBg,
            color: labelColor,
            letterSpacing: "-0.01em",
            lineHeight: 1,
            border: `1px solid color-mix(in srgb, ${labelColor} 15%, transparent)`,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <LabelIcon size={iconSize} strokeWidth={2.2} style={{ opacity: 0.85, flexShrink: 0 }} />
          {label}
        </span>
        {sublabel && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-tertiary)",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {sublabel}
          </span>
        )}
        {isUnassigned && sessions.length > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              fontWeight: 500,
              color: "var(--color-text-muted)",
              background: "var(--color-bg-surface-hover)",
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
            }}
          >
            <ArrowRightLeft size={10} strokeWidth={2} />
            반 이동
          </span>
        )}
      </div>

      {/* Session blocks */}
      {sessions.map((s) => {
        const isActive = currentSessionId != null && Number(s.id) === Number(currentSessionId);
        const supplement = isSupplement(s.title);
        return (
          <div key={s.id} className="relative group">
            <SessionBlockView variant={supplement ? "supplement" : "n1"} compact selected={isActive} title={formatSessionOrderLabel(s.order, s.title)} desc={s.date ?? "-"} onClick={() => navigate(`/admin/lectures/${lectureId}/sessions/${s.id}`)} />
            <SessionGearMenu session={s} sections={sections} onDone={() => { invalidate(); if (currentSessionId === s.id) navigate(`/admin/lectures/${lectureId}`); }} />
          </div>
        );
      })}

      {/* Empty state or add button */}
      {sessions.length === 0 ? (
        <button
          onClick={onAdd}
          aria-label={`${label} 차시 추가`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 10,
            border: "1.5px dashed var(--color-border-subtle)",
            background: "transparent",
            color: "var(--color-text-muted)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            transition: "border-color 160ms ease, color 160ms ease, background 160ms ease",
            minHeight: 52,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = labelColor;
            e.currentTarget.style.color = labelColor;
            e.currentTarget.style.background = "var(--color-bg-surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-subtle)";
            e.currentTarget.style.color = "var(--color-text-muted)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Plus size={15} strokeWidth={2.2} />
          차시를 추가하세요
        </button>
      ) : (
        <SessionBlockView variant="add" compact onClick={onAdd} ariaLabel={`${label} 차시 추가`}>
          <Plus size={18} strokeWidth={2.5} />
        </SessionBlockView>
      )}
    </div>
  );
}
