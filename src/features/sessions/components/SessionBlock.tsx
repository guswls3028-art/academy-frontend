// PATH: src/features/sessions/components/SessionBlock.tsx
// 차시 = 세션 — lecture 기준 세션 목록 + 추가 (LectureLayout, SessionLayout 공용). 차시 블록 SSOT 사용

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings } from "lucide-react";

import { fetchSessions, sortSessionsByDateDesc, updateSession, deleteSession } from "@/features/lectures/api/sessions";
import SessionCreateModal from "@/features/lectures/components/SessionCreateModal";
import { SessionBlockView, isSupplement } from "@/shared/ui/session-block";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";

interface Props {
  lectureId: number;
  /** 현재 세션 ID (SessionLayout일 때 활성 표시용) */
  currentSessionId?: number;
}

type SessionItem = { id: number; order?: number; date?: string | null; title?: string | null };

/** 차시 블록 우상단 톱니바퀴 → 수정/삭제 팝오버 */
function SessionGearMenu({
  session,
  lectureId,
  onDone,
}: {
  session: SessionItem;
  lectureId: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title ?? "");
  const [editDate, setEditDate] = useState(session.date ?? "");
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
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

  return (
    <div
      ref={menuRef}
      className="absolute top-1 right-1 z-10"
      style={{ opacity: open ? 1 : undefined }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setEditing(false); }}
        className="session-block__gear"
        aria-label="차시 설정"
      >
        <Settings size={14} strokeWidth={2.5} />
      </button>

      {open && !editing && (
        <div
          className="absolute right-0 top-full mt-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] rounded-lg shadow-lg py-1 min-w-[120px]"
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
        </div>
      )}

      {open && editing && (
        <div
          className="absolute right-0 top-full mt-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] rounded-lg shadow-lg p-3 min-w-[200px]"
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
        </div>
      )}
    </div>
  );
}

export default function SessionBlock({ lectureId, currentSessionId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: rawSessions = [], isLoading } = useQuery({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId),
    enabled: Number.isFinite(lectureId),
  });
  const sessions = sortSessionsByDateDesc(rawSessions);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["lecture-sessions", lectureId] });
    qc.invalidateQueries({ queryKey: ["session"] });
  }, [qc, lectureId]);

  const handleClose = () => {
    setShowCreate(false);
    invalidate();
  };

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
                    title={supplement ? "보강" : `${s.order ?? "-"}차시`}
                    desc={s.date ?? "-"}
                    onClick={() =>
                      navigate(`/admin/lectures/${lectureId}/sessions/${s.id}`)
                    }
                  />
                  <SessionGearMenu
                    session={s}
                    lectureId={lectureId}
                    onDone={() => {
                      invalidate();
                      // 삭제된 세션이 현재 세션이면 강의 페이지로 이동
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
