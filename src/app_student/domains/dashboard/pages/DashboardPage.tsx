/* eslint-disable no-restricted-syntax */
/**
 * 학생 홈 — 모바일 우선
 *
 * 정보 우선순위:
 *   1) 다음 일정 카운트다운
 *   2) 오늘 할 일 (긍정/중립/부정 혼합, 비어 있으면 응원 메시지)
 *   3) 오늘 수업
 *   4) 학습 현황 (활동성 우선, 시험 평균은 완화 컬러)
 *   5) 공지 (긴급 1건+ 또는 신규 있을 때만 강조, 비어 있으면 1행 라인 링크)
 *   6) 앱 아이콘 (탭바 중복 제거 + 출석 포함, 6개)
 *   7) 학원문의 (1행 압축, 분점 다수일 때만 펼침)
 *
 * 부분 실패: 한쪽 쿼리만 실패해도 가능한 섹션 노출.
 */
import { useState, useEffect, useMemo, memo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "@/auth/context/AuthContext";
import { Badge } from "@/shared/ui/ds";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import type { StudentDashboardResponse } from "../api/dashboard.api";
import { useMySessions } from "@student/domains/sessions/hooks/useStudentSessions";
import { useMyGradesSummary } from "@student/domains/grades/hooks/useMyGradesSummary";
import type { MyExamGradeSummary, MyGradesSummary, MyHomeworkGradeSummary } from "@student/domains/grades/api/grades.api";
import { useStudentExams } from "@student/domains/exams/hooks/useStudentExams";
import { getParentStudentId } from "@student/shared/api/parentStudentSelection";
import {
  IconCalendar, IconGrade, IconExam, IconNotice,
  IconClipboard, IconClinic, IconFolder, IconChevronRight, IconCheck, IconUser, IconBell, IconBoard,
} from "@student/shared/ui/icons/Icons";
import { formatYmd } from "@student/shared/utils/date";
import { useNotificationCounts } from "@student/domains/notifications/hooks/useNotificationCounts";
import type { NotificationCounts } from "@student/domains/notifications/api/notifications.api";
import NotificationBadge from "@student/shared/ui/components/NotificationBadge";
import type { StudentSession } from "@student/domains/sessions/api/sessions.api";
import styles from "./DashboardPage.module.css";

/* ============================================================================
 * 유틸
 * ========================================================================== */

function sessionToDate(s: StudentSession): Date | null {
  if (!s.date) return null;
  const [y, m, d] = s.date.split("-").map(Number);
  if (!y || !m || !d) return null;
  if (s.start_time) {
    const parts = s.start_time.split(":").map(Number);
    return new Date(y, m - 1, d, parts[0] ?? 0, parts[1] ?? 0);
  }
  return new Date(y, m - 1, d, 0, 0);
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "곧 시작";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}일 ${hours}시간 후`;
  if (hours > 0) return `${hours}시간 ${mins}분 후`;
  return `${mins}분 후`;
}

function ymdToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const ms = startOfDay(dt).getTime() - startOfDay(new Date()).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/* ============================================================================
 * 카운트다운 카드 — 다음 일정
 *  - 적응형 갱신: 5분 이내 30초, 그 외 60초
 *  - 페이지 백그라운드일 때 갱신 중지 (배터리 절약)
 * ========================================================================== */

const CountdownCard = memo(function CountdownCard({
  session, dt,
}: { session: StudentSession; dt: Date }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const cur = new Date();
      setNow(cur);
      const remainingMs = dt.getTime() - cur.getTime();
      const nextDelay = remainingMs <= 0 ? 60_000 : remainingMs <= 5 * 60_000 ? 30_000 : 60_000;
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(tick, nextDelay);
    };

    const start = () => {
      if (intervalId) clearInterval(intervalId);
      tick();
    };
    const stop = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [dt]);

  const linkTo = session.type === "clinic" ? "/student/clinic" : `/student/sessions/${session.id}`;
  const isClinic = session.type === "clinic";
  const remainingMs = dt.getTime() - now.getTime();
  const isImminent = remainingMs > 0 && remainingMs <= 30 * 60_000;

  return (
    <Link
      to={linkTo}
      className={`${styles.countdownCard} ${isClinic ? styles.countdownCardClinic : ""}`}
      data-imminent={!isClinic && isImminent ? "true" : undefined}
    >
      <div className={styles.countdownInner}>
        <div className={styles.countdownIcon}>
          {isClinic
            ? <IconClinic />
            : <IconCalendar />}
        </div>
        <div className={styles.countdownCopy}>
          <div className={styles.countdownLabel}>다음 일정</div>
          <div className={styles.countdownTitle}>{session.title}</div>
          <div className={styles.countdownTimeText}>
            {formatYmd(session.date ?? null)}
            {session.start_time && ` ${session.start_time.slice(0, 5)}`}
          </div>
        </div>
        <div className={styles.countdownValue}>
          {formatRemaining(remainingMs)}
        </div>
      </div>
    </Link>
  );
});

/* ============================================================================
 * 앱 아이콘
 * ========================================================================== */

function AppIcon({
  to, icon, label, badge,
}: { to: string; icon: ReactNode; label: string; badge?: number; }) {
  return (
    <Link to={to} className={styles.shortcut}>
      <div className={styles.shortcutIcon}>
        {icon}
        {badge != null && badge > 0 && <NotificationBadge count={badge} />}
      </div>
      <span className={styles.shortcutLabel}>{label}</span>
    </Link>
  );
}

function QuickAction({
  to, state, icon, label, detail, badge, primary = false,
}: {
  to: string;
  state?: unknown;
  icon: ReactNode;
  label: string;
  detail: string;
  badge?: number;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      state={state}
      className={`${styles.quickAction} ${primary ? styles.quickActionPrimary : ""}`}
    >
      <span className={styles.quickActionIcon}>
        {icon}
      </span>
      <span className={styles.quickActionBody}>
        <span className={styles.quickActionLabel}>
          <span className={styles.quickActionLabelText}>{label}</span>
          {badge != null && badge > 0 && (
            <Badge variant="solid" tone="primary" size="xs" className={styles.quickActionBadge}>
              {badge}
            </Badge>
          )}
        </span>
        <span className={styles.quickActionDetail}>{detail}</span>
      </span>
      <IconChevronRight className={styles.quickActionChevron} />
    </Link>
  );
}

/* ============================================================================
 * 페이지
 * ========================================================================== */

export default function DashboardPage() {
  const { user } = useAuthContext();
  const feesEnabled = useFeesEnabled();
  const { data: dashboard, isLoading: dashLoading, isError: dashError } = useStudentDashboard();
  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useMySessions();
  const { data: grades } = useMyGradesSummary();
  const { data: examsResp } = useStudentExams({ include_upcoming: true });
  const { data: notificationCounts, isLoading: countsLoading } = useNotificationCounts();
  const isParent = user?.tenantRole === "parent";

  const today = ymdToday();
  const todaySessions = useMemo<StudentSession[]>(() => {
    const dashboardSessions = dashboard?.today_sessions;
    if (dashboardSessions) {
      return dashboardSessions.map((s) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        status: s.status,
        type: s.type ?? "session",
        start_time: s.start_time ?? null,
      }));
    }
    return (sessions ?? []).filter((s) => (s.date ?? "").slice(0, 10) === today);
  }, [dashboard?.today_sessions, sessions, today]);

  const nextSession = useMemo(() => {
    if (!sessions?.length) return null;
    const now = Date.now();
    let best: { session: StudentSession; dt: Date } | null = null;
    for (const s of sessions) {
      const dt = sessionToDate(s);
      if (!dt || dt.getTime() <= now) continue;
      if (!best || dt.getTime() < best.dt.getTime()) best = { session: s, dt };
    }
    return best;
  }, [sessions]);

  /* ─── 오늘 할 일 항목 빌드 ─── */
  const failedExams = useMemo(
    () => (grades?.exams ?? []).filter((e) => e.is_pass === false),
    [grades?.exams],
  );
  const failedHomeworks = useMemo(
    () => (grades?.homeworks ?? []).filter((h) => h.passed === false),
    [grades?.homeworks],
  );

  /* 다가오는 시험: open_at이 오늘~+7일, 아직 결과 없는 것 */
  const upcomingExams = useMemo(() => {
    const items = examsResp?.items ?? [];
    return items
      .map((e) => ({ exam: e, d: daysUntil(e.open_at) }))
      .filter((x) => x.d != null && x.d >= 0 && x.d <= 7 && !x.exam.has_result)
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  }, [examsResp]);

  const clinicUpcoming = dashboard?.badges?.clinic_upcoming === true;
  const replyCount = (notificationCounts?.qna ?? 0) + (notificationCounts?.counsel ?? 0);

  const todoCount =
    upcomingExams.length +
    failedHomeworks.length +
    failedExams.length +
    (clinicUpcoming ? 1 : 0) +
    (replyCount > 0 ? 1 : 0);

  /* 로딩 / 에러 — 주 데이터(dashboard) 또는 sessions 둘 다 로딩 중일 때만 스켈레톤 */
  if (dashLoading && sessionsLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius-md)" }} />
        <div className="stu-skel" style={{ height: 100, marginTop: 12, borderRadius: "var(--stu-radius-md)" }} />
        <div className="stu-skel" style={{ height: 120, marginTop: 12, borderRadius: "var(--stu-radius-md)" }} />
      </div>
    );
  }

  /* 둘 다 실패 — 전체 다시 시도. 한쪽만 실패면 가능한 섹션 노출. */
  if (dashError && sessionsError) {
    return (
      <div style={{ padding: "var(--stu-space-8) var(--stu-space-4)", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "var(--stu-text-muted)", marginBottom: "var(--stu-space-4)" }}>
          정보를 불러오지 못했어요.
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 20px",
            borderRadius: "var(--stu-radius-md)",
            border: "1px solid var(--stu-border)",
            background: "var(--stu-surface)",
            color: "var(--stu-text)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  const hasUrgentNotice = (dashboard?.notices ?? []).some((n) => n.is_urgent === true);
  const hasNotices = (dashboard?.notices?.length ?? 0) > 0;

  if (isParent) {
    const selectedStudentId = getParentStudentId();
    const childName =
      user?.linkedStudents?.find((s) => s.id === selectedStudentId)?.name
      ?? user?.linkedStudentName
      ?? user?.linkedStudents?.[0]?.name
      ?? "자녀";

    return (
      <ParentDashboardView
        childName={childName}
        todaySessions={todaySessions}
        nextSession={nextSession}
        failedExams={failedExams}
        failedHomeworks={failedHomeworks}
        upcomingExams={upcomingExams}
        clinicUpcoming={clinicUpcoming}
        replyCount={replyCount}
        notificationCounts={notificationCounts}
        countsLoading={countsLoading}
        grades={grades ?? null}
        sessions={sessions ?? null}
        notices={dashboard?.notices ?? []}
        hasUrgentNotice={hasUrgentNotice}
        hasNotices={hasNotices}
        tenantInfo={dashboard?.tenant_info ?? null}
        feesEnabled={feesEnabled}
      />
    );
  }

  return (
    <div className={styles.page}>
      {hasUrgentNotice && (
        <UrgentNotice notices={(dashboard?.notices ?? []).filter((n) => n.is_urgent)} />
      )}

      <section className={styles.hero} data-guide="dash-todo">
        <div className={styles.heroTop}>
          <div>
            <div className={styles.heroEyebrow}>오늘 할 일</div>
            <h2 className={styles.heroTitle}>
              {todoCount > 0 ? "오늘 확인할 일이 있어요" : "오늘은 급한 일이 없어요"}
            </h2>
            <p className={styles.heroDescription}>
              {todoCount > 0
                ? "시험, 답변, 클리닉처럼 지금 확인하면 좋은 항목만 모았어요."
                : "수업과 영상 학습 흐름만 차근차근 이어가면 됩니다."}
            </p>
          </div>
          <div className={styles.heroPill}>{todoCount > 0 ? `${todoCount}건` : "정리됨"}</div>
        </div>

        {nextSession && (
          <div data-guide="dash-countdown">
            <CountdownCard session={nextSession.session} dt={nextSession.dt} />
          </div>
        )}

        {todoCount > 0 ? (
          <div className={`stu-panel ${styles.todoPanel}`}>
            {upcomingExams.length > 0 && (() => {
              const preview = upcomingExams.slice(0, 2).map((x) => x.exam.title);
              const nearest = upcomingExams[0];
              const dLabel = nearest && nearest.d != null
                ? (nearest.d === 0 ? "오늘" : nearest.d === 1 ? "내일" : `D-${nearest.d}`)
                : "";
              const more = upcomingExams.length - 2 > 0 ? ` 외 ${upcomingExams.length - 2}건` : "";
              return (
                <TodoRow
                  to="/student/exams"
                  icon={<IconExam />}
                  iconBg="color-mix(in srgb, var(--stu-primary) 14%, var(--stu-surface-1))"
                  label={`다가오는 시험 ${upcomingExams.length}건${dLabel ? ` · ${dLabel}` : ""}`}
                  labelColor="var(--stu-primary)"
                  detail={preview.join(", ") + more}
                />
              );
            })()}

            {replyCount > 0 && (() => {
              /* qna가 더 많으면 QnA 탭, 아니면 상담 탭으로 prefill */
              const qnaC = notificationCounts?.qna ?? 0;
              const counselC = notificationCounts?.counsel ?? 0;
              const prefillTab = qnaC >= counselC ? "qna" : "counsel";
              return (
                <TodoRow
                  to="/student/community"
                  state={{ tab: prefillTab }}
                  icon={<IconBell />}
                  iconBg="color-mix(in srgb, var(--stu-success) 14%, var(--stu-surface-1))"
                  label={`새 답변 ${replyCount}건`}
                  labelColor="var(--stu-success)"
                  detail="질문/상담에 선생님이 답변했어요"
                />
              );
            })()}

            {clinicUpcoming && (
              <TodoRow
                to="/student/clinic"
                icon={<IconClinic />}
                iconBg="color-mix(in srgb, var(--stu-primary) 16%, var(--stu-surface-1))"
                label="클리닉 예약이 있어요"
                labelColor="var(--stu-primary)"
              />
            )}

            {failedHomeworks.length > 0 && (() => {
              const preview = failedHomeworks.slice(0, 2).map((h) => h.title);
              const more = failedHomeworks.length - 2 > 0 ? ` 외 ${failedHomeworks.length - 2}건` : "";
              return (
                <TodoRow
                  to="/student/grades"
                  icon={<IconClipboard />}
                  iconBg="var(--stu-warn-bg)"
                  label={`과제 미통과 ${failedHomeworks.length}건`}
                  labelColor="var(--stu-warn-text)"
                  detail={preview.join(", ") + more}
                />
              );
            })()}

            {failedExams.length > 0 && (() => {
              const preview = failedExams.slice(0, 2).map((e) => e.title);
              const more = failedExams.length - 2 > 0 ? ` 외 ${failedExams.length - 2}건` : "";
              return (
                <TodoRow
                  to="/student/exams"
                  icon={<IconExam />}
                  iconBg="var(--stu-danger-bg)"
                  label={`재시험 필요 ${failedExams.length}건`}
                  labelColor="var(--stu-danger)"
                  detail={preview.join(", ") + more}
                />
              );
            })()}
          </div>
        ) : (
          <div className={styles.heroDone}>
            <div className={styles.heroDoneIcon}>
              <IconCheck />
            </div>
            <div>
              <div className={styles.heroDoneTitle}>
                오늘은 급한 할 일이 없어요
              </div>
              <div className={styles.heroDoneText}>
                오늘 수업과 영상 학습으로 차근차근 진행해 보세요
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={styles.quickSection} aria-label="자주 쓰는 일">
        <div className={styles.sectionLabel}>자주 쓰는 일</div>
        <div className={styles.quickGrid}>
          <QuickAction
            to="/student/qna"
            state={{ openQnaForm: true }}
            icon={<IconBoard />}
            label="질문하기"
            detail="바로 질문"
            primary
          />
          <QuickAction
            to="/student/community"
            state={{ tab: replyCount > 0 && (notificationCounts?.counsel ?? 0) > (notificationCounts?.qna ?? 0) ? "counsel" : "qna" }}
            icon={<IconBell />}
            label="답변 보기"
            detail="답변 확인"
            badge={!countsLoading ? replyCount : undefined}
          />
          <QuickAction
            to="/student/clinic"
            icon={<IconClinic />}
            label="클리닉"
            detail="예약·일정"
            badge={!countsLoading ? notificationCounts?.clinic : undefined}
          />
          <QuickAction
            to="/student/grades"
            icon={<IconGrade />}
            label="성적"
            detail="결과 보기"
            badge={!countsLoading ? notificationCounts?.grade : undefined}
          />
        </div>
      </section>

      {todaySessions.length > 0 && (
        <section className={styles.section}>
          <SectionLabel>오늘 수업</SectionLabel>
          <div className={styles.sessionList}>
            {todaySessions.slice(0, 3).map((s) => {
              const isClinic = s.type === "clinic";
              return (
                <Link
                  key={s.id}
                  to={isClinic ? "/student/clinic" : `/student/sessions/${s.id}`}
                  className={`stu-panel stu-panel--pressable ${styles.sessionCard} ${isClinic ? "stu-panel--nav" : "stu-panel--action"}`}
                >
                  <div className={`${styles.sessionIcon} ${isClinic ? styles.sessionIconClinic : ""}`}>
                    {isClinic
                      ? <IconClinic />
                      : <IconCalendar />}
                  </div>
                  <div className={styles.sessionBody}>
                    <div className={styles.sessionTitle}>
                      {s.title}
                      {s.start_time && <span className={styles.sessionTime}>{s.start_time.slice(0, 5)}</span>}
                    </div>
                    <div className="stu-muted">오늘 수업</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div data-guide="dash-stats">
        <LearningStatusCard grades={grades ?? null} sessions={sessions ?? null} />
      </div>

      {!hasUrgentNotice && (
        <NoticeStrip notices={dashboard?.notices ?? []} hasNotices={hasNotices} />
      )}

      <section className={styles.shortcutSection} data-guide="dash-apps">
        <div className={styles.shortcutGrid}>
          <AppIcon to="/student/grades" label="성적"
            icon={<IconGrade />}
            badge={!countsLoading ? notificationCounts?.grade : undefined} />
          <AppIcon to="/student/exams" label="시험"
            icon={<IconExam />} />
          <AppIcon to="/student/submit/assignment" label="과제"
            icon={<IconClipboard />} />
          <AppIcon to="/student/clinic" label="클리닉"
            icon={<IconClinic />}
            badge={!countsLoading ? notificationCounts?.clinic : undefined} />
          <AppIcon to="/student/attendance" label="출결"
            icon={<IconCheck />} />
          <AppIcon to="/student/notices" label="공지"
            icon={<IconNotice />} />
          <AppIcon to="/student/inventory" label="보관함"
            icon={<IconFolder />} />
          <AppIcon to="/student/profile" label="내 정보"
            icon={<IconUser />} />
        </div>
      </section>

      {dashboard?.tenant_info && <AcademyContact tenantInfo={dashboard.tenant_info} />}
    </div>
  );
}

/* ============================================================================
 * 학부모 홈 — 자녀 상태 요약
 * ========================================================================== */

type ParentUpcomingExam = {
  exam: { title: string };
  d: number | null;
};

type ParentDashboardViewProps = {
  childName: string;
  todaySessions: StudentSession[];
  nextSession: { session: StudentSession; dt: Date } | null;
  failedExams: MyExamGradeSummary[];
  failedHomeworks: MyHomeworkGradeSummary[];
  upcomingExams: ParentUpcomingExam[];
  clinicUpcoming: boolean;
  replyCount: number;
  notificationCounts: NotificationCounts | undefined;
  countsLoading: boolean;
  grades: MyGradesSummary | null;
  sessions: StudentSession[] | null;
  notices: Array<{ id: number; title: string; created_at: string | null; is_urgent?: boolean }>;
  hasUrgentNotice: boolean;
  hasNotices: boolean;
  tenantInfo: StudentDashboardResponse["tenant_info"] | null;
  feesEnabled: boolean;
};

function ParentDashboardView({
  childName,
  todaySessions,
  nextSession,
  failedExams,
  failedHomeworks,
  upcomingExams,
  clinicUpcoming,
  replyCount,
  notificationCounts,
  countsLoading,
  grades,
  sessions,
  notices,
  hasUrgentNotice,
  hasNotices,
  tenantInfo,
  feesEnabled,
}: ParentDashboardViewProps) {
  const supportCount = failedExams.length + failedHomeworks.length;
  const attentionCount =
    (replyCount > 0 ? 1 : 0) +
    (todaySessions.length > 0 ? 1 : 0) +
    (upcomingExams.length > 0 ? 1 : 0) +
    (clinicUpcoming ? 1 : 0) +
    (supportCount > 0 ? 1 : 0);
  const qnaC = notificationCounts?.qna ?? 0;
  const counselC = notificationCounts?.counsel ?? 0;
  const answerTab = qnaC >= counselC ? "qna" : "counsel";

  return (
    <div className={styles.page}>
      {hasUrgentNotice && (
        <UrgentNotice notices={notices.filter((n) => n.is_urgent)} />
      )}

      <section className={styles.parentHero} aria-label="우리 아이 요약">
        <div className={styles.parentHeroTop}>
          <div>
            <div className={styles.heroEyebrow}>우리 아이 요약</div>
            <h2 className={styles.parentHeroTitle}>
              {childName} 상태를 한눈에 볼게요
            </h2>
            <p className={styles.heroDescription}>
              일정, 답변, 성적, 출결처럼 학부모님이 바로 확인할 항목만 모았습니다.
            </p>
          </div>
          <div className={styles.heroPill}>
            {attentionCount > 0 ? `${attentionCount}건` : "안정"}
          </div>
        </div>

        <div className={styles.parentSummaryGrid}>
          <ParentMetric
            label="선생님 답변"
            value={replyCount}
            unit="건"
            tone={replyCount > 0 ? "primary" : "neutral"}
          />
          <ParentMetric
            label="오늘 일정"
            value={todaySessions.length}
            unit="개"
            tone={todaySessions.length > 0 ? "primary" : "neutral"}
          />
          <ParentMetric
            label="보충 필요"
            value={supportCount}
            unit="건"
            tone={supportCount > 0 ? "warn" : "neutral"}
          />
        </div>
      </section>

      <section className={styles.quickSection} aria-label="학부모 주요 확인">
        <div className={styles.sectionLabel}>바로 확인</div>
        <div className={styles.quickGrid}>
          <QuickAction
            to="/student/community"
            state={{ tab: answerTab }}
            icon={<IconBell />}
            label="답변"
            detail="질문·상담 확인"
            badge={!countsLoading ? replyCount : undefined}
            primary={replyCount > 0}
          />
          <QuickAction
            to="/student/grades"
            icon={<IconGrade />}
            label="성적"
            detail="시험·과제"
            badge={!countsLoading ? notificationCounts?.grade : undefined}
          />
          <QuickAction
            to="/student/attendance"
            icon={<IconCheck />}
            label="출결"
            detail="최근 출결"
          />
          <QuickAction
            to="/student/sessions"
            icon={<IconCalendar />}
            label="일정"
            detail="수업 일정"
          />
          <QuickAction
            to="/student/clinic"
            icon={<IconClinic />}
            label="클리닉"
            detail="예약·보충"
            badge={!countsLoading ? notificationCounts?.clinic : undefined}
          />
          <QuickAction
            to={feesEnabled ? "/student/fees" : "/student/notices"}
            icon={feesEnabled ? <IconClipboard /> : <IconNotice />}
            label={feesEnabled ? "수납/결제" : "공지"}
            detail={feesEnabled ? "청구·납부" : "학원 소식"}
          />
        </div>
      </section>

      <section className={styles.section}>
        <SectionLabel>지금 볼 것</SectionLabel>
        <div className={`stu-panel ${styles.parentWatchPanel}`}>
          {replyCount > 0 && (
            <TodoRow
              to="/student/community"
              state={{ tab: answerTab }}
              icon={<IconBell />}
              iconBg="color-mix(in srgb, var(--stu-primary) 14%, var(--stu-surface-1))"
              label={`선생님 답변 ${replyCount}건`}
              labelColor="var(--stu-primary)"
              detail="새 답변을 확인해 주세요"
            />
          )}
          {upcomingExams.length > 0 && (() => {
            const nearest = upcomingExams[0];
            const dLabel = nearest?.d === 0 ? "오늘" : nearest?.d === 1 ? "내일" : nearest?.d != null ? `D-${nearest.d}` : "";
            return (
              <TodoRow
                to="/student/exams"
                icon={<IconExam />}
                iconBg="color-mix(in srgb, var(--stu-primary) 12%, var(--stu-surface-1))"
                label={`다가오는 시험 ${upcomingExams.length}건${dLabel ? ` · ${dLabel}` : ""}`}
                labelColor="var(--stu-primary)"
                detail={nearest?.exam.title ?? "시험 일정을 확인해 주세요"}
              />
            );
          })()}
          {supportCount > 0 && (
            <TodoRow
              to="/student/grades"
              icon={<IconGrade />}
              iconBg="var(--stu-warn-bg)"
              label={`보충 확인 ${supportCount}건`}
              labelColor="var(--stu-warn-text)"
              detail="미통과 시험·과제를 확인해 주세요"
            />
          )}
          {clinicUpcoming && (
            <TodoRow
              to="/student/clinic"
              icon={<IconClinic />}
              iconBg="color-mix(in srgb, var(--stu-success) 14%, var(--stu-surface-1))"
              label="클리닉 예약이 있어요"
              labelColor="var(--stu-success)"
              detail="보충 일정과 상태를 확인해 주세요"
            />
          )}
          {attentionCount === 0 && (
            <div className={styles.parentAllClear}>
              <div className={styles.heroDoneIcon}>
                <IconCheck />
              </div>
              <div>
                <div className={styles.heroDoneTitle}>큰 변동은 없어요</div>
                <div className={styles.heroDoneText}>일정과 공지만 가볍게 확인하면 됩니다.</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {nextSession && (
        <section className={styles.section}>
          <SectionLabel>다음 일정</SectionLabel>
          <CountdownCard session={nextSession.session} dt={nextSession.dt} />
        </section>
      )}

      <LearningStatusCard grades={grades} sessions={sessions} />

      {!hasUrgentNotice && (
        <NoticeStrip notices={notices} hasNotices={hasNotices} />
      )}

      {tenantInfo && <AcademyContact tenantInfo={tenantInfo} />}
    </div>
  );
}

function ParentMetric({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  tone: "primary" | "warn" | "neutral";
}) {
  return (
    <div className={styles.parentMetric} data-tone={tone}>
      <div className={styles.parentMetricValue}>
        {value}
        <span>{unit}</span>
      </div>
      <div className={styles.parentMetricLabel}>{label}</div>
    </div>
  );
}

/* ============================================================================
 * 학습 현황 — 활동성 + 시험 평균 (완화 컬러)
 * ========================================================================== */

function LearningStatusCard({
  grades,
  sessions,
}: {
  grades: MyGradesSummary | null;
  sessions: StudentSession[] | null;
}) {
  /* 최근 4주 수업 활동 */
  const recentSessionCount = useMemo(() => {
    if (!sessions?.length) return 0;
    const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => {
      if (!s.date) return false;
      const t = new Date(s.date).getTime();
      return t >= cutoff && t <= Date.now();
    }).length;
  }, [sessions]);

  /* 과제 통과율 */
  const hwCount = grades?.homeworks?.length ?? 0;
  const passedHw = grades?.homeworks?.filter((h) => h.passed === true).length ?? 0;
  const hwRate = hwCount > 0 ? Math.round((passedHw / hwCount) * 100) : null;

  /* 시험 합격률 (점수 평균 대신 합격/총합 비율) */
  const examTotal = grades?.exams?.filter((e) => e.is_pass != null).length ?? 0;
  const examPassed = grades?.exams?.filter((e) => e.is_pass === true).length ?? 0;
  const examRate = examTotal > 0 ? Math.round((examPassed / examTotal) * 100) : null;

  const hasData = recentSessionCount > 0 || hwCount > 0 || examTotal > 0;

  /* 컬러 임계값 완화: 70% 이상 녹색, 그 외 회색. 빨강 제거. */
  const tone = (rate: number | null): string => {
    if (rate == null) return "var(--stu-text)";
    if (rate >= 70) return "var(--stu-success, #10b981)";
    return "var(--stu-text)";
  };

  return (
    <section className={`stu-panel ${styles.surface}`}>
      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceEyebrow}>나의 학습 현황</div>
        <span className={styles.surfaceMeta}>최근 4주</span>
      </div>
      {hasData ? (
        <div className={styles.statGrid}>
          <Stat label="수업" value={recentSessionCount} unit="회" tone="var(--stu-text)" />
          <Divider />
          <Stat label="과제 통과" value={hwRate} unit={hwRate != null ? "%" : ""} tone={tone(hwRate)} />
          <Divider />
          <Stat label="시험 합격" value={examRate} unit={examRate != null ? "%" : ""} tone={tone(examRate)} />
        </div>
      ) : (
        <div className={styles.learningEmpty}>
          <div className={styles.learningEmptyIcon}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 7h6M9 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>
          <div>
            <div className={styles.learningEmptyTitle}>
              아직 학습 기록이 없어요
            </div>
            <div className={styles.learningEmptyText}>
              수업에 참여하면 현황이 여기에 표시돼요
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: number | null; unit: string; tone: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <div>
        <span className={styles.statValue} style={{ "--stat-tone": tone } as CSSProperties}>
          {value != null ? value : "-"}
        </span>
        <span className={styles.statUnit}>{unit}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className={styles.statDivider} />;
}

/* ============================================================================
 * 공지 / TODO / 학원문의 보조 컴포넌트
 * ========================================================================== */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className={styles.sectionLabel}>
      {children}
    </div>
  );
}

function TodoRow({ to, state, icon, iconBg, label, labelColor, detail }: {
  to: string; state?: unknown; icon: ReactNode; iconBg: string;
  label: string; labelColor: string; detail?: string;
}) {
  return (
    <Link
      to={to}
      state={state}
      className={styles.todoRow}
    >
      <div className={styles.rowIcon} style={{ background: iconBg, color: labelColor }}>
        {icon}
      </div>
      <div className={styles.rowBody}>
        <div className={styles.rowTitle} style={{ color: labelColor }}>{label}</div>
        {detail && (
          <div className={styles.rowDetail}>
            {detail}
          </div>
        )}
      </div>
      <IconChevronRight className={styles.rowChevron} />
    </Link>
  );
}

function UrgentNotice({ notices }: { notices: Array<{ id: number; title: string; created_at: string | null }> }) {
  const top = notices[0];
  const more = notices.length - 1;
  if (!top) return null;
  return (
    <Link to="/student/notices" className={styles.urgentNotice}>
      <span className={styles.urgentBadge}>긴급</span>
      <div className={styles.urgentBody}>
        <div className={styles.urgentTitle}>{top.title}</div>
        {more > 0 && (
          <div className={styles.urgentMore}>외 {more}건의 긴급 공지</div>
        )}
      </div>
      <IconChevronRight className={styles.rowChevron} />
    </Link>
  );
}

function NoticeStrip({
  notices, hasNotices,
}: {
  notices: Array<{ id: number; title: string; created_at: string | null }>; hasNotices: boolean;
}) {
  const top = notices[0];
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isNew = top?.created_at != null
    && (Date.now() - new Date(top.created_at).getTime()) < SEVEN_DAYS_MS;

  return (
    <Link to="/student/notices" className={styles.noticeStrip}>
      <div className={styles.noticeIcon}>
        <IconNotice />
      </div>
      <div className={styles.noticeBody}>
        <div className={styles.surfaceEyebrow}>공지사항</div>
        <div className={styles.noticeTitle}>
          {isNew && (
            <span className={styles.noticeNew}>NEW</span>
          )}
          {hasNotices && top ? top.title : "최신 공지를 확인하세요"}
        </div>
      </div>
      {notices.length > 0 && (
        <span className={styles.noticeCount}>{notices.length}</span>
      )}
      <IconChevronRight className={styles.noticeChevron} />
    </Link>
  );
}

function AcademyContact({
  tenantInfo,
}: {
  tenantInfo: NonNullable<import("../api/dashboard.api").StudentDashboardResponse["tenant_info"]>;
}) {
  const academies = tenantInfo.academies?.length
    ? tenantInfo.academies
    : [{ name: tenantInfo.name || "학원", phone: tenantInfo.headquarters_phone || tenantInfo.phone || "" }];

  /* 학원문의는 "전화 거는 행위"가 핵심. phone 없는 분점은 카드에서 제외. */
  const contactable = academies.filter((a) => (a.phone || "").trim() !== "");
  if (contactable.length === 0) return null;

  /* 단일 분점 — 1행 압축 */
  if (contactable.length === 1) {
    const a = contactable[0]!;
    return (
      <a
        href={`tel:${a.phone.replace(/\D/g, "")}`}
        className={styles.contactCard}
      >
        <div className={styles.contactIcon}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <div className={styles.contactBody}>
          <div className={styles.surfaceEyebrow}>학원문의</div>
          <div className={styles.contactTitle}>
            {a.name || "학원"} · <span className={styles.contactPhone}>{a.phone}</span>
          </div>
        </div>
      </a>
    );
  }

  /* 다중 분점 — 카드형 */
  return (
    <section className={`${styles.contactCard} ${styles.contactMulti}`}>
      <div className={styles.surfaceEyebrow}>학원문의</div>
      <div className={styles.contactRows}>
        {contactable.map((a, i) => (
          <div key={i} className={styles.contactRow}>
            <span className={styles.contactName}>{a.name || "학원"}</span>
            {a.phone && (
              <a href={`tel:${a.phone.replace(/\D/g, "")}`} className={styles.contactPhone}>
                {a.phone}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
