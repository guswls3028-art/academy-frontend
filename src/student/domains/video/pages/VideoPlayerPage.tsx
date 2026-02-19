// PATH: src/student/domains/video/pages/VideoPlayerPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";
import { fetchStudentVideoPlayback } from "../api/video";

import StudentVideoPlayer, {
  PlaybackBootstrap,
  VideoMetaLite,
} from "../playback/player/StudentVideoPlayer";
import { safeParseInt } from "../playback/player/design/utils";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function VideoPlayerPage() {
  const nav = useNavigate();
  const q = useQuery();
  const params = useParams();

  const videoId =
    safeParseInt(params.videoId) ??
    safeParseInt(q.get("video")) ??
    safeParseInt(q.get("video_id"));

  const enrollmentId =
    safeParseInt(q.get("enrollment")) ??
    safeParseInt(q.get("enrollment_id")) ??
    safeParseInt(params.enrollmentId);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [video, setVideo] = useState<(VideoMetaLite & { 
    description?: string | null;
    created_at?: string | null;
    view_count?: number | null;
    tags?: string[];
  }) | null>(null);
  const [boot, setBoot] = useState<PlaybackBootstrap | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);

      if (!videoId) {
        setLoading(false);
        setErr("video_id가 필요합니다.");
        return;
      }

      try {
        // 학생 앱 전용 API: 비디오 정보와 재생 정보를 한 번에 가져오기
        const playbackData = await fetchStudentVideoPlayback(videoId, enrollmentId || undefined);
        
        if (!alive) return;

        // 비디오 정보 추출
        const v: VideoMetaLite & {
          description?: string | null;
          created_at?: string | null;
          view_count?: number | null;
          tags?: string[];
        } = {
          id: Number(playbackData.video.id),
          title: String(playbackData.video.title ?? "영상"),
          duration: playbackData.video.duration == null ? null : Number(playbackData.video.duration),
          status: String(playbackData.video.status ?? ""),
          thumbnail_url: playbackData.video.thumbnail_url ?? null,
          hls_url: playbackData.hls_url ?? null,
          description: (playbackData.video as any).description ?? null,
          created_at: (playbackData.video as any).created_at ?? null,
          view_count: (playbackData.video as any).view_count ?? null,
          tags: Array.isArray((playbackData.video as any).tags) ? (playbackData.video as any).tags : [],
        };

        // 재생 URL 확인 (play_url 우선, 없으면 hls_url 또는 mp4_url)
        const playUrl = playbackData.play_url || playbackData.hls_url || playbackData.mp4_url || "";
        
        if (!playUrl) {
          console.error("[VideoPlayerPage] No play URL available:", playbackData);
          setErr("재생 URL을 가져올 수 없습니다.");
          setLoading(false);
          return;
        }

        // Bootstrap 정보 생성
        const b: PlaybackBootstrap = {
          token: `student-${videoId}-${Date.now()}`, // 학생 앱용 임시 token (세션 관리 불필요)
          session_id: null,
          expires_at: null,
          access_mode: playbackData.policy?.access_mode || "FREE_REVIEW",
          monitoring_enabled: playbackData.policy?.monitoring_enabled ?? false,
          policy: playbackData.policy || {},
          play_url: playUrl,
        };

        console.log("[VideoPlayerPage] Playback ready:", {
          videoId,
          playUrl,
          hasPolicy: !!playbackData.policy,
        });

        setVideo(v);
        setBoot(b);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error("[VideoPlayerPage] Error loading playback:", e);
        const msg =
          e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "재생 페이지 로드에 실패했습니다.";
        setErr(String(msg));
        setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, enrollmentId]);

  return (
    <div style={{ background: "#000", minHeight: "100vh", padding: "var(--stu-space-4)" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: "var(--stu-space-4)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => nav(-1)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← 뒤로
          </button>
          {video && (
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
              {video.title}
            </h1>
          )}
          <div style={{ width: 80 }} />
        </div>
      {loading ? (
        <div style={{ padding: 8 }}>
          <div
            style={{
              height: 520,
              borderRadius: 14,
              border: "1px solid #eee",
              background:
                "linear-gradient(90deg, #f3f3f3, #fafafa, #f3f3f3)",
              backgroundSize: "200% 100%",
              animation: "mediaShimmer 1.1s ease-in-out infinite",
            }}
          />
          <style>{`
            @keyframes mediaShimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>
      ) : err ? (
        <EmptyState
          title="재생을 시작할 수 없습니다"
          description={err}
        />
      ) : video && boot ? (
        <>
          {/* 상단: 영상 플레이어 */}
          <StudentVideoPlayer
            video={video}
            bootstrap={boot}
            enrollmentId={enrollmentId ? Number(enrollmentId) : 0}
            onFatal={(reason) => setErr(reason)}
          />
          
          {/* 하단: 영상 요약 정보 */}
          <div
            style={{
              marginTop: "var(--stu-space-6)",
              padding: "var(--stu-space-5)",
              borderRadius: 12,
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                marginBottom: "var(--stu-space-4)",
              }}
            >
              영상 정보
            </h2>
            
            {/* 메타 정보 */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--stu-space-4)",
                marginBottom: "var(--stu-space-4)",
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {video.view_count != null && (
                <div>
                  <span style={{ fontWeight: 600 }}>조회수:</span> {video.view_count.toLocaleString()}회
                </div>
              )}
              {video.created_at && (
                <div>
                  <span style={{ fontWeight: 600 }}>업로드:</span> {new Date(video.created_at).toLocaleDateString("ko-KR")}
                </div>
              )}
              {video.duration && (
                <div>
                  <span style={{ fontWeight: 600 }}>재생시간:</span> {Math.floor(video.duration / 60)}분 {Math.floor(video.duration % 60)}초
                </div>
              )}
            </div>

            {/* 태그 */}
            {video.tags && video.tags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: "var(--stu-space-4)",
                }}
              >
                {video.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "var(--stu-tint-primary)",
                      color: "var(--stu-text)",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* 설명 */}
            {video.description && (
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.9)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {video.description}
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyState title="데이터가 없습니다" description="다시 시도해주세요." />
      )}
      </div>
    </div>
  );
}
