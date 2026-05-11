/**
 * 적중보고서 row "🌐 홈페이지" 토글 chip — 학원장 권한 + API 동작 검증
 * Tenant 1 (admin97/hakwonplus) — 실 테넌트(tchul) 검증 금지 정책 준수
 *
 * 검증:
 * 1. 학원장 로그인 → /admin/storage/matchup/hit-reports 진입
 * 2. 보고서가 있는 경우 row에 "+ 홈페이지" 또는 "🌐 홈페이지" chip 노출
 * 3. chip 클릭 시 POST /core/landing/admin/hit-report-toggle/ 호출
 * 4. 응답 200 → chip 색상/텍스트 토글
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test("학원장은 적중보고서 row에서 홈페이지 토글 chip 보임 + 클릭 시 API 호출", async ({ page }) => {
  test.setTimeout(60_000);
  await loginViaUI(page, "admin");

  await page.goto(`${BASE}/admin/storage/hit-reports`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

  // 적중보고서 페이지 진입 확인
  const heading = page.getByRole("heading", { name: /적중\s*보고서/ });
  await expect(heading.first()).toBeVisible({ timeout: 8_000 });

  // chip 존재 여부 — "+ 홈페이지" 또는 "🌐 홈페이지" 둘 중 하나
  const showcaseChips = page.locator('button[title*="홈페이지"]');
  const chipCount = await showcaseChips.count();
  console.log(`SHOWCASE_CHIP_COUNT: ${chipCount}`);

  if (chipCount === 0) {
    console.log("NO_REPORTS: 적중보고서가 없어 chip 검증 skip");
    return;
  }

  // 첫 chip의 텍스트 확인
  const firstChip = showcaseChips.first();
  const beforeText = await firstChip.textContent();
  console.log(`CHIP_BEFORE: ${beforeText?.trim()}`);

  // 토글 API 응답 캡처
  const togglePromise = page.waitForResponse(
    (r) => r.url().includes("/core/landing/admin/hit-report-toggle/") && r.request().method() === "POST",
    { timeout: 10_000 },
  );

  await firstChip.click();
  const resp = await togglePromise;
  console.log(`TOGGLE_API: ${resp.status()} ${resp.url()}`);
  expect(resp.status()).toBe(200);

  const body = await resp.json().catch(() => null);
  console.log(`TOGGLE_RESP: ${JSON.stringify(body)}`);
  expect(body?.ok).toBe(true);

  // 토글 완료 후 텍스트 변화 (옵티미스틱 업데이트가 아니라 응답 후 set)
  // eslint-disable-next-line no-restricted-syntax
  await page.waitForTimeout(300);
  const afterText = await firstChip.textContent();
  console.log(`CHIP_AFTER: ${afterText?.trim()}`);
  expect(afterText).not.toBe(beforeText);

  // 원복 — 테스트 후 상태 cleanup (다시 클릭해서 원래 상태로)
  const revertPromise = page.waitForResponse(
    (r) => r.url().includes("/core/landing/admin/hit-report-toggle/") && r.request().method() === "POST",
    { timeout: 10_000 },
  );
  await firstChip.click();
  await revertPromise;
});
