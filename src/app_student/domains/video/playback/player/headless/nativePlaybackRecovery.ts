/** A native HLS load can fail before the playhead watchdog starts. */
export class NativePlaybackRecovery {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private failed = false;

  get active() { return this.timeout !== null; }

  clear() {
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
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
    if (code === 2 && retryAllowed && !this.active) {
      this.timeout = setTimeout(fail, 10_000);
      reload();
    } else {
      fail();
    }
  }
}
