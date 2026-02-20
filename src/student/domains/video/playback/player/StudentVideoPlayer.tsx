// PATH: src/student/domains/video/playback/player/StudentVideoPlayer.tsx
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
  RangeSlider,
} from "./design/ui";
import {
  StudentHlsController,
  type ControllerState,
} from "./headless/StudentHlsController";

import type { AccessMode } from "@/features/videos/types/access-mode";

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
  session_id: string | null;
  expires_at: number | null;
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
  onLeaveProgress?: (data: LeaveProgressPayload) => void;
};

type Policy = {
  access_mode?: AccessMode;
  monitoring_enabled?: boolean;
  allow_seek?: boolean;
  seek?: { mode?: string; grace_seconds?: number };
  playback_rate?: { max?: number; ui_control?: boolean };
  watermark?: { enabled?: boolean };
};

function normalizePolicy(p: any): Policy {
  const policy = (p || {}) as Policy;
  policy.seek = policy.seek || {};
  policy.playback_rate = policy.playback_rate || {};
  policy.watermark = policy.watermark || {};
  if (policy.monitoring_enabled == null) {
    policy.monitoring_enabled = policy.access_mode === "PROCTORED_CLASS";
  }
  if (policy.allow_seek == null) policy.allow_seek = true;
  if (!policy.seek?.mode) (policy.seek as any).mode = "free";
  if (policy.seek?.grace_seconds == null) (policy.seek as any).grace_seconds = 3;
  if (policy.playback_rate?.max == null) (policy.playback_rate as any).max = 16;
  if (policy.playback_rate?.ui_control == null) (policy.playback_rate as any).ui_control = true;
  if (policy.watermark?.enabled == null) (policy.watermark as any).enabled = false;
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
};

export default function StudentVideoPlayer({
  video,
  bootstrap,
  enrollmentId,
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

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<StudentHlsController | null>(null);

  const [ctrlState, setCtrlState] = useState<ControllerState>(initialControllerState);
  const [theater, setTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const gestureLayerRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRateRef = useRef(1);
  const swipeHandledRef = useRef(false);
  const touchStartRef = useRef<{ y: number; volume: number; rightHalf: boolean } | null>(null);

  const { ready, playing, buffering, duration, current, volume, muted, rate, toast } = ctrlState;


  useEffect(() => {
    const el = videoElRef.current;
    if (!el || !video || !bootstrap) return;

    const ctrl = new StudentHlsController({
      videoId: video.id,
      playUrl: bootstrap.play_url || video.hls_url || "",
      policy: bootstrap.policy,
      token: bootstrap.token,
      enrollmentId,
      onFatal,
      onLeaveProgress,
    });
    controllerRef.current = ctrl;
    ctrl.attach(el);

    const unsub = ctrl.subscribe(setCtrlState);

    return () => {
      unsub();
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, [video?.id, bootstrap?.play_url, bootstrap?.token, enrollmentId]);

  useEffect(() => {
    const ctrl = controllerRef.current;
    if (ctrl) ctrl.setToken(bootstrap.token);
  }, [bootstrap.token]);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;

    const onFullscreenChange = () => {
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
    const el = ctrl.getVideoEl();
    if (!el) return;
    if (el.paused) ctrl.play();
    else ctrl.pause();
  }, []);

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
    if (el) try { el.volume = clamp(v, 0, 1); } catch {}
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
    const el = ctrl.getVideoEl();
    if (!el) return;
    const t = Number(el.currentTime || 0) + Number(delta || 0);
    ctrl.seek(t);
  }, []);

  const requestFullscreen = useCallback(() => {
    const wrap = wrapElRef.current;
    const vid = videoElRef.current;
    const ctrl = controllerRef.current;

    const isFs =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement;

    try {
      if (!isFs) {
        ctrl?.queueFullscreenEvent(true);
        if (wrap?.requestFullscreen) {
          wrap.requestFullscreen();
          return;
        }
        if ((wrap as any)?.webkitRequestFullscreen) {
          (wrap as any).webkitRequestFullscreen();
          return;
        }
        if (vid?.requestFullscreen) {
          vid.requestFullscreen();
          return;
        }
        if ((vid as any)?.webkitRequestFullscreen) {
          (vid as any).webkitRequestFullscreen();
        }
      } else {
        ctrl?.queueFullscreenEvent(false);
        if (document.exitFullscreen) document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      }
    } catch {}
  }, []);

  const getTapZone = useCallback((rect: DOMRect, clientX: number) => {
    if (clientX < rect.left + rect.width * 0.3) return 0;
    if (clientX > rect.right - rect.width * 0.3) return 2;
    return 1;
  }, []);

  const resolveTap = useCallback(
    (clientX: number, rect: DOMRect) => {
      const count = tapCountRef.current;
      tapCountRef.current = 0;
      const ctrl = controllerRef.current;
      if (!ctrl) return;

      if (count === 1) {
        setShowControls((v) => !v);
        const zone = getTapZone(rect, clientX);
        if (zone === 1) togglePlay();
      } else if (count >= 2 && allowSeek) {
        const zone = getTapZone(rect, clientX);
        const delta = count >= 3
          ? (zone === 0 ? -20 : zone === 2 ? 20 : 0)
          : (zone === 0 ? -10 : zone === 2 ? 10 : 0);
        if (delta !== 0) {
          skip(delta);
          ctrl.showToast(delta > 0 ? `앞으로 ${Math.abs(delta)}초` : `뒤로 ${Math.abs(delta)}초`, "info");
        }
      }
    },
    [allowSeek, getTapZone, skip, togglePlay]
  );

  const onStageTap = useCallback((clientX: number, clientY: number) => {
    const layer = gestureLayerRef.current;
    const rect = layer?.getBoundingClientRect?.();
    if (!rect) return;

    lastTapRef.current = { time: Date.now(), x: clientX, y: clientY };
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      const r = gestureLayerRef.current?.getBoundingClientRect?.();
      if (r) resolveTap(lastTapRef.current.x, r);
    }, 200);
  }, [resolveTap]);

  const onStageTouchEndLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const el = controllerRef.current?.getVideoEl();
    if (el && savedRateRef.current !== undefined) {
      try {
        el.playbackRate = savedRateRef.current;
      } catch {}
      controllerRef.current?.setRate(savedRateRef.current);
    }
  }, []);

  const onStageTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const layer = gestureLayerRef.current;
      const rect = layer?.getBoundingClientRect?.();
      const t = e.touches?.[0];
      if (t && rect) {
        touchStartRef.current = {
          y: t.clientY,
          volume,
          rightHalf: t.clientX > rect.left + rect.width / 2,
        };
      }
      if (speedLocked || !rect || !t) return;
      const rightHalf = t.clientX > rect.left + rect.width / 2;
      if (!rightHalf) return;
      savedRateRef.current = rate;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        setPlaybackRate(2);
        controllerRef.current?.showToast("2배속", "info");
      }, 500);
    },
    [rate, setPlaybackRate, speedLocked, volume]
  );

  const onStageTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
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
        controllerRef.current?.setVolume(v);
        const el = controllerRef.current?.getVideoEl();
        if (el) try { el.volume = v; } catch {}
      }
    },
    [volume]
  );

  const onStageTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      onStageTouchEndLongPress();
      const t = e.changedTouches?.[0];
      if (t && !swipeHandledRef.current) onStageTap(t.clientX, t.clientY);
      swipeHandledRef.current = false;
      touchStartRef.current = null;
    },
    [onStageTap, onStageTouchEndLongPress]
  );

  useEffect(() => {
    const el = controllerRef.current?.getVideoEl();
    if (!el) return;
    try {
      el.volume = volume;
      el.muted = muted;
    } catch {}
  }, [muted, volume]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as any)?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || (e.target as any)?.isContentEditable) return;
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
    return pills;
  }, [policy.access_mode, monitoringEnabled, allowSeek, boundedForward, seekMode, speedLocked, watermarkEnabled]);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const shareText = useMemo(() => {
    if (!monitoringEnabled) return `기기: ${deviceId.slice(0, 8)}… · 모니터링 없음 (복습 모드)`;
    const expires = bootstrap.expires_at ? formatDateTimeKorean(bootstrap.expires_at * 1000) : "";
    return `기기: ${deviceId.slice(0, 8)}… · 세션 만료: ${expires || "-"}`;
  }, [bootstrap.expires_at, deviceId, monitoringEnabled]);

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
            className={`svpPlayerWrap ${!showControls ? "svpPlayerWrap--controlsHidden" : ""} ${isFullscreen ? "svpPlayerWrap--fullscreen" : ""}`}
            ref={wrapElRef}
          >
            <div className="svpTopBar">
              <div className="svpTopLeft">
                <div className="svpTitle" title={video.title}>{video.title}</div>
                <div className="svpMeta">
                  <span className="svpMetaItem">video#{video.id}</span>
                  <span className="svpDot">•</span>
                  <span className="svpMetaItem">enrollment#{enrollmentId ?? "-"}</span>
                </div>
              </div>
              <div className="svpTopRight">
                <div className="svpPills">
                  {policyPills.map((p, idx) => (
                    <Pill key={idx} tone={p.tone}>{p.text}</Pill>
                  ))}
                </div>
                <KebabMenu
                  align="right"
                  label="메뉴"
                  items={[
                    {
                      label: "세션 새로고침",
                      onClick: () => controllerRef.current?.refreshSession(),
                    },
                    {
                      label: "이 영상 정보",
                      onClick: () => controllerRef.current?.showToast(shareText, "info"),
                    },
                  ]}
                />
              </div>
            </div>

            <div className="svpVideoStage" role="presentation">
              <video
                ref={videoElRef}
                className="svpVideo"
                playsInline
                controls={false}
                preload="metadata"
                poster={video.thumbnail_url || undefined}
              />
              <div
                ref={gestureLayerRef}
                className="svpGestureLayer"
                aria-hidden
                onClick={(e) => { e.preventDefault(); onStageTap(e.clientX, e.clientY); }}
                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onStageTap(e.clientX, e.clientY); }}
                onTouchStart={onStageTouchStart}
                onTouchMove={onStageTouchMove}
                onTouchEnd={onStageTouchEnd}
                onTouchCancel={onStageTouchEndLongPress}
              />

              {!ready && (
                <div className="svpOverlayCenter">
                  <div className="svpSpinner" />
                  <div className="svpOverlayText">로딩 중…</div>
                </div>
              )}

              {ready && !playing && (
                <button className="svpBigPlay" type="button" onClick={togglePlay} onDoubleClick={(e) => e.stopPropagation()}>
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
                    <IconButton icon={theater ? "shrink" : "theater"} label={theater ? "기본 보기" : "극장 모드"} onClick={() => setTheater((v) => !v)} />
                    <IconButton icon="fullscreen" label="전체화면" onPointerDown={() => requestFullscreen()} />
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
                {allowSeek && !speedLocked && (
                  <div className="svpPolicyHint svpPolicyHintMuted">
                    키보드: Space/K(재생), J/L(±10s), ←/→(±5s), F(전체화면), M(음소거), T(극장)
                  </div>
                )}
              </div>
            </div>
          </div>

          <PlayerToast toast={toast} onClose={() => controllerRef.current?.clearToast()} />
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
                  <div className="svpSideValue">{bootstrap.expires_at ? formatDateTimeKorean(bootstrap.expires_at * 1000) : "-"}</div>
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
                <span className="svpSideTxt">{allowSeek ? (boundedForward ? "시청한 구간까지만 이동 가능" : "탐색 가능") : "탐색 차단"}</span>
              </div>
              <div className="svpSideBullet">
                <span className="svpSideDot" />
                <span className="svpSideTxt">{speedLocked ? "배속 차단" : `최대 배속 ${maxRate}x`}</span>
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
                세션 점검
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
