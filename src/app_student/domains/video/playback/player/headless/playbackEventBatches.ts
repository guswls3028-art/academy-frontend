import api, {
  capturePlaybackEventScope, isPlaybackEventScopeCurrent,
  type PlaybackEventScope, type ApiRequestConfig,
} from "@/shared/api/axios";
import { getParentStudentId } from "@/shared/api/parentStudentSelection";
import type { EventType } from "./StudentHlsController";

type PlaybackEvent = { type: EventType; occurred_at: number; payload?: Record<string, unknown> };
type Batch = { batch_id: string; events: PlaybackEvent[] };
type PendingBatch = { value: Batch; bytes: number; sealed: boolean };
type SaveState = "saving" | "retry" | "capacity" | "incomplete" | "expired";
export type PlaybackSaveNotice = { key: number; state: SaveState; count: number; terminal: boolean };

// Packet bounds are NOT a playback limit. Keep many packets pending in this
// document, with headroom to pause only after a sustained delivery failure.
const MAX_EVENTS = 4096;
const MAX_BYTES = 1024 * 1024;
const SOFT_EVENTS = MAX_EVENTS - 256;
const SOFT_BYTES = MAX_BYTES - 64 * 1024;
const BATCH_BYTES = 7600; // below server normalized 8KiB, including numeric encoding headroom
const BODY_BYTES = 48 * 1024;
const writers = new Set<PlaybackEventBatches>();
const subscribers = new Set<() => void>();
let ordinal = 0;
let keepaliveBytes = 0;
let snapshot: readonly PlaybackSaveNotice[] = [];
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const value = crypto.getRandomValues(new Uint8Array(16));
  value[6] = (value[6] & 15) | 64;
  value[8] = (value[8] & 63) | 128;
  const hex = Array.from(value, (n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function publish() {
  snapshot = [...writers].flatMap((writer) => writer.notice());
  subscribers.forEach((subscriber) => subscriber());
}
export const subscribePlaybackSaves = (subscriber: () => void) => {
  subscribers.add(subscriber);
  return () => { subscribers.delete(subscriber); };
};
export const getPlaybackSaveSnapshot = () => snapshot;
export function syncPlaybackSaveScope() {
  for (const writer of writers) writer.checkScope();
  publish();
}
export function retryPlaybackSaves() {
  for (const writer of writers) if (writer.notice().length) void writer.flush();
}
export function finishPlaybackSaves() {
  for (const writer of writers) writer.finish();
}
export function dismissPlaybackSave(key: number) {
  for (const writer of writers) if (writer.key === key) writer.dismiss();
}
export function acquirePlaybackEventBatches(token: string, expiresAt: number, sessionId: string, onPressure: (terminal?: boolean) => void) {
  const scope = capturePlaybackEventScope();
  for (const writer of writers) {
    if (writer.sessionId === sessionId && writer.scope.studentId === scope.studentId && writer.checkScope()
      && writer.reattach(token, expiresAt, onPressure)) return writer;
  }
  return new PlaybackEventBatches(token, expiresAt, sessionId, onPressure);
}

/** Document-memory only; owns immutable receipts across a controller's SPA disposal. */
export class PlaybackEventBatches {
  readonly key = ++ordinal;
  readonly scope: PlaybackEventScope = capturePlaybackEventScope();
  finishing = false;
  private pending: PendingBatch[] = [];
  private token: string;
  private expiresAt: number;
  private stopped = false;
  private incomplete = false;
  private state: SaveState | null = null;
  private inFlight: Promise<void> | null = null;
  private timer: number | null = null;
  private expiryTimer: number | null = null;
  private attempt = 0;
  private abort = new AbortController();
  private finalSent = false;
  private finishGeneration = 0;

  constructor(token: string, expiresAt: number, readonly sessionId: string, private onPressure: (terminal?: boolean) => void) {
    this.token = token;
    this.expiresAt = expiresAt;
    writers.add(this);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("pagehide", this.onPageHide);
    this.scheduleExpiry();
  }

  private readonly onOnline = () => { void this.flush(); };
  private readonly onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) this.finish(true);
  };

  private totals() {
    return this.pending.reduce((sum, batch) => ({ count: sum.count + batch.value.events.length, size: sum.size + batch.bytes }), { count: 0, size: 0 });
  }
  notice(): PlaybackSaveNotice[] {
    if (!this.state || !isPlaybackEventScopeCurrent(this.scope) || this.scope.studentId !== getParentStudentId()) return [];
    return [{ key: this.key, state: this.state, count: this.totals().count, terminal: this.stopped }];
  }
  checkScope(): boolean {
    if (isPlaybackEventScopeCurrent(this.scope)) return true;
    this.release();
    return false;
  }
  private scheduleExpiry() {
    if (this.expiryTimer !== null) window.clearTimeout(this.expiryTimer);
    this.expiryTimer = window.setTimeout(() => {
      if (Date.now() < this.expiresAt * 1000) { this.scheduleExpiry(); return; }
      this.expire();
    }, Math.max(0, Math.min(this.expiresAt * 1000 - Date.now(), 2_147_000_000)));
  }
  setToken(token: string, expiresAt: number) {
    if (this.stopped || !this.checkScope()) return;
    this.token = token;
    this.expiresAt = expiresAt;
    this.scheduleExpiry();
    if (this.state === "expired" && expiresAt * 1000 > Date.now()) {
      this.state = this.incomplete ? "incomplete" : "retry";
      void this.flush();
    }
  }
  reattach(token: string, expiresAt: number, onPressure: (terminal?: boolean) => void): boolean {
    if (this.stopped || this.finalSent) return false;
    this.finishGeneration++;
    this.finishing = false;
    this.onPressure = onPressure;
    this.setToken(token, expiresAt);
    if (this.state === "saving") this.state = null;
    publish();
    return true;
  }
  dismiss() {
    if (this.stopped) this.release();
  }
  private expire() {
    if (this.finishing) { this.stop("expired"); return; }
    // A still-mounted player may receive a valid, already-issued same-session
    // renewal after the old token timer fires. Retain its bounded records.
    this.state = this.incomplete ? "incomplete" : "expired";
    this.onPressure();
    publish();
  }

  enqueue(event: PlaybackEvent): void {
    if (this.finishing || this.stopped || !this.checkScope()) return;
    let copy: PlaybackEvent;
    try {
      // Freeze caller-owned payloads before they can change a retry's fingerprint.
      copy = JSON.parse(JSON.stringify({ ...event, occurred_at: Math.floor(event.occurred_at), payload: event.payload ?? {} }));
    } catch { this.captureFailed(); return; }
    const last = this.pending[this.pending.length - 1];
    let target = last && !last.sealed && last.value.events.length < 50 ? last : undefined;
    if (target && bytes({ ...target.value, events: [...target.value.events, copy] }) > BATCH_BYTES) target = undefined;
    const value: Batch = target
      ? { ...target.value, events: [...target.value.events, copy] }
      : { batch_id: uuid(), events: [copy] };
    const size = bytes(value);
    const all = [...writers].reduce((sum, writer) => {
      const total = writer.totals(); return { count: sum.count + total.count, size: sum.size + total.size };
    }, { count: 0, size: 0 });
    const nextSize = all.size + size - (target?.bytes ?? 0);
    if (size > BATCH_BYTES || all.count + 1 > MAX_EVENTS || nextSize > MAX_BYTES) {
      this.captureFailed(); return;
    }
    if (target) { target.value = value; target.bytes = size; }
    else this.pending.push({ value, bytes: size, sealed: false });
    if (all.count + 1 >= SOFT_EVENTS || nextSize >= SOFT_BYTES) {
      this.state = this.incomplete ? "incomplete" : "capacity";
      this.onPressure();
      publish();
    }
  }
  private captureFailed() {
    // Retained records remain retryable. A real capture gap cannot be repaired by
    // ACKing only those records, so never show a complete save or send a false end.
    this.incomplete = true;
    this.state = "incomplete";
    this.onPressure();
    publish();
  }

  private finalBody() {
    const batches = this.pending.map((batch) => batch.value);
    const body = { token: this.token, batches };
    return !this.incomplete && batches.length <= 8 && this.totals().count <= 200 && bytes(body) <= BODY_BYTES ? body : null;
  }
  private acknowledge(data: unknown, sent: Batch[], final: boolean) {
    const result = data as { protocol_version?: unknown; session_status?: unknown; inserted_count?: unknown; acknowledgements?: Array<{ batch_id?: unknown; event_count?: unknown; duplicate?: unknown }> } | null;
    const acknowledgements = result?.acknowledgements;
    if (result?.protocol_version !== 2 || !["ACTIVE", "ENDED", "REVOKED", "EXPIRED"].includes(String(result.session_status))
      || !Number.isInteger(result.inserted_count) || Number(result.inserted_count) < 0
      || !Array.isArray(acknowledgements) || acknowledgements.length !== sent.length
      || new Set(acknowledgements.map((ack) => ack.batch_id)).size !== sent.length
      || sent.some((batch) => !acknowledgements.some((ack) => ack.batch_id === batch.batch_id
        && ack.event_count === batch.events.length && typeof ack.duplicate === "boolean"))
      || result.inserted_count !== acknowledgements.reduce((count, ack) => count + (ack.duplicate ? 0 : Number(ack.event_count)), 0)
      || (final && result.session_status === "ACTIVE")) throw new Error("invalid_playback_receipt");
    const ids = new Set(sent.map((batch) => batch.batch_id));
    this.pending = this.pending.filter((batch) => !ids.has(batch.value.batch_id));
    if (result.session_status === "REVOKED" || result.session_status === "EXPIRED") {
      this.onPressure(true);
      this.stop("expired");
      return;
    }
    if (final || (result.session_status === "ENDED" && !this.pending.length && !this.incomplete)) { this.release(); return; }
    if (result.session_status === "ENDED") { this.stop("expired"); return; }
    this.attempt = 0;
    this.state = this.incomplete ? "incomplete" : this.finishing ? "saving" : null;
    publish();
  }

  private async send(final: boolean, unloading = false): Promise<boolean> {
    if (this.stopped || !this.checkScope()) return false;
    if (Date.now() >= this.expiresAt * 1000) { this.expire(); return false; }
    const body = final ? this.finalBody() : this.pending[0] ? { token: this.token, batch: this.pending[0].value } : null;
    if (!body) return false;
    const size = bytes(body);
    if (size > BODY_BYTES || (unloading && keepaliveBytes + size > BODY_BYTES)) {
      this.state = this.incomplete ? "incomplete" : "retry";
      this.scheduleRetry();
      publish();
      return false;
    }
    const sent = "batches" in body ? body.batches : [body.batch];
    sent.forEach((value) => { const batch = this.pending.find((item) => item.value.batch_id === value.batch_id); if (batch) batch.sealed = true; });
    if (unloading) keepaliveBytes += size;
    if (final) this.finalSent = true;
    try {
      const config: ApiRequestConfig = {
        playbackEventScope: this.scope, ...(unloading ? { playbackUnload: true as const } : {}),
        signal: this.abort.signal, timeout: 15_000,
      };
      const response = await api.post(`/media/playback/v2/${final ? "end" : "events"}/`, body, config);
      if (!this.stopped && this.checkScope()) this.acknowledge(response.data, sent, final);
      return true;
    } catch (error: unknown) {
      if (!this.stopped && this.checkScope()) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 409) { this.onPressure(true); this.stop("expired"); return false; }
        this.state = this.incomplete ? "incomplete" : "retry";
        this.scheduleRetry();
        publish();
      }
      return false;
    } finally {
      if (unloading) keepaliveBytes -= size;
    }
  }
  private scheduleRetry() {
    if (this.timer !== null || this.stopped) return;
    const delay = [2_000, 5_000, 10_000, 30_000][Math.min(this.attempt++, 3)];
    this.timer = window.setTimeout(() => { this.timer = null; void this.flush(); }, delay);
  }
  flush(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (this.stopped || !this.checkScope()) return Promise.resolve();
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.inFlight = (async () => {
      while (!this.stopped) {
        if (this.finishing && this.finalBody()) { await this.send(true); return; }
        if (!this.pending.length || !await this.send(false)) return;
      }
    })().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  finish(unloading = false) {
    if (this.stopped) return;
    this.finishing = true;
    this.onPressure = () => {};
    this.state = this.incomplete ? "incomplete" : "saving";
    publish();
    if (unloading) {
      // Include in-flight, unacknowledged batches too: exact receipts make an
      // overtaken/lost ordinary POST safe. Never partial-end or token-only fallback.
      if (this.finalBody()) void this.send(true, true);
      else { this.state = this.incomplete ? "incomplete" : "retry"; publish(); }
    } else {
      // React effect cleanup/remount can retain this exact session before any
      // terminal POST starts. Real route exits still flush in the same task turn.
      const generation = ++this.finishGeneration;
      void Promise.resolve().then(() => {
        if (this.finishing && generation === this.finishGeneration) void this.flush();
      });
    }
  }
  private stop(state: SaveState) {
    this.release(false);
    this.state = this.incomplete ? "incomplete" : state;
    publish();
  }
  private release(remove = true) {
    this.stopped = true;
    this.abort.abort();
    this.token = "";
    this.pending = [];
    this.onPressure = () => {};
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (this.expiryTimer !== null) window.clearTimeout(this.expiryTimer);
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("pagehide", this.onPageHide);
    if (remove) writers.delete(this);
    publish();
  }
}
