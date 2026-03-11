import { lazy } from "react";

/**
 * Vite code-splitting + Cloudflare Pages 배포 시, 이전 빌드의 chunk 파일이
 * 새 배포에 존재하지 않아 lazy import가 404로 실패하는 문제를 해결한다.
 *
 * 실패 시 한 번만 페이지를 리로드하여 최신 HTML(새 chunk 해시)을 가져온다.
 * sessionStorage 플래그로 무한 리로드를 방지한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry(factory: () => Promise<{ default: any }>) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const key = "chunk_reload_retry";
      const hasRetried = sessionStorage.getItem(key);

      if (!hasRetried) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }

      sessionStorage.removeItem(key);
      throw err;
    }),
  );
}
