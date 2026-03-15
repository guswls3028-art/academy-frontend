/**
 * 홈 — 다음 일정 카운트다운, 오늘 할 일, 오늘/다음 수업, 빠른 메뉴, 공지
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import { useMyGradesSummary } from "@/student/domains/grades/hooks/useMyGradesSummary";
import { IconPlay, IconCalendar, IconGrade, IconExam, IconNotice, IconClipboard, IconClinic, IconFolder, IconChevronRight } from "@/student/shared/ui/icons/Icons";
import { formatYmd } from "@/student/shared/utils/date";
import { useNotificationCounts } from "@/student/domains/notifications/hooks/useNotificationCounts";
import NotificationBadge from "@/student/shared/ui/components/NotificationBadge";
import type { StudentSession } from "@/student/domains/sessions/api/sessions";

/** 세션의 datetime을 Date 객체로 변환. start_time이 없으면 해당 날짜 00:00. */
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

/** 남은 시간을 사람이 읽을 수 있는 텍스트로. */
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

/** 요일 한글 */
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/** 날짜를 "3/17 (월)" 형식으로 */
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()] ?? "";
  return `${m}/${day} (${dow})`;
}

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading, isError: dashError } = useStudentDashboard();
  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useMySessions();
  const { data: grades } = useMyGradesSummary();
  const { data: notificationCounts, isLoading: countsLoading } = useNotificationCounts();

  const [now, setNow] = useState(() => new Date());

  // 1분마다 갱신 (카운트다운용)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todaySessions = (sessions ?? []).filter((s) => (s.date ?? "").slice(0, 10) === today);

  // 다음 일정 계산: 현재 시각 이후의 가장 가까운 세션/클리닉
  const nextSession = (() => {
    if (!sessions?.length) return null;
    let best: { session: StudentSession; dt: Date } | null = null;
    for (const s of sessions) {
      const dt = sessionToDate(s);
      if (!dt || dt.getTime() <= now.getTime()) continue;
      if (!best || dt.getTime() < best.dt.getTime()) {
        best = { session: s, dt };
      }
    }
    return best;
  })();

  // 오늘 할 일 계산
  const failedExamCount = grades?.exams?.filter((e) => !e.is_pass).length ?? 0;
  const failedHomeworkCount = grades?.homeworks?.filter((h) => !h.passed).length ?? 0;
  const clinicUpcoming = dashboard?.badges?.clinic_upcoming === true;
  const hasTodos = failedExamCount > 0 || failedHomeworkCount > 0 || clinicUpcoming;

  // 다음 수업 (오늘 수업이 없을 때 표시할 가장 가까운 미래 세션)
  const nextFutureSession = (() => {
    if (todaySessions.length > 0) return null; // 오늘 수업이 있으면 불필요
    if (!sessions?.length) return null;
    let best: { session: StudentSession; dt: Date } | null = null;
    for (const s of sessions) {
      const dateStr = (s.date ?? "").slice(0, 10);
      if (!dateStr || dateStr <= today) continue; // 오늘 이후만
      const dt = sessionToDate(s);
      if (!dt) continue;
      if (!best || dt.getTime() < best.dt.getTime()) {
        best = { session: s, dt };
      }
    }
    return best;
  })();

  if (dashLoading || sessionsLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <div className="stu-skel" style={{ height: 100, borderRadius: "var(--stu-radius-md)" }} />
        <div className="stu-skel" style={{ height: 120, marginTop: 12, borderRadius: "var(--stu-radius-md)" }} />
      </div>
    );
  }

  if (dashError || sessionsError) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
        데이터를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      {/* 다음 일정 카운트다운 */}
      {nextSession && (
        <Link
          to={nextSession.session.type === "clinic" ? "/student/clinic" : `/student/sessions/${nextSession.session.id}`}
          style={{
            display: "block",
            textDecoration: "none",
            color: "inherit",
            marginBottom: "var(--stu-space-4)",
            borderRadius: 14,
            background: nextSession.session.type === "clinic"
              ? "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, var(--stu-surface) 60%)"
              : "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, var(--stu-surface) 60%)",
            border: nextSession.session.type === "clinic"
              ? "1.5px solid rgba(16,185,129,0.2)"
              : "1.5px solid rgba(99,102,241,0.2)",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: nextSession.session.type === "clinic" ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.12)",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              {nextSession.session.type === "clinic"
                ? <IconClinic style={{ width: 22, height: 22, color: "var(--stu-success, #10b981)" }} />
                : <IconCalendar style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--stu-text-muted)", letterSpacing: "0.03em", marginBottom: 2 }}>
                다음 일정
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {nextSession.session.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2 }}>
                {formatYmd(nextSession.session.date ?? null)}
                {nextSession.session.start_time && ` ${nextSession.session.start_time.slice(0, 5)}`}
              </div>
            </div>
            <div style={{
              textAlign: "right", flexShrink: 0,
            }}>
              <div style={{
                fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em",
                color: nextSession.session.type === "clinic" ? "var(--stu-success, #10b981)" : "var(--stu-primary)",
              }}>
                {formatRemaining(nextSession.dt.getTime() - now.getTime())}
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* 공지 KPI 위젯 */}
      <Link
        to="/student/notices"
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          marginBottom: "var(--stu-space-6)",
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(59,130,246,0.07) 0%, var(--stu-surface) 55%)",
          border: "1.5px solid rgba(59,130,246,0.18)",
          boxShadow: "0 2px 16px rgba(59,130,246,0.08), 0 1px 4px rgba(0,0,0,0.04)",
          padding: "14px 16px 12px",
          transition: "box-shadow var(--stu-motion-base), transform var(--stu-motion-base)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(59,130,246,0.14), 0 2px 8px rgba(0,0,0,0.06)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 16px rgba(59,130,246,0.08), 0 1px 4px rgba(0,0,0,0.04)"; }}
      >
        {/* 헤더 행 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(59,130,246,0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <IconNotice style={{ width: 17, height: 17, color: "var(--stu-primary)" }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.02em" }}>공지사항</span>
          </div>
          {(dashboard?.notices?.length ?? 0) > 0 && (
            <span style={{
              background: "var(--stu-primary)",
              color: "#fff",
              borderRadius: 999,
              padding: "2px 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.01em",
              flexShrink: 0,
            }}>
              {dashboard!.notices.length}건
            </span>
          )}
        </div>

        {/* 공지 미리보기 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {dashboard?.notices?.length ? (
            dashboard.notices.slice(0, 2).map((n, i) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: i === 0 ? "8px 10px" : "4px 10px",
                  borderRadius: 8,
                  background: i === 0 ? "rgba(59,130,246,0.06)" : "transparent",
                  border: i === 0 ? "1px solid rgba(59,130,246,0.12)" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: i === 0 ? 14 : 13,
                    fontWeight: i === 0 ? 600 : 400,
                    color: i === 0 ? "var(--stu-text)" : "var(--stu-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {n.title}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--stu-text-subtle)", flexShrink: 0 }}>
                  {formatYmd(n.created_at)}
                </span>
              </div>
            ))
          ) : (
            <div className="stu-muted" style={{ fontSize: 13, padding: "4px 2px" }}>중요한 공지를 확인하세요</div>
          )}
        </div>

        {/* 푸터 CTA */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(59,130,246,0.1)" }}>
          <span style={{ fontSize: 12, color: "var(--stu-primary)", fontWeight: 600, letterSpacing: "-0.01em" }}>전체 공지 보기 →</span>
        </div>
      </Link>

      {/* 오늘 할 일 — 미제출 과제, 재시험 필요, 클리닉 예약 */}
      {hasTodos && (
        <section style={{ marginBottom: "var(--stu-space-6)" }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--stu-text-muted)",
            letterSpacing: "0.02em",
            marginBottom: 10,
          }}>
            오늘 할 일
          </div>
          <div style={{
            borderRadius: 14,
            border: "1.5px solid var(--stu-border)",
            background: "var(--stu-surface)",
            overflow: "hidden",
          }}>
            {failedHomeworkCount > 0 && (
              <Link
                to="/student/submit"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: "inherit",
                  borderBottom: (failedExamCount > 0 || clinicUpcoming) ? "1px solid var(--stu-border)" : "none",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(245,158,11,0.1)",
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <IconClipboard style={{ width: 18, height: 18, color: "#f59e0b" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#b45309" }}>
                    미제출 과제 {failedHomeworkCount}건
                  </div>
                </div>
                <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
              </Link>
            )}
            {failedExamCount > 0 && (
              <Link
                to="/student/exams"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: "inherit",
                  borderBottom: clinicUpcoming ? "1px solid var(--stu-border)" : "none",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(239,68,68,0.1)",
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <IconExam style={{ width: 18, height: 18, color: "#ef4444" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#dc2626" }}>
                    재시험 필요 {failedExamCount}건
                  </div>
                </div>
                <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
              </Link>
            )}
            {clinicUpcoming && (
              <Link
                to="/student/clinic"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(59,130,246,0.1)",
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <IconClinic style={{ width: 18, height: 18, color: "#3b82f6" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#2563eb" }}>
                    클리닉 예약이 있습니다
                  </div>
                </div>
                <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* 오늘/다음 수업 */}
      <section style={{ marginBottom: "var(--stu-space-8)" }}>
        {todaySessions.length === 0 ? (
          nextFutureSession ? (
            /* 오늘 수업 없으나 다음 수업이 있는 경우 */
            <Link
              to={nextFutureSession.session.type === "clinic" ? "/student/clinic" : `/student/sessions/${nextFutureSession.session.id}`}
              className="stu-status-surface stu-panel--pressable"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--stu-space-4)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div className="stu-status-eyebrow">다음 수업</div>
                <div className="stu-status-title" style={{ fontSize: 15 }}>
                  {formatShortDate(nextFutureSession.session.date!)}
                  {nextFutureSession.session.start_time && ` ${nextFutureSession.session.start_time.slice(0, 5)}`}
                  {" · "}
                  {nextFutureSession.session.title}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-2)", flexShrink: 0 }}>
                <IconCalendar style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />
                <span className="stu-cta-link" style={{ fontSize: 13 }}>전체 일정</span>
              </div>
            </Link>
          ) : (
            /* 다음 수업도 없는 경우 */
            <Link
              to="/student/sessions"
              className="stu-status-surface stu-panel--pressable"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--stu-space-4)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div className="stu-status-eyebrow">TODAY</div>
                <div className="stu-status-title">예정된 수업이 없습니다</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-2)", flexShrink: 0 }}>
                <IconCalendar style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />
                <span className="stu-cta-link" style={{ fontSize: 13 }}>전체 일정 보기</span>
              </div>
            </Link>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
            {todaySessions.slice(0, 3).map((s) => {
              const isClinic = s.type === "clinic";
              const linkTo = isClinic ? "/student/clinic" : `/student/sessions/${s.id}`;
              return (
                <Link
                  key={s.id}
                  to={linkTo}
                  className={`stu-panel stu-panel--pressable stu-panel--accent ${isClinic ? "stu-panel--nav" : "stu-panel--action"}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: isClinic ? "var(--stu-success, #10b981)" : "var(--stu-primary)",
                    opacity: 0.9, display: "grid", placeItems: "center",
                  }}>
                    {isClinic
                      ? <IconClinic style={{ width: 20, height: 20, color: "#fff" }} />
                      : <IconCalendar style={{ width: 20, height: 20, color: "var(--stu-primary-contrast)" }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {s.title}
                      {s.start_time && (
                        <span style={{ fontWeight: 400, color: "var(--stu-text-muted)", marginLeft: 6, fontSize: 13 }}>
                          {s.start_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                    <div className="stu-muted" style={{ fontSize: 12 }}>
                      {isClinic && s.status && <span style={{ color: "var(--stu-success, #10b981)", fontWeight: 600 }}>{s.status}</span>}
                      {!isClinic && `오늘 수업`}
                    </div>
                  </div>
                </Link>
              );
            })}
            <Link
              to="/student/sessions"
              className="stu-panel stu-panel--pressable"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "var(--stu-space-2)",
                textDecoration: "none",
                color: "inherit",
                padding: "var(--stu-space-3)",
              }}
            >
              <IconCalendar style={{ width: 20, height: 20, color: "var(--stu-primary)", flexShrink: 0 }} />
              <span className="stu-cta-link" style={{ fontSize: 13 }}>전체 일정 보기</span>
            </Link>
          </div>
        )}
      </section>

      {/* 빠른 메뉴 */}
      <section>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Link
            to="/student/video"
            className="stu-action-tile"
            style={{ position: "relative" }}
          >
            <div className="stu-action-tile__icon" style={{ position: "relative" }}>
              <IconPlay style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
              {!countsLoading && notificationCounts && notificationCounts.video > 0 && (
                <NotificationBadge count={notificationCounts.video} />
              )}
            </div>
            <div className="stu-action-tile__label">영상</div>
          </Link>
          <Link
            to="/student/exams"
            className="stu-action-tile"
          >
            <div className="stu-action-tile__icon">
              <IconExam style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
            </div>
            <div className="stu-action-tile__label">시험</div>
          </Link>
          <Link
            to="/student/submit"
            className="stu-action-tile"
          >
            <div className="stu-action-tile__icon">
              <IconClipboard style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
            </div>
            <div className="stu-action-tile__label">제출</div>
          </Link>
          <Link
            to="/student/grades"
            className="stu-action-tile"
            style={{ position: "relative" }}
          >
            <div className="stu-action-tile__icon" style={{ position: "relative" }}>
              <IconGrade style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
              {!countsLoading && notificationCounts && notificationCounts.grade > 0 && (
                <NotificationBadge count={notificationCounts.grade} />
              )}
            </div>
            <div className="stu-action-tile__label">성적</div>
          </Link>
          <Link
            to="/student/inventory"
            className="stu-action-tile"
          >
            <div className="stu-action-tile__icon">
              <IconFolder style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
            </div>
            <div className="stu-action-tile__label">인벤토리</div>
          </Link>
          <Link
            to="/student/clinic"
            className="stu-action-tile"
            style={{ position: "relative" }}
          >
            <div className="stu-action-tile__icon" style={{ position: "relative" }}>
              <IconClinic style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
              {!countsLoading && notificationCounts && notificationCounts.clinic > 0 && (
                <NotificationBadge count={notificationCounts.clinic} />
              )}
            </div>
            <div className="stu-action-tile__label">클리닉</div>
          </Link>
        </div>
      </section>

      {/* 학원문의 (학원명·전화) */}
      {dashboard?.tenant_info && (() => {
        const ti = dashboard.tenant_info;
        const academies = ti.academies?.length ? ti.academies : [{ name: ti.name || "학원", phone: ti.headquarters_phone || ti.phone || "" }];
        const hasAny = academies.some((a: { name?: string; phone?: string }) => a.name || a.phone);
        if (!hasAny) return null;
        return (
          <section style={{ marginTop: "var(--stu-space-8)", paddingTop: "var(--stu-space-4)", borderTop: "1px solid var(--stu-border)" }}>
            <div className="stu-muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 8, textTransform: "uppercase" }}>
              학원문의
            </div>
            {academies.map((a: { name?: string; phone?: string }, i: number) => (
              <div key={i} style={{ marginBottom: academies.length > 1 ? 12 : 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>{a.name || "학원"}</div>
                {a.phone && (
                  <a
                    href={`tel:${a.phone.replace(/\D/g, "")}`}
                    style={{ fontSize: 14, color: "var(--stu-primary)", textDecoration: "none", marginTop: 6, display: "inline-block", fontWeight: 600 }}
                  >
                    {a.phone}
                  </a>
                )}
              </div>
            ))}
          </section>
        );
      })()}
    </div>
  );
}
