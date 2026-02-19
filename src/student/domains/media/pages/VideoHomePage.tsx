/**
 * 영상 홈 — 전체공개영상(맨위) + 강의별 차시 영상 (접기/펼치기)
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchVideoMe, fetchStudentSessionVideos } from "../api/media";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { IconChevronRight, IconPlay } from "@/student/shared/ui/icons/Icons";

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSessionTitle(s: { title: string; order: number; date?: string | null }): string {
  const dateStr = s.date ? new Date(s.date).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "";
  return dateStr ? `${s.order}차시 ${dateStr}` : `${s.order}차시`;
}

function SessionVideoList({
  sessionId,
  sessionTitle,
  enrollmentId,
}: {
  sessionId: number;
  sessionTitle: string;
  enrollmentId?: number | null;
}) {
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
    <section style={{ marginBottom: "var(--stu-space-6)" }}>
      {sessionTitle ? (
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: "var(--stu-space-3)",
            paddingLeft: "var(--stu-space-2)",
            color: "var(--stu-text-muted)",
          }}
        >
          {sessionTitle}
        </h3>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {items.map((v) => (
          <Link
            key={v.id}
            to={`/student/video/play?video=${v.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`}
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
                {formatDuration((v as { duration?: number }).duration ?? 0)}
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
  const [expandedLectureIds, setExpandedLectureIds] = useState<Set<number>>(new Set());
  const enrollmentId: number | null = null;

  const { data: videoMe, isLoading, isError } = useQuery({
    queryKey: ["student-video-me"],
    queryFn: fetchVideoMe,
  });

  const hasPublic = !!videoMe?.public?.session_id;
  const hasLectures = (videoMe?.lectures?.length ?? 0) > 0;
  const hasAny = hasPublic || hasLectures;

  const toggleLecture = (lectureId: number) => {
    setExpandedLectureIds((prev) => {
      const next = new Set(prev);
      if (next.has(lectureId)) next.delete(lectureId);
      else next.add(lectureId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4)" }}>
        <div className="stu-skel" style={{ height: 120, borderRadius: "var(--stu-radius-lg)" }} />
        <div className="stu-skel" style={{ height: 80, marginTop: 12, borderRadius: "var(--stu-radius-lg)" }} />
      </div>
    );
  }

  if (isError || !hasAny) {
    return (
      <div style={{ padding: "var(--stu-space-4)" }}>
        <EmptyState
          title="등록된 영상이 없습니다"
          description="전체공개 영상이나 수강 중인 강의의 차시 영상이 여기에 표시됩니다."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: "var(--stu-space-6)", paddingLeft: "var(--stu-space-2)" }}>
        영상
      </h1>

      {/* 전체공개영상 */}
      {hasPublic && videoMe?.public && (
        <section style={{ marginBottom: "var(--stu-space-10)" }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 800,
              marginBottom: "var(--stu-space-4)",
              paddingLeft: "var(--stu-space-2)",
            }}
          >
            전체공개영상
          </h2>
          <SessionVideoList
            sessionId={videoMe.public.session_id}
            sessionTitle=""
            enrollmentId={enrollmentId}
          />
        </section>
      )}

      {/* 강의별 차시 */}
      {(videoMe?.lectures ?? []).map((lec) => {
        const isExpanded = expandedLectureIds.has(lec.id);
        return (
          <section key={lec.id} style={{ marginBottom: "var(--stu-space-6)" }}>
            <button
              type="button"
              onClick={() => toggleLecture(lec.id)}
              className="stu-card stu-card--pressable"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "var(--stu-space-4)",
                border: "none",
                background: "var(--stu-surface)",
                borderRadius: "var(--stu-radius-lg)",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lec.title}
              </span>
              <IconChevronRight
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  color: "var(--stu-text-muted)",
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>
            {isExpanded && (
              <div style={{ marginTop: "var(--stu-space-4)", paddingLeft: "var(--stu-space-2)" }}>
                {lec.sessions.map((s) => (
                  <SessionVideoList
                    key={s.id}
                    sessionId={s.id}
                    sessionTitle={formatSessionTitle(s)}
                    enrollmentId={enrollmentId}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
