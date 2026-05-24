/* eslint-disable no-restricted-syntax */
/**
 * 일정 — 3탭: 내 일정(달력) | 예약 | 지난 일정
 */
import { useState, useMemo, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import ScheduleCalendar from "@student/shared/ui/components/ScheduleCalendar";
import type { DateStatusColor } from "@student/shared/ui/components/ScheduleCalendar";
import { useMySessions } from "@student/domains/sessions/hooks/useStudentSessions";
import {
  clearMyPastSessions,
  hideMySession,
  unhideMySession,
} from "@student/domains/sessions/api/sessions.api";
import type { StudentSession } from "@student/domains/sessions/api/sessions.api";
import EmptyState from "@student/layout/EmptyState";
import { formatYmd } from "@student/shared/utils/date";
import { IconCalendar, IconClinic, IconChevronRight, IconTrash } from "@student/shared/ui/icons/Icons";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useConfirm } from "@/shared/ui/confirm";
import { studentToast } from "@student/shared/ui/feedback/studentToast";
import styles from "./SessionListPage.module.css";

type ApiErrorBody = { detail?: string; message?: string };

function toDateKey(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

type ScheduleTab = "calendar" | "upcoming" | "past";

/** 지난 일정 탭을 숨기는 테넌트 */
const HIDE_PAST_TAB_TENANTS = ["limglish"];

function getTabItems(): { key: ScheduleTab; label: string }[] {
  const code = getTenantCodeForApiRequest();
  const hidePast = code != null && HIDE_PAST_TAB_TENANTS.includes(String(code));
  const items: { key: ScheduleTab; label: string }[] = [
    { key: "calendar", label: "내 일정" },
    { key: "upcoming", label: "예약" },
  ];
  if (!hidePast) items.push({ key: "past", label: "지난 일정" });
  return items;
}

export default function SessionListPage() {
  const [tab, setTab] = useState<ScheduleTab>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data: sessions = [], isLoading, isError } = useMySessions();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [undoTarget, setUndoTarget] = useState<{ id: number; title: string } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const clearPastMutation = useMutation({
    mutationFn: clearMyPastSessions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-sessions"] });
      setSelectedDate(null);
      studentToast.success("지난 일정을 모두 비웠어요.");
    },
    onError: (error: AxiosError<ApiErrorBody>) => {
      studentToast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          "비우기에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  const hideMutation = useMutation({
    mutationFn: hideMySession,
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ["student-sessions"] });
      const prev = qc.getQueryData<StudentSession[]>(["student-sessions"]);
      qc.setQueryData<StudentSession[]>(["student-sessions"], (cur) =>
        (cur ?? []).filter((s) => s.id !== id),
      );
      return { prev };
    },
    onError: (error: AxiosError<ApiErrorBody>, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["student-sessions"], ctx.prev);
      studentToast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          "숨기기에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      setUndoTarget(null);
    },
  });

  const unhideMutation = useMutation({
    mutationFn: unhideMySession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-sessions"] });
    },
    onError: (error: AxiosError<ApiErrorBody>) => {
      studentToast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          "되돌리기에 실패했어요.",
      );
    },
  });

  const handleHide = useCallback(
    (s: StudentSession) => {
      hideMutation.mutate(s.id);
      setUndoTarget({ id: s.id, title: s.title });
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = window.setTimeout(() => setUndoTarget(null), 4500);
    },
    [hideMutation],
  );

  const handleUndo = useCallback(() => {
    if (!undoTarget) return;
    unhideMutation.mutate(undoTarget.id);
    setUndoTarget(null);
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, [undoTarget, unhideMutation]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handleClearPast = async () => {
    if (clearPastMutation.isPending) return;
    const ok = await confirm({
      title: "지난 일정 비우기",
      message: "지나간 차시와 클리닉 예약을 화면에서 모두 숨길까요? (학원에 기록은 그대로 남아요)",
      confirmText: "비우기",
      danger: true,
    });
    if (ok) clearPastMutation.mutate();
  };

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  // 날짜별 그룹
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, StudentSession[]>();
    sessions.forEach((s) => {
      const key = toDateKey(s.date);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    map.forEach((arr) => arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")));
    return map;
  }, [sessions]);

  // 예약 (오늘 이후 + clinic 예약)
  const upcomingSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        const d = toDateKey(s.date);
        if (!d) return false;
        return d >= today;
      })
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [sessions, today]);

  // 지난 일정 (오늘 이전)
  const pastSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        const d = toDateKey(s.date);
        if (!d) return false;
        return d < today;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")); // 최신순
  }, [sessions, today]);

  const datesWithSessions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      const key = toDateKey(s.date);
      if (key) set.add(key);
    });
    return Array.from(set);
  }, [sessions]);

  const dateStatusMap = useMemo(() => {
    const map: Record<string, DateStatusColor> = {};
    sessionsByDate.forEach((arr, date) => {
      const statuses = arr.map((s) => (s.status ?? "").toLowerCase());
      if (statuses.some((st) => st.includes("임박") || st.includes("마감"))) {
        map[date] = "danger";
      } else if (statuses.some((st) => st.includes("예정") || st.includes("진행") || st.includes("예약"))) {
        map[date] = "action";
      } else if (statuses.some((st) => st.includes("완료") || st.includes("종료"))) {
        map[date] = "complete";
      }
    });
    return map;
  }, [sessionsByDate]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessionsByDate.get(selectedDate) ?? [];
  }, [selectedDate, sessionsByDate]);

  if (isLoading) {
    return (
      <StudentPageShell title="일정" description="내 차시 일정">
        <div className="stu-skel" style={{ height: 48, borderRadius: "var(--stu-radius-md)", marginBottom: 8 }} />
        <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-md)", marginBottom: 8 }} />
        <div className="stu-skel" style={{ height: 72, borderRadius: "var(--stu-radius-md)" }} />
      </StudentPageShell>
    );
  }

  if (isError || !sessions) {
    return (
      <StudentPageShell title="일정">
        <EmptyState title="일정을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
      </StudentPageShell>
    );
  }

  const hasPast = pastSessions.length > 0;
  const clearPastButton = hasPast ? (
    <button
      type="button"
      onClick={handleClearPast}
      disabled={clearPastMutation.isPending}
      aria-label="지난 일정 비우기"
      title="지난 일정 비우기"
      className={styles.clearPastButton}
    >
      <IconTrash className={styles.clearPastIcon} />
    </button>
  ) : null;

  return (
    <StudentPageShell
      title="일정"
      description="날짜를 누르면 해당 날의 일정을 볼 수 있어요."
      actions={clearPastButton}
    >
      <div className={styles.pageStack}>
        {/* 탭 */}
        <TabBar items={getTabItems()} value={tab} onChange={setTab} counts={{ upcoming: upcomingSessions.length, past: pastSessions.length }} />

        {/* 내 일정 탭: 달력 */}
        {tab === "calendar" && (
          <>
            <ScheduleCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              datesWithSessions={datesWithSessions}
              dateStatusMap={dateStatusMap}
            />
            {selectedDate ? (
              <div className="stu-section stu-section--nested">
                <div className={styles.selectedSectionTitle}>
                  {formatYmd(selectedDate)} 일정
                </div>
                {selectedDaySessions.length === 0 ? (
                  <EmptyState title="해당 날짜에 일정이 없습니다." description="다른 날짜를 선택해 보세요." compact />
                ) : (
                  <SessionList sessions={selectedDaySessions} />
                )}
              </div>
            ) : (
              <div className={`stu-muted ${styles.calendarHint}`}>
                날짜를 선택하면 해당 날의 일정이 여기에 표시됩니다.
              </div>
            )}
          </>
        )}

        {/* 예약 탭 */}
        {tab === "upcoming" && (
          upcomingSessions.length === 0 ? (
            <EmptyState title="예약된 일정이 없습니다." description="수업이나 클리닉이 예약되면 여기에 표시됩니다." />
          ) : (
            <SessionList sessions={upcomingSessions} showDate />
          )
        )}

        {/* 지난 일정 탭 */}
        {tab === "past" && (
          pastSessions.length === 0 ? (
            <EmptyState title="지난 일정이 없습니다." description="완료된 수업과 클리닉이 여기에 기록됩니다." />
          ) : (
            <>
              <div className={`stu-muted ${styles.pastMeta}`}>
                총 {pastSessions.length}건의 지난 일정 · 좌측으로 밀어 숨기기
              </div>
              <SessionList sessions={pastSessions} showDate isPast onHide={handleHide} />
            </>
          )
        )}
      </div>
      {undoTarget && (
        <UndoBanner
          title={undoTarget.title}
          onUndo={handleUndo}
          onDismiss={() => setUndoTarget(null)}
        />
      )}
    </StudentPageShell>
  );
}

// ─── Undo Banner ───
function UndoBanner({
  title,
  onUndo,
  onDismiss,
}: {
  title: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={styles.undoBanner}
    >
      <div className={styles.undoTitle}>
        숨김 · {title}
      </div>
      <button
        type="button"
        onClick={onUndo}
        className={styles.undoButton}
      >
        되돌리기
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="닫기"
        className={styles.undoClose}
      >
        ×
      </button>
    </div>
  );
}

// ─── Swipe to Hide ───
function SwipeRevealHide({
  onHide,
  children,
}: {
  onHide: () => void;
  children: React.ReactNode;
}) {
  const [dragX, setDragX] = useState(0);
  const [removing, setRemoving] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null);
  const draggedAt = useRef(0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (removing) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    isHorizontal.current = null;
    draggedAt.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current == null || startY.current == null || removing) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (isHorizontal.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontal.current) return;
    if (dx >= 0) {
      setDragX(0);
      return;
    }
    setDragX(Math.max(dx, -180));
    draggedAt.current = Math.abs(dx);
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is best-effort on older embedded browsers.
    }
  };

  const release = () => {
    const x = dragX;
    startX.current = null;
    startY.current = null;
    isHorizontal.current = null;
    if (x < -80) {
      setRemoving(true);
      setDragX(-560);
      window.setTimeout(() => onHide(), 180);
    } else {
      setDragX(0);
    }
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (draggedAt.current > 6) {
      e.preventDefault();
      e.stopPropagation();
      draggedAt.current = 0;
    }
  };

  const revealOpacity = Math.min(1, Math.abs(dragX) / 80);

  return (
    <div
      className={styles.swipeRoot}
      data-removing={removing ? "true" : undefined}
    >
      <div
        aria-hidden
        className={styles.swipeReveal}
        style={{ "--reveal-opacity": revealOpacity } as CSSProperties}
      >
        <IconTrash className={styles.swipeRevealIcon} />
        숨기기
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onClickCapture={onClickCapture}
        className={styles.swipeTrack}
        style={{
          "--swipe-x": `${dragX}px`,
          "--swipe-transition": dragX === 0 || removing ? "transform 0.2s ease" : "none",
        } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Tab Bar ───
function TabBar<T extends string>({
  items,
  value,
  onChange,
  counts,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className={styles.tabBar}>
      {items.map(({ key, label }) => {
        const active = value === key;
        const count = counts?.[key as string];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={styles.tabButton}
            data-active={active ? "true" : undefined}
          >
            <span>{label}</span>
            {count != null && count > 0 && (
              <span
                className={styles.tabCount}
                data-active={active ? "true" : undefined}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Session List ───
function SessionList({
  sessions,
  showDate,
  isPast,
  onHide,
}: {
  sessions: StudentSession[];
  showDate?: boolean;
  isPast?: boolean;
  onHide?: (s: StudentSession) => void;
}) {
  return (
    <div className={styles.sessionList}>
      {sessions.map((s) => {
        const isClinic = s.type === "clinic";
        const linkTo = isClinic ? "/student/clinic" : `/student/sessions/${s.id}`;
        const status = (s.status ?? "").toLowerCase();
        const panelVariant = isPast
          ? "stu-panel--complete"
          : status.includes("완료") || status.includes("종료")
            ? "stu-panel--complete"
            : status.includes("임박") || status.includes("마감")
              ? "stu-panel--danger"
              : status.includes("예정") || status.includes("진행") || status.includes("예약")
                ? "stu-panel--action"
                : "stu-panel--nav";
        const card = (
          <Link
            key={s.id}
            to={linkTo}
            className={`stu-panel stu-panel--pressable stu-panel--accent ${panelVariant} ${styles.sessionCard}`}
            data-past={isPast ? "true" : undefined}
          >
            <div
              className={styles.sessionIconWrap}
              data-type={isClinic ? "clinic" : "session"}
              data-past={isPast ? "true" : undefined}
            >
              {isClinic
                ? <IconClinic className={styles.sessionIcon} />
                : <IconCalendar className={styles.sessionIcon} />
              }
            </div>
            <div className={styles.sessionText}>
              <div className={styles.sessionTitle}>
                {s.title}
              </div>
              <div className={`stu-muted ${styles.sessionMeta}`}>
                {showDate && s.date && <>{formatYmd(s.date)} · </>}
                {s.start_time && s.start_time.slice(0, 5)}
                {s.status ? ` · ${s.status}` : isPast ? " · 완료" : ""}
              </div>
            </div>
            <IconChevronRight className={`stu-chevron ${styles.sessionChevron}`} />
          </Link>
        );
        if (isPast && onHide) {
          return (
            <SwipeRevealHide key={s.id} onHide={() => onHide(s)}>
              {card}
            </SwipeRevealHide>
          );
        }
        return <div key={s.id}>{card}</div>;
      })}
    </div>
  );
}
