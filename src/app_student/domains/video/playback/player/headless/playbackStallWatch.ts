const STALL_MS = 10_000;
const PROGRESS_SECONDS = 0.05;

/** A network response or "playing" event alone does not prove the playhead recovered. */
export class PlaybackStallWatch {
  private timer: ReturnType<typeof setInterval> | null = null;
  private checkpoint: { position: number; at: number } | null = null;
  private restarted = false;

  constructor(
    private readonly readPosition: () => number | null,
    private readonly onStall: (exhausted: boolean) => void,
    private readonly onRecovery: () => void,
  ) {}

  get retrying() { return this.restarted; }

  start() {
    if (this.timer !== null) return;
    this.timer = setInterval(this.check, 1_000);
  }

  resetSample() {
    this.checkpoint = null;
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.checkpoint = null;
    this.restarted = false;
  }

  private check = () => {
    const position = this.readPosition();
    if (position === null) {
      this.checkpoint = null;
      return;
    }
    const now = performance.now();
    const previous = this.checkpoint;
    if (!previous || Math.abs(position - previous.position) >= PROGRESS_SECONDS) {
      this.checkpoint = { position, at: now };
      if (previous && position > previous.position && this.restarted) {
        this.restarted = false;
        this.onRecovery();
      }
      return;
    }
    if (now - previous.at < STALL_MS) return;
    const exhausted = this.restarted;
    if (exhausted) this.stop();
    else {
      this.restarted = true;
      this.checkpoint = { position, at: now };
    }
    this.onStall(exhausted);
  };
}
