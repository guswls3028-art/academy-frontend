// PATH: src/app_admin/domains/sessions/components/SessionBlock.tsx
// 차시 = 세션. 강의 홈 / 차시 상세에서 공용. 반 편성 모드일 때는 반별 row로 그룹.

import { lazy, Suspense, useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useFloatingPosition } from "@/shared/ui/floating/useFloatingPosition";
import { useLocation, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings, BookOpen, Stethoscope, ArrowRightLeft, Layers, Users } from "lucide-react";

import { fetchSessions, type Session } from "@/shared/api/contracts/sessions";
import { fetchSections, type Section as SectionType } from "@/shared/api/contracts/lectureSections";
import { updateSession, deleteSession } from "@admin/domains/lectures/api/sessions";
import { SessionBlockView, formatSessionBlockLabel } from "@/shared/ui/session-block";
import {
  getSessionType,
  isSupplementSession,
  sortSessionsByDisplayOrder,
  type SessionType,
} from "@/shared/product/sessions/sessionOrdering";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { extractApiError } from "@/shared/utils/extractApiError";
import { Tabs } from "@/shared/ui/ds";
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
type SessionScope = SessionType;
type SessionViewMode = "ALL" | "SCOPED";

function formatSessionScopeName(scope?: SessionScope): string {
  if (scope == null) return "수업";
  return scope === "REGULAR" ? "정규 수업" : "보강";
}

function formatFirstSessionObject(scope?: SessionScope): string {
  if (scope == null) return "첫 수업을";
  return scope === "REGULAR" ? "첫 차시를" : "첫 보강을";
}

/** 차시 블록 우상단 톱니바퀴 → 수정/삭제/반변경 팝오버 */
function SessionGearMenu({
  session,
  sections,
  onDone,
}: {
  session: SessionItem;
  sections?: SectionType[];
  onDone: (action: "updated" | "deleted") => void;
}) {
  const supplement = isSupplementSession(session);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title ?? "");
  const [editDate, setEditDate] = useState(session.date ?? "");
  const [editOrder, setEditOrder] = useState(String(session.regular_order ?? session.order ?? 1));
  const [busy, setBusy] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  // SSOT floating position — alignRight(우측 정렬, translateX(-100%) 등가)
  const anchor = useFloatingPosition(gearRef, dropdownRef, open, {
    placement: "bottom",
    gap: 4,
    margin: 8,
    estimateHeight: editing ? 320 : 180,
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
      title: supplement ? "보강 삭제" : "차시 삭제",
      message: `이 ${supplement ? "보강" : "차시"}을 삭제하시겠습니까? 관련된 시험, 과제, 출결 데이터가 모두 삭제됩니다.`,
      confirmText: "삭제",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteSession(session.id);
      feedback.success(supplement ? "보강이 삭제되었습니다." : "차시가 삭제되었습니다.");
      setOpen(false);
      onDone("deleted");
    } catch {
      feedback.error("차시 삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (supplement && !editTitle.trim()) {
      feedback.warning("보강 이름을 입력하세요.");
      return;
    }
    const nextRegularOrder = Number(editOrder);
    if (!supplement && (!Number.isInteger(nextRegularOrder) || nextRegularOrder < 1)) {
      feedback.warning("차시 번호는 1 이상의 정수로 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const payload: Parameters<typeof updateSession>[1] = {};
      if (editTitle.trim()) payload.title = editTitle.trim();
      if (editDate.trim()) payload.date = editDate.trim();
      if (!supplement) payload.regular_order = nextRegularOrder;
      await updateSession(session.id, payload);
      feedback.success(supplement ? "보강이 수정되었습니다." : "차시가 수정되었습니다.");
      setOpen(false);
      setEditing(false);
      onDone("updated");
    } catch (error) {
      feedback.error(extractApiError(error, "차시 수정에 실패했습니다."));
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
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]"
            onClick={() => {
              setEditTitle(session.title ?? "");
              setEditDate(session.date ?? "");
              setEditOrder(String(session.regular_order ?? session.order ?? 1));
              setEditing(true);
            }}
          >
            수정
          </button>
          {sections && sections.length > 0 && (
            <>
              <div className={styles.dropdownDivider} />
              <div className="px-3 py-1 text-[11px] text-[var(--color-text-muted)]">반 이동</div>
              {session.section && (
                <button type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]" onClick={async () => { setBusy(true); try { await updateSession(session.id, { section: null }); feedback.success("반 미지정으로 이동"); setOpen(false); onDone("updated"); } catch { feedback.error("이동 실패"); } setBusy(false); }} disabled={busy}>미지정</button>
              )}
              {sections.filter(s => s.id !== session.section).map(s => (
                <button key={s.id} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-surface-hover)]" onClick={async () => { setBusy(true); try { await updateSession(session.id, { section: s.id }); feedback.success(`${s.section_type === "CLASS" ? "수업" : "클리닉"} ${s.label}반으로 이동`); setOpen(false); onDone("updated"); } catch { feedback.error("이동 실패"); } setBusy(false); }} disabled={busy}>{s.section_type === "CLASS" ? "수업" : "클리닉"} {s.label}반</button>
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
            {!supplement && (
              <>
                <label htmlFor={`session-order-${session.id}`} className="text-xs font-medium text-[var(--color-text-muted)]">
                  차시 번호
                </label>
                <input
                  id={`session-order-${session.id}`}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  className="ds-input text-sm"
                  value={editOrder}
                  onChange={(e) => setEditOrder(e.target.value)}
                  aria-describedby={`session-order-help-${session.id}`}
                  autoFocus
                />
                <span id={`session-order-help-${session.id}`} className="text-[11px] leading-4 text-[var(--color-text-muted)]">
                  저장하면 카드와 차시 제목이 {editOrder || "N"}차시로 표시됩니다.
                </span>
              </>
            )}
            <label htmlFor={`session-title-${session.id}`} className="text-xs font-medium text-[var(--color-text-muted)]">
              {supplement ? "보강 이름" : "차시 설명 (선택)"}
            </label>
            <input
              id={`session-title-${session.id}`}
              className="ds-input text-sm"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder={supplement ? "예: 토요일 심화 클리닉" : "예: 함수 개념 정리"}
              maxLength={255}
              autoFocus={supplement}
            />
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
      <button ref={gearRef} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setEditing(false); }} className={`session-block__gear ${open ? styles.gearOpen : ""}`} aria-label={`${supplement ? "보강" : "차시"} 설정`}>
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
  const [viewMode, setViewMode] = useState<SessionViewMode>("ALL");
  const [sessionScope, setSessionScope] = useState<SessionScope>("REGULAR");
  const [createForSection, setCreateForSection] = useState<{
    id: number | null;
    label: string | null;
    sessionType?: SessionScope;
  } | null>(null);
  const { sectionMode, clinicMode } = useSectionMode();
  const validLectureId = Number.isInteger(lectureId) && lectureId > 0;

  const { data: rawSessions = [], isLoading, isError, refetch } = useQuery({
    queryKey: adminSessionQueryKeys.lectureSessions(lectureId),
    queryFn: () => fetchSessions(lectureId),
    enabled: validLectureId,
  });

  const sectionsQ = useQuery<SectionType[]>({
    queryKey: adminSessionQueryKeys.lectureSections(lectureId),
    queryFn: () => fetchSections(lectureId),
    enabled: validLectureId && sectionMode,
  });
  const sections = useMemo(() => sectionsQ.data ?? [], [sectionsQ.data]);

  const orderedSessions = useMemo(
    () => sortSessionsByDisplayOrder(rawSessions),
    [rawSessions],
  );
  const sessions = useMemo(
    () => viewMode === "ALL"
      ? orderedSessions
      : orderedSessions.filter((session) => getSessionType(session) === sessionScope),
    [orderedSessions, sessionScope, viewMode],
  );
  const sessionCounts = useMemo(() => rawSessions.reduce(
    (counts, session) => {
      counts[getSessionType(session)] += 1;
      return counts;
    },
    { REGULAR: 0, SUPPLEMENT: 0 } as Record<SessionScope, number>), [rawSessions]);

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
  const createSessionType = viewMode === "SCOPED" ? sessionScope : undefined;
  const createKindLabel = formatSessionScopeName(createSessionType);
  const firstSessionObject = formatFirstSessionObject(createSessionType);

  const getSessionTargetPath = useCallback((nextSessionId: number) => {
    const match = location.pathname.match(/\/workspace\/lectures\/\d+\/sessions\/\d+\/(attendance|scores|exams|assignments|videos|clinic)(?:\/|$)/);
    const tab = currentSessionId != null ? match?.[1] : null;
    const targetTab = tab ?? "attendance";
    return `/workspace/lectures/${lectureId}/sessions/${nextSessionId}/${targetTab}`;
  }, [currentSessionId, lectureId, location.pathname]);

  useEffect(() => {
    setViewMode("ALL");
    setSessionScope("REGULAR");
    setCreateForSection(null);
  }, [lectureId]);

  useEffect(() => {
    if (currentSessionId == null) return;
    const currentSession = rawSessions.find((session) => Number(session.id) === Number(currentSessionId));
    if (currentSession) setSessionScope(getSessionType(currentSession));
  }, [currentSessionId, rawSessions]);

  const handleScopeChange = useCallback((nextScope: SessionScope) => {
    setSessionScope(nextScope);
    if (currentSessionId == null) return;

    const currentSession = orderedSessions.find((session) => Number(session.id) === Number(currentSessionId));
    if (!currentSession || getSessionType(currentSession) === nextScope) return;

    const sameSectionTarget = orderedSessions.find((session) => (
      getSessionType(session) === nextScope && session.section === currentSession.section
    ));
    const target = sameSectionTarget
      ?? orderedSessions.find((session) => getSessionType(session) === nextScope);
    navigate(target ? getSessionTargetPath(target.id) : `/workspace/lectures/${lectureId}`);
  }, [currentSessionId, getSessionTargetPath, lectureId, navigate, orderedSessions]);

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

    const sessionsBySection = new Map<number | null, Session[]>();
    sessions.forEach((session) => {
      const sectionId = session.section ?? null;
      const groupedSessions = sessionsBySection.get(sectionId);
      if (groupedSessions) groupedSessions.push(session);
      else sessionsBySection.set(sectionId, [session]);
    });

    const commonSessions = sessionsBySection.get(null) ?? [];
    const rows = activeSections.map((sec) => ({
      section: sec,
      sessions: sessionsBySection.get(sec.id) ?? [],
    }));

    return { commonSessions, rows };
  }, [sectionMode, sections, sessions]);

  // --- 렌더: section_mode ---
  if (sectionMode && sectionRows) {
    const { commonSessions, rows } = sectionRows;
    const hasAnySections = rows.length > 0;

    return (
      <>
        <SessionViewControls
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sessionScope={sessionScope}
          counts={sessionCounts}
          onScopeChange={handleScopeChange}
        />
        <div
          id={viewMode === "SCOPED" ? "lecture-session-scope-panel" : undefined}
          role={viewMode === "SCOPED" ? "tabpanel" : undefined}
          className={styles.sectionModeStack}
        >
          {isLoading || sectionsQ.isLoading ? (
            <span className={styles.loadingText}>불러오는 중…</span>
          ) : isError || sectionsQ.isError || !validLectureId ? (
            <SessionLoadError onRetry={() => {
              if (validLectureId) {
                void refetch();
                void sectionsQ.refetch();
              }
            }} />
          ) : !hasAnySections ? (
            <EmptySectionNotice
              onGoToSections={() => navigate(`/workspace/lectures/${lectureId}/sections`)}
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
                  onAdd={() => setCreateForSection({ id: null, label: null, sessionType: createSessionType })}
                  sessionScope={createSessionType}
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
                    onAdd={() => setCreateForSection({
                      id: sec.id,
                      label: `${isClinic ? "클리닉" : "수업"} ${sec.label}반`,
                      sessionType: createSessionType,
                    })}
                    sessionScope={createSessionType}
                    sectionType={sec.section_type}
                  />
                );
              })}
            </>
          )}
        </div>

        {showCreate && (
          <Suspense fallback={null}>
            <SessionCreateModal
              lectureId={lectureId}
              sectionId={createForSection?.id}
              sectionLabel={createForSection?.label}
              initialSessionType={createForSection?.sessionType}
              onClose={handleClose}
            />
          </Suspense>
        )}
      </>
    );
  }

  // --- 렌더: 기존 (section_mode OFF) ---
  return (
    <>
      <SessionViewControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sessionScope={sessionScope}
        counts={sessionCounts}
        onScopeChange={handleScopeChange}
      />
      <div
        id={viewMode === "SCOPED" ? "lecture-session-scope-panel" : undefined}
        role={viewMode === "SCOPED" ? "tabpanel" : undefined}
        className={styles.legacyBar}
      >
        {isLoading ? (
          <span className={styles.loadingText}>불러오는 중…</span>
        ) : isError ? (
          <SessionLoadError onRetry={() => void refetch()} />
        ) : (
          <>
            {(sessions as SessionItem[]).map((s) => {
              const isActive = currentSessionId != null && Number(s.id) === Number(currentSessionId);
              const supplement = isSupplementSession(s);
              return (
                <div key={s.id} className="relative group">
                  <SessionBlockView
                    variant={supplement ? "supplement" : "n1"}
                    compact
                    selected={isActive}
                    title={formatSessionBlockLabel(s)}
                    desc={s.date ?? "-"}
                    className={supplement ? styles.supplementCard : undefined}
                    onClick={() => navigate(getSessionTargetPath(s.id))}
                  />
                  <SessionGearMenu session={s} onDone={(action) => { invalidate(); if (action === "deleted" && currentSessionId === s.id) navigate(`/workspace/lectures/${lectureId}`); }} />
                </div>
              );
            })}
            {sessions.length === 0 ? (
              <button
                type="button"
                className={styles.scopeEmptyButton}
                aria-label={`${createKindLabel} 추가`}
                onClick={() => setCreateForSection({ id: null, label: null, sessionType: createSessionType })}
              >
                <Plus size={16} strokeWidth={2.4} />
                <span>
                  <strong>{createKindLabel}이 아직 없습니다</strong>
                  <small>{firstSessionObject} 추가하세요</small>
                </span>
              </button>
            ) : (
              <SessionBlockView
                variant="add"
                compact
                onClick={() => setCreateForSection({ id: null, label: null, sessionType: createSessionType })}
                ariaLabel={`${createKindLabel} 추가`}
              >
                <Plus size={22} strokeWidth={2.5} />
              </SessionBlockView>
            )}
          </>
        )}
      </div>
      {showCreate && (
        <Suspense fallback={null}>
          <SessionCreateModal
            lectureId={lectureId}
            sectionId={createForSection?.id}
            sectionLabel={createForSection?.label}
            initialSessionType={createForSection?.sessionType}
            onClose={handleClose}
          />
        </Suspense>
      )}
    </>
  );
}

function SessionViewControls({
  viewMode,
  onViewModeChange,
  sessionScope,
  counts,
  onScopeChange,
}: {
  viewMode: SessionViewMode;
  onViewModeChange: (mode: SessionViewMode) => void;
  sessionScope: SessionScope;
  counts: Record<SessionScope, number>;
  onScopeChange: (scope: SessionScope) => void;
}) {
  return (
    <div className={styles.viewControls}>
      <div className={styles.viewModeHeader}>
        <div className={styles.viewModeFilter}>
          <span className={styles.viewModeLabel}>보기 방식</span>
          <div className={`ds-segment ${styles.viewModeSegment}`} role="group" aria-label="수업 보기 방식">
            <button
              type="button"
              className="ds-segment__btn"
              aria-pressed={viewMode === "ALL"}
              onClick={() => onViewModeChange("ALL")}
            >
              전체 보기
            </button>
            <button
              type="button"
              className="ds-segment__btn"
              aria-pressed={viewMode === "SCOPED"}
              onClick={() => onViewModeChange("SCOPED")}
            >
              정규·보강 나눠 보기
            </button>
          </div>
        </div>
        <p className={styles.viewModeHelp}>
          {viewMode === "ALL"
            ? "기존처럼 모든 수업을 순서대로 봅니다."
            : "정규 수업과 보강을 선택해서 봅니다."}
        </p>
      </div>
      {viewMode === "SCOPED" && (
        <SessionScopeSwitcher
          value={sessionScope}
          counts={counts}
          onChange={onScopeChange}
        />
      )}
    </div>
  );
}

function SessionLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.sessionLoadError} role="alert">
      <span>수업 목록을 불러오지 못했습니다.</span>
      <button type="button" onClick={onRetry}>다시 불러오기</button>
    </div>
  );
}

function SessionScopeSwitcher({
  value,
  counts,
  onChange,
}: {
  value: SessionScope;
  counts: Record<SessionScope, number>;
  onChange: (scope: SessionScope) => void;
}) {
  const options: Array<{ value: SessionScope; label: string; description: string }> = [
    { value: "REGULAR", label: "정규 수업", description: "차시별 수업" },
    { value: "SUPPLEMENT", label: "보강", description: "클리닉·추가 수업" },
  ];

  return (
    <div className={styles.scopeHeader}>
      <Tabs
        value={value}
        ariaLabel="수업 구분"
        className={styles.scopeTabs}
        onChange={(nextValue) => onChange(nextValue as SessionScope)}
        items={options.map((option) => ({
          key: option.value,
          label: (
            <>
              <span className={styles.scopeTabText}>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <span className={styles.scopeCount} aria-label={`${counts[option.value]}개`}>
                {counts[option.value]}
              </span>
            </>
          ),
        }))}
      />
      <p className={styles.scopeHelp}>
        {value === "REGULAR"
          ? "정규 진도와 성적은 차시 순서대로 관리합니다."
          : "주말 클리닉처럼 정규 진도와 별개인 수업을 관리합니다."}
      </p>
    </div>
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
  sessionScope, sectionType, isUnassigned,
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
  sessionScope?: SessionScope;
  sectionType?: "CLASS" | "CLINIC";
  isUnassigned?: boolean;
}) {
  const LabelIcon = sectionType === "CLINIC" ? Stethoscope : isUnassigned ? Layers : BookOpen;
  const iconSize = 13;
  const addKindLabel = formatSessionScopeName(sessionScope);

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
            <SessionBlockView
              variant={supplement ? "supplement" : "n1"}
              compact
              selected={isActive}
              title={formatSessionBlockLabel(s)}
              desc={s.date ?? "-"}
              className={supplement ? styles.supplementCard : undefined}
              onClick={() => navigate(getSessionTargetPath(s.id))}
            />
            <SessionGearMenu session={s} sections={sections} onDone={(action) => { invalidate(); if (action === "deleted" && currentSessionId === s.id) navigate(`/workspace/lectures/${lectureId}`); }} />
          </div>
        );
      })}

      {/* Empty state or add button */}
      {sessions.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={`${label} ${addKindLabel} 추가`}
          className={styles.emptyAddButton}
          data-tone={tone}
        >
          <Plus size={15} strokeWidth={2.2} />
          {addKindLabel}을 추가하세요
        </button>
      ) : (
        <SessionBlockView
          variant="add"
          compact
          onClick={onAdd}
          ariaLabel={`${label} ${addKindLabel} 추가`}
        >
          <Plus size={18} strokeWidth={2.5} />
        </SessionBlockView>
      )}
    </div>
  );
}
