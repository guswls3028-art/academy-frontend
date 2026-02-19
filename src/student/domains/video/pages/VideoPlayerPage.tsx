// PATH: src/student/domains/video/pages/VideoPlayerPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";
import { fetchStudentVideoPlayback } from "../api/video";
import { IconCheck, IconRefresh, IconArrowRight } from "@/student/shared/ui/icons/Icons";
import { Link } from "react-router-dom";

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
          const videoStatus = playbackData.video?.status;
          const detail = playbackData.detail || "";
          
          // 백엔드에서 제공한 상세 에러 메시지가 있으면 사용
          if (detail) {
            setErr(detail);
          } else if (videoStatus && videoStatus !== "READY") {
            setErr(`비디오가 아직 준비되지 않았습니다. (상태: ${videoStatus})`);
          } else {
            setErr("재생 URL을 가져올 수 없습니다. 비디오 파일이 처리 중이거나 업로드되지 않았을 수 있습니다.");
          }
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
          playUrl: playUrl.substring(0, 200) + (playUrl.length > 200 ? "..." : ""), // URL 일부만 로깅
          hlsUrl: playbackData.hls_url?.substring(0, 200),
          mp4Url: playbackData.mp4_url?.substring(0, 200),
          videoStatus: playbackData.video?.status,
          hasPolicy: !!playbackData.policy,
          fullResponse: playbackData, // 전체 응답도 로깅 (디버깅용)
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
    <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
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
          
          {/* 하단: 행동 중심 UI (YouTube SaaS 스타일) */}
          <div
            style={{
              marginTop: "var(--stu-space-6)",
            }}
          >
            {/* 제목 및 행동 버튼 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--stu-space-4)",
                flexWrap: "wrap",
                gap: "var(--stu-space-3)",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fff",
                  margin: 0,
                }}
              >
                {video.title}
              </h2>
              
              {/* 행동 버튼 그룹 */}
              <div
                style={{
                  display: "flex",
                  gap: "var(--stu-space-2)",
                  flexWrap: "wrap",
                }}
              >
                {/* 수강 완료 버튼 */}
                <button
                  type="button"
                  onClick={() => {
                    // TODO: 수강 완료 처리
                    console.log("수강 완료");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  }}
                >
                  <IconCheck style={{ width: 18, height: 18 }} />
                  <span>수강 완료</span>
                </button>
                
                {/* 다시보기 버튼 */}
                <button
                  type="button"
                  onClick={() => {
                    // TODO: 다시보기 처리 (재생 위치 초기화)
                    console.log("다시보기");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  }}
                >
                  <IconRefresh style={{ width: 18, height: 18 }} />
                  <span>다시보기</span>
                </button>
                
                {/* 다음 강의 버튼 */}
                <Link
                  to="#" // TODO: 다음 강의 링크
                  onClick={(e) => {
                    e.preventDefault();
                    // TODO: 다음 강의로 이동
                    console.log("다음 강의");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "var(--stu-primary)",
                    border: "none",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.9";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <span>다음 강의</span>
                  <IconArrowRight style={{ width: 18, height: 18 }} />
                </Link>
              </div>
            </div>
            
            {/* 구분선 */}
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.1)",
                marginBottom: "var(--stu-space-4)",
              }}
            />
            
            {/* 자동 재생 안내 (선택사항) */}
            <div
              style={{
                padding: "var(--stu-space-3)",
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <IconPlay style={{ width: 16, height: 16, opacity: 0.6 }} />
              <span>다음 강의 자동재생 ON</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ opacity: 0.5 }}>5초 후 재생</span>
            </div>
          </div>
        </>
      ) : (
        <EmptyState title="데이터가 없습니다" description="다시 시도해주세요." />
      )}
      </div>
    </div>
  );
}
