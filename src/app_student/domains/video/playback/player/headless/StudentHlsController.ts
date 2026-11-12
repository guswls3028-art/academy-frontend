/**
 * Headless HLS controller — owns ALL imperative lifecycle.
 * Hls.js / HTMLVideoElement events / timers live here, NOT in React.
 * After dispose(), zero callbacks can run — guards enforce no setState from video events.
 */
import { postEvents, postHeartbeat, postRefresh } from "./playbackTransport";
import { prepareReviewPlayback, REVIEW_EXHAUSTED } from "../../../api/reviewWatch.api";
import type Hls from "hls.js";
import type { ErrorData, LevelSwitchedData } from "hls.js";
import { clamp, getEpochSec } from "../design/utils";
import { resolveStudentVideoPlayUrl } from "../playbackUrl";
import { PlaybackSessionEnd } from "./playbackSessionEnd";
import { PlaybackStallWatch } from "./playbackStallWatch";
import { NativePlaybackRecovery } from "./nativePlaybackRecovery";
import { hlsErrorDetails } from "./hlsErrorDetails";
import { capturePlaybackSource, describeQualityLevels, restorePlaybackSource, type PlaybackSourceSnapshot } from "./playbackMediaSettings";
import { normalizeControllerPolicy as normalizePolicy } from "./controllerTypes";
import type { ControllerOptions, ControllerState, EventType, Policy } from "./controllerTypes";
export type { ControllerOptions, ControllerState, EventType, Policy, QualityLevel } from "./controllerTypes";
import { acquirePlaybackEventBatches, type PlaybackEventBatches } from "./playbackEventBatches";

const ignoreBestEffortError = () => undefined;

type Listener = (state: ControllerState) => void;

export class StudentHlsController {
  private el: HTMLVideoElement | null = null;
  private hls: Hls | null = null;
  private playGeneration = 0;
  private pendingPreparation: Promise<number> = Promise.resolve(0);
  private nativeGestureUntil = 0;
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
  private stallWatch: PlaybackStallWatch | null = null;
  private nativeRecovery = new NativePlaybackRecovery();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 4;

  private maxWatchedRef = 0;
  private lastTimeRef = 0;
  private seekGuardRef = { blocking: false, lastWarnAt: 0, initialSeekActive: false };
  private eventQueue: Array<{ type: EventType; occurred_at: number; payload?: Record<string, unknown> }> = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private videoListeners: Array<{ ev: string; fn: EventListener }> = [];
  private docCleanups: Array<() => void> = [];
  private tokenRef: string;
  private playbackEnd: PlaybackSessionEnd;
  private readonly eventBatches?: PlaybackEventBatches;
  private initialPositionApplied = false;
  private pendingSourceResume: PlaybackSourceSnapshot | null = null;

  constructor(opts: ControllerOptions) {
    this.opts = opts;
    this.policy = normalizePolicy(opts.policy);
    this.tokenRef = opts.token;
    if (opts.eventProtocolVersion === 2 && this.policy.monitoring_enabled && opts.sessionId && opts.expiresAt) {
      this.eventBatches = acquirePlaybackEventBatches(opts.token, opts.expiresAt, opts.sessionId, (terminal) => {
        this.pause();
        if (terminal) this.opts.onFatal?.("session_inactive");
      });
    }
    this.playbackEnd = new PlaybackSessionEnd(() => this.policy.monitoring_enabled ? this.tokenRef : null, this.eventBatches);
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
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): ControllerState {
    return { ...this.state };
  }

  getVideoEl(): HTMLVideoElement | null {
    return this.el;
  }

  getMaxWatched(): number {
    return Math.max(0, this.maxWatchedRef);
  }

  play() {
    if (this.disposed || !this.el) return;
    if (this.opts.reviewStream) {
      const generation = ++this.playGeneration;
      if (performance.now() < this.nativeGestureUntil) this.playPreparedMedia(generation);
      else void this.startReviewPlayback(generation, this.opts.reviewStream);
      return;
    }
    try {
      this.el.play()?.catch(ignoreBestEffortError);
    } catch {
      ignoreBestEffortError();
    }
  }

  private playPreparedMedia(generation: number) {
    this.el?.play()?.catch((error: DOMException) => {
      if (this.disposed || generation !== this.playGeneration) return;
      if (error.name === "NotAllowedError") {
        this.nativeGestureUntil = performance.now() + 15_000;
        this.showToast("재생 준비가 끝났어요. 재생을 눌러 주세요.", "info");
      }
    });
  }

  private async startReviewPlayback(generation: number, stream: string, seekTo?: number) {
    try {
      const position = seekTo ?? (this.el?.readyState ? this.el.currentTime : this.opts.initialPosition || 0);
      // Serialize admission: a slow earlier drag must never replace the grant for the final playhead.
      this.pendingPreparation = this.pendingPreparation.catch(() => 0).then(() =>
        this.disposed || generation !== this.playGeneration ? 0 :
          prepareReviewPlayback(this.opts.videoId, this.opts.enrollmentId, stream, position));
      const wait = await this.pendingPreparation;
      if (this.disposed || generation !== this.playGeneration) return;
      if (wait > 0) {
        this.showToast(`약 ${Math.ceil(wait / 1000)}초 후 재생을 준비합니다.`, "info");
        this.timeouts.push(setTimeout(() => {
          if (!this.disposed && generation === this.playGeneration) void this.startReviewPlayback(generation, stream, seekTo);
        }, wait + 50));
        return;
      }
      if (!this.hls && this.el && !this.el.getAttribute("src")) {
        const url = resolveStudentVideoPlayUrl(this.opts.playUrl || "");
        if (!url) throw new Error("Invalid review playback URL");
        this.el.src = url;
      }
      if (seekTo !== undefined && this.el) {
        this.el.currentTime = position;
        if (!this.el.paused) this.hls?.startLoad(position);
      } else {
        this.hls?.startLoad(position);
        this.playPreparedMedia(generation);
      }
    } catch (error) {
      if (!this.disposed && generation === this.playGeneration) {
        this.opts.onFatal?.(error instanceof Error && error.message === REVIEW_EXHAUSTED ?
          REVIEW_EXHAUSTED : "복습 재생 권한을 확인하지 못했습니다. 다시 열어 주세요.");
      }
    }
  }

  pause() {
    if (this.disposed || !this.el) return;
    this.playGeneration++;
    this.nativeGestureUntil = 0;
    if (this.pendingSourceResume) this.pendingSourceResume.wasPlaying = false;
    if (this.stallWatch?.retrying || this.pendingSourceResume) {
      this.setState({ playing: false, buffering: false, reconnecting: false });
    }
    this.stallWatch?.stop();
    if (this.opts.reviewStream) this.hls?.stopLoad();
    try {
      this.el.pause();
    } catch {
      ignoreBestEffortError();
    }
  }

  seek(t: number) {
    if (this.disposed || !this.el) return;
    const d = Number(this.el.duration) || 0;
    const safe = clamp(t, 0, Math.max(0, d));
    if (this.opts.reviewStream) {
      this.nativeGestureUntil = 0;
      void this.startReviewPlayback(++this.playGeneration, this.opts.reviewStream, safe);
      return;
    }
    try {
      this.el.currentTime = safe;
    } catch {
      ignoreBestEffortError();
    }
  }

  seekApprovedForward(t: number) {
    if (this.disposed || !this.el) return;
    const duration = Number(this.el.duration) || 0;
    const target = clamp(t, 0, Math.max(0, duration));
    this.seekGuardRef.initialSeekActive = true;
    this.maxWatchedRef = Math.max(this.maxWatchedRef, target);
    this.lastTimeRef = target;
    try {
      this.el.currentTime = target;
      this.setState({ current: target });
    } catch {
      ignoreBestEffortError();
    }
    setTimeout(() => { this.seekGuardRef.initialSeekActive = false; }, 200);
  }

  setRate(r: number) {
    if (this.disposed || !this.el) return;
    const maxRate = Math.max(1, Number(this.policy.playback_rate?.max) || 1);
    const speedLocked = this.policy.playback_rate?.ui_control === false || maxRate <= 1.0001;
    if (speedLocked) {
      try {
        this.el.playbackRate = 1;
      } catch {
        ignoreBestEffortError();
      }
      this.guard(() => this.setState({ rate: 1, toast: { text: "배속 변경이 제한되어 있습니다.", kind: "warn" } }));
      this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: 1 });
      return;
    }
    const rr = clamp(r, 0.25, maxRate);
    try {
      this.el.playbackRate = rr;
    } catch {
      ignoreBestEffortError();
    }
    this.guard(() => this.setState({ rate: rr }));
  }

  setVolume(v: number) {
    if (this.disposed || !this.el) return;
    const vv = clamp(v, 0, 1);
    this.setState({ volume: vv, muted: vv <= 0.0001 });
    try {
      this.el.volume = vv;
      this.el.muted = vv <= 0.0001;
    } catch {
      ignoreBestEffortError();
    }
  }

  setMuted(m: boolean) {
    if (this.disposed || !this.el) return;
    this.setState({ muted: m });
    try {
      this.el.muted = m;
    } catch {
      ignoreBestEffortError();
    }
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

  setToken(token: string, expiresAt?: number | null) {
    this.tokenRef = token;
    if (expiresAt && this.policy.monitoring_enabled) this.eventBatches?.setToken(token, expiresAt);
  }

  setPolicy(policy: Partial<Policy> | null | undefined) {
    if (this.disposed) return;
    const next = normalizePolicy(policy);
    const monitoringChanged = this.policy.monitoring_enabled !== next.monitoring_enabled;
    if (this.policy.monitoring_enabled && !next.monitoring_enabled) {
      // finish captures the old token before the caller rotates it; media stays attached.
      this.playbackEnd.finish(() => this.flushEvents());
      this.playbackEnd = new PlaybackSessionEnd(() => this.policy.monitoring_enabled ? this.tokenRef : null);
      this.playbackEnd.listen();
    }
    this.policy = next;
    if (monitoringChanged) {
      this.intervals.forEach(clearInterval);
      this.intervals = [];
      this.startIntervals();
    }
  }
  setSource(playUrl: string) {
    if (this.disposed || !playUrl || playUrl === this.opts.playUrl) return;
    this.reloadSource(playUrl);
  }

  private reloadSource(playUrl: string) {
    const url = resolveStudentVideoPlayUrl(playUrl);
    if (!url) {
      this.opts.onFatal?.("잘못된 재생 URL 형식입니다.");
      return;
    }
    const previousPlayUrl = this.opts.playUrl;
    const el = this.el;
    if (!el) return;

    this.pendingSourceResume ??= capturePlaybackSource(el, this.state);
    if (!this.state.ready) {
      this.pendingSourceResume.position = Number(this.opts.initialPosition || 0);
    }
    this.setState({ buffering: true });
    try {
      if (this.hls) {
        this.hls.loadSource(url);
        this.hls.startLoad?.(this.pendingSourceResume.position);
      } else {
        el.src = url;
        el.load();
      }
      this.opts.playUrl = playUrl;
    } catch {
      this.pendingSourceResume = null;
      this.opts.playUrl = previousPlayUrl;
      this.opts.onFatal?.("새 재생 권한을 영상에 적용하지 못했습니다.");
    }
  }

  private resumeAfterSourceRefresh() {
    const pending = this.pendingSourceResume;
    const el = this.el;
    if (!pending || !el || this.disposed) return;
    this.pendingSourceResume = null;
    this.seekGuardRef.initialSeekActive = true;
    this.maxWatchedRef = Math.max(this.maxWatchedRef, pending.position);
    this.lastTimeRef = pending.position;
    try {
      restorePlaybackSource(el, pending, this.hls);
      if (pending.wasPlaying) {
        el.play()?.catch(() => {
          if (this.disposed || this.pendingSourceResume || !el.paused
            || (!this.stallWatch?.retrying && !this.nativeRecovery.active)) return;
          this.stallWatch?.stop();
          this.nativeRecovery.clear();
          this.setState({ playing: false, buffering: false, reconnecting: false });
          this.showToast("재생을 눌러 보던 위치부터 이어보세요.", "info");
        });
      }
    } catch {
      ignoreBestEffortError();
    }
    this.setState({
      current: pending.position,
      rate: pending.rate,
      volume: pending.volume,
      muted: pending.muted,
      buffering: false,
    });
    this.stallWatch?.resetSample();
    const releaseGuard = setTimeout(() => {
      this.seekGuardRef.initialSeekActive = false;
    }, 200);
    this.timeouts.push(releaseGuard);
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
    } catch {
      ignoreBestEffortError();
    }
  }

  private publishQualities() {
    if (this.disposed || !this.hls) return;
    this.setState({ qualities: describeQualityLevels(this.hls.levels) });
  }

  private recoverStall(exhausted: boolean) {
    const terminal = exhausted || Boolean(this.opts.reviewStream);
    this.queueEvent("PLAYER_ERROR", { details: "playhead_stall", fatal: terminal });
    if (terminal) {
      this.pause();
      this.opts.onFatal?.("영상 재생이 멈췄어요. 다시 시도해 보던 위치에서 이어보세요.");
      return;
    }
    // Do not compete with an already scheduled Hls.js fatal retry.
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.setState({ buffering: true, reconnecting: true, toast: null });
    this.reloadSource(this.opts.playUrl);
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

  private queueEvent(type: EventType, payload?: Record<string, unknown>) {
    if (this.disposed || this.playbackEnd.started) return;
    const monitoringEnabled = this.policy.monitoring_enabled ?? false;
    if (!monitoringEnabled) return;
    const violationEvents: EventType[] = ["SEEK_ATTEMPT", "SPEED_CHANGE_ATTEMPT"];
    const isViolation = violationEvents.includes(type);
    if (this.policy.access_mode === "FREE_REVIEW" && isViolation) return;
    const now = getEpochSec();
    if (this.eventBatches) {
      this.eventBatches.enqueue({ type, occurred_at: now, payload: payload || {} });
      return;
    }
    this.eventQueue.push({ type, occurred_at: now, payload: payload || {} });
    if (this.eventQueue.length > 300) this.eventQueue.splice(0, this.eventQueue.length - 300);
  }

  private flushEvents = async () => {
    if (this.disposed || this.playbackEnd.started) return;
    if (this.eventBatches) { await this.eventBatches.flush(); return; }
    const token = this.tokenRef;
    if (!token) return;
    const batch = this.eventQueue.splice(0, this.eventQueue.length);
    if (!batch.length) return;
    try {
      await postEvents(token, batch, this.opts.videoId, this.opts.enrollmentId);
    } catch (e: unknown) {
      if (this.disposed || token !== this.tokenRef) return;
      const err = e as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const msg = err?.response?.data?.detail || err?.message || "";
      if (String(msg).includes("session_inactive") || err?.response?.status === 409) {
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
        postHeartbeat(token).catch((e: unknown) => {
          if (this.disposed) return;
          const err = e as { response?: { data?: { detail?: string }; status?: number }; message?: string };
          const msg = err?.response?.data?.detail || err?.message || "";
          if (String(msg).includes("policy_changed")) {
            this.setState({ toast: { text: "정책이 변경되어 재생이 종료되었습니다.", kind: "danger" } });
            this.opts.onFatal?.("policy_changed");
          } else if (String(msg).includes("session_inactive") || err?.response?.status === 409) {
            this.setState({ toast: { text: "재생 세션이 종료되었습니다.", kind: "danger" } });
            this.opts.onFatal?.("session_inactive");
          }
        });
      });
    }, 30000);
    this.intervals.push(id2);
  }

  private startDocListeners() {
    this.playbackEnd.listen();
    const onVis = () => {
      if (this.disposed) return;
      this.stallWatch?.resetSample();
      if (document.hidden) {
        this.flushProgress();
        this.queueEvent("VISIBILITY_HIDDEN", { hidden: true });
      } else {
        this.queueEvent("VISIBILITY_VISIBLE", { hidden: false });
        if (this.policy.monitoring_enabled) {
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
    const pending = this.pendingSourceResume;
    const currentTime = pending?.position ?? Number(this.el.currentTime || 0);
    const maxWatched = Math.max(0, this.maxWatchedRef);
    const dur = pending ? this.state.duration : Number(this.el.duration);
    // Do not overwrite server progress with a synthetic 0% before metadata is ready.
    if (!(dur > 0 && Number.isFinite(dur))) return;
    const baselineProgress = Math.min(100, Math.max(0, Number(this.opts.initialProgress) || 0));
    const progressPercent = Math.max(baselineProgress, Math.min(100, (maxWatched / dur) * 100));
    const completed = baselineProgress >= 100 || maxWatched >= dur - 0.5;
    this.opts.onLeaveProgress({ progress: progressPercent, last_position: Math.round(currentTime), completed });
  }

  private lastSavedPosition = -1;
  private flushProgressIfChanged() {
    if (this.disposed || !this.el) return;
    const cur = Math.round(this.pendingSourceResume?.position ?? Number(this.el.currentTime || 0));
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
    } catch {
      ignoreBestEffortError();
    }
    el.removeAttribute("src");

    const url = resolveStudentVideoPlayUrl(this.opts.playUrl || "");
    if (!url) {
      this.opts.onFatal?.("재생 URL이 제공되지 않았습니다.");
      return;
    }

    const canNative =
      el.canPlayType("application/vnd.apple.mpegurl") || el.canPlayType("application/x-mpegURL");

    if (canNative) {
      if (this.opts.reviewStream) this.setState({ ready: true });
      else el.src = url;
      this.bindVideoEvents();
      this.startIntervals();
      this.startDocListeners();
      return;
    }

    try {
      const mod = await import("hls.js");
      if (this.disposed || this.el !== el) return;
      const Hls = mod.default;

      if (Hls && Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: false,
          autoStartLoad: !this.opts.reviewStream,
          backBufferLength: 30,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          startLevel: -1,
          abrEwmaDefaultEstimate: 20_000_000,
          abrEwmaDefaultEstimateMax: 50_000_000,
        });
        this.hls = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (this.disposed) return;
          if (this.opts.reviewStream) this.setState({ ready: true });
          this.publishQualities();
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (this.disposed) return;
          if (this.reconnectAttempts > 0) {
            this.reconnectAttempts = 0;
          }
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data: LevelSwitchedData) => {
          if (this.disposed) return;
          // ABR(Auto) 상태에서는 currentQuality는 -1로 유지
          if ((this.hls?.autoLevelEnabled ?? true) === true) {
            if (this.state.currentQuality !== -1) this.setState({ currentQuality: -1 });
          } else if (typeof data?.level === "number" && data.level !== this.state.currentQuality) {
            this.setState({ currentQuality: data.level });
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
          if (this.disposed) return;
          try {
            this.queueEvent("PLAYER_ERROR", {
              fatal: !!data?.fatal,
              details: data?.details || "",
              type: data?.type || "",
            });
          } catch {
            ignoreBestEffortError();
          }

          if (!data?.fatal) return;

          const { detail: errorMsg, is404, isServiceAuthError, isServiceUnavailable, isNetworkError, isMediaError } =
            hlsErrorDetails(data, Hls.ErrorTypes.NETWORK_ERROR, Hls.ErrorTypes.MEDIA_ERROR);

          if (is404) {
            this.setState({
              toast: { text: "비디오 파일을 찾을 수 없습니다. 처리 중이거나 업로드되지 않았을 수 있습니다.", kind: "danger" },
              reconnecting: false,
            });
            this.opts.onFatal?.("비디오 파일을 찾을 수 없습니다.");
            return;
          }

          // CDN 인증 실패는 같은 URL 재시도로 복구되지 않는다. 학생 네트워크
          // 문제로 안내하지 말고 페이지가 새 재생 URL을 요청할 수 있게 종료한다.
          if (isServiceAuthError) {
            const message = "영상 서비스 인증에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
            this.setState({
              toast: { text: message, kind: "danger" },
              reconnecting: false,
            });
            this.opts.onFatal?.(message);
            return;
          }

          if (!this.stallWatch?.retrying && (isNetworkError || isMediaError) && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.scheduleReconnect(isMediaError ? "media" : "network");
            return;
          }

          const message = isServiceUnavailable
            ? "영상 서비스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
            : isNetworkError
            ? "영상 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요."
            : `재생 오류가 발생했습니다: ${errorMsg}`;
          this.setState({ toast: { text: message, kind: "danger" }, reconnecting: false });
          this.opts.onFatal?.(message);
        });

        hls.loadSource(url);
        hls.attachMedia(el);
      } else if (!this.opts.reviewStream) {
        el.src = url;
      } else {
        this.setState({ ready: true });
      }
    } catch {
      if (this.opts.reviewStream) this.setState({ ready: true });
      else el.src = url;
    }

    this.bindVideoEvents();
    this.startIntervals();
    this.startDocListeners();
  }

  private bindVideoEvents() {
    const el = this.el;
    if (!el) return;

    const maxRate = Math.max(1, Number(this.policy.playback_rate?.max) || 1);
    const speedLocked = this.policy.playback_rate?.ui_control === false || maxRate <= 1.0001;

    this.stallWatch = new PlaybackStallWatch(() => {
      if (this.disposed || document.hidden || this.playbackEnd.started || el.ended || el.error) return null;
      if (this.nativeRecovery.active) return null;
      if (this.pendingSourceResume?.wasPlaying) return this.pendingSourceResume.position;
      return el.paused || el.playbackRate <= 0 ? null : el.currentTime;
    }, (exhausted) => this.recoverStall(exhausted), () => {
      this.reconnectAttempts = 0;
      this.setState({ buffering: false, reconnecting: false });
    });

    const onLoadedMeta = () => {
      if (this.disposed) return;
      const d = Number(el.duration || 0);
      if (d && Number.isFinite(d)) this.setState({ duration: d });
      const pending = this.pendingSourceResume;
      if (!this.state.ready && pending && d > 0 && Number.isFinite(d)) {
        pending.position = Math.min(pending.position, Math.max(0, d - 1));
      }
      this.setState({ ready: true, buffering: false });

      // 이어보기: initialPosition이 있으면 해당 위치로 이동 (seek 정책 가드 우회)
      const initPos = this.opts.initialPosition;
      if (!this.initialPositionApplied && initPos && initPos > 1 && d > 0 && Number.isFinite(d)) {
        this.initialPositionApplied = true;
        const safePos = Math.min(initPos, d - 1);
        if (safePos > 1) {
          this.seekGuardRef.initialSeekActive = true;
          this.maxWatchedRef = Math.max(this.maxWatchedRef, safePos);
          try {
            el.currentTime = safePos;
          } catch {
            ignoreBestEffortError();
          }
          // onSeeking 이벤트가 동기적으로 발생하므로 즉시 해제해도 안전
          // 다만 비동기 발생 가능성 대비 짧은 타이머
          setTimeout(() => { this.seekGuardRef.initialSeekActive = false; }, 200);
        }
      }
      this.resumeAfterSourceRefresh();
      if (this.nativeRecovery.active && !pending?.wasPlaying) {
        this.nativeRecovery.clear();
        this.setState({ reconnecting: false });
      }
    };

    const onTime = () => {
      if (this.disposed || this.pendingSourceResume) return;
      const t = Number(el.currentTime || 0);
      const resumed = this.nativeRecovery.active && !el.paused && !el.seeking && t > this.lastTimeRef;
      if (resumed) this.nativeRecovery.clear();
      this.setState(resumed ? { current: t, reconnecting: false } : { current: t });
      this.lastTimeRef = t;
      if (t > this.maxWatchedRef) this.maxWatchedRef = t;
    };

    const onPlay = () => this.guard(() => {
      this.stallWatch?.start();
      this.setState({ playing: true, buffering: el.readyState < el.HAVE_FUTURE_DATA });
    });
    const onPause = () => this.guard(() => {
      if (this.pendingSourceResume?.wasPlaying) return;
      const retrying = this.stallWatch?.retrying;
      this.stallWatch?.stop();
      this.setState({ playing: false, buffering: false, ...(retrying ? { reconnecting: false } : {}) });
    });
    const onWaiting = () => this.setState({ buffering: true });
    const onPlaying = () => this.setState({ buffering: false });
    const onEnded = () => {
      if (this.disposed) return;
      this.stallWatch?.stop();
      const duration = Number(el.duration);
      if (duration > 0 && Number.isFinite(duration)) {
        this.maxWatchedRef = Math.max(this.maxWatchedRef, duration);
      }
      this.setState({ playing: false, buffering: false, current: Number(el.currentTime || 0) });
      this.flushProgress();
      this.opts.onEnded?.();
    };

    const onRateChange = () => {
      if (this.disposed) return;
      const maxRate = Math.max(1, Number(this.policy.playback_rate?.max) || 1);
      const speedLocked = this.policy.playback_rate?.ui_control === false || maxRate <= 1.0001;
      const r = Number(el.playbackRate || 1);
      this.setState({ rate: r });
      if (speedLocked) {
        if (Math.abs(r - 1) > 0.001) {
          try {
            el.playbackRate = 1;
          } catch {
            ignoreBestEffortError();
          }
          this.setState({ toast: { text: "배속 변경이 제한되어 있습니다.", kind: "warn" } });
          this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: 1 });
        }
        return;
      }
      if (r > maxRate + 0.0001) {
        try {
          el.playbackRate = maxRate;
        } catch {
          ignoreBestEffortError();
        }
        this.setState({ toast: { text: `최대 배속은 ${maxRate}x 입니다.`, kind: "warn" } });
        this.queueEvent("SPEED_CHANGE_ATTEMPT", { attempted: r, enforced: maxRate });
      }
    };

    const onSeeking = () => {
      if (this.disposed) return;
      this.stallWatch?.resetSample();
      if (this.seekGuardRef.initialSeekActive) return; // 이어보기 초기 seek 시 가드 우회
      const allowSeek = !!this.policy.allow_seek && this.policy.seek?.mode !== "blocked";
      const seekMode = this.policy.seek?.mode || "free";
      const grace = Math.max(0, Number(this.policy.seek?.grace_seconds ?? 3));
      const boundedForward = seekMode === "bounded_forward";
      const budgetedForward = seekMode === "budgeted_forward";
      if (allowSeek && !boundedForward && !budgetedForward) return;

      const now = Date.now();
      const guard = this.seekGuardRef;
      const target = Number(el.currentTime || 0);
      const maxWatched = this.maxWatchedRef;
      const allowedMax = (boundedForward || budgetedForward) ? maxWatched + grace : maxWatched;
      const isForwardBeyond = target > allowedMax + 0.001;

      if (!allowSeek || seekMode === "blocked") {
        guard.blocking = true;
        try {
          el.currentTime = maxWatched;
        } catch {
          ignoreBestEffortError();
        }
        guard.blocking = false;
        if (now - guard.lastWarnAt > 900) {
          guard.lastWarnAt = now;
          this.setState({ toast: { text: "탐색이 제한된 영상입니다.", kind: "warn" } });
        }
        this.queueEvent("SEEK_ATTEMPT", { mode: "blocked", target, max_watched: maxWatched });
        return;
      }

      if ((boundedForward || budgetedForward) && isForwardBeyond) {
        guard.blocking = true;
        try {
          el.currentTime = allowedMax;
        } catch {
          ignoreBestEffortError();
        }
        guard.blocking = false;
        if (now - guard.lastWarnAt > 900) {
          guard.lastWarnAt = now;
          this.setState({
            toast: {
              text: budgetedForward
                ? "앞으로는 10초 건너뛰기 버튼으로 이동해 주세요."
                : "아직 시청하지 않은 구간으로 이동할 수 없습니다.",
              kind: "warn",
            },
          });
        }
        this.queueEvent("SEEK_ATTEMPT", { mode: seekMode, target, max_watched: maxWatched, grace });
      }
    };

    const onError = () => {
      if (this.disposed) return;
      const elErr: MediaError | null = el.error;
      const errorCode = elErr?.code || 0;
      const errorMessage = elErr?.message || "";
      this.queueEvent("PLAYER_ERROR", { code: errorCode, message: errorMessage });
      // Hls.js reports the HTTP status more reliably than a generic MediaError.
      if (this.hls) return;
      this.nativeRecovery.handleError(errorCode, errorMessage, !this.opts.reviewStream && !this.stallWatch?.retrying, () => {
        this.pendingSourceResume ??= {
          ...capturePlaybackSource(el, this.state),
          wasPlaying: this.state.playing || !el.paused,
        };
        this.setState({ buffering: true, reconnecting: true, toast: null });
        this.reloadSource(this.opts.playUrl);
      }, (message) => {
        this.stallWatch?.stop();
        this.setState({ playing: false, buffering: false, reconnecting: false });
        this.opts.onFatal?.(message);
      });
    };

    this.addVideoListener("loadedmetadata", onLoadedMeta);
    this.addVideoListener("timeupdate", onTime);
    this.addVideoListener("play", onPlay);
    this.addVideoListener("pause", onPause);
    this.addVideoListener("waiting", onWaiting);
    this.addVideoListener("playing", onPlaying);
    this.addVideoListener("ended", onEnded);
    this.addVideoListener("ratechange", onRateChange);
    this.addVideoListener("seeking", onSeeking);
    this.addVideoListener("error", onError);

    try {
      if (speedLocked) el.playbackRate = 1;
      if (maxRate < 1) el.playbackRate = 1;
    } catch {
      ignoreBestEffortError();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.flushProgress(true);

    const token = this.tokenRef;
    const batch = this.eventQueue.splice(0, this.eventQueue.length);
    this.disposed = true;

    this.listeners.clear();
    this.stallWatch?.stop();
    this.nativeRecovery.clear();

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
      } catch {
        ignoreBestEffortError();
      }
      this.hls = null;
    }

    this.playbackEnd.finish(() => postEvents(token, batch, this.opts.videoId, this.opts.enrollmentId));

    this.el = null;
  }
}
