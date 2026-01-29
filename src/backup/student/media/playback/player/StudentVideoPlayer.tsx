// src/student/media/playback/player/StudentVideoPlayer.tsx
//
// v2-ish enforcement 적용 (설계도 반영):
// - policy.seek.mode 기반 SEEK 제어 (free / bounded_forward / blocked)
// - maxWatched(최대 시청 위치) 추적 + SEEK_ATTEMPT payload에 max_watched 포함
// - 배속 제한: policy.playback_rate.max + ui_control 반영, 위반 시 SPEED_CHANGE_ATTEMPT
// - 탭 이탈(visibility) 시간 누적 + 이벤트로 기록 (VISIBILITY_HIDDEN / VISIBILITY_VISIBLE)
// - (권장) 제한 모드일 때 전체화면 유도 + FULLSCREEN_ENTER/EXIT 이벤트
//
// ✅ Admin preview 요구사항(최종 패치):
// - enforcement는 ON (seek/speed/fullscreen/visibility 보정 유지)
// - 이벤트 전송은 OFF (push/flush no-op)
// - admin preview에서 ready=false로 영원히 막히는 UI 방지
// - attach effect deps에 ready 포함
//
// 주의:
// - token/policy는 localStorage 저장 금지
// - 이벤트 타입은 backend enum과 정확히 일치해야 함

import { useCallback, useEffect, useMemo, useRef } from "react";
import Hls from "hls.js";

import { usePlaybackEvents } from "@/student/media/playback/hooks/usePlaybackEvents";
import { usePlaybackSession } from "@/student/media/playback/hooks/usePlaybackSession";
import { resolvePlayUrl } from "@/student/media/playback/utils/resolvePlayUrl";
import { getDeviceId } from "@/student/media/playback/utils/deviceId";
import WatermarkOverlay from "@/student/media/playback/player/WatermarkOverlay";

type Props = {
  videoId: number;
  enrollmentId: number;

  /**
   * - "student": 학생 재생 (기본)
   * - "admin_preview": 관리자 프리뷰 (이벤트 OFF, enforcement ON)
   */
  mode?: "student" | "admin_preview";
};

type SeekMode = "free" | "bounded_forward" | "blocked";
type SeekPolicy = {
  mode?: SeekMode;
  forward_limit?: "max_watched" | null;
  grace_seconds?: number;
};

export default function StudentVideoPlayer({
  videoId,
  enrollmentId,
  mode = "student",
}: Props) {
  const isAdminPreview = mode === "admin_preview";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // ---- 핵심 상태(메모리) ----
  const lastTimeRef = useRef(0);
  const maxWatchedRef = useRef(0);

  // 탭 이탈 시간 누적
  const hiddenStartedAtRef = useRef<number | null>(null);
  const totalHiddenSecondsRef = useRef(0);

  const deviceId = getDeviceId();

  /* ======================================================
   * Playback Session
   * ====================================================== */
  // admin_preview에서도 policy/playUrl이 필요하므로 session을 완전히 끄지 않음
  const { sessionId, playUrl, policy, ready, getToken } =
    usePlaybackSession({
      videoId,
      enrollmentId,
      deviceId,
      enabled: Boolean(videoId && enrollmentId),
      // mode, // 훅이 지원하면 전달 가능
    } as any);

  /* ======================================================
   * Playback Events
   * ====================================================== */
  const { push, flush } = usePlaybackEvents({
    videoId,
    enabled: ready && !isAdminPreview,
    getToken,
  });

  const safePush = useCallback(
    (type: any, payload?: any) => {
      if (isAdminPreview) return;
      push(type, payload);
    },
    [isAdminPreview, push]
  );

  const safeFlush = useCallback(
    async (immediate?: boolean) => {
      if (isAdminPreview) return;
      await flush(immediate);
    },
    [isAdminPreview, flush]
  );

  /* ======================================================
   * Policy 해석
   * ====================================================== */
  const seekPolicy: SeekPolicy = useMemo(() => {
    const p: any = policy ?? {};
    const seek: any = p.seek;

    if (seek && typeof seek === "object") {
      return {
        mode: seek.mode as SeekMode | undefined,
        forward_limit: seek.forward_limit ?? null,
        grace_seconds:
          typeof seek.grace_seconds === "number" ? seek.grace_seconds : 0,
      };
    }

    const allowSeek = Boolean(p.allow_seek);
    return {
      mode: allowSeek ? "free" : "blocked",
      forward_limit: null,
      grace_seconds: 0,
    };
  }, [policy]);

  const seekMode: SeekMode = (seekPolicy.mode ?? "free") as SeekMode;
  const seekGrace = Number(seekPolicy.grace_seconds ?? 0);

  /* ======================================================
   * Attach Video (HLS)
   * ====================================================== */
  useEffect(() => {
    if (!videoRef.current) return;
    if (!playUrl) return;
    if (!ready && !isAdminPreview) return;

    const video = videoRef.current;
    const src = resolvePlayUrl(playUrl);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        console.warn("[playback] hls error", data);
        safePush("PLAYER_ERROR", {
          details: data?.details,
          fatal: data?.fatal,
        });
      });

      hlsRef.current = hls;
    } else {
      video.src = src;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [isAdminPreview, playUrl, ready, safePush]);

  /* ======================================================
   * timeupdate: maxWatched + playbackRate enforcement
   * ====================================================== */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!ready && !isAdminPreview) return;

    const onTimeUpdate = () => {
      const t = Number(video.currentTime || 0);

      lastTimeRef.current = t;
      if (t > maxWatchedRef.current) {
        maxWatchedRef.current = t;
      }

      const pr: any = (policy as any)?.playback_rate ?? {};
      const uiControl = Boolean(pr.ui_control ?? true);
      const maxRate = Number(pr.max ?? 1.0);

      if (!uiControl && video.playbackRate !== 1.0) {
        video.playbackRate = 1.0;
        safePush("SPEED_CHANGE_ATTEMPT", {
          to: 1.0,
          reason: "ui_control_disabled",
        });
      } else if (video.playbackRate > maxRate) {
        const attempted = video.playbackRate;
        video.playbackRate = maxRate;
        safePush("SPEED_CHANGE_ATTEMPT", {
          to: attempted,
          capped_to: maxRate,
        });
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [isAdminPreview, policy, ready, safePush]);

  /* ======================================================
   * ratechange: 즉시 배속 보정
   * ====================================================== */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!ready && !isAdminPreview) return;

    const onRateChange = () => {
      const pr: any = (policy as any)?.playback_rate ?? {};
      const uiControl = Boolean(pr.ui_control ?? true);
      const maxRate = Number(pr.max ?? 1.0);
      const attempted = Number(video.playbackRate || 1.0);

      if (!uiControl && attempted !== 1.0) {
        safePush("SPEED_CHANGE_ATTEMPT", {
          to: attempted,
          reason: "ui_control_disabled",
        });
        video.playbackRate = 1.0;
        return;
      }

      if (attempted > maxRate) {
        safePush("SPEED_CHANGE_ATTEMPT", {
          to: attempted,
          capped_to: maxRate,
        });
        video.playbackRate = maxRate;
      }
    };

    video.addEventListener("ratechange", onRateChange);
    return () => {
      video.removeEventListener("ratechange", onRateChange);
    };
  }, [isAdminPreview, policy, ready, safePush]);

  /* ======================================================
   * SEEK enforcement
   * ====================================================== */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!ready && !isAdminPreview) return;

    const onSeeking = () => {
      const from = Number(lastTimeRef.current || 0);
      const to = Number(video.currentTime || 0);
      const maxWatched = Number(maxWatchedRef.current || 0);

      if (seekMode === "blocked") {
        video.currentTime = from;
        safePush("SEEK_ATTEMPT", {
          from,
          to,
          max_watched: maxWatched,
          mode: "blocked",
        });
        return;
      }

      if (seekMode === "bounded_forward" && to > maxWatched + seekGrace) {
        video.currentTime = maxWatched;
        safePush("SEEK_ATTEMPT", {
          from,
          to,
          max_watched: maxWatched,
          grace_seconds: seekGrace,
          mode: "bounded_forward",
        });
        return;
      }

      lastTimeRef.current = to;
    };

    video.addEventListener("seeking", onSeeking);
    return () => {
      video.removeEventListener("seeking", onSeeking);
    };
  }, [isAdminPreview, ready, safePush, seekGrace, seekMode]);

  /* ======================================================
   * Visibility tracking
   * ====================================================== */
  useEffect(() => {
    if (!ready && !isAdminPreview) return;

    const nowSec = () => Math.floor(Date.now() / 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenStartedAtRef.current = nowSec();

        safePush("VISIBILITY_HIDDEN", {
          at: hiddenStartedAtRef.current,
          total_hidden_seconds: totalHiddenSecondsRef.current,
        });

        void safeFlush(true);
        return;
      }

      const started = hiddenStartedAtRef.current;
      if (started != null) {
        const delta = Math.max(0, nowSec() - started);
        totalHiddenSecondsRef.current += delta;
        hiddenStartedAtRef.current = null;

        safePush("VISIBILITY_VISIBLE", {
          at: nowSec(),
          hidden_seconds: delta,
          total_hidden_seconds: totalHiddenSecondsRef.current,
        });
      } else {
        safePush("VISIBILITY_VISIBLE", {
          at: nowSec(),
          total_hidden_seconds: totalHiddenSecondsRef.current,
        });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAdminPreview, ready, safeFlush, safePush]);

  /* ======================================================
   * Fullscreen 유도 + 이벤트
   * ====================================================== */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!ready && !isAdminPreview) return;
    if (seekMode === "free") return;

    const onFirstPlay = async () => {
      try {
        if (!document.fullscreenElement && video.requestFullscreen) {
          await video.requestFullscreen();
          safePush("FULLSCREEN_ENTER");
        }
      } catch {
        // ignore
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        safePush("FULLSCREEN_EXIT");
      }
    };

    video.addEventListener("play", onFirstPlay, { once: true });
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      video.removeEventListener("play", onFirstPlay);
      document.removeEventListener(
        "fullscreenchange",
        onFullscreenChange
      );
    };
  }, [isAdminPreview, ready, safePush, seekMode]);

  /* ======================================================
   * Render
   * ====================================================== */
  if (!ready && !isAdminPreview) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-500">
        재생 세션 생성 중...
      </div>
    );
  }

  return (
    <div className="relative space-y-2">
      <div className="relative">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          className="w-full rounded-lg bg-black"
          controlsList="nodownload noremoteplayback"
        />

        {policy?.watermark?.enabled && (
          <WatermarkOverlay
            enabled
            text="무단 배포 금지"
            sessionId={sessionId}
          />
        )}
      </div>
    </div>
  );
}
