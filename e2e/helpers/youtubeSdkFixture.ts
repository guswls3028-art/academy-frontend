import type { Page } from "@playwright/test";

/** Every intercepted unexpected vendor request is a defect, not successful playback. */
export async function guardUnmockedYouTubeRequests(page: Page) {
  const unexpected: string[] = [];
  await page.route(/^https:\/\/[^/]*youtube(?:-nocookie)?\.com\//, async (route) => {
    unexpected.push(route.request().url());
    await route.abort("blockedbyclient");
  });
  return unexpected;
}

type FixturePlayerSnapshot = {
  videoId: string;
  ready: boolean;
  destroyed: boolean;
  state: number;
  current: number;
  volume: number;
  muted: boolean;
  calls: string[];
};

type FixtureControl = {
  snapshot: () => { sdkReady: number; players: FixturePlayerSnapshot[] };
  emitError: (code: number) => void;
};

function bootYouTubeFixture() {
  type Event = { target: Player; data?: number };
  type Options = {
    videoId: string;
    events?: {
      onReady?: (event: Event) => void;
      onStateChange?: (event: Event) => void;
      onPlaybackRateChange?: (event: Event) => void;
      onError?: (event: Event) => void;
    };
  };
  const sdkWindow = window as unknown as {
    YT: { Player: typeof Player };
    onYouTubeIframeAPIReady?: () => void;
    __academyYouTubeFixture: FixtureControl;
  };
  const players: Player[] = [];
  let sdkReady = 0;

  class Player {
    ready = false;
    destroyed = false;
    state = -1;
    current = 0;
    startedAt = 0;
    rate = 1;
    volume = 100;
    muted = false;
    calls: string[] = [];

    constructor(private element: HTMLElement, private options: Options) {
      players.push(this);
      element.dataset.youtubeSdkFixture = options.videoId;
      // The real SDK resolves readiness asynchronously, never from its constructor.
      window.setTimeout(() => {
        if (this.destroyed) return;
        this.ready = true;
        this.calls.push("onReady");
        options.events?.onReady?.({ target: this });
      }, 20);
    }

    getCurrentTime() {
      return Math.min(600, this.current + (this.state === 1 ? (performance.now() - this.startedAt) / 1000 * this.rate : 0));
    }
    getDuration() { return 600; }
    getPlayerState() { return this.state; }
    getAvailablePlaybackRates() { return [0.25, 0.5, 1, 1.5, 2]; }
    getVolume() { return this.volume; }
    isMuted() { return this.muted; }
    setVolume(volume: number) { this.volume = volume; this.calls.push("setVolume"); }
    mute() { this.muted = true; this.calls.push("mute"); }
    unMute() { this.muted = false; this.calls.push("unMute"); }
    setPlaybackRate(rate: number) {
      this.current = this.getCurrentTime();
      this.startedAt = performance.now();
      this.rate = rate;
      this.calls.push("setPlaybackRate");
      window.setTimeout(() => {
        if (!this.destroyed) this.options.events?.onPlaybackRateChange?.({ target: this, data: rate });
      }, 0);
    }
    seekTo(seconds: number) {
      this.current = Math.max(0, Math.min(600, seconds));
      this.startedAt = performance.now();
      this.calls.push("seekTo");
    }
    playVideo() { this.changeState(1, "playVideo"); }
    pauseVideo() { this.changeState(2, "pauseVideo"); }
    private changeState(state: number, call: string) {
      if (this.destroyed || !this.ready) throw new Error("YouTube fixture player is not ready");
      this.current = this.getCurrentTime();
      this.startedAt = performance.now();
      this.state = state;
      this.calls.push(call);
      window.setTimeout(() => {
        if (!this.destroyed) this.options.events?.onStateChange?.({ target: this, data: state });
      }, 0);
    }
    emitError(code: number) {
      this.calls.push(`onError:${code}`);
      window.setTimeout(() => {
        if (!this.destroyed) this.options.events?.onError?.({ target: this, data: code });
      }, 0);
    }
    destroy() {
      this.current = this.getCurrentTime();
      this.state = -1;
      this.destroyed = true;
      this.calls.push("destroy");
      delete this.element.dataset.youtubeSdkFixture;
    }
    snapshot(): FixturePlayerSnapshot {
      return {
        videoId: this.options.videoId, ready: this.ready, destroyed: this.destroyed,
        state: this.state, current: this.getCurrentTime(), volume: this.volume,
        muted: this.muted, calls: [...this.calls],
      };
    }
  }

  sdkWindow.__academyYouTubeFixture = {
    snapshot: () => ({ sdkReady, players: players.map((player) => player.snapshot()) }),
    emitError: (code) => {
      const player = [...players].reverse().find((candidate) => !candidate.destroyed);
      if (!player) throw new Error("No active YouTube fixture player");
      player.emitError(code);
    },
  };
  sdkWindow.YT = { Player };
  window.setTimeout(() => {
    sdkReady += 1;
    sdkWindow.onYouTubeIframeAPIReady?.();
  }, 0);
}

/** Exercise the production SDK loader and callbacks; only vendor implementation is replaced. */
export async function installYouTubeSdkFixture(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/javascript",
      body: `(${bootYouTubeFixture.toString()})();`,
    });
  });
  return {
    snapshot: () => page.evaluate(() => (window as unknown as { __academyYouTubeFixture: FixtureControl }).__academyYouTubeFixture.snapshot()),
    emitError: (code: number) => page.evaluate((value) => (window as unknown as { __academyYouTubeFixture: FixtureControl }).__academyYouTubeFixture.emitError(value), code),
  };
}
