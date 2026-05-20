import { lazy, type ComponentType } from "react";
import { hardReloadWithCacheBust } from "@/shared/utils/hardReload";

/**
 * Vite code-splitting + Cloudflare Pages 배포 시 발생하는 두 종류 race 처리.
 *
 * 1) chunk 404: 이전 빌드의 chunk 파일이 새 배포에 없어 dynamic import가 reject.
 * 2) default undefined: chunk fetch는 성공했지만 module evaluation 결과가
 *    `{ default: undefined }` 인 경우 (named export 매핑 race, 또는 평가 실패).
 *    React.lazy는 이 상황에서 "Cannot read properties of undefined (reading 'default')"
 *    런타임 에러를 발생시킨다 (catch에 잡히지 않음).
 *
 * 두 케이스 모두 cache-bust reload로 최신 HTML(새 chunk 해시)을 가져오는 것으로 회복.
 * sessionStorage 타임스탬프로 무한 리로드 방지(10초 이내 재시도 차단).
 */
type RetryableLazyModule = {
  default: ComponentType<never> | ComponentType;
};

export function lazyWithRetry(
  factory: () => Promise<RetryableLazyModule>,
) {
  const key = "chunk_reload_ts";
  const cooldownMs = 10_000;

  const loader = () =>
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
        // 10초 이내에 이미 reload했으면 무한 루프 방지 — 에러를 그대로 던져 ErrorBoundary로
        if (!hardReloadWithCacheBust({ key, cooldownMs })) {
          throw err;
        }
        return new Promise<never>(() => {});
      });

  return lazy(loader as unknown as () => Promise<{ default: ComponentType }>);
}
