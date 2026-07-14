// PATH: e2e/admin/matchup-spinner-check.spec.ts
// done doc 선택 시 "AI가 문제를 찾아가고 있습니다..." spinner 가
// 회귀인지 fetch latency 인지 판별 — 5s/10s 캡처 비교.

import { test, expect } from "../fixtures/strictTest";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const ADMIN_USER = "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "__MISSING_E2E_ADMIN_PASS__";
const TENANT = "hakwonplus";

const OUT = "../_artifacts/sessions/matchup-final-review-2026-05-09";

test("done doc spinner check — 5s/10s/15s", async ({ page }) => {
  test.setTimeout(120_000);
  await page.context().addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
  }, { access: "x", refresh: "y" });

  // 토큰 발급 + 주입
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    timeout: 60_000,
  });
  const tokens = await resp.json();
  await page.addInitScript((t) => {
    localStorage.setItem("access", t.access);
    localStorage.setItem("refresh", t.refresh);
  }, tokens);

  await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // 다른 done doc 선택
  const rows = page.locator('[data-testid="matchup-doc-row"][data-doc-status="done"]');
  await expect(rows.nth(64)).toBeVisible({ timeout: 15_000 });
  await rows.nth(64).click();

  // eslint-disable-next-line no-restricted-syntax
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/spinner-2s.png`, fullPage: true });

  // eslint-disable-next-line no-restricted-syntax
  await page.waitForTimeout(3000); // total 5s
  await page.screenshot({ path: `${OUT}/spinner-5s.png`, fullPage: true });

  // eslint-disable-next-line no-restricted-syntax
  await page.waitForTimeout(5000); // total 10s
  await page.screenshot({ path: `${OUT}/spinner-10s.png`, fullPage: true });

  // problem grid 안 카드 가시
  const cards = page.locator('[data-testid="matchup-problem-card"]');
  const cardCount = await cards.count();
  console.error("[INFO] problem cards visible at 10s =", cardCount);

  // 우측 panel "AI 검색 중" 텍스트
  const spinner = page.locator('text=/AI가 문제를 찾아가고 있습니다/');
  const spinnerVisible = await spinner.isVisible().catch(() => false);
  console.error("[INFO] spinner visible at 10s =", spinnerVisible);
});
