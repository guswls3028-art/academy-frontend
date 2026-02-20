/**
 * Headless HLS controller — owns ALL imperative lifecycle.
 * Hls.js / HTMLVideoElement events / timers live here, NOT in React.
 * After dispose(), zero callbacks can run — guards enforce no setState from video events.
 */
import studentApi from "@/student/shared/api/studentApi";
import { clamp, getEpochSec } from "../design/utils";

export type EventType =
  | "VISIBILITY_HIDDEN"
  | "VISIBILITY_VISIBLE"
  | "FOCUS_LOST"
  | "FOCUS_GAINED"
  | "SEEK_ATTEMPT"
  | "SPEED_CHANGE_ATTEMPT"
  | "FULLSCREEN_ENTER"
  | "FULLSCREEN_EXIT"
  | "PLAYER_ERROR";

export interface Policy {
  access_mode?: string;
  monitoring_enabled?: boolean;
  allow_seek?: boolean;
  seek?: { mode?: string; grace_seconds?: number };
  playback_rate?: { max?: number; ui_control?: boolean };
  watermark?: { enabled?: boolean };
}

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

async function postHeartbeat(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/api/v1/videos/playback/heartbeat/`, { token });
  } catch {}
}

async function postRefresh(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/api/v1/videos/playback/refresh/`, { token });
  } catch {}
}

async function postEnd(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/api/v1/videos/playback/end/`, { token });
  } catch {}
}

async function postEvents(
  token: string,
  events: Array<{ type: EventType; occurred_at: number; payload?: any }>,
  videoId: number,
  enrollmentId: number | null
) {
  if (!events.length || token.startsWith("student-")) return;
  try {
    await studentApi.post(`/api/v1/videos/playback/events/`, {
      token,
      video_id: videoId,
      enrollment_id: enrollmentId,
      events: events.map((e) => ({ type: e.type, occurred_at: e.occurred_at, payload: e.payload || {} })),
    });
  } catch {}
}

export interface ControllerState {
  ready: boolean;
  playing: boolean;
  buffering: boolean;
  duration: number;
  current: number;
  volume: number;
  muted: boolean;
  rate: number;
  toast: { text: string; kind?: "info" | "warn" | "danger" } | null;
}

export interface ControllerOptions {
  videoId: number;
  playUrl: string;
  policy: any;
  token: string;
  enrollmentId: number | null;
  onFatal?: (reason: string) => void;
  onLeaveProgress?: (data: { progress?: number; last_position?: number; completed?: boolean }) => void;
}

type Listener = (state: ControllerState) => void;

export class StudentHlsController {
  private el: HTMLVideoElement | null = null;
  private hls: any = null;
  private disposed = false;
  private listeners = new Set<Listener>();
  private opts: ControllerOptions;
  private policy: Policy;

  private state: ControllerState = {
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

  private maxWatchedRef = 0;
  private lastTimeRef = 0;
  private seekGuardRef = { blocking: false, lastWarnAt: 0 };
  private eventQueue: Array<{ type: EventType; occurred_at: number; payload?: any }> = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private videoListeners: Array<{ ev: string; fn: EventListener }> = [];
  private docListeners: Array<{ ev: string; fn: EventListener }> = [];
  private tokenRef: string;

  constructor(opts: ControllerOptions) {
    this.opts = opts;
    this.policy = normalizePolicy(opts.policy);
    this.tokenRef = opts.token;
  }

  private guard(cb: () => void) {
    if (this.disposed) return;
    cb();
  }

  private emit() {
    if (this.disposed) return;
    const s = { ...this.state };
    this.listeners.forEach((fn) => {
      try {
        fn(s);
      } catch {}
    });
  }

  private setState(partial: Partial<ControllerState>) {
    if (this.disposed) return;
    Object.assign(this.state, partial);
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): ControllerState {
    return { ...this.state };
  }

  getVideoEl(): HTMLVideoElement | null {
    return this.el;
  }

  play() {
    if (this.disposed || !this.el) return;
    try {
      this.el.play().catch(() => {});
    } catch {}
  }

  pause() {
    if (this.disposed || !this.el) return;
    try {
      this.el.pause();
    } catch {}
  }

  seek(t: number) {
    if (this.disposed || !this.el) return;
    const d = Number(this.el.duration) || 0;
    const safe = clamp(t, 0, Math.max(0, d));
    try {
      this.el.currentTime = safe;
    } catch {}
  }

  setRate(r: number) {
    if (this.disposed || !this.el) return;
    const maxRate = Math.max(1, Number(this.policy.playback_rate?.max) || 1);
    const speedLocked = this.policy.playback_rate?.ui_control === false || maxRate <= 1.0001;
    if (speedLocked) {
      try {
        this.el.playbackRate = 1;
      } catch {}
      this.guard(() => this.setState({ rate: 1, toast: { text: "배속 변경이 제한되어 있습니다.", kind: "warn" } }));
      this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: 1 });
      return;
    }
    const rr = clamp(r, 0.25, maxRate);
    try {
      this.el.playbackRate = rr;
    } catch {}
    this.guard(() => this.setState({ rate: rr }));
  }

  setVolume(v: number) {
    if (this.disposed || !this.el) return;
    const vv = clamp(v, 0, 1);
    this.setState({ volume: vv, muted: vv <= 0.0001 });
    try {
      this.el.volume = vv;
      this.el.muted = vv <= 0.0001;
    } catch {}
  }

  setMuted(m: boolean) {
    if (this.disposed || !this.el) return;
    this.setState({ muted: m });
    try {
      this.el.muted = m;
    } catch {}
  }

  setToken(token: string) {
    this.tokenRef = token;
  }

  private queueEvent(type: EventType, payload?: any) {
    if (this.disposed) return;
    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    if (!monitoringEnabled) return;
    const violationEvents: EventType[] = ["SEEK_ATTEMPT", "SPEED_CHANGE_ATTEMPT"];
    const isViolation = violationEvents.includes(type);
    if (this.policy.access_mode === "FREE_REVIEW" && isViolation) return;
    const now = getEpochSec();
    this.eventQueue.push({ type, occurred_at: now, payload: payload || {} });
    if (this.eventQueue.length > 300) this.eventQueue.splice(0, this.eventQueue.length - 300);
  }

  private flushEvents = async () => {
    if (this.disposed) return;
    const token = this.tokenRef;
    if (!token) return;
    const batch = this.eventQueue.splice(0, this.eventQueue.length);
    if (!batch.length) return;
    try {
      await postEvents(token, batch, this.opts.videoId, this.opts.enrollmentId);
    } catch (e: any) {
      if (this.disposed) return;
      const msg = e?.response?.data?.detail || e?.message || "";
      if (String(msg).includes("session_inactive") || e?.response?.status === 409) {
        this.setState({ toast: { text: "재생 세션이 종료되었습니다.", kind: "danger" } });
        this.opts.onFatal?.("session_inactive");
      }
    }
  };

  private startIntervals() {
    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    if (!monitoringEnabled) return;

    const id1 = setInterval(() => this.guard(() => this.flushEvents()), 2200);
    this.intervals.push(id1);

    const id2 = setInterval(() => {
      this.guard(() => {
        const token = this.tokenRef;
        if (!token) return;
        postHeartbeat(token).catch((e: any) => {
          if (this.disposed) return;
          const msg = e?.response?.data?.detail || e?.message || "";
          if (String(msg).includes("policy_changed")) {
            this.setState({ toast: { text: "정책이 변경되어 재생이 종료되었습니다.", kind: "danger" } });
            this.opts.onFatal?.("policy_changed");
          } else if (String(msg).includes("session_inactive") || e?.response?.status === 409) {
            this.setState({ toast: { text: "재생 세션이 종료되었습니다.", kind: "danger" } });
            this.opts.onFatal?.("session_inactive");
          }
        });
      });
    }, 30000);
    this.intervals.push(id2);
  }

  private startDocListeners() {
    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    const onVis = () => {
      if (this.disposed) return;
      if (document.hidden) this.queueEvent("VISIBILITY_HIDDEN", { hidden: true });
      else {
        this.queueEvent("VISIBILITY_VISIBLE", { hidden: false });
        if (monitoringEnabled) {
          const token = this.tokenRef;
          if (token) postRefresh(token).catch(() => {});
        }
      }
    };
    const onBlur = () => this.guard(() => this.queueEvent("FOCUS_LOST", {}));
    const onFocus = () => this.guard(() => this.queueEvent("FOCUS_GAINED", {}));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    this.docListeners.push(
      { ev: "visibilitychange", fn: onVis as EventListener },
      { ev: "blur", fn: onBlur as EventListener },
      { ev: "focus", fn: onFocus as EventListener }
    );
  }

  private addVideoListener(ev: string, fn: EventListener) {
    if (!this.el) return;
    this.el.addEventListener(ev, fn);
    this.videoListeners.push({ ev, fn });
  }

  private removeAllVideoListeners() {
    this.videoListeners.forEach(({ ev, fn }) => this.el?.removeEventListener(ev, fn));
    this.videoListeners = [];
  }

  private flushProgress() {
    if (this.disposed || !this.el || !this.opts.onLeaveProgress) return;
    const lastPosition = Math.max(0, this.maxWatchedRef);
    const dur = Number(this.el.duration);
    const progressPercent = dur > 0 && Number.isFinite(dur) ? Math.min(100, (lastPosition / dur) * 100) : 0;
    const completed = dur > 0 && lastPosition >= dur - 0.5;
    this.opts.onLeaveProgress({
      progress: progressPercent,
      last_position: Math.round(lastPosition),
      completed,
    });
  }

  queueFullscreenEvent(entering: boolean) {
    this.guard(() => this.queueEvent(entering ? "FULLSCREEN_ENTER" : "FULLSCREEN_EXIT", {}));
  }

  async attach(el: HTMLVideoElement): Promise<void> {
    if (this.disposed) return;
    this.el = el;

    try {
      el.pause();
    } catch {}
    el.src = "";

    let url = this.opts.playUrl || "";
    if (!url) {
      this.opts.onFatal?.("재생 URL이 제공되지 않았습니다.");
      return;
    }

    try {
      new URL(url);
    } catch {
      const apiBase = String(import.meta.env.VITE_API_BASE_URL || "https://api.hakwonplus.com").trim();
      const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
      const path = url.startsWith("/") ? url : `/${url}`;
      url = `${base}${path}`;
    }

    try {
      new URL(url);
    } catch {
      this.opts.onFatal?.(`잘못된 재생 URL 형식입니다: ${url}`);
      return;
    }

    const canNative =
      el.canPlayType("application/vnd.apple.mpegurl") || el.canPlayType("application/x-mpegURL");

    if (canNative) {
      el.src = url;
      this.bindVideoEvents();
      this.startIntervals();
      this.startDocListeners();
      return;
    }

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
        this.hls = hls;

        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (this.disposed) return;
          try {
            this.queueEvent("PLAYER_ERROR", {
              fatal: !!data?.fatal,
              details: data?.details || "",
              type: data?.type || "",
            });
          } catch {}

          if (data?.fatal) {
            if (this.disposed) return;
            const errorMsg = data?.details || data?.type || "알 수 없는 오류";
            const errorCode = data?.response?.code ?? data?.code;
            const is404 = errorCode === 404 || String(errorMsg).includes("404") || String(errorMsg).includes("Not Found");
            const isNetworkError =
              errorCode === -1 || errorCode === -2 || String(errorMsg).includes("network") || String(errorMsg).includes("NetworkError");
            let message = "";
            if (is404) message = "비디오 파일을 찾을 수 없습니다. 비디오가 아직 처리 중이거나 업로드되지 않았을 수 있습니다.";
            else if (isNetworkError) message = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
            else message = `재생 오류가 발생했습니다: ${errorMsg}`;
            this.setState({ toast: { text: message, kind: "danger" } });
            if (is404 || isNetworkError) this.opts.onFatal?.(message);
          }
        });

        hls.loadSource(url);
        hls.attachMedia(el);
      } else {
        el.src = url;
      }
    } catch {
      el.src = url;
    }

    this.bindVideoEvents();
    this.startIntervals();
    this.startDocListeners();
  }

  private bindVideoEvents() {
    const el = this.el;
    if (!el) return;

    const allowSeek = !!this.policy.allow_seek && this.policy.seek?.mode !== "blocked";
    const seekMode = this.policy.seek?.mode || "free";
    const grace = Math.max(0, Number(this.policy.seek?.grace_seconds ?? 3));
    const boundedForward = seekMode === "bounded_forward";
    const maxRate = Math.max(1, Number(this.policy.playback_rate?.max) || 1);
    const speedLocked = this.policy.playback_rate?.ui_control === false || maxRate <= 1.0001;

    const onLoadedMeta = () => {
      if (this.disposed) return;
      const d = Number(el.duration || 0);
      if (d && Number.isFinite(d)) this.setState({ duration: d });
      this.setState({ ready: true, buffering: false });
    };

    const onTime = () => {
      if (this.disposed) return;
      const t = Number(el.currentTime || 0);
      this.setState({ current: t });
      const prev = this.lastTimeRef;
      this.lastTimeRef = t;
      if (t > this.maxWatchedRef) this.maxWatchedRef = t;
    };

    const onPlay = () => this.guard(() => this.setState({ playing: true, buffering: false }));
    const onPause = () => this.guard(() => this.setState({ playing: false }));
    const onWaiting = () => this.guard(() => this.setState({ buffering: true }));
    const onPlaying = () => this.guard(() => this.setState({ buffering: false }));

    const onRateChange = () => {
      if (this.disposed) return;
      const r = Number(el.playbackRate || 1);
      this.setState({ rate: r });
      if (speedLocked) {
        if (Math.abs(r - 1) > 0.001) {
          try {
            el.playbackRate = 1;
          } catch {}
          this.setState({ toast: { text: "배속 변경이 제한되어 있습니다.", kind: "warn" } });
          this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: 1 });
        }
        return;
      }
      if (r > maxRate + 0.0001) {
        try {
          el.playbackRate = maxRate;
        } catch {}
        this.setState({ toast: { text: `최대 배속은 ${maxRate}x 입니다.`, kind: "warn" } });
        this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: maxRate });
      }
    };

    const onSeeking = () => {
      if (this.disposed) return;
      if (allowSeek && !boundedForward) return;

      const now = Date.now();
      const guard = this.seekGuardRef;
      const target = Number(el.currentTime || 0);
      const maxWatched = this.maxWatchedRef;
      const allowedMax = boundedForward ? maxWatched + grace : maxWatched;
      const isForwardBeyond = target > allowedMax + 0.001;

      if (!allowSeek || seekMode === "blocked") {
        guard.blocking = true;
        try {
          el.currentTime = maxWatched;
        } catch {}
        guard.blocking = false;
        if (now - guard.lastWarnAt > 900) {
          guard.lastWarnAt = now;
          this.setState({ toast: { text: "탐색이 제한된 영상입니다.", kind: "warn" } });
        }
        this.queueEvent("SEEK_ATTEMPT", { mode: "blocked", target, max_watched: maxWatched });
        return;
      }

      if (boundedForward && isForwardBeyond) {
        guard.blocking = true;
        try {
          el.currentTime = allowedMax;
        } catch {}
        guard.blocking = false;
        if (now - guard.lastWarnAt > 900) {
          guard.lastWarnAt = now;
          this.setState({ toast: { text: "아직 시청하지 않은 구간으로 이동할 수 없습니다.", kind: "warn" } });
        }
        this.queueEvent("SEEK_ATTEMPT", { mode: "bounded_forward", target, max_watched: maxWatched, grace });
      }
    };

    const onError = () => {
      if (this.disposed) return;
      const elErr = el.error as any;
      const errorCode = elErr?.code || 0;
      const errorMessage = elErr?.message || "";
      this.queueEvent("PLAYER_ERROR", { code: errorCode, message: errorMessage });
      let message = "재생 오류가 발생했습니다.";
      if (errorCode === 4 || errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        message = "비디오 파일을 찾을 수 없습니다 (404). 서버에 비디오 파일이 있는지 확인해주세요.";
        this.opts.onFatal?.("비디오 파일을 찾을 수 없습니다.");
      } else if (errorCode === 2) message = "네트워크 오류가 발생했습니다. 연결을 확인해주세요.";
      else if (errorCode === 3) message = "비디오 디코딩 오류가 발생했습니다.";
      this.setState({ toast: { text: message, kind: "danger" } });
    };

    this.addVideoListener("loadedmetadata", onLoadedMeta);
    this.addVideoListener("timeupdate", onTime);
    this.addVideoListener("play", onPlay);
    this.addVideoListener("pause", onPause);
    this.addVideoListener("waiting", onWaiting);
    this.addVideoListener("playing", onPlaying);
    this.addVideoListener("ratechange", onRateChange);
    this.addVideoListener("seeking", onSeeking);
    this.addVideoListener("error", onError);

    try {
      if (speedLocked) el.playbackRate = 1;
      if (maxRate < 1) el.playbackRate = 1;
    } catch {}
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.listeners.clear();

    this.intervals.forEach((id) => clearInterval(id));
    this.intervals = [];
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts = [];

    this.removeAllVideoListeners();

    this.docListeners.forEach(({ ev, fn }) => {
      if (ev === "visibilitychange") document.removeEventListener(ev, fn);
      else window.removeEventListener(ev, fn);
    });
    this.docListeners = [];

    if (this.hls && typeof this.hls.destroy === "function") {
      try {
        this.hls.destroy();
      } catch {}
      this.hls = null;
    }

    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    if (monitoringEnabled) {
      const token = this.tokenRef;
      if (token) postEnd(token).catch(() => {});
      try {
        this.flushEvents();
      } catch {}
    }

    this.flushProgress();
    this.el = null;
  }
}
