const STALL_MS = 10_000;
const PROGRESS_SECONDS = 0.05;

type PlayheadSample = { position: number; seeking: boolean };

export function readStallPlayhead(
  media: HTMLMediaElement,
  pending: { position: number; wasPlaying: boolean } | null,
): PlayheadSample | null {
  if (media.ended || media.error) return null;
  if (pending?.wasPlaying) return { position: pending.position, seeking: true };
  if (media.paused || media.playbackRate <= 0) return null;
  return { position: media.currentTime, seeking: media.seeking };
}

/** A network response or "playing" event alone does not prove the playhead recovered. */
export class PlaybackStallWatch {
  private timer: ReturnType<typeof setInterval> | null = null;
  private checkpoint: { position: number; at: number } | null = null;
  private seekObserved = false;
  private restarted = false;

  constructor(
    private readonly readPlayhead: () => PlayheadSample | null,
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

  observeSeek() {
    this.seekObserved = true;
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.checkpoint = null;
    this.seekObserved = false;
    this.restarted = false;
  }

  private check = () => {
    const playhead = this.readPlayhead();
    const seeking = this.seekObserved || playhead?.seeking;
    this.seekObserved = false;
    if (!playhead) {
      this.checkpoint = null;
      return;
    }
    const { position } = playhead;
    const now = performance.now();
    const previous = this.checkpoint;
    // Native HLS can repeatedly seek while retrying segments without advancing playback.
    if (!previous || (!seeking && Math.abs(position - previous.position) >= PROGRESS_SECONDS)) {
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
      this.checkpoint = { position: previous.position, at: now };
    }
    this.onStall(exhausted);
  };
}
