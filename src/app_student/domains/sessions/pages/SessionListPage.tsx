/* eslint-disable no-restricted-syntax */
/**
 * 일정 — 3탭: 내 일정(달력) | 예약 | 지난 일정
 */
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid var(--stu-border, rgba(0,0,0,0.08))",
        background: "var(--stu-surface-1, #fff)",
        color: "var(--stu-text-muted)",
        cursor: clearPastMutation.isPending ? "not-allowed" : "pointer",
        opacity: clearPastMutation.isPending ? 0.5 : 1,
        transition: "color 0.15s ease, background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--stu-danger, #ef4444)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--stu-text-muted)";
      }}
    >
      <IconTrash style={{ width: 18, height: 18 }} />
    </button>
  ) : null;

  return (
    <StudentPageShell
      title="일정"
      description="날짜를 누르면 해당 날의 일정을 볼 수 있어요."
      actions={clearPastButton}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
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
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
                  {formatYmd(selectedDate)} 일정
                </div>
                {selectedDaySessions.length === 0 ? (
                  <EmptyState title="해당 날짜에 일정이 없습니다." description="다른 날짜를 선택해 보세요." compact />
                ) : (
                  <SessionList sessions={selectedDaySessions} />
                )}
              </div>
            ) : (
              <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-6)", fontSize: 14 }}>
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
              <div className="stu-muted" style={{ fontSize: 13, textAlign: "center", padding: "2px 0 4px" }}>
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
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(var(--stu-safe-bottom, 0px) + var(--stu-tabbar-h, 56px) + 12px)",
        transform: "translateX(-50%)",
        zIndex: 9998,
        maxWidth: "min(92vw, 380px)",
        background: "var(--stu-text, #111827)",
        color: "#fff",
        borderRadius: 12,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        숨김 · {title}
      </div>
      <button
        type="button"
        onClick={onUndo}
        style={{
          background: "transparent",
          border: "none",
          color: "#93c5fd",
          fontWeight: 800,
          fontSize: 13,
          padding: "6px 8px",
          cursor: "pointer",
          letterSpacing: "-0.01em",
        }}
      >
        되돌리기
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="닫기"
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.7)",
          fontSize: 16,
          lineHeight: 1,
          padding: "4px 6px",
          cursor: "pointer",
        }}
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
    } catch {}
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
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        maxHeight: removing ? 0 : 200,
        marginBottom: removing ? 0 : undefined,
        opacity: removing ? 0 : 1,
        transition: removing ? "max-height 0.2s ease, opacity 0.2s ease, margin 0.2s ease" : undefined,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--stu-danger, #ef4444)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 20px",
          gap: 6,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "-0.01em",
          opacity: revealOpacity,
          pointerEvents: "none",
        }}
      >
        <IconTrash style={{ width: 18, height: 18 }} />
        숨기기
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onClickCapture={onClickCapture}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragX === 0 || removing ? "transform 0.2s ease" : undefined,
          touchAction: "pan-y",
        }}
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
    <div
      style={{
        display: "flex",
        gap: 3,
        padding: 3,
        background: "var(--stu-surface-soft)",
        borderRadius: 12,
      }}
    >
      {items.map(({ key, label }) => {
        const active = value === key;
        const count = counts?.[key as string];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "none",
              borderRadius: 9,
              background: active ? "var(--stu-surface-1)" : "transparent",
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              letterSpacing: "-0.01em",
              color: active ? "var(--stu-primary)" : "var(--stu-text-muted)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px color-mix(in srgb, var(--stu-primary) 14%, transparent)" : undefined,
              cursor: "pointer",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <span>{label}</span>
            {count != null && count > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: active ? "var(--stu-primary)" : "var(--stu-surface-soft)",
                  color: active ? "var(--stu-primary-contrast)" : "var(--stu-text-muted)",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
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
            className={`stu-panel stu-panel--pressable stu-panel--accent ${panelVariant}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--stu-space-4)",
              textDecoration: "none",
              color: "inherit",
              opacity: isPast ? 0.7 : 1,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: isClinic ? "rgba(16,185,129,0.1)" : isPast ? "var(--stu-surface-soft)" : "var(--stu-surface-soft)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {isClinic
                ? <IconClinic style={{ width: 22, height: 22, color: isPast ? "var(--stu-text-muted)" : "var(--stu-success, #10b981)" }} />
                : <IconCalendar style={{ width: 22, height: 22, color: isPast ? "var(--stu-text-muted)" : "var(--stu-primary)" }} />
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: isPast ? 600 : 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.title}
              </div>
              <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                {showDate && s.date && <>{formatYmd(s.date)} · </>}
                {s.start_time && s.start_time.slice(0, 5)}
                {s.status ? ` · ${s.status}` : isPast ? " · 완료" : ""}
              </div>
            </div>
            <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)", flexShrink: 0 }} />
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
