import { lazy } from "react";

/**
 * Vite code-splitting + Cloudflare Pages 배포 시, 이전 빌드의 chunk 파일이
 * 새 배포에 존재하지 않아 lazy import가 404로 실패하는 문제를 해결한다.
 *
 * 실패 시 한 번만 페이지를 리로드하여 최신 HTML(새 chunk 해시)을 가져온다.
 * sessionStorage 타임스탬프로 무한 리로드를 방지한다 (10초 이내 재시도 차단).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry(factory: () => Promise<{ default: any }>) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const key = "chunk_reload_ts";
      const lastReload = Number(sessionStorage.getItem(key) || "0");
      const now = Date.now();

      // 10초 이내에 이미 reload했으면 무한 루프 방지 — 에러를 그대로 던짐
      if (now - lastReload < 10_000) {
        throw err;
      }

      sessionStorage.setItem(key, String(now));
      window.location.reload();
      // reload 대기 (실제로 도달하지 않음)
      return new Promise<never>(() => {});
    }),
  );
}
