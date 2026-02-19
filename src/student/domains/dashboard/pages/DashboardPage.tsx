/**
 * 홈 — 오늘 일정, 빠른 메뉴(영상·시험·성적·일정), 공지
 */
import { Link } from "react-router-dom";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { IconPlay, IconCalendar, IconGrade, IconExam, IconNotice } from "@/student/shared/ui/icons/Icons";
import { formatYmd } from "@/student/shared/utils/date";

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading } = useStudentDashboard();
  const { data: sessions, isLoading: sessionsLoading } = useMySessions();

  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = (sessions ?? []).filter((s) => (s.date ?? "").slice(0, 10) === today);

  if (dashLoading && sessionsLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <div className="stu-skel" style={{ height: 100, borderRadius: "var(--stu-radius-md)" }} />
        <div className="stu-skel" style={{ height: 120, marginTop: 12, borderRadius: "var(--stu-radius-md)" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: "var(--stu-space-6)", paddingLeft: "var(--stu-space-2)", letterSpacing: "-0.01em" }}>
        홈
      </h1>

      {/* 공지 */}
      <Link
        to="/student/qna"
        className="stu-panel stu-panel--pressable stu-panel--accent"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--stu-space-4)",
          marginBottom: "var(--stu-space-6)",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--stu-surface-soft)", display: "grid", placeItems: "center" }}>
          <IconNotice style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>공지·Q&A</div>
          <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>소통 게시판에서 확인하세요</div>
        </div>
        <span className="stu-cta-link" style={{ fontSize: 13 }}>보기</span>
      </Link>

      {/* 오늘 일정 */}
      <section style={{ marginBottom: "var(--stu-space-8)" }}>
        {todaySessions.length === 0 ? (
          <div className="stu-status-surface">
            <div className="stu-status-eyebrow">TODAY</div>
            <div className="stu-status-title">예정된 수업이 없습니다</div>
            <Link to="/student/sessions" className="stu-cta-link" style={{ marginTop: 8, display: "inline-block" }}>
              전체 일정 보기
            </Link>
          </div>
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
            {todaySessions.length > 3 && (
              <Link to="/student/sessions" className="stu-cta-link" style={{ fontSize: 13, paddingLeft: 4 }}>
                더보기
              </Link>
            )}
          </div>
        )}
      </section>

      {/* 빠른 메뉴 */}
      <section>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Link
            to="/student/video"
            className="stu-action-tile"
          >
            <div className="stu-action-tile__icon">
              {isTchulTheme ? (
                <img
                  src={TchulLogoIcon}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "6px",
                  }}
                />
              ) : (
                <IconPlay style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
              )}
            </div>
            <div className="stu-action-tile__label">영상</div>
          </Link>
          <Link
            to="/student/exams"
            className="stu-action-tile"
          >
            <div className="stu-action-tile__icon">
              {isTchulTheme ? (
                <img
                  src={TchulLogoIcon}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "6px",
                  }}
                />
              ) : (
                <IconExam style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
              )}
            </div>
            <div className="stu-action-tile__label">시험</div>
          </Link>
          <Link
            to="/student/grades"
            className="stu-action-tile"
          >
            <div className="stu-action-tile__icon">
              {isTchulTheme ? (
                <img
                  src={TchulLogoIcon}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "6px",
                  }}
                />
              ) : (
                <IconGrade style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
              )}
            </div>
            <div className="stu-action-tile__label">성적</div>
          </Link>
          <Link
            to="/student/sessions"
            className="stu-action-tile"
          >
            <div className="stu-action-tile__icon">
              {isTchulTheme ? (
                <img
                  src={TchulLogoIcon}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "6px",
                  }}
                />
              ) : (
                <IconCalendar style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
              )}
            </div>
            <div className="stu-action-tile__label">일정</div>
          </Link>
        </div>
      </section>
    </div>
  );
}
