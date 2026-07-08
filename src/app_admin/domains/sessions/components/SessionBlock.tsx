// PATH: src/app_admin/domains/sessions/components/SessionBlock.tsx
// 차시 = 세션. 강의 홈 / 차시 상세에서 공용. 반 편성 모드일 때는 반별 row로 그룹.

import { lazy, Suspense, useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useFloatingPosition } from "@/shared/ui/floating/useFloatingPosition";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings, BookOpen, Stethoscope, ArrowRightLeft, Layers, Users } from "lucide-react";

import { fetchSessions, type Session } from "@/shared/api/contracts/sessions";
import { fetchSections, type Section as SectionType } from "@/shared/api/contracts/lectureSections";
import { updateSession, deleteSession } from "@admin/domains/lectures/api/sessions";
import { SessionBlockView, formatSessionBlockLabel } from "@/shared/ui/session-block";
import { isSupplementSession, sortSessionsByDisplayOrder } from "@/shared/product/sessions/sessionOrdering";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { adminSessionQueryKeys } from "../queryKeys";
import styles from "./SessionBlock.module.css";

const SessionCreateModal = lazy(() => import("@admin/domains/lectures/components/SessionCreateModal"));

interface Props {
  lectureId: number;
  /** 현재 세션 ID (SessionLayout일 때 활성 표시용) */
  currentSessionId?: number;
}

type SessionItem = {
  id: number;
  order?: number;
  regular_order?: number | null;
  session_type?: string | null;
  date?: string | null;
  title?: string | null;
  section?: number | null;
};
type SessionRowTone = "primary" | "warning" | "muted";

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
  const confirm = useConfirm();

  // SSOT floating position — alignRight(우측 정렬, translateX(-100%) 등가)
  const anchor = useFloatingPosition(gearRef, dropdownRef, open, {
    placement: "bottom",
    gap: 4,
    margin: 8,
    estimateHeight: editing ? 220 : 180,
    estimateWidth: 200,
    alignRight: true,
  });

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
          className={`${styles.dropdown} ${styles.dropdownList}`}
          // eslint-disable-next-line no-restricted-syntax -- floating menu position is computed from the trigger geometry.
          style={{ left: anchor.left, top: anchor.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]" onClick={() => setEditing(true)}>수정</button>
          {sections && sections.length > 0 && (
            <>
              <div className={styles.dropdownDivider} />
              <div className="px-3 py-1 text-[11px] text-[var(--color-text-muted)]">반 이동</div>
              {session.section && (
                <button type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]" onClick={async () => { setBusy(true); try { await updateSession(session.id, { section: null }); feedback.success("반 미지정으로 이동"); setOpen(false); onDone(); } catch { feedback.error("이동 실패"); } setBusy(false); }} disabled={busy}>미지정</button>
              )}
              {sections.filter(s => s.id !== session.section).map(s => (
                <button key={s.id} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]" onClick={async () => { setBusy(true); try { await updateSession(session.id, { section: s.id }); feedback.success(`${s.section_type === "CLASS" ? "수업" : "클리닉"} ${s.label}반으로 이동`); setOpen(false); onDone(); } catch { feedback.error("이동 실패"); } setBusy(false); }} disabled={busy}>{s.section_type === "CLASS" ? "수업" : "클리닉"} {s.label}반</button>
              ))}
              <div className={styles.dropdownDivider} />
            </>
          )}
          <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-error)] hover:bg-[var(--color-bg-surface-hover)]" onClick={handleDelete} disabled={busy}>삭제</button>
        </div>,
        document.body
      )}
      {editing && createPortal(
        <div
          ref={dropdownRef}
          className={`${styles.dropdown} ${styles.dropdownEdit}`}
          // eslint-disable-next-line no-restricted-syntax -- floating menu position is computed from the trigger geometry.
          style={{ left: anchor.left, top: anchor.top }}
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
    <div className={styles.gearWrap}>
      <button ref={gearRef} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setEditing(false); }} className={`session-block__gear ${open ? styles.gearOpen : ""}`} aria-label="차시 설정">
        <Settings size={14} strokeWidth={2.5} />
      </button>
      {dropdownContent}
    </div>
  );
}

export default function SessionBlock({ lectureId, currentSessionId }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [createForSection, setCreateForSection] = useState<{ id: number | null; label: string | null } | null>(null);
  const { sectionMode, clinicMode } = useSectionMode();

  const { data: rawSessions = [], isLoading } = useQuery({
    queryKey: adminSessionQueryKeys.lectureSessions(lectureId),
    queryFn: () => fetchSessions(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  const { data: sections = [] } = useQuery<SectionType[]>({
    queryKey: adminSessionQueryKeys.lectureSections(lectureId),
    queryFn: () => fetchSections(lectureId),
    enabled: Number.isFinite(lectureId) && sectionMode,
  });

  const sessions = sortSessionsByDisplayOrder(rawSessions);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: adminSessionQueryKeys.lectureSessions(lectureId) });
    qc.invalidateQueries({ queryKey: adminSessionQueryKeys.lectureSections(lectureId) });
    qc.invalidateQueries({ queryKey: adminSessionQueryKeys.session });
  }, [qc, lectureId]);

  const handleClose = () => {
    setCreateForSection(null);
    invalidate();
  };
  const showCreate = createForSection !== null;

  const getSessionTargetPath = useCallback((nextSessionId: number) => {
    const match = location.pathname.match(/\/admin\/lectures\/\d+\/sessions\/\d+\/(attendance|scores|exams|assignments|videos|clinic)(?:\/|$)/);
    const tab = currentSessionId != null ? match?.[1] : null;
    const targetTab = tab ?? "attendance";
    return `/admin/lectures/${lectureId}/sessions/${nextSessionId}/${targetTab}`;
  }, [currentSessionId, lectureId, location.pathname]);

  // section_mode 분기: 반별 row 데이터
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
    const commonSessions = sortSessionsByDisplayOrder((rawSessions as Session[])
      .filter((s) => !s.section)
    );

    // 반별 차시
    const rows = activeSections.map((sec) => ({
      section: sec,
      sessions: sortSessionsByDisplayOrder((rawSessions as Session[])
        .filter((s) => s.section === sec.id)
      ),
    }));

    return { commonSessions, rows };
  }, [sectionMode, sections, rawSessions]);

  // --- 렌더: section_mode ---
  if (sectionMode && sectionRows) {
    const { commonSessions, rows } = sectionRows;
    const hasAnySections = rows.length > 0;

    return (
      <>
        <div className={styles.sectionModeStack}>
          {isLoading ? (
            <span className={styles.loadingText}>불러오는 중…</span>
          ) : !hasAnySections ? (
            <EmptySectionNotice
              onGoToSections={() => navigate(`/admin/lectures/${lectureId}/sections`)}
            />
          ) : (
            <>
              {/* 반 미지정 차시 (section=null) — 기존 차시 보존
                  정규형: 레거시 차시로 잘못 남을 확률 높으므로 warning 톤으로 강조. */}
              {commonSessions.length > 0 && (
                <SessionRow
                  label={clinicMode === "regular" ? "반 미지정 (정리 필요)" : "반 미지정"}
                  sublabel={clinicMode === "regular" ? "기어 메뉴에서 반으로 이동하세요" : undefined}
                  tone={clinicMode === "regular" ? "warning" : "muted"}
                  sessions={commonSessions}
                  sections={sections}
                  lectureId={lectureId}
                  currentSessionId={currentSessionId}
                  navigate={navigate}
                  getSessionTargetPath={getSessionTargetPath}
                  invalidate={invalidate}
                  onAdd={() => setCreateForSection({ id: null, label: null })}
                  isUnassigned
                />
              )}

              {/* 반별 차시 */}
              {rows.map(({ section: sec, sessions: secSessions }) => {
                // remediation 모드: 차시 없는 클리닉 반은 숨김
                // regular 모드: 클리닉 반은 항상 표시 (필수이므로)
                if (secSessions.length === 0 && sec.section_type === "CLINIC" && clinicMode !== "regular") return null;
                const isClinic = sec.section_type === "CLINIC";
                return (
                  <SessionRow
                    key={sec.id}
                    label={`${isClinic ? "클리닉" : "수업"} ${sec.label}반`}
                    sublabel={`${sec.day_of_week_display} ${sec.start_time?.slice(0, 5) ?? ""}`}
                    tone={isClinic ? "warning" : "primary"}
                    sessions={secSessions}
                    sections={sections}
                    lectureId={lectureId}
                    currentSessionId={currentSessionId}
                    navigate={navigate}
                    getSessionTargetPath={getSessionTargetPath}
                    invalidate={invalidate}
                    onAdd={() => setCreateForSection({ id: sec.id, label: `${isClinic ? "클리닉" : "수업"} ${sec.label}반` })}
                    sectionType={sec.section_type}
                  />
                );
              })}
            </>
          )}
        </div>

        {showCreate && (
          <Suspense fallback={null}>
            <SessionCreateModal lectureId={lectureId} sectionId={createForSection?.id} sectionLabel={createForSection?.label} onClose={handleClose} />
          </Suspense>
        )}
      </>
    );
  }

  // --- 렌더: 기존 (section_mode OFF) ---
  return (
    <>
      <div className={styles.legacyBar}>
        {isLoading ? (
          <span className={styles.loadingText}>불러오는 중…</span>
        ) : (
          <>
            {(sessions as SessionItem[]).map((s) => {
              const isActive = currentSessionId != null && Number(s.id) === Number(currentSessionId);
              const supplement = isSupplementSession(s);
              return (
                <div key={s.id} className="relative group">
                  <SessionBlockView variant={supplement ? "supplement" : "n1"} compact selected={isActive} title={formatSessionBlockLabel(s)} desc={s.date ?? "-"} onClick={() => navigate(getSessionTargetPath(s.id))} />
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
      {showCreate && (
        <Suspense fallback={null}>
          <SessionCreateModal lectureId={lectureId} sectionId={createForSection?.id} sectionLabel={createForSection?.label} onClose={handleClose} />
        </Suspense>
      )}
    </>
  );
}

/** 반 편성 모드이지만 반이 하나도 없을 때의 온보딩 안내 */
function EmptySectionNotice({ onGoToSections }: { onGoToSections: () => void }) {
  return (
    <div className={styles.emptyNotice}>
      <div className={styles.emptyNoticeText}>
        <span className={styles.emptyNoticeTitle}>
          이 강의에 반이 아직 없습니다
        </span>
        <span className={styles.emptyNoticeBody}>
          수업 반(A, B…)과 클리닉 반을 만들면 차시를 반별로 관리할 수 있습니다.
        </span>
      </div>
      <button
        type="button"
        onClick={onGoToSections}
        className={styles.emptyNoticeButton}
      >
        <Users size={14} /> 반 편성 열기
      </button>
    </div>
  );
}

/** 한 줄: 라벨 + 차시 블록들 + 추가 버튼 */
function SessionRow({
  label, sublabel, tone, sessions, sections, lectureId, currentSessionId, navigate, getSessionTargetPath, invalidate, onAdd,
  sectionType, isUnassigned,
}: {
  label: string;
  sublabel?: string;
  tone: SessionRowTone;
  sessions: Session[];
  sections?: SectionType[];
  lectureId: number;
  currentSessionId?: number;
  navigate: (path: string) => void;
  getSessionTargetPath: (sessionId: number) => string;
  invalidate: () => void;
  onAdd: () => void;
  sectionType?: "CLASS" | "CLINIC";
  isUnassigned?: boolean;
}) {
  const LabelIcon = sectionType === "CLINIC" ? Stethoscope : isUnassigned ? Layers : BookOpen;
  const iconSize = 13;

  return (
    <div className={styles.sessionRow}>
      {/* Lane header: icon + label + schedule */}
      <div className={styles.rowHeader} data-unassigned={isUnassigned ? "true" : undefined}>
        <span className={styles.labelChip} data-tone={tone}>
          <LabelIcon size={iconSize} strokeWidth={2.2} className={styles.labelIcon} />
          {label}
        </span>
        {sublabel && (
          <span className={styles.sublabel}>
            {sublabel}
          </span>
        )}
        {isUnassigned && sessions.length > 0 && (
          <span className={styles.moveHint}>
            <ArrowRightLeft size={10} strokeWidth={2} />
            반 이동
          </span>
        )}
      </div>

      {/* Session blocks */}
      {sessions.map((s) => {
        const isActive = currentSessionId != null && Number(s.id) === Number(currentSessionId);
        const supplement = isSupplementSession(s);
        return (
          <div key={s.id} className="relative group">
            <SessionBlockView variant={supplement ? "supplement" : "n1"} compact selected={isActive} title={formatSessionBlockLabel(s)} desc={s.date ?? "-"} onClick={() => navigate(getSessionTargetPath(s.id))} />
            <SessionGearMenu session={s} sections={sections} onDone={() => { invalidate(); if (currentSessionId === s.id) navigate(`/admin/lectures/${lectureId}`); }} />
          </div>
        );
      })}

      {/* Empty state or add button */}
      {sessions.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={`${label} 차시 추가`}
          className={styles.emptyAddButton}
          data-tone={tone}
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
