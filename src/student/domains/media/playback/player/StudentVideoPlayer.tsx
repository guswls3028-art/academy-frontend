// PATH: src/student/domains/media/playback/player/StudentVideoPlayer.tsx
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

type Props = {
  video: VideoMetaLite;
  bootstrap: PlaybackBootstrap;
  enrollmentId: number;
  onFatal?: (reason: string) => void;
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

async function postHeartbeat(token: string) {
  await studentApi.post(`/api/v1/videos/playback/heartbeat/`, { token });
}

async function postRefresh(token: string) {
  await studentApi.post(`/api/v1/videos/playback/refresh/`, { token });
}

async function postEnd(token: string) {
  await studentApi.post(`/api/v1/videos/playback/end/`, { token });
}

async function postEvents(
  token: string,
  events: Array<{ type: EventType; occurred_at: number; payload?: any }>,
  videoId: number,
  enrollmentId: number
) {
  if (!events.length) return;
  await studentApi.post(`/api/v1/videos/playback/events/`, {
    token,
    video_id: videoId,
    enrollment_id: enrollmentId,
    events: events.map((e) => ({
      type: e.type,
      occurred_at: e.occurred_at,
      payload: e.payload || {},
    })),
  });
}

function useStableInterval(cb: () => void, ms: number, enabled: boolean) {
  const ref = useRef(cb);
  ref.current = cb;

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
}

export default function StudentVideoPlayer({ video, bootstrap, enrollmentId, onFatal }: Props) {
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

  const maxWatchedRef = useRef<number>(0); // seconds
  const lastTimeRef = useRef<number>(0);
  const seekGuardRef = useRef<{ blocking: boolean; lastWarnAt: number }>({ blocking: false, lastWarnAt: 0 });

  const eventQueueRef = useRef<Array<{ type: EventType; occurred_at: number; payload?: any }>>([]);

  const tokenRef = useRef(bootstrap.token);
  useEffect(() => {
    tokenRef.current = bootstrap.token;
  }, [bootstrap.token]);

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

    const url = bootstrap.play_url || video.hls_url || "";
    if (!url) {
      onFatal?.("play_url_not_provided");
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
            setToast({ text: "재생 오류가 발생했습니다. 다시 시도해주세요.", kind: "danger" });
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
  }, [bootstrap.play_url, video.hls_url, onFatal]);

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

  const flushEvents = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    const batch = eventQueueRef.current.splice(0, eventQueueRef.current.length);
    if (!batch.length) return;

    try {
      await postEvents(token, batch, video.id, enrollmentId);
    } catch (e: any) {
      // session revoked / inactive -> stop
      const msg = e?.response?.data?.detail || e?.message || "";
      if (String(msg).includes("session_inactive") || e?.response?.status === 409) {
        setToast({ text: "재생 세션이 종료되었습니다.", kind: "danger" });
        onFatal?.("session_inactive");
      }
    }
  }, [onFatal, video.id, enrollmentId]);

  const monitoringEnabled = policy.monitoring_enabled ?? false;

  // Events: only when monitoring_enabled (FREE_REVIEW sends nothing)
  useStableInterval(
    () => {
      flushEvents();
    },
    2200,
    monitoringEnabled
  );

  // Heartbeat: only for PROCTORED_CLASS
  useStableInterval(
    () => {
      const token = tokenRef.current;
      if (!token) return;

      postHeartbeat(token).catch((e: any) => {
        const msg = e?.response?.data?.detail || e?.message || "";
        if (String(msg).includes("policy_changed")) {
          setToast({ text: "정책이 변경되어 재생이 종료되었습니다.", kind: "danger" });
          onFatal?.("policy_changed");
          return;
        }
        if (String(msg).includes("session_inactive") || e?.response?.status === 409) {
          setToast({ text: "재생 세션이 종료되었습니다.", kind: "danger" });
          onFatal?.("session_inactive");
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
      // cleanup hls
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

        // flush last events
        try {
          flushEvents();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Visibility / Focus events
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        queueEvent("VISIBILITY_HIDDEN", { hidden: true });
      } else {
        queueEvent("VISIBILITY_VISIBLE", { hidden: false });
        if (monitoringEnabled) {
          const token = tokenRef.current;
          if (token) postRefresh(token).catch(() => {});
        }
      }
    };
    const onBlur = () => queueEvent("FOCUS_LOST", {});
    const onFocus = () => queueEvent("FOCUS_GAINED", {});

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [queueEvent, monitoringEnabled]);

  // ---------------------------------------------------------------------------
  // Video event binding
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = videoEl.current;
    if (!el) return;

    const onLoadedMeta = () => {
      const d = Number(el.duration || 0);
      if (d && Number.isFinite(d)) setDuration(d);
      setReady(true);
      setBuffering(false);
    };

    const onTime = () => {
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
      setPlaying(true);
      setBuffering(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);

    const onRateChange = () => {
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
      queueEvent("PLAYER_ERROR", {
        code: (el.error as any)?.code || 0,
        message: (el.error as any)?.message || "",
      });
      setToast({ text: "재생 오류가 발생했습니다.", kind: "danger" });
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

  const requestFullscreen = useCallback(async () => {
    const wrap = wrapEl.current;
    if (!wrap) return;

    const isFs =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement;

    try {
      if (!isFs) {
        queueEvent("FULLSCREEN_ENTER", {});
        if (wrap.requestFullscreen) return await wrap.requestFullscreen();
        if ((wrap as any).webkitRequestFullscreen) return await (wrap as any).webkitRequestFullscreen();
      } else {
        queueEvent("FULLSCREEN_EXIT", {});
        if (document.exitFullscreen) return await document.exitFullscreen();
        if ((document as any).webkitExitFullscreen) return await (document as any).webkitExitFullscreen();
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
    // UX: slider is always moveable, but policy guards actual seeking
    setTime(v);
  }, [setTime]);

  const onVolume = useCallback((v: number) => {
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
    const el = videoEl.current;
    if (!el) return;
    const m = !muted;
    setMuted(m);
    try {
      el.muted = m;
    } catch {}
  }, [muted]);

  const setPlaybackRate = useCallback((r: number) => {
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
          <div className="svpPlayerWrap" ref={wrapEl}>
            <div className="svpTopBar">
              <div className="svpTopLeft">
                <div className="svpTitle" title={video.title}>
                  {video.title}
                </div>
                <div className="svpMeta">
                  <span className="svpMetaItem">video#{video.id}</span>
                  <span className="svpDot">•</span>
                  <span className="svpMetaItem">enrollment#{enrollmentId}</span>
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

            <div className="svpVideoStage">
              <video
                ref={videoEl}
                className="svpVideo"
                playsInline
                controls={false}
                preload="metadata"
                poster={video.thumbnail_url || undefined}
              />

              {!ready && (
                <div className="svpOverlayCenter">
                  <div className="svpSpinner" />
                  <div className="svpOverlayText">로딩 중…</div>
                </div>
              )}

              {ready && !playing && (
                <button className="svpBigPlay" type="button" onClick={togglePlay}>
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
                    <IconButton icon="fullscreen" label="전체화면" onClick={requestFullscreen} />
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
