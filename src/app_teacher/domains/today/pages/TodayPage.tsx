// PATH: src/app_teacher/domains/today/pages/TodayPage.tsx
// 오늘 홈 — 인사 + KPI 4개 + 지금 처리할 일 + 오늘 수업
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import useAuth from "@/auth/hooks/useAuth";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import { Card, KpiCard, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { ChevronRight } from "@teacher/shared/ui/Icons";
import { TEACHER_PENDING_ROUTES } from "@teacher/domains/notifications/routes";
import { fetchTodaySessions } from "../api";
import SessionCard from "../components/SessionCard";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayPage() {
  const today = todayISO();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["today-sessions", today],
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

  const greetingName = user?.name?.trim() || "선생님";
  const pendingTotal = pendingCounts?.total ?? 0;
  const recentSubs = pendingCounts?.recentSubmissions ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* === Greeting / Date === */}
      <div style={{ padding: "var(--tc-space-1) var(--tc-space-1) var(--tc-space-2)" }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--tc-text-muted)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
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
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
          }}
        >
          안녕하세요, {greetingName}
        </h1>
      </div>

      {/* === KPI Grid === */}
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
          sub="건"
          color="var(--tc-text)"
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
        <KpiCard
          label="처리할 일"
          value={pendingTotal}
          sub={pendingTotal > 0 ? "건" : "없음"}
          color={pendingTotal > 0 ? "var(--tc-danger)" : "var(--tc-text-muted)"}
          onClick={pendingTotal > 0 ? () => {
            const first = pendingItems[0];
            if (first) navigate(TEACHER_PENDING_ROUTES[first.type]);
          } : undefined}
        />
        <KpiCard
          label="최근 제출"
          value={recentSubs}
          sub={recentSubs > 0 ? "건" : "없음"}
          color={recentSubs > 0 ? "var(--tc-info)" : "var(--tc-text-muted)"}
          onClick={recentSubs > 0 ? () => navigate("/teacher/submissions") : undefined}
        />
      </div>

      {/* === 지금 처리할 일 === */}
      <SectionTitle
        right={
          pendingItems.length > 0 ? (
            <Badge tone="danger" pill>
              {pendingTotal}건
            </Badge>
          ) : (
            <Badge tone="success" pill size="xs">
              비어있음
            </Badge>
          )
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
        <ChevronRight size={16} style={{ color: "var(--tc-text-muted)" }} />
      </span>
    </button>
  );
}
