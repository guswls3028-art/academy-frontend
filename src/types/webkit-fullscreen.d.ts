// PATH: src/types/webkit-fullscreen.d.ts
// WebKit/Mozilla 벤더 프리픽스 fullscreen API. Safari/iOS/구 Firefox 지원용.

declare global {
  interface Document {
    readonly webkitFullscreenElement?: Element | null;
    readonly mozFullScreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
  }

  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
  }

  // iOS Safari: video 요소의 네이티브 전체화면 API
  interface HTMLVideoElement {
    webkitEnterFullscreen?: () => void;
    webkitExitFullscreen?: () => void;
  }

  interface DocumentEventMap {
    webkitfullscreenchange: Event;
    mozfullscreenchange: Event;
  }

  interface HTMLVideoElementEventMap {
    webkitendfullscreen: Event;
    webkitbeginfullscreen: Event;
  }
}

export {};
