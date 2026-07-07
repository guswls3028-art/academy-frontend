/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/today/pages/TodayPage.tsx
// 오늘 홈 — 인사 + KPI 4개 + 지금 처리할 일 + 오늘 수업
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import useAuth from "@/auth/hooks/useAuth";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import { Card, KpiCard, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { ChevronRight, Clock, MessageSquare, Send } from "@teacher/shared/ui/Icons";
import { TEACHER_PENDING_ROUTES } from "@teacher/domains/notifications/routes";
import { todayLocalISO as todayISO } from "@/shared/utils/localDate";
import { fetchTodaySessions } from "../api";
import { teacherTodayQueryKeys } from "../queryKeys";
import SessionCard from "../components/SessionCard";

  const notificationLinkStyle: CSSProperties = {
    minHeight: 36,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  borderRadius: 999,
  border: "1px solid var(--tc-border)",
  background: "var(--tc-surface)",
  color: "var(--tc-text-secondary)",
  padding: "4px 8px 4px 10px",
  fontWeight: 700,
};

export default function TodayPage() {
  const today = todayISO();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: sessions, isLoading } = useQuery({
    queryKey: teacherTodayQueryKeys.sessions(today),
    queryFn: () => fetchTodaySessions(today),
    staleTime: 60_000,
  });

  const { items: pendingItems, counts: pendingCounts } = useTeacherPendingCounts();

  const dateStr = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const sessionCount = sessions?.length ?? 0;

  const attendanceProgress = useMemo(() => {
    if (!sessions || sessions.length === 0) return { filled: 0, total: 0, pct: null as number | null };
    const filled = sessions.reduce((s, x) => s + (x.attendance_filled ?? 0), 0);
    const total = sessions.reduce((s, x) => s + (x.attendance_total ?? 0), 0);
    const pct = total > 0 ? Math.round((filled / total) * 100) : null;
    return { filled, total, pct };
  }, [sessions]);

  const honorific = (() => {
    const role = user?.tenantRole;
    if (role === "owner") return "원장님";
    if (role === "admin") return "관리자님";
    return "선생님";
  })();
  const userName = user?.name?.trim();
  const greetingName = userName ? `${userName} ${honorific}` : honorific;
  const pendingTotal = pendingCounts?.total ?? 0;
  const pendingQnaCount = pendingCounts?.qnaPending ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* === Greeting / Date === */}
      <div style={{ padding: "var(--tc-space-1) var(--tc-space-1) var(--tc-space-2)" }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--tc-text-muted)",
            fontWeight: 500,
            letterSpacing: 0,
          }}
        >
          {dateStr}
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--tc-text)",
            margin: "2px 0 0 0",
            letterSpacing: 0,
            lineHeight: 1.25,
          }}
        >
          안녕하세요, {greetingName}
        </h1>
      </div>

      {/* === KPI Grid === */}
      {/* "처리할 일" KPI는 아래 인박스와 중복이라 제거. KPI 2x1로 축소 — 오늘 흐름(수업/출결)만 유지. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "var(--tc-space-2)",
        }}
      >
        <KpiCard
          label="오늘 수업"
          value={sessionCount}
          sub={sessionCount > 0 ? "건" : "없음"}
          color={sessionCount > 0 ? "var(--tc-text)" : "var(--tc-text-muted)"}
        />
        <KpiCard
          label="출결 입력"
          value={
            attendanceProgress.pct != null
              ? `${attendanceProgress.pct}%`
              : "—"
          }
          sub={
            attendanceProgress.total > 0
              ? `${attendanceProgress.filled}/${attendanceProgress.total}`
              : "수업 없음"
          }
          color={
            attendanceProgress.pct != null && attendanceProgress.pct >= 100
              ? "var(--tc-success)"
              : "var(--tc-primary)"
          }
        />
      </div>

      <SectionTitle>바로 처리</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "var(--tc-space-2)",
        }}
      >
        <QuickAction
          icon={<MessageSquare size={ICON.md} />}
          label="답변 대기"
          detail={pendingQnaCount > 0 ? `${pendingQnaCount}건` : "QnA"}
          tone={pendingQnaCount > 0 ? "danger" : "primary"}
          onClick={() => navigate("/teacher/comms?tab=qna")}
        />
        <QuickAction
          icon={<Send size={ICON.md} />}
          label="알림톡"
          detail="학생 선택"
          tone="primary"
          onClick={() => navigate("/teacher/students", { state: { startSelectMode: true, preferredMessageTiming: "now" } })}
        />
        <QuickAction
          icon={<Clock size={ICON.md} />}
          label="예약 발송"
          detail="시간 설정"
          tone="neutral"
          onClick={() => navigate("/teacher/students", { state: { startSelectMode: true, preferredMessageTiming: "scheduled" } })}
        />
      </div>

      {/* === 지금 처리할 일 ===
          알림 센터와 동일 데이터. Today는 빠른 진입점, 알림 센터는 카테고리별 처리 가이드.
          사용자 멘탈 모델 정리를 위해 우측에 "전체 보기" 링크 추가. */}
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            {pendingItems.length > 0 ? (
              <Badge tone="danger" pill>{pendingTotal}건</Badge>
            ) : (
              <Badge tone="success" pill size="xs">비어있음</Badge>
            )}
            <button
              onClick={() => navigate("/teacher/notifications")}
              aria-label="알림 전체 보기"
              className="text-[12px] cursor-pointer"
              style={notificationLinkStyle}
            >
              전체
              <ChevronRight size={ICON.xs} style={{ color: "var(--tc-text-muted)" }} />
            </button>
          </div>
        }
      >
        지금 처리할 일
      </SectionTitle>
      {pendingItems.length > 0 ? (
        <Card style={{ padding: 0, overflow: "hidden", boxShadow: "var(--tc-shadow-sm)" }}>
          {pendingItems.map((item, idx) => (
            <PendingRow
              key={item.type}
              label={item.label}
              count={item.count}
              isLast={idx === pendingItems.length - 1}
              onClick={() => navigate(TEACHER_PENDING_ROUTES[item.type])}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--tc-space-3)",
              color: "var(--tc-text-secondary)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: "var(--tc-success-bg)",
                color: "var(--tc-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="text-[14px] font-semibold" style={{ color: "var(--tc-text)" }}>
                지금 처리할 일이 없어요
              </div>
              <div className="text-[12px]" style={{ color: "var(--tc-text-muted)", marginTop: 2 }}>
                새 알림이 들어오면 여기에 표시됩니다.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* === 오늘의 수업 === */}
      <SectionTitle
        right={
          sessionCount > 0 ? (
            <Badge tone="primary" pill size="xs">
              {sessionCount}건
            </Badge>
          ) : undefined
        }
      >
        오늘의 수업
      </SectionTitle>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : sessions && sessions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      ) : (
        <Card>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "var(--tc-space-3)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="text-[14px] font-semibold" style={{ color: "var(--tc-text)" }}>
                오늘 예정된 수업이 없어요
              </div>
              <div className="text-[12px]" style={{ color: "var(--tc-text-muted)", marginTop: 2 }}>
                강의 목록에서 시간표를 확인하거나 차시를 추가하세요.
              </div>
            </div>
            <button
              onClick={() => navigate("/teacher/classes")}
              className="rounded-full text-[13px] font-semibold cursor-pointer"
              style={{
                padding: "8px 16px",
                background: "var(--tc-primary)",
                color: "var(--tc-primary-contrast)",
                border: "none",
              }}
            >
              강의 보기 →
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  detail,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  tone: "primary" | "danger" | "neutral";
  onClick: () => void;
}) {
  const color = tone === "danger"
    ? "var(--tc-danger)"
    : tone === "primary"
      ? "var(--tc-primary)"
      : "var(--tc-text-secondary)";
  const bg = tone === "danger"
    ? "var(--tc-danger-bg)"
    : tone === "primary"
      ? "var(--tc-primary-bg)"
      : "var(--tc-surface-soft)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      style={{
        minHeight: 86,
        padding: "12px 10px",
        borderRadius: "var(--tc-radius)",
        border: "1px solid var(--tc-border)",
        background: "var(--tc-surface)",
        color: "var(--tc-text)",
        textAlign: "left",
        boxShadow: "var(--tc-shadow-sm)",
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--tc-radius-sm)",
          display: "grid",
          placeItems: "center",
          background: bg,
          color,
          marginBottom: 8,
        }}
      >
        {icon}
      </span>
      <span className="block text-[13px] font-bold" style={{ color: "var(--tc-text)" }}>
        {label}
      </span>
      <span className="block text-[11px] font-semibold mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
        {detail}
      </span>
    </button>
  );
}

function PendingRow({
  label,
  count,
  isLast,
  onClick,
}: {
  label: string;
  count: number;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label} ${count}건 처리하기`}
      className="flex justify-between items-center w-full text-left cursor-pointer"
      style={{
        padding: "var(--tc-space-3) var(--tc-space-4)",
        background: "none",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid var(--tc-border)",
      }}
    >
      <span className="text-sm" style={{ color: "var(--tc-text)" }}>
        {label}
      </span>
      <span className="flex items-center gap-2">
        <Badge tone="danger" pill>
          {count}건
        </Badge>
        <ChevronRight size={ICON.sm} style={{ color: "var(--tc-text-muted)" }} />
      </span>
    </button>
  );
}
