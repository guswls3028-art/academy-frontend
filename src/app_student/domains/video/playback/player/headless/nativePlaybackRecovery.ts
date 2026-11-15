/** A native HLS load can fail before the playhead watchdog starts. */
export class NativePlaybackRecovery {
  private retry: {
    timeout: ReturnType<typeof setTimeout>;
    fail: () => void;
    reloaded: boolean;
  } | null = null;
  private source: string | null = null;
  private failed = false;

  get active() { return this.retry !== null; }

  setSource(el: HTMLVideoElement, url: string) {
    const replacing = this.source !== url;
    el.src = url;
    this.source = url;
    if (replacing && this.retry) {
      // A fresh grant has its own recovery window. Reloading the same URL does not extend it.
      const { fail } = this.retry;
      this.clear();
      this.retry = { fail, timeout: setTimeout(fail, 10_000), reloaded: false };
    }
  }

  releaseSource(el: HTMLVideoElement | null) {
    const source = this.source;
    this.source = null;
    if (!el || source === null || el.getAttribute("src") !== source) return;
    try {
      el.pause();
    } finally {
      el.removeAttribute("src");
      // A paused native player can keep buffering until its source is reset.
      el.load();
    }
  }

  clear() {
    if (this.retry) clearTimeout(this.retry.timeout);
    this.retry = null;
  }

  handleError(code: number, detail: string, retryAllowed: boolean, reload: () => void, onFatal: (message: string) => void) {
    if (this.failed || code === 1) return;
    const fail = () => {
      this.clear();
      this.failed = true;
      const missingSource = code === 4 || detail.includes("404") || detail.includes("Not Found");
      onFatal(missingSource
        ? "영상 서비스에서 재생 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        : code === 2 ? "영상 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요."
        : code === 3 ? "비디오 디코딩 오류가 발생했습니다."
        : "재생 오류가 발생했습니다.");
    };
    if (code !== 2 || !retryAllowed || this.retry?.reloaded) {
      fail();
      return;
    }
    this.retry ??= { fail, timeout: setTimeout(fail, 10_000), reloaded: false };
    this.retry.reloaded = true;
    reload();
  }
}
