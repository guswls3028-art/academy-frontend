import studentApi from "@student/shared/api/student.api";
import { createPlaybackUnloadConfig } from "@/shared/api/axios";

/** One terminal request for this controller only; never a device/tab-wide revoke. */
export class PlaybackSessionEnd {
  started = false;
  private timer: number | null = null;

  constructor(private readonly currentToken: () => string | null) {}

  private readonly onPageHide = (event: PageTransitionEvent) => {
    // Backgrounding and BFCache persistence are not terminal playback exits.
    if (!event.persisted) this.end(true);
  };

  listen(): void {
    window.addEventListener("pagehide", this.onPageHide);
  }

  private removeListener(): void {
    window.removeEventListener("pagehide", this.onPageHide);
  }

  private end(unloading: boolean, token = this.currentToken()): void {
    if (this.started) return;
    this.removeListener();
    if (!token || token.startsWith("student-")) return;
    this.started = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    const config = unloading ? createPlaybackUnloadConfig() : undefined;
    // Do not wait for an event POST/timer after pagehide: the old document may no
    // longer run that continuation. Server state, not this best-effort call, proves end.
    void studentApi.post("/media/playback/end/", { token }, config).catch(() => undefined);
  }

  finish(flushEvents: () => Promise<void>): void {
    if (this.started) return;
    const token = this.currentToken();
    if (!token || token.startsWith("student-")) {
      this.removeListener();
      return;
    }
    // Preserve the existing bounded SPA flush. Keep pagehide attached until the
    // terminal request starts, including a hard navigation during a pending flush.
    this.timer = window.setTimeout(() => this.end(false, token), 1_000);
    void flushEvents().catch(() => undefined).finally(() => this.end(false, token));
  }
}
