// PATH: src/features/sessions/components/SessionBlock.tsx
// 차시 = 세션 — lecture 기준 세션 목록 + 추가 (LectureLayout, SessionLayout 공용). 차시 블록 SSOT 사용

import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings } from "lucide-react";

import { fetchSessions, sortSessionsByDateDesc, updateSession, deleteSession, type Session } from "@/features/lectures/api/sessions";
import { fetchSections, type Section as SectionType } from "@/features/lectures/api/sections";
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

type SessionItem = { id: number; order?: number; date?: string | null; title?: string | null };

/** 차시 블록 우상단 톱니바퀴 → 수정/삭제 팝오버 (createPortal로 body에 렌더) */
function SessionGearMenu({
  session,
  onDone,
}: {
  session: SessionItem;
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

  // 드롭다운 위치 계산: 톱니 버튼 아래 중앙 정렬
  useLayoutEffect(() => {
    if (!open || !gearRef.current) { setAnchor(null); return; }
    const rect = gearRef.current.getBoundingClientRect();
    // 버튼 아래에 표시, 오른쪽 정렬
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
          style={{
            left: anchor.left,
            top: anchor.top,
            transform: "translateX(-100%)",
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]"
            onClick={() => setEditing(true)}
          >
            수정
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-error)] hover:bg-[var(--color-bg-surface-hover)]"
            onClick={handleDelete}
            disabled={busy}
          >
            삭제
          </button>
        </div>,
        document.body
      )}
      {editing && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] rounded-lg shadow-lg p-3 min-w-[200px]"
          style={{
            left: anchor.left,
            top: anchor.top,
            transform: "translateX(-100%)",
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">제목</label>
            <input
              className="ds-input text-sm"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="차시 제목"
              autoFocus
            />
            <label className="text-xs font-medium text-[var(--color-text-muted)]">날짜</label>
            <input
              type="date"
              className="ds-input text-sm"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
            <div className="flex justify-end gap-1 mt-1">
              <button
                type="button"
                className="px-2.5 py-1 text-xs rounded bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)]"
                onClick={() => { setEditing(false); setOpen(false); }}
              >
                취소
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs rounded bg-[var(--color-brand-primary)] text-white font-medium"
                onClick={handleSaveEdit}
                disabled={busy}
              >
                저장
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  ) : null;

  return (
    <div className="absolute top-1 right-1 z-10" style={{ opacity: open ? 1 : undefined }}>
      <button
        ref={gearRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setEditing(false); }}
        className="session-block__gear"
        aria-label="차시 설정"
      >
        <Settings size={14} strokeWidth={2.5} />
      </button>
      {dropdownContent}
    </div>
  );
}

export default function SessionBlock({ lectureId, currentSessionId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { sectionMode } = useSectionMode();

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
    setShowCreate(false);
    invalidate();
  };

  // section_mode: 반별로 세션 그룹핑
  const sectionRows = useMemo(() => {
    if (!sectionMode || sections.length === 0) return null;
    const activeSections = sections
      .filter((s) => s.is_active)
      .sort((a, b) => {
        // CLASS 먼저, 그 다음 CLINIC. 같은 타입이면 label 순
        const typeOrder = (a.section_type === "CLASS" ? 0 : 1) - (b.section_type === "CLASS" ? 0 : 1);
        if (typeOrder !== 0) return typeOrder;
        return a.label.localeCompare(b.label);
      });

    return activeSections.map((sec) => {
      const sectionSessions = (rawSessions as Session[])
        .filter((s) => s.section === sec.id)
        .sort((a, b) => a.order - b.order);
      return { section: sec, sessions: sectionSessions };
    });
  }, [sectionMode, sections, rawSessions]);

  // section_mode ON — 반별 두 줄
  if (sectionMode && sectionRows && sectionRows.length > 0) {
    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            paddingBottom: "var(--space-4)",
            marginBottom: "var(--space-4)",
            borderBottom: "1px solid var(--color-border-divider)",
          }}
        >
          {isLoading ? (
            <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>불러오는 중…</span>
          ) : (
            sectionRows.map(({ section: sec, sessions: secSessions }) => (
              <div
                key={sec.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                {/* 반 라벨 */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    minWidth: 48,
                    padding: "2px 8px",
                    borderRadius: 6,
                    textAlign: "center",
                    background: sec.section_type === "CLASS"
                      ? "var(--color-primary-light, #e0e7ff)"
                      : "var(--color-warning-light, #fef3c7)",
                    color: sec.section_type === "CLASS"
                      ? "var(--color-primary)"
                      : "var(--color-warning, #d97706)",
                  }}
                >
                  {sec.label}반
                </span>

                {/* 차시 블록들 */}
                {secSessions.map((s) => {
                  const isActive =
                    currentSessionId != null && Number(s.id) === Number(currentSessionId);
                  const supplement = isSupplement(s.title);
                  return (
                    <div key={s.id} className="relative group">
                      <SessionBlockView
                        variant={supplement ? "supplement" : "n1"}
                        compact
                        selected={isActive}
                        title={formatSessionOrderLabel(s.order, s.title)}
                        desc={s.date ?? "-"}
                        onClick={() =>
                          navigate(`/admin/lectures/${lectureId}/sessions/${s.id}`)
                        }
                      />
                      <SessionGearMenu
                        session={s}
                        onDone={() => {
                          invalidate();
                          if (currentSessionId === s.id) {
                            navigate(`/admin/lectures/${lectureId}`);
                          }
                        }}
                      />
                    </div>
                  );
                })}

                {/* + 버튼 (반별 차시 추가) */}
                <SessionBlockView
                  variant="add"
                  compact
                  onClick={() => setShowCreate(true)}
                  ariaLabel={`${sec.label}반 차시 추가`}
                >
                  <Plus size={18} strokeWidth={2.5} />
                </SessionBlockView>
              </div>
            ))
          )}
        </div>

        {showCreate && (
          <SessionCreateModal lectureId={lectureId} onClose={handleClose} />
        )}
      </>
    );
  }

  // section_mode OFF — 기존 한 줄
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          flexWrap: "wrap",
          paddingBottom: "var(--space-4)",
          marginBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border-divider)",
        }}
      >
        {isLoading ? (
          <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>불러오는 중…</span>
        ) : (
          <>
            {(sessions as SessionItem[]).map((s) => {
              const isActive =
                currentSessionId != null && Number(s.id) === Number(currentSessionId);
              const supplement = isSupplement(s.title);

              return (
                <div key={s.id} className="relative group">
                  <SessionBlockView
                    variant={supplement ? "supplement" : "n1"}
                    compact
                    selected={isActive}
                    title={formatSessionOrderLabel(s.order, s.title)}
                    desc={s.date ?? "-"}
                    onClick={() =>
                      navigate(`/admin/lectures/${lectureId}/sessions/${s.id}`)
                    }
                  />
                  <SessionGearMenu
                    session={s}
                    onDone={() => {
                      invalidate();
                      if (currentSessionId === s.id) {
                        navigate(`/admin/lectures/${lectureId}`);
                      }
                    }}
                  />
                </div>
              );
            })}
            <SessionBlockView
              variant="add"
              compact
              onClick={() => setShowCreate(true)}
              ariaLabel="차시 추가"
            >
              <Plus size={22} strokeWidth={2.5} />
            </SessionBlockView>
          </>
        )}
      </div>

      {showCreate && (
        <SessionCreateModal lectureId={lectureId} onClose={handleClose} />
      )}
    </>
  );
}
