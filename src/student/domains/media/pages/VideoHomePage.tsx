/**
 * 영상 홈 — 프리미엄 SaaS 인강 느낌의 코스 카드 UI
 * 전체공개영상(맨위) + 강의별 코스 카드
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchVideoMe, fetchStudentSessionVideos } from "../api/media";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import CourseCard from "../components/CourseCard";

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

// 전체공개영상 세션용 코스 카드 데이터 계산
function usePublicCourseCard(publicSession: { session_id: number } | null) {
  const { data: videosData } = useQuery({
    queryKey: ["student-session-videos", publicSession?.session_id, null],
    queryFn: () => fetchStudentSessionVideos(publicSession!.session_id, null),
    enabled: !!publicSession?.session_id,
  });

  return useMemo(() => {
    if (!videosData?.items || videosData.items.length === 0) return null;
    
    const videos = videosData.items;
    const totalDuration = videos.reduce((sum, v) => sum + ((v as { duration?: number }).duration ?? 0), 0);
    const firstVideo = videos[0];
    
    return {
      title: "전체공개영상",
      thumbnailUrl: firstVideo.thumbnail_url,
      videoCount: videos.length,
      totalDuration,
      progress: 0, // TODO: 진행률 계산
      isNew: false,
      isContinue: false,
      isCompleted: false,
      to: `/student/video/play?video=${firstVideo.id}`,
    };
  }, [videosData]);
}

// 강의별 코스 카드 데이터 계산
function useLectureCourseCard(lecture: { id: number; title: string; sessions: Array<{ id: number }> }) {
  const sessionIds = lecture.sessions.map((s) => s.id);
  const sessionQueries = useQuery({
    queryKey: ["student-lecture-videos", lecture.id],
    queryFn: async () => {
      const allVideos: Array<{ duration?: number; thumbnail_url?: string | null }> = [];
      for (const sessionId of sessionIds) {
        const res = await fetchStudentSessionVideos(sessionId, null);
        allVideos.push(...res.items);
      }
      return allVideos;
    },
    enabled: sessionIds.length > 0,
  });

  return useMemo(() => {
    if (!sessionQueries.data || sessionQueries.data.length === 0) return null;
    
    const videos = sessionQueries.data;
    const totalDuration = videos.reduce((sum, v) => sum + (v.duration ?? 0), 0);
    const firstVideo = videos[0];
    
    return {
      title: lecture.title,
      thumbnailUrl: firstVideo.thumbnail_url,
      videoCount: videos.length,
      totalDuration,
      progress: 0, // TODO: 진행률 계산
      isNew: false,
      isContinue: false,
      isCompleted: false,
      to: `/student/video/play?video=${firstVideo.id}`,
    };
  }, [lecture, sessionQueries.data]);
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
            enrollmentId={null}
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
