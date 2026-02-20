// PATH: src/student/domains/video/playback/player/StudentVideoPlayer.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import studentApi from "@/student/shared/api/studentApi";

import "./player.css";

import {
  clamp,
  formatClock,
  formatDateTimeKorean,
  getEpochSec,
  getOrCreateDeviceId,
  safeParseFloat,
  safeParseInt,
} from "./design/utils";
import {
  IconButton,
  KebabMenu,
  MenuItem,
  Pill,
  PlayerToast,
  RangeSlider,
} from "./design/ui";

/**
 * ✅ SSOT: Backend playback/start returns policy + play_url
 * - Frontend는 소비만 한다 (판단/계산 최소)
 * - 단, "정책 강제"는 플레이어 UX의 일부로서 client에서 막는다 (탐색/배속/표시)
 */

export type VideoMetaLite = {
  id: number;
  title: string;
  duration: number | null;
  status?: string;
  thumbnail_url?: string | null;
  hls_url?: string | null;
};

export type PlaybackBootstrap = {
  token: string;
  session_id: string | null;  // null for FREE_REVIEW
  expires_at: number | null;  // null for FREE_REVIEW
  access_mode: "FREE_REVIEW" | "PROCTORED_CLASS";
  monitoring_enabled: boolean;
  policy: any;
  play_url: string;
};

export type LeaveProgressPayload = {
  progress?: number;
  last_position?: number;
  completed?: boolean;
};

type Props = {
  video: VideoMetaLite;
  bootstrap: PlaybackBootstrap;
  enrollmentId: number | null;
  onFatal?: (reason: string) => void;
  /** 나갈 때(언마운트) 현재 시청 위치로 자동 저장용 */
  onLeaveProgress?: (data: LeaveProgressPayload) => void;
};

import type { AccessMode } from "@/features/videos/types/access-mode";

type Policy = {
  access_mode?: AccessMode;
  monitoring_enabled?: boolean;  // true only for PROCTORED_CLASS
  allow_seek?: boolean;
  seek?: {
    mode?: "free" | "blocked" | "bounded_forward";
    forward_limit?: "max_watched" | null;
    grace_seconds?: number;
  };
  playback_rate?: {
    max?: number;
    ui_control?: boolean;
  };
  watermark?: {
    enabled?: boolean;
    mode?: "overlay";
    fields?: string[];
  };
  concurrency?: {
    max_sessions?: number;
    max_devices?: number;
  };
};

type EventType =
  | "VISIBILITY_HIDDEN"
  | "VISIBILITY_VISIBLE"
  | "FOCUS_LOST"
  | "FOCUS_GAINED"
  | "SEEK_ATTEMPT"
  | "SPEED_CHANGE_ATTEMPT"
  | "FULLSCREEN_ENTER"
  | "FULLSCREEN_EXIT"
  | "PLAYER_ERROR";

function normalizePolicy(p: any): Policy {
  const policy = (p || {}) as Policy;
  policy.seek = (policy.seek || {}) as any;
  policy.playback_rate = (policy.playback_rate || {}) as any;
  policy.watermark = (policy.watermark || {}) as any;

  if (policy.monitoring_enabled == null) {
    policy.monitoring_enabled = policy.access_mode === "PROCTORED_CLASS";
  }
  if (policy.allow_seek == null) policy.allow_seek = true;
  if (!policy.seek) policy.seek = { mode: "free", grace_seconds: 3 };
  if (!policy.seek?.mode) policy.seek!.mode = "free";
  if (policy.seek?.grace_seconds == null) policy.seek!.grace_seconds = 3;

  if (policy.playback_rate?.max == null) policy.playback_rate = { ...policy.playback_rate, max: 16 };
  if (policy.playback_rate?.ui_control == null) policy.playback_rate = { ...policy.playback_rate, ui_control: true };

  if (policy.watermark?.enabled == null) policy.watermark = { ...policy.watermark, enabled: false };

  return policy;
}

/**
 * 학생 앱에서는 세션 관리 API가 필요 없을 수 있음
 * token이 "student-" 접두사로 시작하면 스킵
 */
async function postHeartbeat(token: string) {
  if (token.startsWith("student-")) return; // 학생 앱용 임시 token은 스킵
  try {
    await studentApi.post(`/api/v1/videos/playback/heartbeat/`, { token });
  } catch (e) {
    // 실패해도 계속 진행
  }
}

async function postRefresh(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/api/v1/videos/playback/refresh/`, { token });
  } catch (e) {
    // 실패해도 계속 진행
  }
}

async function postEnd(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/api/v1/videos/playback/end/`, { token });
  } catch (e) {
    // 실패해도 계속 진행
  }
}

async function postEvents(
  token: string,
  events: Array<{ type: EventType; occurred_at: number; payload?: any }>,
  videoId: number,
  enrollmentId: number | null
) {
  if (!events.length) return;
  if (token.startsWith("student-")) return; // 학생 앱용 임시 token은 스킵
  try {
    await studentApi.post(`/api/v1/videos/playback/events/`, {
      token,
      video_id: videoId,
      enrollment_id: enrollmentId ?? 0,
      events: events.map((e) => ({
        type: e.type,
        occurred_at: e.occurred_at,
        payload: e.payload || {},
      })),
    });
  } catch (e) {
    // 실패해도 계속 진행
  }
}

function useStableInterval(cb: () => void, ms: number, enabled: boolean) {
  const ref = useRef(cb);
  ref.current = cb;

  useEffect(() => {
    const id = enabled ? window.setInterval(() => ref.current(), ms) : null;
    return () => {
      if (id != null) window.clearInterval(id);
    };
  }, [ms, enabled]);
}

export default function StudentVideoPlayer({ video, bootstrap, enrollmentId, onFatal, onLeaveProgress }: Props) {
  const onFatalRef = useRef(onFatal);
  onFatalRef.current = onFatal;

  const policy = useMemo(() => normalizePolicy(bootstrap.policy), [bootstrap.policy]);

  const allowSeek = !!policy.allow_seek && policy.seek?.mode !== "blocked";
  const seekMode = policy.seek?.mode || "free";
  const grace = Math.max(0, Number(policy.seek?.grace_seconds ?? 3));
  const boundedForward = seekMode === "bounded_forward";

  const speedUi = policy.playback_rate?.ui_control !== false;
  const maxRate = Math.max(1, safeParseFloat(policy.playback_rate?.max, 1) || 1);
  const speedLocked = !speedUi || maxRate <= 1.0001;

  const watermarkEnabled = !!policy.watermark?.enabled;

  // UI State
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const wrapEl = useRef<HTMLDivElement | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);

  const [duration, setDuration] = useState<number>(video.duration ?? 0);
  const [current, setCurrent] = useState<number>(0);

  const [volume, setVolume] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(false);

  const [rate, setRate] = useState<number>(1);
  const [theater, setTheater] = useState<boolean>(false);

  const [toast, setToast] = useState<{ text: string; kind?: "info" | "warn" | "danger" } | null>(null);

  /** 모바일 OTT: 컨트롤 표시 여부(싱글탭 토글) + 상태머신 */
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const maxWatchedRef = useRef<number>(0); // seconds
  const lastTimeRef = useRef<number>(0);
  const seekGuardRef = useRef<{ blocking: boolean; lastWarnAt: number }>({ blocking: false, lastWarnAt: 0 });

  const eventQueueRef = useRef<Array<{ type: EventType; occurred_at: number; payload?: any }>>([]);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRateRef = useRef(1);
  const gestureLayerRef = useRef<HTMLDivElement | null>(null);
  const swipeHandledRef = useRef(false);
  const touchStartRef = useRef<{ y: number; volume: number; rightHalf: boolean } | null>(null);

  const tokenRef = useRef(bootstrap.token);
  useEffect(() => {
    tokenRef.current = bootstrap.token;
  }, [bootstrap.token]);

  /** unmount 후 setState 방지 (React #310, cleanup 중/이후 이벤트·비동기 콜백) */
  const isUnmountedRef = useRef(false);
  const mountedRef = useRef(false);

  // 나갈 때 저장: 언마운트 + 탭 전환/창 내리기(모바일 웹 Safari 등) — DB는 이 시점에만 1회 쓰기
  const flushProgress = useCallback(() => {
    if (!onLeaveProgress) return;
    const el = videoEl.current;
    if (!el) return;
    const lastPosition = Math.max(0, maxWatchedRef.current || 0);
    const dur = Number(el.duration);
    const progressPercent =
      dur > 0 && Number.isFinite(dur) ? Math.min(100, (lastPosition / dur) * 100) : 0;
    const completed = dur > 0 && lastPosition >= dur - 0.5;
    onLeaveProgress({
      progress: progressPercent,
      last_position: Math.round(lastPosition),
      completed,
    });
  }, [onLeaveProgress]);

  const flushProgressRef = useRef(flushProgress);
  flushProgressRef.current = flushProgress;

  // Unmount 시에만 저장. deps에 flushProgress 넣지 않음 → 부모 리렌더 시 cleanup 반복 실행 방지 (React #310)
  useEffect(() => {
    return () => { flushProgressRef.current?.(); };
  }, []);

  // Page Visibility: 다른 탭 이동·사파리 창 내리기 시 한 번 저장 (모바일 웹). ref 사용으로 effect 재실행 방지
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushProgressRef.current?.();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Fullscreen sync + body scroll lock (모바일 Player Mode)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const wrap = wrapEl.current;
    if (!wrap) return;

    const onFullscreenChange = () => {
      if (!mountedRef.current) return;
      const el =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement;
      const active = el === wrap || (el && wrap.contains(el));
      setIsFullscreen(!!active);
      if (active) {
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        setShowControls(true);
      } else {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    (document as any).addEventListener?.("webkitfullscreenchange", onFullscreenChange);
    (document as any).addEventListener?.("mozfullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      (document as any).removeEventListener?.("webkitfullscreenchange", onFullscreenChange);
      (document as any).removeEventListener?.("mozfullscreenchange", onFullscreenChange);
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-hide controls: PLAYING 시 3초 후 숨김, SEEKING/GESTURE/PAUSED 시 유지
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    if (playing && !buffering && showControls) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        hideControlsTimerRef.current = null;
        if (!mountedRef.current) return;
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [playing, buffering, showControls]);

  // ---------------------------------------------------------------------------
  // HLS attach
  // ---------------------------------------------------------------------------
  const attachSource = useCallback(async () => {
    const el = videoEl.current;
    if (!el) return;

    // reset
    try {
      el.pause();
    } catch {}
    el.src = "";

    let url = bootstrap.play_url || video.hls_url || "";
    
    // 디버깅: URL 확인
    console.log("[StudentVideoPlayer] attachSource:", {
      play_url: bootstrap.play_url,
      video_hls_url: video.hls_url,
      final_url: url,
      hasUrl: !!url,
    });
    
    if (!url) {
      console.error("[StudentVideoPlayer] No play URL available:", {
        bootstrap: bootstrap,
        video: video,
      });
      onFatalRef.current?.("재생 URL이 제공되지 않았습니다. (play_url 또는 hls_url 필요)");
      return;
    }
    
    // 상대 경로인 경우 절대 URL로 변환
    try {
      // 절대 URL인지 확인
      new URL(url);
    } catch (e) {
      // 상대 경로인 경우 API 베이스 URL과 결합
      // studentApi.defaults.baseURL은 /api/v1이 포함되어 있으므로, 직접 환경 변수 사용
      const apiBase = String(import.meta.env.VITE_API_BASE_URL || "https://api.hakwonplus.com").trim();
      // baseURL이 이미 슬래시로 끝나면 제거, url이 슬래시로 시작하면 제거
      const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
      const path = url.startsWith("/") ? url : `/${url}`;
      url = `${base}${path}`;
      console.log("[StudentVideoPlayer] Converted relative URL to absolute:", {
        original: bootstrap.play_url || video.hls_url,
        apiBase: apiBase,
        final: url,
      });
    }
    
    // 최종 URL 유효성 검사
    try {
      new URL(url);
    } catch (e) {
      console.error("[StudentVideoPlayer] Invalid URL format:", url, e);
      onFatalRef.current?.(`잘못된 재생 URL 형식입니다: ${url}`);
      return;
    }

    // Native HLS (Safari)
    const canNative =
      el.canPlayType("application/vnd.apple.mpegurl") ||
      el.canPlayType("application/x-mpegURL");

    if (canNative) {
      el.src = url;
      return;
    }

    // Hls.js
    try {
      const mod: any = await import("hls.js");
      const Hls = mod.default;

      if (Hls && Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
        });

        (el as any).__hls = hls;

        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          try {
            queueEvent("PLAYER_ERROR", {
              fatal: !!data?.fatal,
              details: data?.details || "",
              type: data?.type || "",
            });
          } catch {}

          if (data?.fatal) {
            if (!mountedRef.current) return;
            const errorMsg = data?.details || data?.type || "알 수 없는 오류";
            const errorCode = data?.response?.code || data?.code;
            const is404 = errorCode === 404 || errorMsg.includes("404") || errorMsg.includes("Not Found");
            const isNetworkError = errorCode === -1 || errorCode === -2 || errorMsg.includes("network") || errorMsg.includes("NetworkError");
            
            let message = "";
            if (is404) {
              message = `비디오 파일을 찾을 수 없습니다. 비디오가 아직 처리 중이거나 업로드되지 않았을 수 있습니다.`;
            } else if (isNetworkError) {
              message = `네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.`;
            } else {
              message = `재생 오류가 발생했습니다: ${errorMsg}`;
            }
            
            console.error("[StudentVideoPlayer] HLS.js fatal error:", {
              errorCode,
              errorMsg,
              url,
              data,
            });
            
            setToast({ text: message, kind: "danger" });
            if (is404 || isNetworkError) {
              onFatalRef.current?.(message);
            }
          }
        });

        hls.loadSource(url);
        hls.attachMedia(el);
        return;
      }

      // fallback
      el.src = url;
    } catch (e) {
      // fallback
      el.src = url;
    }
  }, [bootstrap.play_url, video.hls_url]);

  // ---------------------------------------------------------------------------
  // Events batching (anti-spam)
  // ---------------------------------------------------------------------------
  const queueEvent = useCallback((type: EventType, payload?: any) => {
    const policy = normalizePolicy(bootstrap.policy);
    const monitoringEnabled = policy.monitoring_enabled ?? false;
    
    // If monitoring is disabled (FREE_REVIEW), skip all event logging
    if (!monitoringEnabled) {
      return;
    }
    
    // Only send violation-relevant events in PROCTORED_CLASS mode
    // FREE_REVIEW mode: minimal logging (no violation events)
    const violationEvents: EventType[] = ["SEEK_ATTEMPT", "SPEED_CHANGE_ATTEMPT"];
    const isViolationEvent = violationEvents.includes(type);
    const accessMode = policy.access_mode;
    
    if (accessMode === "FREE_REVIEW" && isViolationEvent) {
      // Don't send violation events in FREE_REVIEW mode
      return;
    }
    
    const now = getEpochSec();
    eventQueueRef.current.push({ type, occurred_at: now, payload: payload || {} });

    // small cap (memory safety)
    if (eventQueueRef.current.length > 300) {
      eventQueueRef.current.splice(0, eventQueueRef.current.length - 300);
    }
  }, [bootstrap.policy]);

  const queueEventRef = useRef(queueEvent);
  queueEventRef.current = queueEvent;

  const flushEvents = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    const batch = eventQueueRef.current.splice(0, eventQueueRef.current.length);
    if (!batch.length) return;

    try {
      await postEvents(token, batch, video.id, enrollmentId);
    } catch (e: any) {
      if (!mountedRef.current) return;
      // session revoked / inactive -> stop
      const msg = e?.response?.data?.detail || e?.message || "";
      if (String(msg).includes("session_inactive") || e?.response?.status === 409) {
        setToast({ text: "재생 세션이 종료되었습니다.", kind: "danger" });
        onFatalRef.current?.("session_inactive");
      }
    }
  }, [video.id, enrollmentId]);

  const monitoringEnabled = policy.monitoring_enabled ?? false;

  // Events: only when monitoring_enabled (FREE_REVIEW sends nothing)
  useStableInterval(
    () => {
      if (!mountedRef.current) return;
      flushEvents();
    },
    2200,
    monitoringEnabled
  );

  // Heartbeat: only for PROCTORED_CLASS
  useStableInterval(
    () => {
      if (!mountedRef.current) return;
      const token = tokenRef.current;
      if (!token) return;

      postHeartbeat(token).catch((e: any) => {
        if (!mountedRef.current) return;
        const msg = e?.response?.data?.detail || e?.message || "";
        if (String(msg).includes("policy_changed")) {
          setToast({ text: "정책이 변경되어 재생이 종료되었습니다.", kind: "danger" });
          onFatalRef.current?.("policy_changed");
          return;
        }
        if (String(msg).includes("session_inactive") || e?.response?.status === 409) {
          setToast({ text: "재생 세션이 종료되었습니다.", kind: "danger" });
          onFatalRef.current?.("session_inactive");
          return;
        }
      });
    },
    30000,
    monitoringEnabled
  );

  // ---------------------------------------------------------------------------
  // Mount/Unmount lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    attachSource();

    return () => {
      // unmount 직후 플래그 설정 (아래 destroy/비동기 후 콜백에서 setState 방지)
      isUnmountedRef.current = true;

      // cleanup hls (Video event binding effect의 cleanup이 먼저 실행되어 리스너 제거됨 → 그 다음 이 cleanup)
      const el = videoEl.current as any;
      const hls = el?.__hls;
      if (hls && typeof hls.destroy === "function") {
        try {
          hls.destroy();
        } catch {}
      }

      // end session (best-effort, only for PROCTORED_CLASS)
      const policy = normalizePolicy(bootstrap.policy);
      const monitoringEnabled = policy.monitoring_enabled ?? false;
      
      if (monitoringEnabled) {
        const token = tokenRef.current;
        if (token) {
          postEnd(token).catch(() => {});
        }

        // flush last events (완료 후 setToast는 flushEvents 내부에서 isUnmountedRef로 스킵됨)
        try {
          flushEvents();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Visibility / Focus events (ref 사용으로 queueEvent 변경 시 effect 재실행 방지, React #310)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        queueEventRef.current("VISIBILITY_HIDDEN", { hidden: true });
      } else {
        queueEventRef.current("VISIBILITY_VISIBLE", { hidden: false });
        if (monitoringEnabled) {
          const token = tokenRef.current;
          if (token) postRefresh(token).catch(() => {});
        }
      }
    };
    const onBlur = () => queueEventRef.current("FOCUS_LOST", {});
    const onFocus = () => queueEventRef.current("FOCUS_GAINED", {});

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [monitoringEnabled]);

  // ---------------------------------------------------------------------------
  // Video event binding
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = videoEl.current;
    if (!el) return;

    const onLoadedMeta = () => {
      if (!mountedRef.current) return;
      const d = Number(el.duration || 0);
      if (d && Number.isFinite(d)) setDuration(d);
      setReady(true);
      setBuffering(false);
    };

    const onTime = () => {
      if (!mountedRef.current) return;
      const t = Number(el.currentTime || 0);
      setCurrent(t);

      // "watched" = monotonic forward progress (safety against seek)
      const prev = lastTimeRef.current;
      lastTimeRef.current = t;

      if (t > maxWatchedRef.current) {
        maxWatchedRef.current = t;
      } else if (t + 0.15 < prev) {
        // user moved backward OR the stream jumped
        // don't treat as watched
      }
    };

    const onPlay = () => {
      if (!mountedRef.current) return;
      setPlaying(true);
      setBuffering(false);
    };
    const onPause = () => {
      if (!mountedRef.current) return;
      setPlaying(false);
    };
    const onWaiting = () => {
      if (!mountedRef.current) return;
      setBuffering(true);
    };
    const onPlaying = () => {
      if (!mountedRef.current) return;
      setBuffering(false);
    };

    const onRateChange = () => {
      if (!mountedRef.current) return;
      const r = Number(el.playbackRate || 1);
      setRate(r);

      // enforce speed lock
      if (speedLocked) {
        if (Math.abs(r - 1) > 0.001) {
          try {
            el.playbackRate = 1;
          } catch {}
          setToast({ text: "배속 변경이 제한되어 있습니다.", kind: "warn" });
          queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: 1 });
        }
        return;
      }

      if (r > maxRate + 0.0001) {
        try {
          el.playbackRate = maxRate;
        } catch {}
        setToast({ text: `최대 배속은 ${maxRate}x 입니다.`, kind: "warn" });
        queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: maxRate });
      }
    };

    const onSeeking = () => {
      if (!mountedRef.current) return;
      if (allowSeek && !boundedForward) return;

      const now = Date.now();
      const guard = seekGuardRef.current;

      const target = Number(el.currentTime || 0);
      const maxWatched = Number(maxWatchedRef.current || 0);
      const allowedMax = boundedForward ? maxWatched + grace : maxWatched; // blocked -> no forward
      const isForwardBeyond = target > allowedMax + 0.001;

      // blocked seek -> any seek considered attempt
      if (!allowSeek || seekMode === "blocked") {
        // snap back
        guard.blocking = true;
        try {
          el.currentTime = maxWatched;
        } catch {}
        guard.blocking = false;

        if (now - guard.lastWarnAt > 900) {
          guard.lastWarnAt = now;
          setToast({ text: "탐색이 제한된 영상입니다.", kind: "warn" });
        }

        queueEvent("SEEK_ATTEMPT", {
          mode: "blocked",
          target,
          max_watched: maxWatched,
        });
        return;
      }

      if (boundedForward && isForwardBeyond) {
        // snap back to allowed
        guard.blocking = true;
        try {
          el.currentTime = allowedMax;
        } catch {}
        guard.blocking = false;

        if (now - guard.lastWarnAt > 900) {
          guard.lastWarnAt = now;
          setToast({ text: "아직 시청하지 않은 구간으로 이동할 수 없습니다.", kind: "warn" });
        }

        queueEvent("SEEK_ATTEMPT", {
          mode: "bounded_forward",
          target,
          max_watched: maxWatched,
          grace,
        });
      }
    };

    const onError = () => {
      if (!mountedRef.current) return;
      const elErr = el.error as any;
      const errorCode = elErr?.code || 0;
      const errorMessage = elErr?.message || "";
      
      queueEvent("PLAYER_ERROR", {
        code: errorCode,
        message: errorMessage,
      });
      
      // MEDIA_ERR_SRC_NOT_SUPPORTED (4) 또는 네트워크 오류
      let message = "재생 오류가 발생했습니다.";
      if (errorCode === 4 || errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        message = "비디오 파일을 찾을 수 없습니다 (404). 서버에 비디오 파일이 있는지 확인해주세요.";
        onFatalRef.current?.("비디오 파일을 찾을 수 없습니다.");
      } else if (errorCode === 2) {
        message = "네트워크 오류가 발생했습니다. 연결을 확인해주세요.";
      } else if (errorCode === 3) {
        message = "비디오 디코딩 오류가 발생했습니다.";
      }
      
      setToast({ text: message, kind: "danger" });
    };

    el.addEventListener("loadedmetadata", onLoadedMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("ratechange", onRateChange);
    el.addEventListener("seeking", onSeeking);
    el.addEventListener("error", onError);

    // initial constraints
    try {
      if (speedLocked) el.playbackRate = 1;
      if (maxRate < 1) el.playbackRate = 1;
    } catch {}

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("ratechange", onRateChange);
      el.removeEventListener("seeking", onSeeking);
      el.removeEventListener("error", onError);
    };
  }, [allowSeek, boundedForward, grace, maxRate, queueEvent, seekMode, speedLocked]);

  // ---------------------------------------------------------------------------
  // Controls actions
  // ---------------------------------------------------------------------------
  const togglePlay = useCallback(() => {
    const el = videoEl.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const requestFullscreen = useCallback(() => {
    const wrap = wrapEl.current;
    const video = videoEl.current;

    const isFs =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement;

    try {
      if (!isFs) {
        queueEvent("FULLSCREEN_ENTER", {});
        // 모바일(iOS 등)에서는 사용자 제스처 직후 동기 호출이 필요. await 쓰지 않음.
        if (wrap?.requestFullscreen) {
          wrap.requestFullscreen();
          return;
        }
        if ((wrap as any)?.webkitRequestFullscreen) {
          (wrap as any).webkitRequestFullscreen();
          return;
        }
        // iOS Safari 등: div 대신 video 요소만 전체화면 지원하는 경우
        if (video?.requestFullscreen) {
          video.requestFullscreen();
          return;
        }
        if ((video as any)?.webkitRequestFullscreen) {
          (video as any).webkitRequestFullscreen();
          return;
        }
      } else {
        queueEvent("FULLSCREEN_EXIT", {});
        if (document.exitFullscreen) document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      }
    } catch {}
  }, [queueEvent]);

  const setTime = useCallback((t: number) => {
    const el = videoEl.current;
    if (!el) return;

    const safe = clamp(t, 0, Math.max(0, duration || 0));
    try {
      el.currentTime = safe;
    } catch {}
  }, [duration]);

  const onScrub = useCallback((v: number) => {
    if (!mountedRef.current) return;
    setShowControls(true);
    setTime(v);
  }, [setTime]);

  const onVolume = useCallback((v: number) => {
    if (!mountedRef.current) return;
    const el = videoEl.current;
    if (!el) return;
    const vv = clamp(v, 0, 1);
    setVolume(vv);
    try {
      el.volume = vv;
    } catch {}
    if (vv <= 0.0001) setMuted(true);
    else setMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!mountedRef.current) return;
    const el = videoEl.current;
    if (!el) return;
    const m = !muted;
    setMuted(m);
    try {
      el.muted = m;
    } catch {}
  }, [muted]);

  const setPlaybackRate = useCallback((r: number) => {
    if (!mountedRef.current) return;
    const el = videoEl.current;
    if (!el) return;

    if (speedLocked) {
      setToast({ text: "배속 변경이 제한되어 있습니다.", kind: "warn" });
      queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: 1 });
      try {
        el.playbackRate = 1;
      } catch {}
      setRate(1);
      return;
    }

    const rr = clamp(r, 0.25, maxRate);
    try {
      el.playbackRate = rr;
    } catch {}
    setRate(rr);
  }, [maxRate, queueEvent, speedLocked]);

  const skip = useCallback((delta: number) => {
    const el = videoEl.current;
    if (!el) return;
    const t = Number(el.currentTime || 0) + Number(delta || 0);
    setTime(t);
  }, [setTime]);

  // 탭 구역: 좌 30% = 0, 중앙 40% = 1, 우 30% = 2
  const getTapZone = useCallback((rect: DOMRect, clientX: number) => {
    const w = rect.width;
    if (clientX < rect.left + w * 0.3) return 0;
    if (clientX > rect.right - w * 0.3) return 2;
    return 1;
  }, []);

  // 유튜브식 탭 우선순위: 싱글 = 컨트롤 토글(+ 중앙이면 재생 토글), 더블 = 구역별 시크, 트리플 = ±20초
  const resolveTap = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (!mountedRef.current) return;
      const count = tapCountRef.current;
      tapCountRef.current = 0;
      if (count === 1) {
        setShowControls((v) => !v);
        const zone = getTapZone(rect, clientX);
        if (zone === 1) togglePlay();
      } else if (count >= 2 && allowSeek) {
        const zone = getTapZone(rect, clientX);
        const delta = count >= 3 ? (zone === 0 ? -20 : zone === 2 ? 20 : 0) : zone === 0 ? -10 : zone === 2 ? 10 : 0;
        if (delta !== 0) {
          skip(delta);
          setToast({ text: delta > 0 ? `앞으로 ${Math.abs(delta)}초` : `뒤로 ${Math.abs(delta)}초`, kind: "info" });
        }
      }
    },
    [allowSeek, getTapZone, skip, togglePlay]
  );

  const onStageTap = useCallback(
    (clientX: number, clientY: number) => {
      const layer = gestureLayerRef.current;
      const rect = layer?.getBoundingClientRect?.();
      if (!rect) return;

      lastTapRef.current = { time: Date.now(), x: clientX, y: clientY };
      tapCountRef.current += 1;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        if (!mountedRef.current) return;
        const r = gestureLayerRef.current?.getBoundingClientRect?.();
        if (r) resolveTap(lastTapRef.current.x, r);
      }, 200);
    },
    [resolveTap]
  );

  const onStageDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      onStageTap(e.clientX, e.clientY);
    },
    [onStageTap]
  );

  const onStageTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      onStageTouchEndLongPress();
      const t = e.changedTouches?.[0];
      if (!t) return;
      e.preventDefault();
      if (!swipeHandledRef.current) onStageTap(t.clientX, t.clientY);
      swipeHandledRef.current = false;
      touchStartRef.current = null;
    },
    [onStageTap, onStageTouchEndLongPress]
  );

  const onStageTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!mountedRef.current) return;
      const start = touchStartRef.current;
      const t = e.touches?.[0];
      if (!start || !t) return;
      const layer = gestureLayerRef.current;
      const rect = layer?.getBoundingClientRect?.();
      if (!rect) return;
      const dy = start.y - t.clientY;
      if (Math.abs(dy) < 15) return;
      swipeHandledRef.current = true;
      if (start.rightHalf) {
        const delta = dy * 0.008;
        const v = clamp((start.volume ?? volume) + delta, 0, 1);
        setVolume(v);
        const el = videoEl.current;
        if (el) try { el.volume = v; } catch {}
        if (v <= 0.0001) setMuted(true);
        else setMuted(false);
      }
    },
    [volume]
  );

  // 롱프레스 500ms → 2배속 (모바일)
  const onStageTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const layer = gestureLayerRef.current;
      const rect = layer?.getBoundingClientRect?.();
      const t = e.touches?.[0];
      if (t && rect) {
        touchStartRef.current = {
          y: t.clientY,
          volume: volume,
          rightHalf: t.clientX > rect.left + rect.width / 2,
        };
      }
      if (speedLocked) return;
      if (!rect || !t) return;
      const x = t.clientX;
      const rightHalf = x > rect.left + rect.width / 2;
      if (!rightHalf) return;
      savedRateRef.current = rate;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (isUnmountedRef.current) return;
        setPlaybackRate(2);
        setToast({ text: "2배속", kind: "info" });
      }, 500);
    },
    [rate, setPlaybackRate, speedLocked, volume]
  );

  const onStageTouchEndLongPress = useCallback(() => {
    if (!mountedRef.current) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const el = videoEl.current;
    if (el && savedRateRef.current !== undefined) {
      try {
        el.playbackRate = savedRateRef.current;
      } catch {}
      setRate(savedRateRef.current);
    }
  }, []);

  const onStageTouchCancel = useCallback(() => {
    onStageTouchEndLongPress();
  }, [onStageTouchEndLongPress]);

  // Hotkeys (YouTube-like)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignore typing
      const tag = (e.target as any)?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || (e.target as any)?.isContentEditable) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }

      if (e.key === "k" || e.key === "K") {
        togglePlay();
        return;
      }

      if (e.key === "f" || e.key === "F") {
        requestFullscreen();
        return;
      }

      if (e.key === "m" || e.key === "M") {
        toggleMute();
        return;
      }

      if (e.key === "t" || e.key === "T") {
        setTheater((v) => !v);
        return;
      }

      if (e.key === "ArrowLeft") {
        skip(-5);
        return;
      }
      if (e.key === "ArrowRight") {
        skip(5);
        return;
      }
      if (e.key === "j" || e.key === "J") {
        skip(-10);
        return;
      }
      if (e.key === "l" || e.key === "L") {
        skip(10);
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestFullscreen, skip, toggleMute, togglePlay]);

  // Prime audio config
  useEffect(() => {
    const el = videoEl.current;
    if (!el) return;
    try {
      el.volume = volume;
      el.muted = muted;
    } catch {}
  }, [muted, volume]);

  // unmount 시 가장 먼저 플래그 설정 (cleanup 역순이라 마지막 effect의 cleanup이 먼저 실행됨)
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const policyPills = useMemo(() => {
    const pills: Array<{ text: string; tone?: "neutral" | "warn" | "danger" }> = [];
    const accessMode = policy.access_mode;
    if (accessMode === "PROCTORED_CLASS") {
      pills.push({ text: "온라인 수업 대체", tone: "warn" });
    } else if (accessMode === "FREE_REVIEW") {
      pills.push({
        text: monitoringEnabled ? "복습" : "복습 모드 (모니터링 없음)",
        tone: "neutral",
      });
    }

    if (!allowSeek || seekMode === "blocked") pills.push({ text: "탐색 제한", tone: "warn" });
    else if (boundedForward) pills.push({ text: "앞으로 탐색 제한", tone: "warn" });

    if (speedLocked) pills.push({ text: "배속 제한", tone: "warn" });

    if (watermarkEnabled) pills.push({ text: "워터마크", tone: "neutral" });

    return pills;
  }, [policy.access_mode, monitoringEnabled, allowSeek, boundedForward, seekMode, speedLocked, watermarkEnabled]);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const shareText = useMemo(() => {
    const policy = normalizePolicy(bootstrap.policy);
    const monitoringEnabled = policy.monitoring_enabled ?? false;
    
    if (!monitoringEnabled) {
      return `기기: ${deviceId.slice(0, 8)}… · 모니터링 없음 (복습 모드)`;
    }
    
    const expires = bootstrap.expires_at ? formatDateTimeKorean(bootstrap.expires_at * 1000) : "";
    return `기기: ${deviceId.slice(0, 8)}… · 세션 만료: ${expires || "-"}`;
  }, [bootstrap.expires_at, bootstrap.policy, deviceId]);

  const rateMenu = useMemo(() => {
    const common = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const extra = [2.5, 3, 4, 5, 8, 10, 16];
    const list = [...common, ...extra].filter((x) => x <= maxRate + 0.0001);
    // always include 1
    if (!list.includes(1)) list.push(1);
    list.sort((a, b) => a - b);
    return list;
  }, [maxRate]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className={`svpRoot ${theater ? "svpTheater" : ""}`}>
      <div className="svpLayout">
        <div className="svpPlayerCol">
          <div
            className={`svpPlayerWrap ${!showControls ? "svpPlayerWrap--controlsHidden" : ""} ${isFullscreen ? "svpPlayerWrap--fullscreen" : ""}`}
            ref={wrapEl}
          >
            <div className="svpTopBar">
              <div className="svpTopLeft">
                <div className="svpTitle" title={video.title}>
                  {video.title}
                </div>
                <div className="svpMeta">
                  <span className="svpMetaItem">video#{video.id}</span>
                  <span className="svpDot">•</span>
                  <span className="svpMetaItem">enrollment#{enrollmentId ?? "-"}</span>
                </div>
              </div>

              <div className="svpTopRight">
                <div className="svpPills">
                  {policyPills.map((p, idx) => (
                    <Pill key={idx} tone={p.tone}>
                      {p.text}
                    </Pill>
                  ))}
                </div>

                <KebabMenu
                  align="right"
                  label="메뉴"
                  items={[
                    {
                      label: "세션 새로고침",
                      onClick: async () => {
                        const token = tokenRef.current;
                        if (!token) return;
                        try {
                          await postRefresh(token);
                          setToast({ text: "세션 확인 완료", kind: "info" });
                        } catch {
                          setToast({ text: "세션 확인 실패", kind: "warn" });
                        }
                      },
                    },
                    {
                      label: "이 영상 정보",
                      onClick: () => {
                        setToast({ text: shareText, kind: "info" });
                      },
                    },
                  ]}
                />
              </div>
            </div>

            <div className="svpVideoStage" role="presentation">
              <video
                ref={videoEl}
                className="svpVideo"
                playsInline
                controls={false}
                preload="metadata"
                poster={video.thumbnail_url || undefined}
              />
              {/* GestureLayer: 모든 터치/클릭 캡처 (touch-action:none), 브라우저 줌/스크롤 차단 */}
              <div
                ref={gestureLayerRef}
                className="svpGestureLayer"
                aria-hidden
                onClick={(e) => { e.preventDefault(); onStageTap(e.clientX, e.clientY); }}
                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onStageTap(e.clientX, e.clientY); }}
                onTouchStart={onStageTouchStart}
                onTouchMove={onStageTouchMove}
                onTouchEnd={onStageTouchEnd}
                onTouchCancel={onStageTouchCancel}
              />

              {!ready && (
                <div className="svpOverlayCenter">
                  <div className="svpSpinner" />
                  <div className="svpOverlayText">로딩 중…</div>
                </div>
              )}

              {ready && !playing && (
                <button
                  className="svpBigPlay"
                  type="button"
                  onClick={togglePlay}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <span className="svpBigPlayIcon">▶</span>
                  <span className="svpBigPlayText">재생</span>
                </button>
              )}

              {buffering && ready && (
                <div className="svpOverlayCorner">
                  <div className="svpSpinnerMini" />
                  <div className="svpOverlayTextMini">버퍼링…</div>
                </div>
              )}

              {watermarkEnabled && (
                <div className="svpWatermark">
                  <div className="svpWatermarkInner">
                    <div className="svpWatermarkTop">hakwonplus</div>
                    <div className="svpWatermarkBottom">{deviceId.slice(0, 8)}…</div>
                  </div>
                </div>
              )}

              <div className="svpControls">
                <div className="svpProgressRow">
                  <RangeSlider
                    value={current}
                    min={0}
                    max={Math.max(0.1, duration || 0)}
                    step={0.1}
                    onChange={(v) => onScrub(v)}
                    ariaLabel="진행 바"
                  />
                  <div className="svpTime">
                    <span className="svpTimeCur">{formatClock(current)}</span>
                    <span className="svpTimeSep">/</span>
                    <span className="svpTimeDur">{formatClock(duration)}</span>
                  </div>
                </div>

                <div className="svpControlRow">
                  <div className="svpLeftControls">
                    <IconButton
                      icon={playing ? "pause" : "play"}
                      label={playing ? "일시정지" : "재생"}
                      onClick={togglePlay}
                    />

                    <IconButton icon="replay10" label="-10초" onClick={() => skip(-10)} />
                    <IconButton icon="forward10" label="+10초" onClick={() => skip(10)} />

                    <div className="svpVolume">
                      <IconButton
                        icon={muted || volume <= 0.0001 ? "mute" : "volume"}
                        label="음소거"
                        onClick={toggleMute}
                      />
                      <div className="svpVolumeSlider">
                        <RangeSlider
                          value={muted ? 0 : volume}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onVolume(v)}
                          ariaLabel="볼륨"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="svpRightControls">
                    <div className="svpRate">
                      <KebabMenu
                        align="right"
                        label={speedLocked ? "배속 제한" : `배속 ${rate.toFixed(2)}x`}
                        disabled={speedLocked}
                        items={rateMenu.map((r) => ({
                          label: `${r}x${Math.abs(r - rate) < 0.001 ? " ✓" : ""}`,
                          onClick: () => setPlaybackRate(r),
                        }))}
                        buttonClassName={speedLocked ? "svpRateDisabled" : ""}
                      />
                    </div>

                    <IconButton
                      icon={theater ? "shrink" : "theater"}
                      label={theater ? "기본 보기" : "극장 모드"}
                      onClick={() => setTheater((v) => !v)}
                    />
                    <IconButton
                      icon="fullscreen"
                      label="전체화면"
                      onPointerDown={() => requestFullscreen()}
                    />
                  </div>
                </div>

                {!allowSeek || speedLocked ? (
                  <div className="svpPolicyHint">
                    {!allowSeek || seekMode === "blocked" ? (
                      <span className="svpPolicyHintItem">
                        • 탐색이 제한됩니다{boundedForward ? " (시청한 구간만 이동 가능)" : ""}
                      </span>
                    ) : boundedForward ? (
                      <span className="svpPolicyHintItem">• 앞으로 탐색이 제한됩니다</span>
                    ) : null}
                    {speedLocked ? (
                      <span className="svpPolicyHintItem">• 배속 변경이 제한됩니다</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="svpPolicyHint svpPolicyHintMuted">
                    키보드: Space/K(재생), J/L(±10s), ←/→(±5s), F(전체화면), M(음소거), T(극장)
                  </div>
                )}
              </div>
            </div>
          </div>

          <PlayerToast toast={toast} onClose={() => setToast(null)} />
        </div>

        <aside className="svpSide">
          <div className="svpSideCard">
            <div className="svpSideTitle">시청 도우미</div>

            {policy.monitoring_enabled ? (
              <>
                <div className="svpSideRow">
                  <div className="svpSideLabel">세션</div>
                  <div className="svpSideValue">{bootstrap.session_id?.slice(0, 8) || "-"}…</div>
                </div>

                <div className="svpSideRow">
                  <div className="svpSideLabel">만료</div>
                  <div className="svpSideValue">
                    {bootstrap.expires_at ? formatDateTimeKorean(bootstrap.expires_at * 1000) : "-"}
                  </div>
                </div>
              </>
            ) : (
              <div className="svpSideRow">
                <div className="svpSideLabel">모니터링</div>
                <div className="svpSideValue">비활성 (복습 모드)</div>
              </div>
            )}

            <div className="svpSideRow">
              <div className="svpSideLabel">기기</div>
              <div className="svpSideValue">{deviceId.slice(0, 10)}…</div>
            </div>

            <div className="svpSideDivider" />

            <div className="svpSideTitle2">정책 적용</div>
            <div className="svpSideBullets">
              <div className="svpSideBullet">
                <span className="svpSideDot" />
                <span className="svpSideTxt">
                  {allowSeek
                    ? boundedForward
                      ? "시청한 구간까지만 이동 가능"
                      : "탐색 가능"
                    : "탐색 차단"}
                </span>
              </div>

              <div className="svpSideBullet">
                <span className="svpSideDot" />
                <span className="svpSideTxt">
                  {speedLocked ? "배속 차단" : `최대 배속 ${maxRate}x`}
                </span>
              </div>

              <div className="svpSideBullet">
                <span className="svpSideDot" />
                <span className="svpSideTxt">{watermarkEnabled ? "워터마크 표시" : "워터마크 없음"}</span>
              </div>
            </div>

            <div className="svpSideDivider" />

            <button
              type="button"
              className="svpSideButton"
              onClick={() => {
                setToast({
                  text: `현재 ${formatClock(current)} / ${formatClock(duration)} (약 ${Math.round(
                    (current / Math.max(1, duration)) * 100
                  )}%)`,
                  kind: "info",
                });
              }}
            >
              진행률 보기
            </button>

            {monitoringEnabled && (
              <button
                type="button"
                className="svpSideButton svpSideButtonGhost"
                onClick={() => {
                  const token = tokenRef.current;
                  if (!token) return;
                  postRefresh(token)
                    .then(() => setToast({ text: "세션 확인 완료", kind: "info" }))
                    .catch(() => setToast({ text: "세션 확인 실패", kind: "warn" }));
                }}
              >
                세션 점검
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
