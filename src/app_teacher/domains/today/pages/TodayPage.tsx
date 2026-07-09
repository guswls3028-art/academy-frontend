/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/today/pages/TodayPage.tsx
// 오늘 홈 — 우선순위 업무 + 오늘 수업 + 빠른 처리
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import useAuth from "@/auth/hooks/useAuth";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import { Card, KpiCard, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { AlertCircle, BookOpen, CheckCircle, ChevronRight, Clock, MessageSquare, Send } from "@teacher/shared/ui/Icons";
import { TEACHER_PENDING_ROUTES } from "@teacher/domains/notifications/routes";
import { todayLocalISO as todayISO } from "@/shared/utils/localDate";
import { fetchTodaySessions } from "../api";
import { teacherTodayQueryKeys } from "../queryKeys";
import SessionCard from "../components/SessionCard";
import styles from "./TodayPage.module.css";

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

  const attendanceGap = Math.max(attendanceProgress.total - attendanceProgress.filled, 0);
  const nextSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    return [...sessions].sort((a, b) => (a.start_time ?? "99:99").localeCompare(b.start_time ?? "99:99"))[0];
  }, [sessions]);

  const nextSessionLabel = nextSession?.start_time
    ? `${nextSession.start_time.slice(0, 5)} 시작`
    : nextSession
      ? "시간 미정"
      : "수업 없음";

  const honorific = (() => {
    const role = user?.tenantRole;
    if (role === "owner") return "원장님";
    if (role === "admin") return "관리자님";
    return "선생님";
  })();
  const userName = user?.name?.trim();
  const greetingName = userName ? `${userName}님` : honorific;
  const pendingTotal = pendingCounts?.total ?? 0;
  const pendingQnaCount = pendingCounts?.qnaPending ?? 0;
  const primaryWork = useMemo(() => {
    if (pendingQnaCount > 0) {
      return {
        icon: <MessageSquare size={ICON.md} />,
        eyebrow: "가장 먼저",
        title: `답변 대기 질문 ${pendingQnaCount}건`,
        description: "학생 질문은 지연될수록 체감 품질이 바로 떨어집니다.",
        action: "Q&A 처리",
        route: "/teacher/comms?tab=qna",
        tone: "danger" as const,
      };
    }

    const firstPending = pendingItems[0];
    if (firstPending) {
      return {
        icon: <AlertCircle size={ICON.md} />,
        eyebrow: "처리 필요",
        title: `${firstPending.label} ${firstPending.count}건`,
        description: "알림 센터에서 같은 항목을 이어서 처리할 수 있습니다.",
        action: "처리하러 가기",
        route: TEACHER_PENDING_ROUTES[firstPending.type],
        tone: "warning" as const,
      };
    }

    if (attendanceGap > 0) {
      return {
        icon: <Clock size={ICON.md} />,
        eyebrow: "오늘 마감",
        title: `출결 미입력 ${attendanceGap}명`,
        description: "오늘 수업 카드에서 바로 출석 입력으로 이어가세요.",
        action: "오늘 수업 보기",
        route: "/teacher/classes",
        tone: "primary" as const,
      };
    }

    if (nextSession) {
      return {
        icon: <BookOpen size={ICON.md} />,
        eyebrow: "다음 수업",
        title: nextSession.lecture_title || nextSession.title,
        description: nextSessionLabel,
        action: "수업 열기",
        route: `/teacher/classes/${nextSession.lecture}/sessions/${nextSession.id}`,
        tone: "primary" as const,
      };
    }

    return {
      icon: <CheckCircle size={ICON.md} />,
      eyebrow: "정리됨",
      title: "오늘 바로 처리할 일이 없습니다",
      description: "강의 일정이나 학생 메시지를 확인하며 다음 업무를 준비하세요.",
      action: "강의 확인",
      route: "/teacher/classes",
      tone: "success" as const,
    };
  }, [attendanceGap, nextSession, nextSessionLabel, pendingItems, pendingQnaCount]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroMeta}>
          <span>{dateStr}</span>
          <Badge tone={pendingTotal > 0 ? "danger" : "success"} pill size="xs">
            {pendingTotal > 0 ? `처리 ${pendingTotal}건` : "정리됨"}
          </Badge>
        </div>
        <div className={styles.heroBody}>
          <div className={styles.heroText}>
            <p className={styles.greeting}>안녕하세요, {greetingName}</p>
            <h1 className={styles.heroTitle}>{primaryWork.title}</h1>
            <p className={styles.heroDescription}>{primaryWork.description}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(primaryWork.route)}
            className={`${styles.primaryWorkButton} ${styles[`primaryWorkButton_${primaryWork.tone}`]}`}
          >
            <span className={styles.primaryWorkIcon}>{primaryWork.icon}</span>
            <span>
              <span className={styles.primaryWorkEyebrow}>{primaryWork.eyebrow}</span>
              <span className={styles.primaryWorkAction}>{primaryWork.action}</span>
            </span>
            <ChevronRight size={ICON.sm} />
          </button>
        </div>
      </section>

      <div className={styles.kpiGrid}>
        <KpiCard
          label="처리할 일"
          value={pendingTotal}
          sub={pendingTotal > 0 ? "건" : "없음"}
          color={pendingTotal > 0 ? "var(--tc-danger)" : "var(--tc-success)"}
          onClick={() => navigate("/teacher/notifications")}
        />
        <KpiCard
          label="오늘 수업"
          value={sessionCount}
          sub={sessionCount > 0 ? "건" : "없음"}
          color={sessionCount > 0 ? "var(--tc-text)" : "var(--tc-text-muted)"}
          onClick={() => navigate("/teacher/classes")}
        />
        <KpiCard
          label="출결 입력"
          value={attendanceProgress.pct != null ? `${attendanceProgress.pct}%` : "—"}
          sub={attendanceProgress.total > 0 ? `${attendanceProgress.filled}/${attendanceProgress.total}` : "수업 없음"}
          color={attendanceProgress.pct != null && attendanceProgress.pct >= 100 ? "var(--tc-success)" : "var(--tc-primary)"}
        />
        <KpiCard
          label="다음 수업"
          value={nextSession ? nextSessionLabel : "—"}
          sub={nextSession?.lecture_title || nextSession?.title || "일정 없음"}
          color={nextSession ? "var(--tc-primary)" : "var(--tc-text-muted)"}
          onClick={() => navigate(nextSession ? `/teacher/classes/${nextSession.lecture}/sessions/${nextSession.id}` : "/teacher/classes")}
        />
      </div>

      <div className={styles.workGrid}>
        <section className={styles.workColumn}>
          <SectionTitle>바로 처리</SectionTitle>
          <div className={styles.quickGrid}>
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
            처리 대기함
          </SectionTitle>
          {pendingItems.length > 0 ? (
            <Card className={styles.pendingCard}>
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
            <Card className={styles.emptyWorkCard}>
              <span className={styles.emptyWorkIcon} aria-hidden>
                <CheckCircle size={ICON.md} />
              </span>
              <div>
                <div className={styles.emptyWorkTitle}>처리 대기함이 비었습니다</div>
                <div className={styles.emptyWorkText}>새 질문, 제출, 알림이 생기면 이곳에서 바로 이어갑니다.</div>
              </div>
            </Card>
          )}
        </section>

        <section className={styles.lessonColumn}>
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
            <div className={styles.sessionList}>
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          ) : (
            <EmptyState
              scope="panel"
              tone="empty"
              title="오늘 수업이 없습니다"
              description="강의 일정이 비어 있으면 출결·성적 업무도 생성되지 않습니다."
              actions={
                <button type="button" onClick={() => navigate("/teacher/classes")} className={styles.emptyActionButton}>
                  강의 일정 확인
                </button>
              }
            />
          )}
        </section>
      </div>
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
