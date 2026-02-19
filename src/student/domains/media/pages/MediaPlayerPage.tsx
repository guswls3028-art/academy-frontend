// PATH: src/student/domains/media/pages/MediaPlayerPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";
import studentApi from "@/student/shared/api/studentApi";

import StudentVideoPlayer, {
  PlaybackBootstrap,
  VideoMetaLite,
} from "../playback/player/StudentVideoPlayer";
import { safeParseInt, getOrCreateDeviceId } from "../playback/player/design/utils";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

async function fetchVideo(videoId: number): Promise<VideoMetaLite & { 
  description?: string | null;
  created_at?: string | null;
  view_count?: number | null;
  tags?: string[];
}> {
  // ✅ backend: apps/support/video/urls.py router videos -> /api/v1/videos/videos/{id}/
  const res = await studentApi.get(`/api/v1/videos/videos/${videoId}/`);
  const v = res?.data || {};
  return {
    id: Number(v.id),
    title: String(v.title ?? "영상"),
    duration: v.duration == null ? null : Number(v.duration),
    status: String(v.status ?? ""),
    thumbnail_url: v.thumbnail_url ?? null,
    hls_url: v.hls_url ?? null,
    description: v.description ?? null,
    created_at: v.created_at ?? null,
    view_count: v.view_count ?? null,
    tags: Array.isArray(v.tags) ? v.tags : [],
  };
}

async function startPlayback(params: {
  videoId: number;
  enrollmentId?: number | null;
  deviceId: string;
}): Promise<PlaybackBootstrap> {
  const body: any = {
    video_id: params.videoId,
    device_id: params.deviceId,
  };
  if (params.enrollmentId) {
    body.enrollment_id = params.enrollmentId;
  }
  const res = await studentApi.post(`/api/v1/videos/playback/start/`, body);
  const d = res?.data || {};
  const policy = d.policy || {};
  return {
    token: String(d.token || ""),
    session_id: d.session_id != null ? String(d.session_id) : null,
    expires_at: d.expires_at != null ? Number(d.expires_at) : null,
    access_mode: (d.access_mode ?? policy.access_mode) || "FREE_REVIEW",
    monitoring_enabled: d.monitoring_enabled ?? policy.monitoring_enabled ?? false,
    policy,
    play_url: String(d.play_url || ""),
  };
}


export default function MediaPlayerPage() {
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
        const deviceId = getOrCreateDeviceId();
        // 전체공개영상인지 확인 (enrollmentId 없이도 재생 가능)
        const v = await fetchVideo(videoId);
        const isPublicVideo = !enrollmentId; // 전체공개영상은 enrollmentId가 없을 수 있음
        
        const b = await startPlayback({ 
          videoId, 
          enrollmentId: enrollmentId || undefined, 
          deviceId 
        });

        if (!alive) return;

        if (!b.token || !b.play_url) {
          setErr("재생 세션 생성 실패");
          setLoading(false);
          return;
        }

        // For FREE_REVIEW mode, session_id and expires_at may be null (expected)

        setVideo(v);
        setBoot(b);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        const msg =
          e?.response?.data?.detail ||
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
              background: "var(--stu-surface-1)",
              border: "1px solid var(--stu-border-subtle)",
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--stu-text)",
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
                color: "var(--stu-text-muted)",
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
                  color: "var(--stu-text)",
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
