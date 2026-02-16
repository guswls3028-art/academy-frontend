/**
 * 영상 홈 — 유튜브 모바일형: 세션별 영상 목록, 썸네일 + 제목 + 길이
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import { fetchStudentSessionVideos } from "../api/media";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { IconChevronRight } from "@/student/shared/ui/icons/Icons";

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SessionVideoList({ sessionId, sessionTitle, enrollmentId }: { sessionId: number; sessionTitle: string; enrollmentId?: number | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-session-videos", sessionId, enrollmentId],
    queryFn: () => fetchStudentSessionVideos(sessionId, enrollmentId),
    enabled: !!sessionId,
  });

  const items = data?.items ?? [];
  if (isLoading) {
    return (
      <div className="stu-card" style={{ padding: "var(--stu-space-8)" }}>
        <div className="stu-skel" style={{ height: 80 }} />
        <div className="stu-skel" style={{ height: 80, marginTop: 8 }} />
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: "var(--stu-space-10)" }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 800,
          marginBottom: "var(--stu-space-4)",
          paddingLeft: "var(--stu-space-2)",
        }}
      >
        {sessionTitle}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {items.map((v) => (
          <Link
            key={v.id}
            to={`/student/video/play?video=${v.id}&enrollment=${enrollmentId ?? ""}`}
            className="stu-card stu-card--pressable"
            style={{
              display: "flex",
              gap: "var(--stu-space-4)",
              padding: 0,
              overflow: "hidden",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: 160,
                minWidth: 160,
                aspectRatio: "16/9",
                background: "var(--stu-surface-soft)",
                position: "relative",
              }}
            >
              {v.thumbnail_url ? (
                <img
                  src={v.thumbnail_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--stu-text-muted)",
                  }}
                >
                  <IconPlay style={{ width: 40, height: 40 }} />
                </div>
              )}
              <span
                style={{
                  position: "absolute",
                  right: 4,
                  bottom: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  background: "rgba(0,0,0,0.8)",
                  color: "#fff",
                  padding: "2px 4px",
                  borderRadius: 4,
                }}
              >
                {formatDuration((v as any).duration ?? 0)}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0, padding: "var(--stu-space-4)", display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {v.title}
              </span>
              <IconChevronRight style={{ width: 20, height: 20, flexShrink: 0, color: "var(--stu-text-muted)" }} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function VideoHomePage() {
  const { data: sessions, isLoading, isError } = useMySessions();
  // enrollmentId: 세션별로 다를 수 있음 — API가 쿼리 파라미터로 받으면 전달. 없으면 백엔드가 user 기준으로 처리할 수 있음
  const enrollmentId: number | null = null;

  if (isLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4)" }}>
        <div className="stu-skel" style={{ height: 120, borderRadius: "var(--stu-radius-lg)" }} />
        <div className="stu-skel" style={{ height: 80, marginTop: 12, borderRadius: "var(--stu-radius-lg)" }} />
      </div>
    );
  }

  if (isError || !sessions?.length) {
    return (
      <div style={{ padding: "var(--stu-space-4)" }}>
        <EmptyState
          title="재생할 영상이 없습니다"
          description="수강 중인 차시가 있으면 여기에 영상이 표시됩니다."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: "var(--stu-space-6)", paddingLeft: "var(--stu-space-2)" }}>
        영상
      </h1>
      {sessions.map((s) => (
        <SessionVideoList
          key={s.id}
          sessionId={s.id}
          sessionTitle={s.title ?? `차시 ${s.id}`}
          enrollmentId={enrollmentId}
        />
      ))}
    </div>
  );
}
