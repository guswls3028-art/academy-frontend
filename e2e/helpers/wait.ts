/**
 * E2E 대기 헬퍼 — `page.waitForTimeout(N)` 안티패턴을 대체.
 *
 * 기존 spec 845+ 곳에서 `waitForTimeout(2000)` 같은 임의 대기를 사용 중.
 * 점진 마이그레이션을 위해 의미 있는 wait 함수를 제공한다.
 *
 * 사용 가이드:
 *   await page.goto(url); await page.waitForTimeout(2000);
 *   → await gotoAndSettle(page, url);
 *
 *   await btn.click(); await page.waitForTimeout(1500);
 *   await modal.isVisible();
 *   → await clickAndExpect(btn, modal);
 */
import { expect, type Page, type Locator } from "@playwright/test";

/**
 * 페이지 이동 + DOM/network 안정화 대기.
 * waitForTimeout 대신 networkidle + load state 기반 대기.
 */
export async function gotoAndSettle(
  page: Page,
  url: string,
  opts?: { timeout?: number; settleMs?: number },
): Promise<void> {
  const timeout = opts?.timeout ?? 20_000;
  await page.goto(url, { waitUntil: "load", timeout });
  // SPA 의 React render 안정화에 networkidle 가 효과적
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
  // 일부 화면은 useEffect 후 데이터 fetch 가 networkidle 이후 일어남 — 짧은 settle
  if (opts?.settleMs && opts.settleMs > 0) {
    await page.waitForTimeout(opts.settleMs);
  }
}

/**
 * 액션 후 기대 요소가 보일 때까지 대기.
 * 임의 sleep 대신 명확한 후속 조건으로 대기.
 */
export async function clickAndExpect(
  trigger: Locator,
  expected: Locator,
  opts?: { timeout?: number },
): Promise<void> {
  await trigger.click();
  await expect(expected).toBeVisible({ timeout: opts?.timeout ?? 10_000 });
}

/**
 * 액션 후 사라짐을 기대 (모달 닫힘 등).
 */
export async function clickAndExpectHidden(
  trigger: Locator,
  expected: Locator,
  opts?: { timeout?: number },
): Promise<void> {
  await trigger.click();
  await expect(expected).toBeHidden({ timeout: opts?.timeout ?? 10_000 });
}

/**
 * "조건이 충족될 때까지 대기" — polling 기반.
 * waitForTimeout 루프 대신 사용.
 */
export async function waitForCondition(
  predicate: () => Promise<boolean>,
  opts: { timeoutMs: number; intervalMs?: number; description?: string },
): Promise<void> {
  const interval = opts.intervalMs ?? 500;
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(
    `waitForCondition 타임아웃 (${opts.timeoutMs}ms): ${opts.description || "no description"}`,
  );
}
