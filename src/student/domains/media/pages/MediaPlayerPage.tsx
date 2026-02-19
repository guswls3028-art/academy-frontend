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

async function fetchVideo(videoId: number): Promise<VideoMetaLite> {
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
  const [video, setVideo] = useState<VideoMetaLite | null>(null);
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
    <StudentPageShell
      title={video?.title || "미디어"}
      description={
        loading
          ? "불러오는 중..."
          : err
            ? "재생 세션 생성 실패"
            : "편하게 시청하세요."
      }
      actions={
        <button
          type="button"
          onClick={() => nav(-1)}
          style={{
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid #e5e5e5",
            background: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ← 뒤로
        </button>
      }
    >
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
        <StudentVideoPlayer
          video={video}
          bootstrap={boot}
          enrollmentId={enrollmentId ? Number(enrollmentId) : 0}
          onFatal={(reason) => setErr(reason)}
        />
      ) : (
        <EmptyState title="데이터가 없습니다" description="다시 시도해주세요." />
      )}
    </StudentPageShell>
  );
}
