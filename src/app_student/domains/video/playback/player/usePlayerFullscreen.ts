import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { getActiveFullscreenElement, isIOSWebKitRuntime } from "./design/utils";

type FullscreenController = { queueFullscreenEvent: (entering: boolean) => void };

/** Native/fallback fullscreen transitions share one cancellable request lifetime. */
export function usePlayerFullscreen(
  wrapElRef: RefObject<HTMLDivElement | null>,
  videoElRef: RefObject<HTMLVideoElement | null>,
  controllerRef: RefObject<FullscreenController | null>,
  setShowControls: (visible: boolean) => void,
) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenFallbackRef = useRef(false);
  const requestRef = useRef(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelFallback = useCallback(() => {
    requestRef.current++;
    if (fallbackTimerRef.current !== null) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;

    const onFullscreenChange = () => {
      cancelFallback();
      const el = getActiveFullscreenElement();
      const active = el === wrap || (el && wrap.contains(el));
      fullscreenFallbackRef.current = false;
      setIsFullscreen(!!active);
      if (active) {
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        setShowControls(true);
      } else {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("mozfullscreenchange", onFullscreenChange);
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [cancelFallback, setShowControls, videoElRef, wrapElRef, controllerRef]);

  // iOS 등: video 요소 네이티브 전체화면(webkitEnterFullscreen) 종료 시 상태 복구 — 플레이어 끄면 UI 꼬임 방지
  useEffect(() => {
    const vid = videoElRef.current;
    if (!vid) return;
    const lockPageForFullscreen = () => {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    };
    const unlockPageFromFullscreen = () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
    const onNativeVideoFullscreenBegin = () => {
      cancelFallback();
      fullscreenFallbackRef.current = false;
      setIsFullscreen(true);
      setShowControls(true);
      lockPageForFullscreen();
      controllerRef.current?.queueFullscreenEvent(true);
    };
    const onNativeVideoFullscreenEnd = () => {
      cancelFallback();
      fullscreenFallbackRef.current = false;
      setIsFullscreen(false);
      unlockPageFromFullscreen();
      controllerRef.current?.queueFullscreenEvent(false);
    };
    vid.addEventListener("webkitbeginfullscreen", onNativeVideoFullscreenBegin);
    vid.addEventListener("webkitendfullscreen", onNativeVideoFullscreenEnd);
    return () => {
      vid.removeEventListener("webkitbeginfullscreen", onNativeVideoFullscreenBegin);
      vid.removeEventListener("webkitendfullscreen", onNativeVideoFullscreenEnd);
    };
  }, [cancelFallback, setShowControls, videoElRef, wrapElRef, controllerRef]);

  useEffect(() => {
    return () => {
      cancelFallback();
      if (fullscreenFallbackRef.current) {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }
    };
  }, [cancelFallback, setShowControls, videoElRef, wrapElRef, controllerRef]);

  const requestFullscreen = useCallback(() => {
    const wrap = wrapElRef.current;
    const vid = videoElRef.current;
    const ctrl = controllerRef.current;
    cancelFallback();
    const request = requestRef.current;

    const isFs = getActiveFullscreenElement();
    const inFallback = fullscreenFallbackRef.current;

    const enterFallback = () => {
      if (request !== requestRef.current) return;
      cancelFallback();
      if (getActiveFullscreenElement()) return;
      fullscreenFallbackRef.current = true;
      setIsFullscreen(true);
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      setShowControls(true);
      ctrl?.queueFullscreenEvent(true);
    };

    const exitFallback = () => {
      cancelFallback();
      fullscreenFallbackRef.current = false;
      setIsFullscreen(false);
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      ctrl?.queueFullscreenEvent(false);
    };

    // Both rejection recovery and the native watchdog belong to this request.
    // A later request, native transition, fallback entry, or unmount invalidates it.
    const scheduleFallback = (delay: number, nativeWatchdog = false) => {
      if (request !== requestRef.current) return;
      if (fallbackTimerRef.current !== null) clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = setTimeout(() => {
        if (request !== requestRef.current) return;
        fallbackTimerRef.current = null;
        if (!nativeWatchdog || !isIOSWebKitRuntime()) enterFallback();
      }, delay);
    };

    try {
      if (isFs || isFullscreen) {
        cancelFallback();
        ctrl?.queueFullscreenEvent(false);
        if (inFallback) {
          exitFallback();
          return;
        }
        if (isFs) {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
          return;
        }
        if (vid?.webkitExitFullscreen) {
          vid.webkitExitFullscreen();
          return;
        }
        exitFallback();
        return;
      }

      ctrl?.queueFullscreenEvent(true);

      const enterNativeVideoFullscreen = () => {
        if (!vid?.webkitEnterFullscreen) return false;
        try {
          vid.webkitEnterFullscreen();
          cancelFallback();
          fullscreenFallbackRef.current = false;
          setIsFullscreen(true);
          setShowControls(true);
          document.body.style.overflow = "hidden";
          document.body.style.touchAction = "none";
          return true;
        } catch {
          return false;
        }
      };

      const tryNative = () => {
        // iOS WebKit(Safari/Chrome/앱 내 브라우저): video 네이티브 전체화면이 가장 안정적이다.
        if (isIOSWebKitRuntime() && enterNativeVideoFullscreen()) {
          return true;
        }
        // Android 및 데스크톱: 래퍼 전체화면 (Fullscreen API)
        if (wrap?.requestFullscreen) {
          wrap.requestFullscreen({ navigationUI: "hide" }).catch(() => scheduleFallback(100));
          return true;
        }
        if (wrap?.webkitRequestFullscreen) {
          wrap.webkitRequestFullscreen();
          return true;
        }
        // 래퍼 전체화면 불가 시 video 요소 직접 시도
        if (vid?.requestFullscreen) {
          vid.requestFullscreen().catch(() => scheduleFallback(100));
          return true;
        }
        if (vid?.webkitRequestFullscreen) {
          vid.webkitRequestFullscreen();
          return true;
        }
        if (enterNativeVideoFullscreen()) {
          return true;
        }
        return false;
      };

      if (!tryNative()) {
        enterFallback();
        return;
      }

      scheduleFallback(350, true);
    } catch {
      enterFallback();
    }
  }, [cancelFallback, controllerRef, isFullscreen, setShowControls, videoElRef, wrapElRef]);

  return { isFullscreen, requestFullscreen };
}
