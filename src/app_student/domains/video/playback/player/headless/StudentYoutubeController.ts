import studentApi from "@student/shared/api/student.api";
import { extractYouTubeVideoId } from "@/shared/media/video/youtube";
import { clamp, getEpochSec } from "../design/utils";
import type {
  ControllerOptions,
  ControllerState,
  EventType,
  Policy,
} from "./StudentHlsController";

const ignoreBestEffortError = () => undefined;

type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5;

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => YouTubePlayerState;
  getAvailablePlaybackRates?: () => number[];
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  destroy: () => void;
};

type YouTubeEvent = {
  target: YouTubePlayer;
  data?: number;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: YouTubeEvent) => void;
        onStateChange?: (event: YouTubeEvent) => void;
        onPlaybackRateChange?: (event: YouTubeEvent) => void;
        onError?: (event: YouTubeEvent) => void;
      };
    }
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YoutubeControllerOptions extends ControllerOptions {
  youtubeVideoId?: string | null;
}

type Listener = (state: ControllerState) => void;

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

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

function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeoutId = window.setTimeout(() => {
      reject(new Error("youtube_iframe_api_timeout"));
    }, 12000);

    window.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } catch {
        ignoreBestEffortError();
      }
      window.clearTimeout(timeoutId);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("youtube_iframe_api_missing"));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("youtube_iframe_api_load_failed"));
    };
    document.head.appendChild(tag);
  });

  return youtubeApiPromise;
}

async function postHeartbeat(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/media/playback/heartbeat/`, { token });
  } catch {
    ignoreBestEffortError();
  }
}

async function postRefresh(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/media/playback/refresh/`, { token });
  } catch {
    ignoreBestEffortError();
  }
}

async function postEnd(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/media/playback/end/`, { token });
  } catch {
    ignoreBestEffortError();
  }
}

async function postEvents(
  token: string,
  events: Array<{ type: EventType; occurred_at: number; payload?: Record<string, unknown> }>,
  videoId: number,
  enrollmentId: number | null
) {
  if (!events.length || token.startsWith("student-")) return;
  try {
    await studentApi.post(`/media/playback/events/`, {
      token,
      video_id: videoId,
      enrollment_id: enrollmentId,
      events: events.map((e) => ({ type: e.type, occurred_at: e.occurred_at, payload: e.payload || {} })),
    });
  } catch {
    ignoreBestEffortError();
  }
}

export class StudentYoutubeController {
  private mount: HTMLElement | null = null;
  private player: YouTubePlayer | null = null;
  private disposed = false;
  private listeners = new Set<Listener>();
  private opts: YoutubeControllerOptions;
  private policy: Policy;
  private tokenRef: string;
  private maxWatchedRef = 0;
  private lastSavedPosition = -1;
  private eventQueue: Array<{ type: EventType; occurred_at: number; payload?: Record<string, unknown> }> = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private docCleanups: Array<() => void> = [];

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
    qualities: [],
    currentQuality: -1,
    reconnecting: false,
  };

  constructor(opts: YoutubeControllerOptions) {
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
      } catch {
        ignoreBestEffortError();
      }
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
    return null;
  }

  play() {
    if (this.disposed || !this.player) return;
    try {
      this.player.playVideo();
    } catch {
      ignoreBestEffortError();
    }
  }

  pause() {
    if (this.disposed || !this.player) return;
    try {
      this.player.pauseVideo();
    } catch {
      ignoreBestEffortError();
    }
  }

  seek(t: number) {
    if (this.disposed || !this.player) return;
    const duration = this.safeDuration();
    const target = clamp(t, 0, Math.max(0, duration));
    const allowSeek = !!this.policy.allow_seek && this.policy.seek?.mode !== "blocked";
    const seekMode = this.policy.seek?.mode || "free";
    const boundedForward = seekMode === "bounded_forward";
    const grace = Math.max(0, Number(this.policy.seek?.grace_seconds ?? 3));

    if (!allowSeek || seekMode === "blocked") {
      const fallback = Math.max(0, this.maxWatchedRef);
      this.player.seekTo(fallback, true);
      this.showToast("탐색이 제한된 영상입니다.", "warn");
      this.queueEvent("SEEK_ATTEMPT", { mode: "blocked", target, max_watched: this.maxWatchedRef });
      return;
    }

    if (boundedForward && target > this.maxWatchedRef + grace) {
      const allowed = Math.min(duration, this.maxWatchedRef + grace);
      this.player.seekTo(allowed, true);
      this.showToast("아직 시청하지 않은 구간으로 이동할 수 없습니다.", "warn");
      this.queueEvent("SEEK_ATTEMPT", {
        mode: "bounded_forward",
        target,
        max_watched: this.maxWatchedRef,
        grace,
      });
      return;
    }

    try {
      this.player.seekTo(target, true);
      this.setState({ current: target });
    } catch {
      ignoreBestEffortError();
    }
  }

  setRate(r: number) {
    if (this.disposed || !this.player) return;
    const maxRate = Math.max(1, Number(this.policy.playback_rate?.max) || 1);
    const speedLocked = this.policy.playback_rate?.ui_control === false || maxRate <= 1.0001;
    if (speedLocked) {
      this.applyPlaybackRate(1);
      this.showToast("배속 변경이 제한되어 있습니다.", "warn");
      this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: 1 });
      return;
    }
    const desired = clamp(r, 0.25, maxRate);
    const applied = this.applyPlaybackRate(desired);
    if (applied < desired - 0.001) {
      this.showToast(`지원되는 배속 ${applied}x로 재생합니다.`, "info");
    }
  }

  setVolume(v: number) {
    if (this.disposed || !this.player) return;
    const vv = clamp(v, 0, 1);
    try {
      this.player.setVolume(Math.round(vv * 100));
      if (vv <= 0.0001) this.player.mute();
      else this.player.unMute();
    } catch {
      ignoreBestEffortError();
    }
    this.setState({ volume: vv, muted: vv <= 0.0001 });
  }

  setMuted(m: boolean) {
    if (this.disposed || !this.player) return;
    try {
      if (m) this.player.mute();
      else this.player.unMute();
    } catch {
      ignoreBestEffortError();
    }
    this.setState({ muted: m });
  }

  showToast(text: string, kind?: "info" | "warn" | "danger") {
    if (this.disposed) return;
    this.setState({ toast: { text, kind } });
  }

  clearToast() {
    if (this.disposed) return;
    this.setState({ toast: null });
  }

  async refreshSession() {
    if (this.disposed) return;
    const token = this.tokenRef;
    if (!token) return;
    try {
      await postRefresh(token);
      this.showToast("세션 확인 완료", "info");
    } catch {
      this.showToast("세션 확인 실패", "warn");
    }
  }

  setToken(token: string) {
    this.tokenRef = token;
  }

  setQuality() {
    this.showToast("YouTube 영상은 화질을 자동으로 조정합니다.", "info");
  }

  queueFullscreenEvent(entering: boolean) {
    this.guard(() => this.queueEvent(entering ? "FULLSCREEN_ENTER" : "FULLSCREEN_EXIT", {}));
  }

  async attach(el: HTMLElement): Promise<void> {
    if (this.disposed) return;
    this.mount = el;
    el.innerHTML = "";

    const videoId = this.opts.youtubeVideoId || extractYouTubeVideoId(this.opts.playUrl);
    if (!videoId) {
      this.opts.onFatal?.("YouTube 영상 ID를 확인할 수 없습니다.");
      return;
    }

    try {
      const api = await loadYouTubeIframeApi();
      if (this.disposed || !this.mount) return;
      this.player = new api.Player(this.mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          fs: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => this.onReady(event.target),
          onStateChange: (event) => this.onStateChange(event.data as YouTubePlayerState),
          onPlaybackRateChange: (event) => this.onPlaybackRateChange(Number(event.data || 1)),
          onError: (event) => this.onError(Number(event.data || 0)),
        },
      });
    } catch {
      this.opts.onFatal?.("YouTube 플레이어를 불러오지 못했습니다.");
    }
  }

  private onReady(player: YouTubePlayer) {
    if (this.disposed) return;
    const duration = Math.max(0, Number(player.getDuration?.() || 0));
    const initialPosition = Math.max(0, Number(this.opts.initialPosition || 0));
    if (initialPosition > 1 && duration > 0) {
      const safe = Math.min(initialPosition, Math.max(0, duration - 1));
      this.maxWatchedRef = Math.max(this.maxWatchedRef, safe);
      try {
        player.seekTo(safe, true);
      } catch {
        ignoreBestEffortError();
      }
    }
    this.setState({
      ready: true,
      buffering: false,
      duration,
      current: initialPosition > 1 ? Math.min(initialPosition, duration || initialPosition) : 0,
      volume: clamp(Number(player.getVolume?.() ?? 100) / 100, 0, 1),
      muted: !!player.isMuted?.(),
    });
    this.startIntervals();
    this.startDocListeners();
  }

  private onStateChange(state: YouTubePlayerState) {
    if (this.disposed) return;
    if (state === 1) {
      this.setState({ playing: true, buffering: false });
      return;
    }
    if (state === 3) {
      this.setState({ buffering: true });
      return;
    }
    if (state === 0) {
      const duration = this.safeDuration();
      this.maxWatchedRef = Math.max(this.maxWatchedRef, duration);
      this.setState({ playing: false, buffering: false, current: duration, duration });
      this.flushProgress();
      return;
    }
    if (state === 2 || state === 5 || state === -1) {
      this.setState({ playing: false, buffering: false });
    }
  }

  private onPlaybackRateChange(rate: number) {
    if (this.disposed) return;
    const maxRate = Math.max(1, Number(this.policy.playback_rate?.max) || 1);
    const speedLocked = this.policy.playback_rate?.ui_control === false || maxRate <= 1.0001;
    if (speedLocked && Math.abs(rate - 1) > 0.001) {
      this.applyPlaybackRate(1);
      this.showToast("배속 변경이 제한되어 있습니다.", "warn");
      this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: rate, enforced: 1 });
      return;
    }
    if (rate > maxRate + 0.001) {
      this.applyPlaybackRate(maxRate);
      this.showToast(`최대 배속은 ${maxRate}x 입니다.`, "warn");
      this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: rate, enforced: maxRate });
      return;
    }
    this.setState({ rate });
  }

  private onError(code: number) {
    if (this.disposed) return;
    const message =
      code === 101 || code === 150
        ? "YouTube에서 이 영상의 퍼가기를 허용하지 않았습니다."
        : "YouTube 재생 오류가 발생했습니다.";
    this.queueEvent("PLAYER_ERROR", { code, provider: "youtube" });
    this.setState({ toast: { text: message, kind: "danger" }, buffering: false });
    this.opts.onFatal?.(message);
  }

  private applyPlaybackRate(rate: number): number {
    if (!this.player) return 1;
    const available = this.player.getAvailablePlaybackRates?.() || [];
    const supported = available.length
      ? [...available].sort((a, b) => a - b).filter((x) => x <= rate + 0.001).pop() ?? available[0] ?? 1
      : rate;
    try {
      this.player.setPlaybackRate(supported);
    } catch {
      ignoreBestEffortError();
    }
    this.setState({ rate: supported });
    return supported;
  }

  private safeCurrent(): number {
    try {
      return Math.max(0, Number(this.player?.getCurrentTime?.() || 0));
    } catch {
      return this.state.current;
    }
  }

  private safeDuration(): number {
    try {
      return Math.max(0, Number(this.player?.getDuration?.() || this.state.duration || 0));
    } catch {
      return this.state.duration;
    }
  }

  private syncTimeFromPlayer() {
    if (this.disposed || !this.player) return;
    const current = this.safeCurrent();
    const duration = this.safeDuration();
    const playing = this.player.getPlayerState?.() === 1;
    if (playing && current > this.maxWatchedRef) this.maxWatchedRef = current;
    this.setState({ current, duration: duration || this.state.duration });
  }

  private startIntervals() {
    const pollId = setInterval(() => this.guard(() => this.syncTimeFromPlayer()), 500);
    this.intervals.push(pollId);

    const saveId = setInterval(() => this.guard(() => this.flushProgressIfChanged()), 30000);
    this.intervals.push(saveId);

    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    if (!monitoringEnabled) return;

    const eventId = setInterval(() => this.guard(() => this.flushEvents()), 2200);
    this.intervals.push(eventId);

    const heartbeatId = setInterval(() => {
      this.guard(() => {
        const token = this.tokenRef;
        if (token) postHeartbeat(token).catch(ignoreBestEffortError);
      });
    }, 30000);
    this.intervals.push(heartbeatId);
  }

  private startDocListeners() {
    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    const onVis = () => {
      if (this.disposed) return;
      if (document.hidden) {
        this.flushProgress();
        this.queueEvent("VISIBILITY_HIDDEN", { hidden: true });
      } else {
        this.queueEvent("VISIBILITY_VISIBLE", { hidden: false });
        if (monitoringEnabled) {
          const token = this.tokenRef;
          if (token) postRefresh(token).catch(ignoreBestEffortError);
        }
      }
    };
    const onBlur = () => this.guard(() => this.queueEvent("FOCUS_LOST", {}));
    const onFocus = () => this.guard(() => this.queueEvent("FOCUS_GAINED", {}));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    this.docCleanups.push(
      () => document.removeEventListener("visibilitychange", onVis),
      () => window.removeEventListener("blur", onBlur),
      () => window.removeEventListener("focus", onFocus)
    );
  }

  private queueEvent(type: EventType, payload?: Record<string, unknown>) {
    if (this.disposed) return;
    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    if (!monitoringEnabled) return;
    const violationEvents: EventType[] = ["SEEK_ATTEMPT", "SPEED_CHANGE_ATTEMPT"];
    const isViolation = violationEvents.includes(type);
    if (this.policy.access_mode === "FREE_REVIEW" && isViolation) return;
    this.eventQueue.push({ type, occurred_at: getEpochSec(), payload: payload || {} });
    if (this.eventQueue.length > 300) this.eventQueue.splice(0, this.eventQueue.length - 300);
  }

  private flushEvents = async () => {
    if (this.disposed) return;
    const token = this.tokenRef;
    if (!token) return;
    const batch = this.eventQueue.splice(0, this.eventQueue.length);
    await postEvents(token, batch, this.opts.videoId, this.opts.enrollmentId);
  };

  private flushProgress(force = false) {
    if ((!force && this.disposed) || !this.opts.onLeaveProgress) return;
    const currentTime = this.safeCurrent();
    const duration = this.safeDuration();
    const maxWatched = Math.max(0, this.maxWatchedRef);
    const progressPercent = duration > 0 ? Math.min(100, (maxWatched / duration) * 100) : 0;
    const completed = duration > 0 && maxWatched >= duration - 0.5;
    this.opts.onLeaveProgress({
      progress: progressPercent,
      last_position: Math.round(currentTime),
      completed,
    });
  }

  private flushProgressIfChanged() {
    if (this.disposed) return;
    const cur = Math.round(this.safeCurrent());
    if (Math.abs(cur - this.lastSavedPosition) < 5) return;
    this.lastSavedPosition = cur;
    this.flushProgress();
  }

  dispose(): void {
    if (this.disposed) return;
    this.flushProgress(true);

    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    const token = this.tokenRef;
    const batch = this.eventQueue.splice(0, this.eventQueue.length);

    this.disposed = true;
    this.listeners.clear();
    this.intervals.forEach((intervalId) => clearInterval(intervalId));
    this.intervals = [];
    this.docCleanups.forEach((fn) => fn());
    this.docCleanups = [];

    if (this.player) {
      try {
        this.player.destroy();
      } catch {
        ignoreBestEffortError();
      }
      this.player = null;
    }

    if (this.mount) {
      this.mount.innerHTML = "";
      this.mount = null;
    }

    if (monitoringEnabled && token) {
      postEnd(token).catch(ignoreBestEffortError);
      postEvents(token, batch, this.opts.videoId, this.opts.enrollmentId).catch(ignoreBestEffortError);
    }
  }
}
