import { lazy } from "react";

/**
 * Vite code-splitting + Cloudflare Pages 배포 시 발생하는 두 종류 race 처리.
 *
 * 1) chunk 404: 이전 빌드의 chunk 파일이 새 배포에 없어 dynamic import가 reject.
 * 2) default undefined: chunk fetch는 성공했지만 module evaluation 결과가
 *    `{ default: undefined }` 인 경우 (named export 매핑 race, 또는 평가 실패).
 *    React.lazy는 이 상황에서 "Cannot read properties of undefined (reading 'default')"
 *    런타임 에러를 발생시킨다 (catch에 잡히지 않음).
 *
 * 두 케이스 모두 한 번 페이지를 리로드해 최신 HTML(새 chunk 해시)을 가져오는 것으로 회복.
 * sessionStorage 타임스탬프로 무한 리로드 방지(10초 이내 재시도 차단).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry(factory: () => Promise<{ default: any }>) {
  return lazy(() =>
    factory()
      .then((mod) => {
        // factory가 resolve 되었어도 default가 undefined면 race로 간주.
        // (named export 매핑 .then((m) => ({ default: m.X })) 에서 m.X가 undefined인 경우 포함)
        if (mod == null || mod.default === undefined) {
          throw new Error("LAZY_DEFAULT_UNDEFINED");
        }
        return mod;
      })
      .catch((err: unknown) => {
        const key = "chunk_reload_ts";
        const lastReload = Number(sessionStorage.getItem(key) || "0");
        const now = Date.now();

        // 10초 이내에 이미 reload했으면 무한 루프 방지 — 에러를 그대로 던져 ErrorBoundary로
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
