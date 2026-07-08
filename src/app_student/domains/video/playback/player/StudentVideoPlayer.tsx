// PATH: src/app_student/domains/video/playback/player/StudentVideoPlayer.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./player.css";

import {
  clamp,
  formatClock,
  formatDateTimeKorean,
  getOrCreateDeviceId,
  safeParseFloat,
} from "./design/utils";
import {
  IconButton,
  KebabMenu,
  Pill,
  PlayerToast,
  QualityButton,
  RangeSlider,
  SpeedButton,
} from "./design/ui";
import {
  StudentHlsController,
  type ControllerState,
} from "./headless/StudentHlsController";
import { StudentYoutubeController } from "./headless/StudentYoutubeController";
import { useDoubleTapSeek } from "./gesture/useDoubleTapSeek";
import SeekOverlay from "./gesture/SeekOverlay";

import type { AccessMode } from "@/shared/api/contracts/videos";
import { resolveTenantCodeString } from "@/shared/tenant";
import { isYouTubeSource } from "@/shared/media/video/youtube";

export type VideoMetaLite = {
  id: number;
  title: string;
  duration: number | null;
  status?: string;
  source_type?: string | null;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  thumbnail_url?: string | null;
  hls_url?: string | null;
};

export type PlaybackBootstrap = {
  token: string;
  session_id: string | null;
  expires_at: number | null;
  access_mode: "FREE_REVIEW" | "PROCTORED_CLASS";
  monitoring_enabled: boolean;
  policy: Partial<Policy> | null | undefined;
  play_url: string;
  source_type?: string | null;
  youtube_video_id?: string | null;
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
  initialPosition?: number;
  onFatal?: (reason: string) => void;
  onLeaveProgress?: (data: LeaveProgressPayload) => void;
};

type Policy = {
  access_mode?: AccessMode;
  monitoring_enabled?: boolean;
  allow_seek?: boolean;
  seek?: { mode?: string; grace_seconds?: number };
  playback_rate?: { max?: number; ui_control?: boolean };
  watermark?: { enabled?: boolean };
  source?: { type?: string; provider?: string; youtube_video_id?: string | null };
};

function normalizePolicy(p: Partial<Policy> | null | undefined): Policy {
  const policy: Policy = { ...(p || {}) };
  const seek = { ...(policy.seek || {}) };
  const playbackRate = { ...(policy.playback_rate || {}) };
  const watermark = { ...(policy.watermark || {}) };
  if (policy.monitoring_enabled == null) {
    policy.monitoring_enabled = policy.access_mode === "PROCTORED_CLASS";
  }
  if (policy.allow_seek == null) policy.allow_seek = true;
  if (!seek.mode) seek.mode = "free";
  if (seek.grace_seconds == null) seek.grace_seconds = 3;
  if (playbackRate.max == null) playbackRate.max = 16;
  if (playbackRate.ui_control == null) playbackRate.ui_control = true;
  if (watermark.enabled == null) watermark.enabled = false;
  policy.seek = seek;
  policy.playback_rate = playbackRate;
  policy.watermark = watermark;
  return policy;
}

const initialControllerState: ControllerState = {
  ready: false,
  playing: false,
  buffering: false,
  duration: 0,
  current: 0,
  volume: 1,
  muted: false,
  rate: 1,
  toast: null,
  qualities: [],
  currentQuality: -1,
  reconnecting: false,
};

function getActiveFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    null
  );
}

function isIOSWebKitRuntime(): boolean {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function StudentVideoPlayer({
  video,
  bootstrap,
  enrollmentId,
  initialPosition,
  onFatal,
  onLeaveProgress,
}: Props) {
  const policy = useMemo(() => normalizePolicy(bootstrap.policy), [bootstrap.policy]);
  const allowSeek = !!policy.allow_seek && policy.seek?.mode !== "blocked";
  const seekMode = policy.seek?.mode || "free";
  const boundedForward = seekMode === "bounded_forward";
  const speedUi = policy.playback_rate?.ui_control !== false;
  const maxRate = Math.max(1, safeParseFloat(policy.playback_rate?.max, 1) || 1);
  const speedLocked = !speedUi || maxRate <= 1.0001;
  const watermarkEnabled = !!policy.watermark?.enabled;
  const monitoringEnabled = policy.monitoring_enabled ?? false;
  const isYoutube = isYouTubeSource(video.source_type || bootstrap.source_type || policy.source?.type);

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const youtubeMountRef = useRef<HTMLDivElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<StudentHlsController | StudentYoutubeController | null>(null);

  const [ctrlState, setCtrlState] = useState<ControllerState>(initialControllerState);
  const [theater, setTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenFallbackRef = useRef(false);

  const gestureLayerRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRateRef = useRef(1);
  const swipeHandledRef = useRef(false);
  const touchStartRef = useRef<{ y: number; volume: number; rightHalf: boolean } | null>(null);
  const currentRef = useRef(0);

  const { ready, playing, buffering, duration, current, volume, muted, rate, toast, qualities, currentQuality, reconnecting } = ctrlState;

  useEffect(() => {
    currentRef.current = current;
  }, [current]);


  useEffect(() => {
    if (!video || !bootstrap) return;
    const attachTarget = isYoutube ? youtubeMountRef.current : videoElRef.current;
    if (!attachTarget) return;

    const commonOptions = {
      videoId: video.id,
      playUrl: bootstrap.play_url || video.hls_url || "",
      policy: bootstrap.policy,
      token: bootstrap.token,
      enrollmentId,
      initialPosition,
      onFatal,
      onLeaveProgress,
    };
    let ctrl: StudentHlsController | StudentYoutubeController;
    if (isYoutube) {
      ctrl = new StudentYoutubeController({
        ...commonOptions,
        youtubeVideoId: video.youtube_video_id || bootstrap.youtube_video_id || policy.source?.youtube_video_id || null,
      });
      ctrl.attach(attachTarget as HTMLDivElement);
    } else {
      ctrl = new StudentHlsController(commonOptions);
      ctrl.attach(attachTarget as HTMLVideoElement);
    }
    controllerRef.current = ctrl;

    const unsub = ctrl.subscribe(setCtrlState);

    return () => {
      unsub();
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, [video, bootstrap, enrollmentId, initialPosition, onFatal, onLeaveProgress, isYoutube, policy.source?.youtube_video_id]);

  useEffect(() => {
    const ctrl = controllerRef.current;
    if (ctrl) ctrl.setToken(bootstrap.token);
  }, [bootstrap.token]);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;

    const onFullscreenChange = () => {
      const el = getActiveFullscreenElement();
      const active = el === wrap || (el && wrap.contains(el));
      if (!active) fullscreenFallbackRef.current = false;
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
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("mozfullscreenchange", onFullscreenChange);
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, []);

  // iOS 등: video 요소 네이티브 전체화면(webkitEnterFullscreen) 종료 시 상태 복구 — 플레이어 끄면 UI 꼬임 방지
  useEffect(() => {
    const vid = videoElRef.current;
    if (!vid) return;
    const lockPageForFullscreen = () => {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    };
    const unlockPageFromFullscreen = () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
    const onNativeVideoFullscreenBegin = () => {
      fullscreenFallbackRef.current = false;
      setIsFullscreen(true);
      setShowControls(true);
      lockPageForFullscreen();
      controllerRef.current?.queueFullscreenEvent(true);
    };
    const onNativeVideoFullscreenEnd = () => {
      fullscreenFallbackRef.current = false;
      setIsFullscreen(false);
      unlockPageFromFullscreen();
      controllerRef.current?.queueFullscreenEvent(false);
    };
    vid.addEventListener("webkitbeginfullscreen", onNativeVideoFullscreenBegin);
    vid.addEventListener("webkitendfullscreen", onNativeVideoFullscreenEnd);
    return () => {
      vid.removeEventListener("webkitbeginfullscreen", onNativeVideoFullscreenBegin);
      vid.removeEventListener("webkitendfullscreen", onNativeVideoFullscreenEnd);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (fullscreenFallbackRef.current) {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }
    };
  }, []);

  useEffect(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    if (playing && !buffering && showControls) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        hideControlsTimerRef.current = null;
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [playing, buffering, showControls]);

  const togglePlay = useCallback(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    if (playing) ctrl.pause();
    else ctrl.play();
  }, [playing]);

  const setTime = useCallback((t: number) => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    ctrl.seek(t);
  }, []);

  const onScrub = useCallback((v: number) => {
    setShowControls(true);
    setTime(v);
  }, [setTime]);

  const onVolume = useCallback((v: number) => {
    controllerRef.current?.setVolume(clamp(v, 0, 1));
    const el = controllerRef.current?.getVideoEl();
    if (el) try { el.volume = clamp(v, 0, 1); } catch {
      // Some mobile browsers reject direct volume writes.
    }
  }, []);

  const toggleMute = useCallback(() => {
    controllerRef.current?.setMuted(!muted);
  }, [muted]);

  const setPlaybackRate = useCallback((r: number) => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    if (speedLocked) {
      ctrl.showToast("배속 변경이 제한되어 있습니다.", "warn");
      return;
    }
    ctrl.setRate(clamp(r, 0.25, maxRate));
  }, [maxRate, speedLocked]);

  const skip = useCallback((delta: number) => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const t = Number(currentRef.current || 0) + Number(delta || 0);
    ctrl.seek(t);
  }, []);

  const getRect = useCallback(() => gestureLayerRef.current?.getBoundingClientRect() ?? null, []);
  const onSingleTap = useCallback(
    (zone: 0 | 1 | 2) => {
      setShowControls((v) => !v);
      if (zone === 1) togglePlay();
    },
    [togglePlay]
  );
  const shouldIgnorePointer = useCallback((target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!(el?.closest?.(".svpControls") || el?.closest?.(".svpBigPlay") || el?.closest?.(".svpProgressRow") || el?.closest?.(".svpRange"));
  }, []);

  const { overlay, onPointerDown: gesturePointerDown, onPointerUp: gesturePointerUp, onPointerMove: gesturePointerMove, onPointerCancel: gesturePointerCancel } = useDoubleTapSeek({
    getRect,
    allowSeek,
    onSingleTap,
    onSeek: skip,
    shouldIgnorePointer,
    getIsDrag: () => swipeHandledRef.current,
  });
  const requestFullscreen = useCallback(() => {
    const wrap = wrapElRef.current;
    const vid = videoElRef.current;
    const ctrl = controllerRef.current;

    const isFs = getActiveFullscreenElement();
    const inFallback = fullscreenFallbackRef.current;

    const enterFallback = () => {
      if (getActiveFullscreenElement()) return;
      fullscreenFallbackRef.current = true;
      setIsFullscreen(true);
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      setShowControls(true);
      ctrl?.queueFullscreenEvent(true);
    };

    const exitFallback = () => {
      fullscreenFallbackRef.current = false;
      setIsFullscreen(false);
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      ctrl?.queueFullscreenEvent(false);
    };

    try {
      if (isFs || isFullscreen) {
        ctrl?.queueFullscreenEvent(false);
        if (inFallback) {
          exitFallback();
          return;
        }
        if (isFs) {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
          return;
        }
        if (vid?.webkitExitFullscreen) {
          vid.webkitExitFullscreen();
          return;
        }
        exitFallback();
        return;
      }

      ctrl?.queueFullscreenEvent(true);

      const enterNativeVideoFullscreen = () => {
        if (!vid?.webkitEnterFullscreen) return false;
        try {
          vid.webkitEnterFullscreen();
          fullscreenFallbackRef.current = false;
          setIsFullscreen(true);
          setShowControls(true);
          document.body.style.overflow = "hidden";
          document.body.style.touchAction = "none";
          return true;
        } catch {
          return false;
        }
      };

      const tryNative = () => {
        // iOS WebKit(Safari/Chrome/앱 내 브라우저): video 네이티브 전체화면이 가장 안정적이다.
        if (isIOSWebKitRuntime() && enterNativeVideoFullscreen()) {
          return true;
        }
        // Android 및 데스크톱: 래퍼 전체화면 (Fullscreen API)
        if (wrap?.requestFullscreen) {
          wrap.requestFullscreen({ navigationUI: "hide" }).catch(() => setTimeout(enterFallback, 100));
          return true;
        }
        if (wrap?.webkitRequestFullscreen) {
          wrap.webkitRequestFullscreen();
          return true;
        }
        // 래퍼 전체화면 불가 시 video 요소 직접 시도
        if (vid?.requestFullscreen) {
          vid.requestFullscreen().catch(() => setTimeout(enterFallback, 100));
          return true;
        }
        if (vid?.webkitRequestFullscreen) {
          vid.webkitRequestFullscreen();
          return true;
        }
        if (enterNativeVideoFullscreen()) {
          return true;
        }
        return false;
      };

      if (!tryNative()) {
        enterFallback();
        return;
      }

      setTimeout(() => {
        const nowFs = getActiveFullscreenElement();
        if (!nowFs && !isIOSWebKitRuntime()) enterFallback();
      }, 350);
    } catch {
      enterFallback();
    }
  }, [isFullscreen]);

  const onStageTouchEndLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (savedRateRef.current !== undefined) {
      controllerRef.current?.setRate(savedRateRef.current);
    }
  }, []);

  const onStagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const layer = gestureLayerRef.current;
      const rect = layer?.getBoundingClientRect?.();
      if (rect && e.clientX >= rect.left && e.clientX <= rect.right) {
        touchStartRef.current = {
          y: e.clientY,
          volume,
          rightHalf: e.clientX > rect.left + rect.width / 2,
        };
      }
      if (rect && !speedLocked && e.clientX > rect.left + rect.width / 2) {
        savedRateRef.current = rate;
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          setPlaybackRate(2);
          controllerRef.current?.showToast("2배속", "info");
        }, 500);
      }
      gesturePointerDown(e);
    },
    [volume, rate, speedLocked, setPlaybackRate, gesturePointerDown]
  );

  const onStagePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      if (!start) {
        gesturePointerMove(e);
        return;
      }
      const layer = gestureLayerRef.current;
      const rect = layer?.getBoundingClientRect?.();
      if (!rect) {
        gesturePointerMove(e);
        return;
      }
      const dy = start.y - e.clientY;
      if (Math.abs(dy) >= 15) {
        swipeHandledRef.current = true;
        if (start.rightHalf) {
          const delta = dy * 0.008;
          const v = clamp((start.volume ?? volume) + delta, 0, 1);
          controllerRef.current?.setVolume(v);
          const el = controllerRef.current?.getVideoEl();
          if (el) try { el.volume = v; } catch {
            // Gesture volume is best effort on browsers that expose it.
          }
        }
      }
      gesturePointerMove(e);
    },
    [volume, gesturePointerMove]
  );

  const onStagePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      onStageTouchEndLongPress();
      gesturePointerUp(e);
      swipeHandledRef.current = false;
      touchStartRef.current = null;
    },
    [onStageTouchEndLongPress, gesturePointerUp]
  );

  const onStagePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      onStageTouchEndLongPress();
      gesturePointerCancel(e);
      swipeHandledRef.current = false;
      touchStartRef.current = null;
    },
    [onStageTouchEndLongPress, gesturePointerCancel]
  );

  useEffect(() => {
    const el = controllerRef.current?.getVideoEl();
    if (!el) return;
    try {
      el.volume = volume;
      el.muted = muted;
    } catch {
      // Native media controls may reject programmatic audio updates.
    }
  }, [muted, volume]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key === "k" || e.key === "K") { togglePlay(); return; }
      if (e.key === "f" || e.key === "F") { requestFullscreen(); return; }
      if (e.key === "m" || e.key === "M") { toggleMute(); return; }
      if (e.key === "t" || e.key === "T") { setTheater((v) => !v); return; }
      if (e.key === "ArrowLeft") { skip(-5); return; }
      if (e.key === "ArrowRight") { skip(5); return; }
      if (e.key === "j" || e.key === "J") { skip(-10); return; }
      if (e.key === "l" || e.key === "L") { skip(10); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestFullscreen, skip, toggleMute, togglePlay]);

  const policyPills = useMemo(() => {
    const pills: Array<{ text: string; tone?: "neutral" | "warn" | "danger" }> = [];
    if (policy.access_mode === "PROCTORED_CLASS") pills.push({ text: "온라인 수업 대체", tone: "warn" });
    else if (policy.access_mode === "FREE_REVIEW") {
      pills.push({ text: monitoringEnabled ? "복습" : "복습 모드 (모니터링 없음)", tone: "neutral" });
    }
    if (!allowSeek || seekMode === "blocked") pills.push({ text: "탐색 제한", tone: "warn" });
    else if (boundedForward) pills.push({ text: "앞으로 탐색 제한", tone: "warn" });
    if (speedLocked) pills.push({ text: "배속 제한", tone: "warn" });
    if (watermarkEnabled) pills.push({ text: "워터마크", tone: "neutral" });
    if (isYoutube) pills.push({ text: "YouTube", tone: "neutral" });
    return pills;
  }, [policy.access_mode, monitoringEnabled, allowSeek, boundedForward, seekMode, speedLocked, watermarkEnabled, isYoutube]);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const shareText = useMemo(() => {
    if (!monitoringEnabled) return "복습 모드로 시청 중입니다.";
    const expires = bootstrap.expires_at ? formatDateTimeKorean(bootstrap.expires_at * 1000) : "";
    return `수업 시청 세션이 활성화되었습니다. 만료: ${expires || "-"}`;
  }, [bootstrap.expires_at, monitoringEnabled]);

  const rateMenu = useMemo(() => {
    const common = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const extra = [2.5, 3, 4, 5, 8, 10, 16];
    const list = [...common, ...extra].filter((x) => x <= maxRate + 0.0001);
    if (!list.includes(1)) list.push(1);
    return list.sort((a, b) => a - b);
  }, [maxRate]);

  return (
    <div className={`svpRoot ${theater ? "svpTheater" : ""}`}>
      <div className="svpLayout">
        <div className="svpPlayerCol">
          <div
            className={`svpPlayerWrap ${isYoutube ? "svpPlayerWrap--youtube" : ""} ${!showControls ? "svpPlayerWrap--controlsHidden" : ""} ${isFullscreen ? "svpPlayerWrap--fullscreen" : ""}`}
            ref={wrapElRef}
          >
            <div className="svpTopBar">
              <div className="svpTopLeft">
                <div className="svpTitle" title={video.title}>{video.title}</div>
                <div className="svpMeta">
                  <span className="svpMetaItem">{policy.access_mode === "PROCTORED_CLASS" ? "수업 모드" : "복습 모드"}</span>
                  {isYoutube && (
                    <>
                      <span className="svpDot">•</span>
                      <span className="svpMetaItem">YouTube</span>
                    </>
                  )}
                  {video.duration != null && video.duration > 0 && (
                    <>
                      <span className="svpDot">•</span>
                      <span className="svpMetaItem">{formatClock(video.duration)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="svpTopRight">
                <div className="svpPills">
                  {policyPills.map((p, idx) => (
                    <Pill key={idx} tone={p.tone}>{p.text}</Pill>
                  ))}
                </div>
                <IconButton
                  className="svpFullscreenTopButton"
                  icon={isFullscreen ? "shrink" : "fullscreen"}
                  label={isFullscreen ? "전체화면 종료" : "전체화면"}
                  onPointerDown={() => requestFullscreen()}
                />
                <KebabMenu
                  align="right"
                  label="메뉴"
                  items={[
                    {
                      label: "재생 상태 새로고침",
                      onClick: () => controllerRef.current?.refreshSession(),
                    },
                    {
                      label: "시청 정보 보기",
                      onClick: () => controllerRef.current?.showToast(shareText, "info"),
                    },
                  ]}
                />
              </div>
            </div>

            <div className="svpVideoStage" role="presentation">
              {isYoutube ? (
                <div ref={youtubeMountRef} className="svpYoutubeFrame" />
              ) : (
                <video
                  ref={videoElRef}
                  className="svpVideo"
                  playsInline
                  controls={false}
                  preload="metadata"
                  poster={video.thumbnail_url || undefined}
                />
              )}
              <div
                ref={gestureLayerRef}
                className="svpGestureLayer"
                aria-hidden
                onPointerDown={onStagePointerDown}
                onPointerMove={onStagePointerMove}
                onPointerUp={onStagePointerUp}
                onPointerCancel={onStagePointerCancel}
              />

              <SeekOverlay overlay={overlay} />

              {!ready && (
                <div className="svpOverlayCenter">
                  <div className="svpSpinner" />
                  <div className="svpOverlayText">재생 화면을 준비하고 있어요…</div>
                </div>
              )}

              {ready && !playing && !reconnecting && (
                <button className="svpBigPlay" type="button" onClick={togglePlay} onDoubleClick={(e) => e.stopPropagation()}>
                  <span className="svpBigPlayIcon">▶</span>
                  <span className="svpBigPlayText">재생</span>
                </button>
              )}

              {/* 재연결 중: 화면 중앙에 명확히 표시 (버퍼링과 구분) */}
              {reconnecting && (
                <div className="svpOverlayCenter" role="status" aria-live="polite">
                  <div className="svpSpinner" />
                  <div className="svpOverlayText">연결을 다시 시도하고 있어요…</div>
                </div>
              )}

              {/* 일반 버퍼링: 코너에 작게 표시 */}
              {buffering && ready && !reconnecting && (
                <div className="svpOverlayCorner" role="status" aria-live="polite">
                  <div className="svpSpinnerMini" />
                  <div className="svpOverlayTextMini">잠시만요…</div>
                </div>
              )}

              {watermarkEnabled && (
                <div className="svpWatermark">
                  <div className="svpWatermarkInner">
                    <div className="svpWatermarkTop">{resolveTenantCodeString()}</div>
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
                    <IconButton icon={playing ? "pause" : "play"} label={playing ? "일시정지" : "재생"} onClick={togglePlay} />
                    <IconButton icon="replay10" label="-10초" onClick={() => skip(-10)} />
                    <IconButton icon="forward10" label="+10초" onClick={() => skip(10)} />
                    <div className="svpVolume">
                      <IconButton icon={muted || volume <= 0.0001 ? "mute" : "volume"} label="음소거" onClick={toggleMute} />
                      <div className="svpVolumeSlider">
                        <RangeSlider value={muted ? 0 : volume} min={0} max={1} step={0.01} onChange={(v) => onVolume(v)} ariaLabel="볼륨" />
                      </div>
                    </div>
                  </div>
                  <div className="svpRightControls">
                    <QualityButton
                      current={currentQuality}
                      qualities={qualities}
                      onSelect={(idx) => controllerRef.current?.setQuality(idx)}
                    />
                    <SpeedButton
                      rate={rate}
                      speeds={rateMenu}
                      disabled={speedLocked}
                      onSelect={setPlaybackRate}
                    />
                    <IconButton
                      className="svpFullscreenButton"
                      icon={isFullscreen ? "shrink" : "fullscreen"}
                      label={isFullscreen ? "전체화면 종료" : "전체화면"}
                      onPointerDown={() => requestFullscreen()}
                    />
                  </div>
                </div>

                {(!allowSeek || speedLocked) && (
                  <div className="svpPolicyHint">
                    {(!allowSeek || seekMode === "blocked") && (
                      <span className="svpPolicyHintItem">• 탐색이 제한됩니다{boundedForward ? " (시청한 구간만 이동 가능)" : ""}</span>
                    )}
                    {allowSeek && seekMode !== "blocked" && boundedForward && (
                      <span className="svpPolicyHintItem">• 앞으로 탐색이 제한됩니다</span>
                    )}
                    {speedLocked && <span className="svpPolicyHintItem">• 배속 변경이 제한됩니다</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <PlayerToast toast={toast} onClose={() => controllerRef.current?.clearToast()} />
        </div>

        <aside className="svpSide">
          <div className="svpSideCard">
            <div className="svpSideTitle">시청 상태</div>
            {policy.monitoring_enabled ? (
              <>
                <div className="svpSideRow">
                  <div className="svpSideLabel">시청 모드</div>
                  <div className="svpSideValue">수업 인정</div>
                </div>
                <div className="svpSideRow">
                  <div className="svpSideLabel">만료</div>
                  <div className="svpSideValue">{bootstrap.expires_at ? formatDateTimeKorean(bootstrap.expires_at * 1000) : "-"}</div>
                </div>
              </>
            ) : (
              <div className="svpSideRow">
                <div className="svpSideLabel">시청 모드</div>
                <div className="svpSideValue">복습</div>
              </div>
            )}
            <div className="svpSideDivider" />
            <div className="svpSideTitle2">재생 설정</div>
            <div className="svpSideBullets">
              <div className="svpSideBullet">
                <span className="svpSideDot" />
                <span className="svpSideTxt">{allowSeek ? (boundedForward ? "본 구간까지만 이동 가능" : "자유롭게 이동 가능") : "구간 이동 제한"}</span>
              </div>
              <div className="svpSideBullet">
                <span className="svpSideDot" />
                <span className="svpSideTxt">{speedLocked ? "배속 변경 제한" : `최대 ${maxRate}x까지 가능`}</span>
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
              onClick={() =>
                controllerRef.current?.showToast(
                  `현재 ${formatClock(current)} / ${formatClock(duration)} (약 ${Math.round((current / Math.max(1, duration)) * 100)}%)`,
                  "info"
                )
              }
            >
              진행률 보기
            </button>
            {monitoringEnabled && (
              <button type="button" className="svpSideButton svpSideButtonGhost" onClick={() => controllerRef.current?.refreshSession()}>
                재생 상태 확인
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
