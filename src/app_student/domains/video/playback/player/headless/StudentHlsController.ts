/**
 * Headless HLS controller — owns ALL imperative lifecycle.
 * Hls.js / HTMLVideoElement events / timers live here, NOT in React.
 * After dispose(), zero callbacks can run — guards enforce no setState from video events.
 */
import studentApi from "@student/shared/api/student.api";
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
    await studentApi.post(`/media/playback/heartbeat/`, { token });
  } catch {}
}

async function postRefresh(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/media/playback/refresh/`, { token });
  } catch {}
}

async function postEnd(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/media/playback/end/`, { token });
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
    await studentApi.post(`/media/playback/events/`, {
      token,
      video_id: videoId,
      enrollment_id: enrollmentId,
      events: events.map((e) => ({ type: e.type, occurred_at: e.occurred_at, payload: e.payload || {} })),
    });
  } catch {}
}

export interface QualityLevel {
  /** hls.js levels[] 인덱스. -1 = Auto(ABR). */
  index: number;
  /** 표시용 라벨 (예: "1080p", "Auto") */
  label: string;
  /** 세로 해상도 (px). Auto는 0. */
  height: number;
  /** 비트레이트 (bps) — 라벨 보조 정보 */
  bitrate: number;
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
  /** HLS 화질 목록 — 첫 항목은 항상 "Auto"(index=-1) */
  qualities: QualityLevel[];
  /** 현재 선택된 level 인덱스. -1 = Auto */
  currentQuality: number;
  /** 자동 재시도 진행 상태 — UI에서 "재연결 중…" 표시용 */
  reconnecting: boolean;
}

export interface ControllerOptions {
  videoId: number;
  playUrl: string;
  policy: any;
  token: string;
  enrollmentId: number | null;
  initialPosition?: number;
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
    qualities: [],
    currentQuality: -1,
    reconnecting: false,
  };

  // HLS fatal 자동 재시도 — exponential backoff
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 4;

  private maxWatchedRef = 0;
  private lastTimeRef = 0;
  private seekGuardRef = { blocking: false, lastWarnAt: 0, initialSeekActive: false };
  private eventQueue: Array<{ type: EventType; occurred_at: number; payload?: any }> = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private videoListeners: Array<{ ev: string; fn: EventListener }> = [];
  private docCleanups: Array<() => void> = [];
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

  /** 화질 선택. -1 = Auto(ABR). 다른 값은 hls.levels[index]. */
  setQuality(index: number) {
    if (this.disposed || !this.hls) return;
    try {
      // hls.js: currentLevel = -1 → ABR, >=0 → 해당 level 강제
      this.hls.currentLevel = index;
      this.setState({ currentQuality: index });
      const label = this.state.qualities.find((q) => q.index === index)?.label || (index === -1 ? "Auto" : `${index}`);
      this.showToast(`화질: ${label}`, "info");
    } catch {}
  }

  private publishQualities() {
    if (this.disposed || !this.hls) return;
    const levels: any[] = Array.isArray(this.hls.levels) ? this.hls.levels : [];
    // 단일 해상도(level 1개 이하) 영상은 화질 선택이 의미 없음 → 빈 배열로 두어 UI 비활성화.
    if (levels.length < 2) {
      this.setState({ qualities: [] });
      return;
    }
    const qs: QualityLevel[] = [{ index: -1, label: "Auto", height: 0, bitrate: 0 }];
    levels.forEach((lv, i) => {
      const h = Number(lv?.height || 0);
      const br = Number(lv?.bitrate || 0);
      const label = h > 0 ? `${h}p` : br > 0 ? `${Math.round(br / 1000)}k` : `Level ${i + 1}`;
      qs.push({ index: i, label, height: h, bitrate: br });
    });
    // 화질 내림차순 (Auto는 맨 위 유지)
    const auto = qs[0];
    const rest = qs.slice(1).sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
    this.setState({ qualities: [auto, ...rest] });
  }

  private scheduleReconnect(kind: "network" | "media") {
    if (this.disposed) return;
    this.reconnectAttempts += 1;
    // 1.2s, 2.4s, 4.8s, 9.6s — exponential backoff (최대 4회)
    const delayMs = Math.min(9_600, 1_200 * Math.pow(2, this.reconnectAttempts - 1));
    this.setState({
      reconnecting: true,
      toast: {
        text: `연결이 끊겼어요. ${Math.round(delayMs / 1000)}초 뒤 다시 시도합니다… (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`,
        kind: "warn",
      },
    });
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disposed || !this.hls) return;
      try {
        if (kind === "media") {
          // recoverMediaError → resume
          this.hls.recoverMediaError?.();
        } else {
          // network: startLoad부터 재시작
          this.hls.startLoad?.();
        }
        // 성공 시 RECONNECT 카운터 리셋은 LEVEL_LOADED/FRAG_BUFFERED 등에서 자연 회복
        this.setState({ reconnecting: false });
      } catch {
        // 재시도 자체가 throw → 한도 초과 처리
        this.setState({
          reconnecting: false,
          toast: { text: "재연결에 실패했습니다. 화면을 새로고침해 주세요.", kind: "danger" },
        });
        this.opts.onFatal?.("reconnect_failed");
      }
    }, delayMs);
    // dispose에서 reconnectTimer는 별도 clear (this.timeouts에 push하지 않음 — 재진입 시 누적 방지)
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
    // 진행률 자동 저장 (30초마다, 모니터링 여부 무관, 5초 미만 변화 시 스킵)
    const saveId = setInterval(() => this.guard(() => this.flushProgressIfChanged()), 30000);
    this.intervals.push(saveId);

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
      if (document.hidden) {
        this.flushProgress();
        this.queueEvent("VISIBILITY_HIDDEN", { hidden: true });
      } else {
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
    this.docCleanups.push(
      () => document.removeEventListener("visibilitychange", onVis),
      () => window.removeEventListener("blur", onBlur),
      () => window.removeEventListener("focus", onFocus)
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

  /**
   * force: true → dispose 시에도 실행 (disposed 가드 무시)
   */
  private flushProgress(force = false) {
    if ((!force && this.disposed) || !this.el || !this.opts.onLeaveProgress) return;
    const currentTime = Number(this.el.currentTime || 0);
    const maxWatched = Math.max(0, this.maxWatchedRef);
    const dur = Number(this.el.duration);
    const progressPercent = dur > 0 && Number.isFinite(dur) ? Math.min(100, (maxWatched / dur) * 100) : 0;
    const completed = dur > 0 && maxWatched >= dur - 0.5;
    // last_position: 현재 재생 위치 (이어보기용), progress: 최대 시청 구간 기반 (진행률용)
    this.opts.onLeaveProgress({
      progress: progressPercent,
      last_position: Math.round(currentTime),
      completed,
    });
  }

  private lastSavedPosition = -1;
  private flushProgressIfChanged() {
    if (this.disposed || !this.el) return;
    const cur = Math.round(Number(this.el.currentTime || 0));
    if (Math.abs(cur - this.lastSavedPosition) < 5) return; // 5초 미만 변화 무시
    this.lastSavedPosition = cur;
    this.flushProgress();
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
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          startLevel: -1,
          abrEwmaDefaultEstimate: 20_000_000,
          abrEwmaDefaultEstimateMax: 50_000_000,
        });
        this.hls = hls;

        // Manifest 파싱 시 화질 목록 수집 → ControllerState에 노출
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (this.disposed) return;
          this.publishQualities();
        });
        // 프래그먼트 1개 정상 버퍼링 시 재시도 카운터 리셋
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (this.disposed) return;
          if (this.reconnectAttempts > 0) {
            this.reconnectAttempts = 0;
          }
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
          if (this.disposed) return;
          // ABR(Auto) 상태에서는 currentQuality는 -1로 유지
          if ((this.hls?.autoLevelEnabled ?? true) === true) {
            if (this.state.currentQuality !== -1) this.setState({ currentQuality: -1 });
          } else if (typeof data?.level === "number" && data.level !== this.state.currentQuality) {
            this.setState({ currentQuality: data.level });
          }
        });

        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (this.disposed) return;
          try {
            this.queueEvent("PLAYER_ERROR", {
              fatal: !!data?.fatal,
              details: data?.details || "",
              type: data?.type || "",
            });
          } catch {}

          if (!data?.fatal) return;
          if (this.disposed) return;

          const errorMsg = data?.details || data?.type || "알 수 없는 오류";
          const errorCode = data?.response?.code ?? data?.code;
          const errorType = data?.type || "";
          const is404 = errorCode === 404 || String(errorMsg).includes("404") || String(errorMsg).includes("Not Found");
          const isNetworkError =
            errorType === Hls.ErrorTypes?.NETWORK_ERROR ||
            errorCode === -1 || errorCode === -2 ||
            String(errorMsg).includes("network") ||
            String(errorMsg).includes("NetworkError") ||
            String(errorMsg).includes("Timeout") ||
            String(errorMsg).includes("manifestLoad");
          const isMediaError = errorType === Hls.ErrorTypes?.MEDIA_ERROR;

          // 404 (원본 누락) — 재시도해도 무의미. 즉시 fatal.
          if (is404) {
            this.setState({
              toast: { text: "비디오 파일을 찾을 수 없습니다. 처리 중이거나 업로드되지 않았을 수 있습니다.", kind: "danger" },
              reconnecting: false,
            });
            this.opts.onFatal?.("비디오 파일을 찾을 수 없습니다.");
            return;
          }

          // 네트워크/미디어 오류 — 자동 재시도(exponential backoff)
          if ((isNetworkError || isMediaError) && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.scheduleReconnect(isMediaError ? "media" : "network");
            return;
          }

          // 한도 초과 또는 알 수 없는 fatal — 사용자에게 알리고 종료
          const message = isNetworkError
            ? "네트워크가 계속 불안정합니다. 인터넷을 확인하고 화면을 새로고침해 주세요."
            : `재생 오류가 발생했습니다: ${errorMsg}`;
          this.setState({ toast: { text: message, kind: "danger" }, reconnecting: false });
          this.opts.onFatal?.(message);
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

      // 이어보기: initialPosition이 있으면 해당 위치로 이동 (seek 정책 가드 우회)
      const initPos = this.opts.initialPosition;
      if (initPos && initPos > 1 && d > 0 && Number.isFinite(d)) {
        const safePos = Math.min(initPos, d - 1);
        if (safePos > 1) {
          this.seekGuardRef.initialSeekActive = true;
          this.maxWatchedRef = Math.max(this.maxWatchedRef, safePos);
          try { el.currentTime = safePos; } catch {}
          // onSeeking 이벤트가 동기적으로 발생하므로 즉시 해제해도 안전
          // 다만 비동기 발생 가능성 대비 짧은 타이머
          setTimeout(() => { this.seekGuardRef.initialSeekActive = false; }, 200);
        }
      }
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
      if (this.seekGuardRef.initialSeekActive) return; // 이어보기 초기 seek 시 가드 우회
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

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.intervals.forEach((intervalId) => clearInterval(intervalId));
    this.intervals = [];
    this.timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.timeouts = [];

    this.removeAllVideoListeners();

    this.docCleanups.forEach((fn) => fn());
    this.docCleanups = [];

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

    this.flushProgress(true);
    this.el = null;
  }
}
