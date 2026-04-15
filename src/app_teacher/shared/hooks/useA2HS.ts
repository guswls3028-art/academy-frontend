/**
 * useA2HS — Add to Home Screen (PWA 설치) 프롬프트 관리
 *
 * - beforeinstallprompt 이벤트 캡처
 * - 설치 가능 여부 + prompt 호출 함수 제공
 * - 이미 설치된 경우 (standalone) 감지
 */
import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface A2HSState {
  /** PWA 설치 가능 (prompt 사용 가능) */
  canInstall: boolean;
  /** 이미 standalone으로 실행 중 (설치 완료) */
  isInstalled: boolean;
  /** 설치 프롬프트 표시 */
  promptInstall: () => Promise<boolean>;
}

export function useA2HS(): A2HSState {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const onAppInstalled = () => {
      deferredPrompt.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) return false;

    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;

    if (outcome === "accepted") {
      deferredPrompt.current = null;
      setCanInstall(false);
      setIsInstalled(true);
      return true;
    }
    return false;
  }, []);

  return { canInstall, isInstalled, promptInstall };
}
