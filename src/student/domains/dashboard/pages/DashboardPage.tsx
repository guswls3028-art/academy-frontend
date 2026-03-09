/**
 * 홈 — 오늘 일정, 빠른 메뉴(영상·시험·성적·일정), 공지
 */
import { Link } from "react-router-dom";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { IconPlay, IconCalendar, IconGrade, IconExam, IconNotice, IconClipboard, IconClinic } from "@/student/shared/ui/icons/Icons";
import { formatYmd } from "@/student/shared/utils/date";
import { useNotificationCounts } from "@/student/domains/notifications/hooks/useNotificationCounts";
import NotificationBadge from "@/student/shared/ui/components/NotificationBadge";

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading } = useStudentDashboard();
  const { data: sessions, isLoading: sessionsLoading } = useMySessions();
  const { data: notificationCounts, isLoading: countsLoading } = useNotificationCounts();

  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = (sessions ?? []).filter((s) => (s.date ?? "").slice(0, 10) === today);

  if (dashLoading || sessionsLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <div className="stu-skel" style={{ height: 100, borderRadius: "var(--stu-radius-md)" }} />
        <div className="stu-skel" style={{ height: 120, marginTop: 12, borderRadius: "var(--stu-radius-md)" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      {/* 공지 KPI 위젯 — 결계형 */}
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

      {/* 오늘 일정 → useMySessions (GET /student/sessions/me/) 반영 */}
      <section style={{ marginBottom: "var(--stu-space-8)" }}>
        {todaySessions.length === 0 ? (
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
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
            {todaySessions.slice(0, 3).map((s) => (
              <Link
                key={s.id}
                to={`/student/sessions/${s.id}`}
                className="stu-panel stu-panel--pressable stu-panel--accent stu-panel--action"
                style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--stu-primary)", opacity: 0.9, display: "grid", placeItems: "center" }}>
                  <IconCalendar style={{ width: 20, height: 20, color: "var(--stu-primary-contrast)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                  <div className="stu-muted" style={{ fontSize: 12 }}>{formatYmd(s.date ?? null)}</div>
                </div>
              </Link>
            ))}
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
            to="/student/qna"
            className="stu-action-tile"
          >
            <div className="stu-action-tile__icon">
              <IconNotice style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
            </div>
            <div className="stu-action-tile__label">QnA</div>
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

      {/* 학원문의 (학원명·전화) — 여러 학원일 때 목록, 단일일 때 기존 표시 */}
      {dashboard?.tenant_info && (() => {
        const ti = dashboard.tenant_info;
        const academies = ti.academies?.length ? ti.academies : [{ name: ti.name || "학원", phone: ti.headquarters_phone || ti.phone || "" }];
        const hasAny = academies.some((a) => a.name || a.phone);
        if (!hasAny) return null;
        return (
          <section style={{ marginTop: "var(--stu-space-8)", paddingTop: "var(--stu-space-4)", borderTop: "1px solid var(--stu-border)" }}>
            <div className="stu-muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 8, textTransform: "uppercase" }}>
              학원문의
            </div>
            {academies.map((a, i) => (
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
