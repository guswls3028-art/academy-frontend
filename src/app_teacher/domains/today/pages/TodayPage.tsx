/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/today/pages/TodayPage.tsx
// 오늘 홈 — 우선순위 업무 + 오늘 수업 + 빠른 처리
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import useAuth from "@/auth/hooks/useAuth";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import { Card, KpiCard, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { AlertCircle, BookOpen, CheckCircle, ChevronRight, Clock, MessageSquare, Send, Sparkles } from "@teacher/shared/ui/Icons";
import { TEACHER_PENDING_ROUTES } from "@teacher/domains/notifications/routes";
import { todayLocalISO as todayISO } from "@/shared/utils/localDate";
import { fetchTodaySessions } from "../api";
import { teacherTodayQueryKeys } from "../queryKeys";
import SessionCard from "../components/SessionCard";
import styles from "./TodayPage.module.css";

  const notificationLinkStyle: CSSProperties = {
    minHeight: "var(--tc-touch-min)",
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

  const sessionsQ = useQuery({
    queryKey: teacherTodayQueryKeys.sessions(today),
    queryFn: () => fetchTodaySessions(today),
    staleTime: 60_000,
  });
  const sessions = sessionsQ.data;
  const isLoading = sessionsQ.isLoading;

  const {
    items: pendingItems,
    counts: pendingCounts,
    failures: pendingFailures,
    isLoading: pendingIsLoading,
    isError: pendingIsError,
  } = useTeacherPendingCounts();

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
  const greetingName = userName ? (userName.endsWith("님") ? userName : `${userName}님`) : honorific;
  const pendingUnavailable = pendingIsError || pendingFailures.length > 0;
  const pendingTotal = pendingIsLoading || pendingUnavailable ? null : pendingCounts?.total ?? 0;
  const pendingQnaCount = pendingCounts?.qnaPending ?? 0;
  const todayWorkTotal = (pendingTotal ?? 0) + attendanceGap;
  const hasTodayWork = pendingTotal == null || todayWorkTotal > 0;
  const primaryWork = useMemo(() => {
    if (pendingIsLoading) {
      return {
        icon: <Clock size={ICON.md} />,
        eyebrow: "확인 중",
        title: "업무 알림을 확인하고 있습니다",
        description: "조회가 끝나기 전에는 처리할 일을 0건으로 표시하지 않습니다.",
        action: "알림 센터 보기",
        route: "/workspace/mobile/notifications",
        tone: "primary" as const,
      };
    }

    if (pendingUnavailable) {
      return {
        icon: <AlertCircle size={ICON.md} />,
        eyebrow: "확인 필요",
        title: "업무 알림을 모두 불러오지 못했습니다",
        description: "일부 조회가 실패해 0건으로 계산하지 않았습니다. 알림 센터에서 다시 확인해 주세요.",
        action: "알림 센터 보기",
        route: "/workspace/mobile/notifications",
        tone: "danger" as const,
      };
    }

    if (pendingQnaCount > 0) {
      return {
        icon: <MessageSquare size={ICON.md} />,
        eyebrow: "가장 먼저",
        title: `답변 대기 질문 ${pendingQnaCount}건`,
        description: "학생 질문은 지연될수록 체감 품질이 바로 떨어집니다.",
        action: "Q&A 처리",
        route: "/workspace/mobile/comms?tab=qna",
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
        route: "/workspace/mobile/classes",
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
        route: `/workspace/mobile/classes/${nextSession.lecture}/sessions/${nextSession.id}`,
        tone: "primary" as const,
      };
    }

    return {
      icon: <CheckCircle size={ICON.md} />,
      eyebrow: "정리됨",
      title: "오늘 바로 처리할 일이 없습니다",
      description: "강의 일정이나 학생 메시지를 확인하며 다음 업무를 준비하세요.",
      action: "강의 확인",
      route: "/workspace/mobile/classes",
      tone: "success" as const,
    };
  }, [attendanceGap, nextSession, nextSessionLabel, pendingIsLoading, pendingItems, pendingQnaCount, pendingUnavailable]);

  if (sessionsQ.isError) {
    return (
      <div className={styles.page}>
        <EmptyState
          scope="panel"
          tone="error"
          title="오늘 수업을 불러오지 못했습니다"
          description="수업·출결 건수를 0으로 계산하지 않고 업무 요약을 중단했습니다."
          actions={<button type="button" onClick={() => void sessionsQ.refetch()} className={styles.emptyActionButton}>다시 시도</button>}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroMeta}>
          <span>{dateStr}</span>
          <Badge tone={hasTodayWork ? "danger" : "success"} pill size="xs">
            {pendingIsLoading
              ? "업무 집계 중"
              : pendingUnavailable
                ? "업무 확인 필요"
                : hasTodayWork
                  ? `오늘 업무 ${todayWorkTotal}건`
                  : "정리됨"}
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
          label="오늘 업무"
          value={pendingTotal == null ? "—" : todayWorkTotal}
          sub={pendingIsLoading ? "집계 중" : pendingUnavailable ? "확인 필요" : hasTodayWork ? "건" : "없음"}
          color={hasTodayWork ? "var(--tc-danger)" : "var(--tc-success)"}
          onClick={() => navigate(primaryWork.route)}
        />
        <KpiCard
          label="오늘 수업"
          value={sessionCount}
          sub={sessionCount > 0 ? "건" : "없음"}
          color={sessionCount > 0 ? "var(--tc-text)" : "var(--tc-text-muted)"}
          onClick={() => navigate("/workspace/mobile/classes")}
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
          onClick={() => navigate(nextSession ? `/workspace/mobile/classes/${nextSession.lecture}/sessions/${nextSession.id}` : "/workspace/mobile/classes")}
        />
      </div>

      <div className={styles.workGrid}>
        <section className={styles.workColumn}>
          <SectionTitle>바로 처리</SectionTitle>
          <div className={styles.quickGrid}>
            <QuickAction
              icon={<Sparkles size={ICON.md} />}
              label="학생 업무"
              detail="사진으로 처리 · BETA"
              tone="primary"
              onClick={() => navigate("/workspace/mobile/assistant")}
            />
            <QuickAction
              icon={<MessageSquare size={ICON.md} />}
              label="답변 대기"
              detail={pendingQnaCount > 0 ? `${pendingQnaCount}건` : "QnA"}
              tone={pendingQnaCount > 0 ? "danger" : "primary"}
              onClick={() => navigate("/workspace/mobile/comms?tab=qna")}
            />
            <QuickAction
              icon={<Send size={ICON.md} />}
              label="알림톡"
              detail="학생 선택"
              tone="primary"
              onClick={() => navigate("/workspace/mobile/students", { state: { startSelectMode: true, preferredMessageTiming: "now" } })}
            />
            <QuickAction
              icon={<Clock size={ICON.md} />}
              label="예약 발송"
              detail="시간 설정"
              tone="neutral"
              onClick={() => navigate("/workspace/mobile/students", { state: { startSelectMode: true, preferredMessageTiming: "scheduled" } })}
            />
          </div>

          <SectionTitle
            right={
              <div className="flex items-center gap-2">
                {hasTodayWork ? (
                  <Badge tone="danger" pill>{todayWorkTotal}건</Badge>
                ) : (
                  <Badge tone="success" pill size="xs">비어있음</Badge>
                )}
                <button
                  onClick={() => navigate("/workspace/mobile/notifications")}
                  aria-label="알림 센터 보기"
                  className="text-[12px] cursor-pointer"
                  style={notificationLinkStyle}
                >
                  알림 센터
                  <ChevronRight size={ICON.xs} style={{ color: "var(--tc-text-muted)" }} />
                </button>
              </div>
            }
          >
            처리 대기함
          </SectionTitle>
          {hasTodayWork ? (
            <Card className={styles.pendingCard}>
              {pendingItems.map((item, idx) => (
                <PendingRow
                  key={item.type}
                  label={item.label}
                  count={item.count}
                  isLast={attendanceGap === 0 && idx === pendingItems.length - 1}
                  onClick={() => navigate(TEACHER_PENDING_ROUTES[item.type])}
                />
              ))}
              {attendanceGap > 0 && (
                <PendingRow
                  label="출결 미입력"
                  count={attendanceGap}
                  isLast
                  onClick={() => navigate("/workspace/mobile/classes")}
                />
              )}
            </Card>
          ) : (
            <Card className={styles.emptyWorkCard}>
              <span className={styles.emptyWorkIcon} aria-hidden>
                <CheckCircle size={ICON.md} />
              </span>
              <div>
                <div className={styles.emptyWorkTitle}>처리 대기함이 비었습니다</div>
                <div className={styles.emptyWorkText}>새 질문, 제출, 출결 업무가 생기면 이곳에서 바로 이어갑니다.</div>
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
                <button type="button" onClick={() => navigate("/workspace/mobile/classes")} className={styles.emptyActionButton}>
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
      className={`${styles.pendingRow} flex justify-between items-center w-full text-left cursor-pointer`}
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
