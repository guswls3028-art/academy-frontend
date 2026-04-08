/**
 * 홈 — 공지(최상단), 다음 일정, 오늘 할 일, 오늘 수업, 앱 아이콘 메뉴
 */
import { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import { useMyGradesSummary } from "@/student/domains/grades/hooks/useMyGradesSummary";
import {
  IconPlay, IconCalendar, IconGrade, IconExam, IconNotice,
  IconClipboard, IconClinic, IconFolder, IconChevronRight, IconBoard, IconBell,
} from "@/student/shared/ui/icons/Icons";
import { formatYmd } from "@/student/shared/utils/date";
import { useNotificationCounts } from "@/student/domains/notifications/hooks/useNotificationCounts";
import NotificationBadge from "@/student/shared/ui/components/NotificationBadge";
import type { StudentSession } from "@/student/domains/sessions/api/sessions";

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

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()] ?? ""})`;
}

const CountdownCard = memo(function CountdownCard({ session, dt }: { session: StudentSession; dt: Date }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const linkTo = session.type === "clinic" ? "/student/clinic" : `/student/sessions/${session.id}`;
  const isClinic = session.type === "clinic";

  return (
    <Link
      to={linkTo}
      style={{
        display: "block", textDecoration: "none", color: "inherit",
        marginBottom: "var(--stu-space-4)",
        borderRadius: "var(--stu-radius-lg, 12px)",
        background: isClinic
          ? "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, var(--stu-surface) 60%)"
          : "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, var(--stu-surface) 60%)",
        border: isClinic ? "1.5px solid rgba(16,185,129,0.2)" : "1.5px solid rgba(99,102,241,0.2)",
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: isClinic ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.12)",
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          {isClinic
            ? <IconClinic style={{ width: 22, height: 22, color: "var(--stu-success, #10b981)" }} />
            : <IconCalendar style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--stu-text-muted)", letterSpacing: "0.03em", marginBottom: 2 }}>다음 일정</div>
          <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title}</div>
          <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2 }}>
            {formatYmd(session.date ?? null)}
            {session.start_time && ` ${session.start_time.slice(0, 5)}`}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: isClinic ? "var(--stu-success, #10b981)" : "var(--stu-primary)" }}>
            {formatRemaining(dt.getTime() - now.getTime())}
          </div>
        </div>
      </div>
    </Link>
  );
});

/* ── iPhone-style app icon ── */
function AppIcon({
  to, icon, label, badge, iconBg,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  iconBg?: string;
}) {
  return (
    <Link
      to={to}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 6, textDecoration: "none", color: "inherit",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: iconBg || "var(--stu-surface)",
        border: iconBg ? "none" : "1.5px solid var(--stu-border-subtle)",
        display: "grid", placeItems: "center",
        position: "relative",
        boxShadow: iconBg ? "0 1px 4px rgba(0,0,0,0.06)" : "0 2px 8px rgba(0,0,0,0.04)",
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

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading, isError: dashError } = useStudentDashboard();
  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useMySessions();
  const { data: grades } = useMyGradesSummary();
  const { data: notificationCounts, isLoading: countsLoading } = useNotificationCounts();

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todaySessions = (sessions ?? []).filter((s) => (s.date ?? "").slice(0, 10) === today);

  const nextSession = (() => {
    if (!sessions?.length) return null;
    let best: { session: StudentSession; dt: Date } | null = null;
    for (const s of sessions) {
      const dt = sessionToDate(s);
      if (!dt || dt.getTime() <= now.getTime()) continue;
      if (!best || dt.getTime() < best.dt.getTime()) best = { session: s, dt };
    }
    return best;
  })();

  const failedExamCount = grades?.exams?.filter((e) => e.is_pass === false).length ?? 0;
  const failedHomeworkCount = grades?.homeworks?.filter((h) => h.passed === false).length ?? 0;
  const clinicUpcoming = dashboard?.badges?.clinic_upcoming === true;
  const hasTodos = failedExamCount > 0 || failedHomeworkCount > 0 || clinicUpcoming;

  if (dashLoading || sessionsLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius-md)" }} />
        <div className="stu-skel" style={{ height: 100, marginTop: 12, borderRadius: "var(--stu-radius-md)" }} />
        <div className="stu-skel" style={{ height: 120, marginTop: 12, borderRadius: "var(--stu-radius-md)" }} />
      </div>
    );
  }

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

  return (
    <div style={{ padding: "var(--stu-space-2) 0", display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>

      {/* ─── 1. 공지사항 (최상단) ─── */}
      <NoticeSection notices={dashboard?.notices} />

      {/* ─── 1.5. 나의 학습 현황 ─── */}
      <LearningStatusCard grades={grades ?? null} sessions={sessions ?? null} />

      {/* ─── 2. 다음 일정 카운트다운 ─── */}
      {nextSession && <CountdownCard session={nextSession.session} dt={nextSession.dt} />}

      {/* ─── 3. 오늘 할 일 ─── */}
      {hasTodos && (
        <section>
          <SectionLabel>오늘 할 일</SectionLabel>
          <div style={{
            borderRadius: "var(--stu-radius-lg, 12px)",
            border: "1.5px solid var(--stu-border)",
            background: "var(--stu-surface)",
            overflow: "hidden",
          }}>
            {failedHomeworkCount > 0 && (() => {
              const failedHws = grades?.homeworks?.filter((h) => h.passed === false) ?? [];
              const preview = failedHws.slice(0, 2).map((h) => h.title);
              return (
                <TodoRow
                  to="/student/grades"
                  icon={<IconClipboard style={{ width: 18, height: 18, color: "var(--stu-warn, #f59e0b)" }} />}
                  iconBg="rgba(245,158,11,0.1)"
                  label={`과제 미통과 ${failedHomeworkCount}건`}
                  labelColor="var(--stu-warn-text, #b45309)"
                  detail={preview.join(", ") + (failedHomeworkCount > 2 ? ` 외 ${failedHomeworkCount - 2}건` : "")}
                  hasBorder={failedExamCount > 0 || clinicUpcoming}
                />
              );
            })()}
            {failedExamCount > 0 && (() => {
              const failedExams = grades?.exams?.filter((e) => e.is_pass === false) ?? [];
              const preview = failedExams.slice(0, 2).map((e) => e.title);
              return (
                <TodoRow
                  to="/student/exams"
                  icon={<IconExam style={{ width: 18, height: 18, color: "var(--stu-danger)" }} />}
                  iconBg="rgba(239,68,68,0.1)"
                  label={`재시험 필요 ${failedExamCount}건`}
                  labelColor="var(--stu-danger)"
                  detail={preview.join(", ") + (failedExamCount > 2 ? ` 외 ${failedExamCount - 2}건` : "")}
                  hasBorder={clinicUpcoming}
                />
              );
            })()}
            {clinicUpcoming && (
              <TodoRow
                to="/student/clinic"
                icon={<IconClinic style={{ width: 18, height: 18, color: "var(--stu-primary)" }} />}
                iconBg="rgba(59,130,246,0.18)"
                label="클리닉 예약이 있습니다"
                labelColor="var(--stu-primary)"
                hasBorder={false}
              />
            )}
          </div>
        </section>
      )}

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
                      ? <IconClinic style={{ width: 20, height: 20, color: "#fff" }} />
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

      {/* ─── 5. 앱 아이콘 메뉴 (iPhone style, 4열) ─── */}
      <section>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px 0",
          justifyItems: "center",
          padding: "var(--stu-space-4) 0",
        }}>
          <AppIcon to="/student/video" label="영상"
            icon={<IconPlay style={{ width: 24, height: 24, color: "#6366f1" }} />}
            iconBg="rgba(99,102,241,0.18)"
            badge={!countsLoading ? notificationCounts?.video : undefined} />
          <AppIcon to="/student/grades" label="성적"
            icon={<IconGrade style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />}
            iconBg="rgba(59,130,246,0.18)"
            badge={!countsLoading ? notificationCounts?.grade : undefined} />
          <AppIcon to="/student/exams" label="시험"
            icon={<IconExam style={{ width: 24, height: 24, color: "var(--stu-danger)" }} />}
            iconBg="rgba(239,68,68,0.15)" />
          <AppIcon to="/student/submit/assignment" label="과제"
            icon={<IconClipboard style={{ width: 24, height: 24, color: "var(--stu-warn)" }} />}
            iconBg="rgba(245,158,11,0.15)" />
          <AppIcon to="/student/sessions" label="일정"
            icon={<IconCalendar style={{ width: 24, height: 24, color: "#8b5cf6" }} />}
            iconBg="rgba(139,92,246,0.18)" />
          <AppIcon to="/student/clinic" label="클리닉"
            icon={<IconClinic style={{ width: 24, height: 24, color: "var(--stu-success)" }} />}
            iconBg="rgba(16,185,129,0.18)"
            badge={!countsLoading ? notificationCounts?.clinic : undefined} />
          <AppIcon to="/student/community" label="커뮤니티"
            icon={<IconBoard style={{ width: 24, height: 24, color: "#0ea5e9" }} />}
            iconBg="rgba(14,165,233,0.18)" />
          <AppIcon to="/student/inventory" label="보관함"
            icon={<IconFolder style={{ width: 24, height: 24, color: "#64748b" }} />}
            iconBg="rgba(100,116,139,0.15)" />
        </div>
      </section>

      {/* ─── 6. 학원문의 ─── */}
      {dashboard?.tenant_info && (() => {
        const ti = dashboard.tenant_info;
        const academies = ti.academies?.length ? ti.academies : [{ name: ti.name || "학원", phone: ti.headquarters_phone || ti.phone || "" }];
        const hasAny = academies.some((a: { name?: string; phone?: string }) => a.name || a.phone);
        if (!hasAny) return null;
        return (
          <section style={{
            borderRadius: "var(--stu-radius-lg, 12px)",
            background: "var(--stu-surface)",
            border: "1.5px solid var(--stu-border)",
            padding: "14px 16px",
          }}>
            <div className="stu-muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 10, textTransform: "uppercase" }}>학원문의</div>
            {academies.map((a: { name?: string; phone?: string }, i: number) => (
              <div key={i} style={{ marginBottom: academies.length > 1 ? 12 : 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>{a.name || "학원"}</div>
                {a.phone && (
                  <a href={`tel:${a.phone.replace(/\D/g, "")}`} style={{ fontSize: 14, color: "var(--stu-primary)", textDecoration: "none", marginTop: 6, display: "inline-block", fontWeight: 600 }}>
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

/* ── Sub-components ── */

function LearningStatusCard({
  grades,
  sessions,
}: {
  grades: import("@/student/domains/grades/api/grades").MyGradesSummary | null;
  sessions: StudentSession[] | null;
}) {
  const examCount = grades?.exams?.length ?? 0;
  const hwCount = grades?.homeworks?.length ?? 0;
  const sessionCount = sessions?.length ?? 0;

  const hasData = examCount > 0 || hwCount > 0 || sessionCount > 0;

  // Exam average
  const scoredExams = grades?.exams?.filter((e) => e.total_score != null && e.max_score > 0) ?? [];
  const examAvg = scoredExams.length > 0
    ? Math.round(scoredExams.reduce((sum, e) => sum + ((e.total_score ?? 0) / e.max_score) * 100, 0) / scoredExams.length)
    : null;

  // Homework completion rate
  const passedHw = grades?.homeworks?.filter((h) => h.passed === true).length ?? 0;
  const hwRate = hwCount > 0 ? Math.round((passedHw / hwCount) * 100) : null;

  const statItemStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "8px 4px",
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--stu-text-muted)",
    letterSpacing: "0.02em",
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "var(--stu-text)",
  };

  const statUnitStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--stu-text-muted)",
    marginLeft: 1,
  };

  return (
    <section style={{
      borderRadius: "var(--stu-radius-lg, 12px)",
      background: "var(--stu-surface)",
      border: "1.5px solid var(--stu-border)",
      padding: "16px",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stu-text-muted)", letterSpacing: "0.02em", marginBottom: 12 }}>
        나의 학습 현황
      </div>
      {hasData ? (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={statItemStyle}>
            <span style={statLabelStyle}>수업</span>
            <div>
              <span style={statValueStyle}>{sessionCount}</span>
              <span style={statUnitStyle}>회</span>
            </div>
          </div>
          <div style={{ width: 1, background: "var(--stu-border)", alignSelf: "stretch", margin: "4px 0" }} />
          <div style={statItemStyle}>
            <span style={statLabelStyle}>과제 완료</span>
            <div>
              <span style={{ ...statValueStyle, color: hwRate != null && hwRate >= 80 ? "var(--stu-success, #10b981)" : hwRate != null && hwRate < 50 ? "var(--stu-danger)" : "var(--stu-text)" }}>
                {hwRate != null ? hwRate : "-"}
              </span>
              <span style={statUnitStyle}>{hwRate != null ? "%" : ""}</span>
            </div>
          </div>
          <div style={{ width: 1, background: "var(--stu-border)", alignSelf: "stretch", margin: "4px 0" }} />
          <div style={statItemStyle}>
            <span style={statLabelStyle}>시험 평균</span>
            <div>
              <span style={{ ...statValueStyle, color: examAvg != null && examAvg >= 80 ? "var(--stu-success, #10b981)" : examAvg != null && examAvg < 50 ? "var(--stu-danger)" : "var(--stu-text)" }}>
                {examAvg != null ? examAvg : "-"}
              </span>
              <span style={statUnitStyle}>{examAvg != null ? "점" : ""}</span>
            </div>
          </div>
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
            background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(59,130,246,0.08))",
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stu-text-muted)", letterSpacing: "0.02em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function TodoRow({ to, icon, iconBg, label, labelColor, detail, hasBorder }: {
  to: string; icon: React.ReactNode; iconBg: string;
  label: string; labelColor: string; detail?: string; hasBorder: boolean;
}) {
  return (
    <Link
      to={to}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", textDecoration: "none", color: "inherit",
        borderBottom: hasBorder ? "1px solid var(--stu-border)" : "none",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: "grid", placeItems: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: labelColor }}>{label}</div>
        {detail && (
          <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {detail}
          </div>
        )}
      </div>
      <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
    </Link>
  );
}

function NoticeSection({ notices }: { notices?: Array<{ id: number; title: string; created_at: string | null; is_urgent?: boolean }> }) {
  return (
    <Link
      to="/student/notices"
      style={{
        display: "block", textDecoration: "none", color: "inherit",
        borderRadius: "var(--stu-radius-lg, 12px)",
        background: "linear-gradient(135deg, rgba(59,130,246,0.07) 0%, var(--stu-surface) 55%)",
        border: "1.5px solid rgba(59,130,246,0.18)",
        boxShadow: "0 2px 16px rgba(59,130,246,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        padding: "14px 16px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(59,130,246,0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <IconNotice style={{ width: 17, height: 17, color: "var(--stu-primary)" }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.02em" }}>공지사항</span>
        </div>
        {(notices?.length ?? 0) > 0 && (
          <span style={{ background: "var(--stu-primary)", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {notices!.length}건
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {notices?.length ? (
          notices.slice(0, 2).map((n, i) => (
            <div
              key={n.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
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
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {n.is_urgent && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--stu-danger, #ef4444)", borderRadius: 3, padding: "0 5px", marginRight: 4, display: "inline" }}>긴급</span>}
                  {n.title}
                </div>
              </div>
              <span style={{ fontSize: 11, color: "var(--stu-text-subtle)", flexShrink: 0 }}>{formatYmd(n.created_at)}</span>
            </div>
          ))
        ) : (
          <div className="stu-muted" style={{ fontSize: 13, padding: "4px 2px" }}>공지를 확인하세요</div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(59,130,246,0.1)" }}>
        <span style={{ fontSize: 12, color: "var(--stu-primary)", fontWeight: 600, letterSpacing: "-0.01em" }}>전체 공지 보기 →</span>
      </div>
    </Link>
  );
}
