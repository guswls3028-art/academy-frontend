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
import { Link } from "react-router-dom";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import { useMySessions } from "@student/domains/sessions/hooks/useStudentSessions";
import { useMyGradesSummary } from "@student/domains/grades/hooks/useMyGradesSummary";
import { useStudentExams } from "@student/domains/exams/hooks/useStudentExams";
import {
  IconCalendar, IconGrade, IconExam, IconNotice,
  IconClipboard, IconClinic, IconFolder, IconChevronRight, IconCheck, IconUser, IconBell,
} from "@student/shared/ui/icons/Icons";
import { formatYmd } from "@student/shared/utils/date";
import { useNotificationCounts } from "@student/domains/notifications/hooks/useNotificationCounts";
import NotificationBadge from "@student/shared/ui/components/NotificationBadge";
import type { StudentSession } from "@student/domains/sessions/api/sessions.api";

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
      style={{
        display: "block", textDecoration: "none", color: "inherit",
        borderRadius: "var(--stu-radius-lg, 12px)",
        background: isClinic
          ? "linear-gradient(135deg, color-mix(in srgb, var(--stu-success) 8%, var(--stu-surface-1)) 0%, var(--stu-surface-1) 60%)"
          : "linear-gradient(135deg, color-mix(in srgb, var(--stu-primary) 8%, var(--stu-surface-1)) 0%, var(--stu-surface-1) 60%)",
        border: isClinic
          ? "1.5px solid color-mix(in srgb, var(--stu-success) 22%, transparent)"
          : `1.5px solid color-mix(in srgb, var(--stu-primary) ${isImminent ? 38 : 22}%, transparent)`,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: isClinic
            ? "color-mix(in srgb, var(--stu-success) 14%, var(--stu-surface-1))"
            : "color-mix(in srgb, var(--stu-primary) 14%, var(--stu-surface-1))",
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          {isClinic
            ? <IconClinic style={{ width: 22, height: 22, color: "var(--stu-success, #10b981)" }} />
            : <IconCalendar style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--stu-text-muted)", letterSpacing: "0.04em", marginBottom: 2, textTransform: "uppercase" }}>다음 일정</div>
          <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title}</div>
          <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2 }}>
            {formatYmd(session.date ?? null)}
            {session.start_time && ` ${session.start_time.slice(0, 5)}`}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: isClinic ? "var(--stu-success, #10b981)" : "var(--stu-primary)" }}>
            {formatRemaining(remainingMs)}
          </div>
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
}: { to: string; icon: React.ReactNode; label: string; badge?: number; }) {
  return (
    <Link
      to={to}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 8, textDecoration: "none", color: "inherit",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: "linear-gradient(135deg, color-mix(in srgb, var(--stu-primary) 14%, var(--stu-surface-1)), color-mix(in srgb, var(--stu-primary) 6%, var(--stu-surface-1)))",
        border: "1px solid color-mix(in srgb, var(--stu-primary) 15%, transparent)",
        display: "grid", placeItems: "center",
        position: "relative",
        transition: "transform var(--stu-motion-fast)",
      }}>
        {icon}
        {badge != null && badge > 0 && <NotificationBadge count={badge} />}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--stu-text)", letterSpacing: "-0.01em", textAlign: "center" }}>
        {label}
      </span>
    </Link>
  );
}

/* ============================================================================
 * 페이지
 * ========================================================================== */

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading, isError: dashError } = useStudentDashboard();
  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useMySessions();
  const { data: grades } = useMyGradesSummary();
  const { data: examsResp } = useStudentExams();
  const { data: notificationCounts, isLoading: countsLoading } = useNotificationCounts();

  const today = ymdToday();
  const todaySessions = useMemo(
    () => (sessions ?? []).filter((s) => (s.date ?? "").slice(0, 10) === today),
    [sessions, today],
  );

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

  return (
    <div style={{ padding: "var(--stu-space-2) 0", display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>

      {/* ─── 1. 다음 일정 카운트다운 (있을 때 최상단) ─── */}
      {nextSession && (
        <div data-guide="dash-countdown">
          <CountdownCard session={nextSession.session} dt={nextSession.dt} />
        </div>
      )}

      {/* ─── 2. 긴급 공지 (긴급일 때만 상단 강조) ─── */}
      {hasUrgentNotice && (
        <UrgentNotice notices={(dashboard?.notices ?? []).filter((n) => n.is_urgent)} />
      )}

      {/* ─── 3. 오늘 할 일 ─── */}
      <section data-guide="dash-todo">
        <SectionLabel>오늘 할 일</SectionLabel>
        {todoCount > 0 ? (
          <div className="stu-panel" style={{ padding: 0, overflow: "hidden" }}>
            {upcomingExams.length > 0 && (() => {
              const preview = upcomingExams.slice(0, 2).map((x) => x.exam.title);
              const nearest = upcomingExams[0];
              const dLabel = nearest && nearest.d != null
                ? (nearest.d === 0 ? "오늘" : nearest.d === 1 ? "내일" : `D-${nearest.d}`)
                : "";
              const more = upcomingExams.length - 2 > 0 ? ` 외 ${upcomingExams.length - 2}건` : "";
              const restCount = todoCount - upcomingExams.length;
              return (
                <TodoRow
                  to="/student/exams"
                  icon={<IconExam style={{ width: 18, height: 18, color: "var(--stu-primary)" }} />}
                  iconBg="color-mix(in srgb, var(--stu-primary) 14%, var(--stu-surface-1))"
                  label={`다가오는 시험 ${upcomingExams.length}건${dLabel ? ` · ${dLabel}` : ""}`}
                  labelColor="var(--stu-primary)"
                  detail={preview.join(", ") + more}
                  hasBorder={restCount > 0}
                />
              );
            })()}

            {replyCount > 0 && (() => {
              const restCount =
                failedHomeworks.length + failedExams.length + (clinicUpcoming ? 1 : 0);
              /* qna가 더 많으면 QnA 탭, 아니면 상담 탭으로 prefill */
              const qnaC = notificationCounts?.qna ?? 0;
              const counselC = notificationCounts?.counsel ?? 0;
              const prefillTab = qnaC >= counselC ? "qna" : "counsel";
              return (
                <TodoRow
                  to="/student/community"
                  state={{ tab: prefillTab }}
                  icon={<IconBell style={{ width: 18, height: 18, color: "var(--stu-success)" }} />}
                  iconBg="color-mix(in srgb, var(--stu-success) 14%, var(--stu-surface-1))"
                  label={`새 답변 ${replyCount}건`}
                  labelColor="var(--stu-success)"
                  detail="질문/상담에 선생님이 답변했어요"
                  hasBorder={restCount > 0}
                />
              );
            })()}

            {clinicUpcoming && (
              <TodoRow
                to="/student/clinic"
                icon={<IconClinic style={{ width: 18, height: 18, color: "var(--stu-primary)" }} />}
                iconBg="color-mix(in srgb, var(--stu-primary) 16%, var(--stu-surface-1))"
                label="클리닉 예약이 있어요"
                labelColor="var(--stu-primary)"
                hasBorder={failedHomeworks.length > 0 || failedExams.length > 0}
              />
            )}

            {failedHomeworks.length > 0 && (() => {
              const preview = failedHomeworks.slice(0, 2).map((h) => h.title);
              const more = failedHomeworks.length - 2 > 0 ? ` 외 ${failedHomeworks.length - 2}건` : "";
              return (
                <TodoRow
                  to="/student/grades"
                  icon={<IconClipboard style={{ width: 18, height: 18, color: "var(--stu-warn)" }} />}
                  iconBg="var(--stu-warn-bg)"
                  label={`과제 미통과 ${failedHomeworks.length}건`}
                  labelColor="var(--stu-warn-text)"
                  detail={preview.join(", ") + more}
                  hasBorder={failedExams.length > 0}
                />
              );
            })()}

            {failedExams.length > 0 && (() => {
              const preview = failedExams.slice(0, 2).map((e) => e.title);
              const more = failedExams.length - 2 > 0 ? ` 외 ${failedExams.length - 2}건` : "";
              return (
                <TodoRow
                  to="/student/exams"
                  icon={<IconExam style={{ width: 18, height: 18, color: "var(--stu-danger)" }} />}
                  iconBg="var(--stu-danger-bg)"
                  label={`재시험 필요 ${failedExams.length}건`}
                  labelColor="var(--stu-danger)"
                  detail={preview.join(", ") + more}
                  hasBorder={false}
                />
              );
            })()}
          </div>
        ) : (
          <div className="stu-panel" style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "color-mix(in srgb, var(--stu-success) 14%, var(--stu-surface-1))",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              <IconCheck style={{ width: 20, height: 20, color: "var(--stu-success)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--stu-text)" }}>
                오늘은 급한 할 일이 없어요
              </div>
              <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2 }}>
                오늘 수업과 영상 학습으로 차근차근 진행해 보세요
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── 4. 오늘 수업 ─── */}
      {todaySessions.length > 0 && (
        <section>
          <SectionLabel>오늘 수업</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
            {todaySessions.slice(0, 3).map((s) => {
              const isClinic = s.type === "clinic";
              return (
                <Link
                  key={s.id}
                  to={isClinic ? "/student/clinic" : `/student/sessions/${s.id}`}
                  className={`stu-panel stu-panel--pressable stu-panel--accent ${isClinic ? "stu-panel--nav" : "stu-panel--action"}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: isClinic ? "var(--stu-success, #10b981)" : "var(--stu-primary)",
                    opacity: 0.9, display: "grid", placeItems: "center",
                  }}>
                    {isClinic
                      ? <IconClinic style={{ width: 20, height: 20, color: "var(--stu-primary-contrast)" }} />
                      : <IconCalendar style={{ width: 20, height: 20, color: "var(--stu-primary-contrast)" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {s.title}
                      {s.start_time && <span style={{ fontWeight: 400, color: "var(--stu-text-muted)", marginLeft: 6, fontSize: 13 }}>{s.start_time.slice(0, 5)}</span>}
                    </div>
                    <div className="stu-muted" style={{ fontSize: 12 }}>오늘 수업</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 5. 학습 현황 (활동성 우선) ─── */}
      <div data-guide="dash-stats">
        <LearningStatusCard grades={grades ?? null} sessions={sessions ?? null} />
      </div>

      {/* ─── 6. 공지 (긴급 없을 때) ─── */}
      {!hasUrgentNotice && (
        <NoticeStrip notices={dashboard?.notices ?? []} hasNotices={hasNotices} />
      )}

      {/* ─── 7. 앱 아이콘 메뉴 (탭바 중복 제거 + 출석) ─── */}
      <section data-guide="dash-apps">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px 0",
          justifyItems: "center",
          padding: "var(--stu-space-4) 0",
        }}>
          <AppIcon to="/student/grades" label="성적"
            icon={<IconGrade style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />}
            badge={!countsLoading ? notificationCounts?.grade : undefined} />
          <AppIcon to="/student/exams" label="시험"
            icon={<IconExam style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />} />
          <AppIcon to="/student/submit/assignment" label="과제"
            icon={<IconClipboard style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />} />
          <AppIcon to="/student/clinic" label="클리닉"
            icon={<IconClinic style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />}
            badge={!countsLoading ? notificationCounts?.clinic : undefined} />
          <AppIcon to="/student/attendance" label="출결"
            icon={<IconCheck style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />} />
          <AppIcon to="/student/notices" label="공지"
            icon={<IconNotice style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />} />
          <AppIcon to="/student/inventory" label="보관함"
            icon={<IconFolder style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />} />
          <AppIcon to="/student/profile" label="내 정보"
            icon={<IconUser style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />} />
        </div>
      </section>

      {/* ─── 8. 학원문의 (압축, 하단) ─── */}
      {dashboard?.tenant_info && <AcademyContact tenantInfo={dashboard.tenant_info} />}
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
  grades: import("@student/domains/grades/api/grades.api").MyGradesSummary | null;
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
    <section className="stu-panel" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--stu-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          나의 학습 현황
        </div>
        <span style={{ fontSize: 11, color: "var(--stu-text-subtle)" }}>최근 4주</span>
      </div>
      {hasData ? (
        <div style={{ display: "flex", gap: 8 }}>
          <Stat label="수업" value={recentSessionCount} unit="회" tone="var(--stu-text)" />
          <Divider />
          <Stat label="과제 통과" value={hwRate} unit={hwRate != null ? "%" : ""} tone={tone(hwRate)} />
          <Divider />
          <Stat label="시험 합격" value={examRate} unit={examRate != null ? "%" : ""} tone={tone(examRate)} />
        </div>
      ) : (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "8px 4px",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: "linear-gradient(135deg, color-mix(in srgb, var(--stu-primary) 14%, var(--stu-surface-1)), color-mix(in srgb, var(--stu-primary) 6%, var(--stu-surface-1)))",
            display: "grid", placeItems: "center",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="var(--stu-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="var(--stu-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 7h6M9 11h4" stroke="var(--stu-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text)", marginBottom: 2 }}>
              아직 학습 기록이 없어요
            </div>
            <div style={{ fontSize: 12, color: "var(--stu-text-muted)", lineHeight: 1.5 }}>
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--stu-text-muted)", letterSpacing: "0.02em" }}>{label}</span>
      <div>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: tone }}>
          {value != null ? value : "-"}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--stu-text-muted)", marginLeft: 1 }}>{unit}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, background: "var(--stu-border)", alignSelf: "stretch", margin: "4px 0" }} />;
}

/* ============================================================================
 * 공지 / TODO / 학원문의 보조 컴포넌트
 * ========================================================================== */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--stu-text-muted)", letterSpacing: "0.06em", marginBottom: 10, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function TodoRow({ to, state, icon, iconBg, label, labelColor, detail, hasBorder }: {
  to: string; state?: unknown; icon: React.ReactNode; iconBg: string;
  label: string; labelColor: string; detail?: string; hasBorder: boolean;
}) {
  return (
    <Link
      to={to}
      state={state}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "12px 16px", textDecoration: "none", color: "inherit",
        borderBottom: hasBorder ? "1px solid var(--stu-border)" : "none",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: labelColor, lineHeight: 1.3 }}>{label}</div>
        {detail && (
          <div
            style={{
              fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2,
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {detail}
          </div>
        )}
      </div>
      <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0, marginTop: 10 }} />
    </Link>
  );
}

function UrgentNotice({ notices }: { notices: Array<{ id: number; title: string; created_at: string | null }> }) {
  const top = notices[0];
  const more = notices.length - 1;
  if (!top) return null;
  return (
    <Link
      to="/student/notices"
      style={{
        display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit",
        borderRadius: "var(--stu-radius-lg, 12px)",
        background: "var(--stu-danger-bg)",
        border: "1.5px solid var(--stu-danger-border)",
        padding: "12px 14px",
      }}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, color: "var(--stu-primary-contrast)",
        background: "var(--stu-danger)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.02em", flexShrink: 0,
      }}>긴급</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: "var(--stu-danger-text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{top.title}</div>
        {more > 0 && (
          <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2 }}>외 {more}건의 긴급 공지</div>
        )}
      </div>
      <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-danger)", flexShrink: 0 }} />
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
    <Link
      to="/student/notices"
      style={{
        display: "flex", alignItems: "center", gap: 10,
        textDecoration: "none", color: "inherit",
        borderRadius: "var(--stu-radius-md, 8px)",
        border: "1px solid var(--stu-border)",
        background: "var(--stu-surface)",
        padding: "10px 14px",
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: "color-mix(in srgb, var(--stu-primary) 12%, var(--stu-surface-1))",
        display: "grid", placeItems: "center",
      }}>
        <IconNotice style={{ width: 16, height: 16, color: "var(--stu-primary)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--stu-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>공지사항</div>
        <div style={{
          fontSize: 13, fontWeight: 500, color: "var(--stu-text)", marginTop: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {isNew && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "var(--stu-primary-contrast)",
              background: "var(--stu-primary)", borderRadius: 4, padding: "1px 5px",
              marginRight: 5, letterSpacing: "0.02em",
            }}>NEW</span>
          )}
          {hasNotices && top ? top.title : "최신 공지를 확인하세요"}
        </div>
      </div>
      {notices.length > 0 && (
        <span style={{
          background: "var(--stu-primary)", color: "var(--stu-primary-contrast)",
          borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>{notices.length}</span>
      )}
      <IconChevronRight style={{ width: 14, height: 14, color: "var(--stu-text-muted)", flexShrink: 0 }} />
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
        style={{
          display: "flex", alignItems: "center", gap: 10,
          textDecoration: "none", color: "inherit",
          borderRadius: "var(--stu-radius-md, 8px)",
          border: "1px solid var(--stu-border)",
          background: "var(--stu-surface)",
          padding: "10px 14px",
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: "color-mix(in srgb, var(--stu-primary) 12%, var(--stu-surface-1))",
          display: "grid", placeItems: "center",
          color: "var(--stu-primary)",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--stu-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>학원문의</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-text)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.name || "학원"} · <span style={{ color: "var(--stu-primary)" }}>{a.phone}</span>
          </div>
        </div>
      </a>
    );
  }

  /* 다중 분점 — 카드형 */
  return (
    <section style={{
      borderRadius: "var(--stu-radius-md, 8px)",
      background: "var(--stu-surface)",
      border: "1px solid var(--stu-border)",
      padding: "12px 14px",
    }}>
      <div className="stu-muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 8, textTransform: "uppercase" }}>학원문의</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {contactable.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || "학원"}</span>
            {a.phone && (
              <a href={`tel:${a.phone.replace(/\D/g, "")}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-primary)", textDecoration: "none", flexShrink: 0 }}>
                {a.phone}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
