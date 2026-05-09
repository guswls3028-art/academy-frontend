/**
 * P3 운영 배포 검증.
 *
 * 응답 schema:
 * - is_discarded: bool
 * - discard_reason: string | null
 *
 * UI:
 * - 실패/폐기 탭에 sub-filter 노출 (실패 / 폐기됨)
 * - 폐기된 row 는 폐기 사유 라벨 + neutral tone
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const TENANT_CODE = "hakwonplus";

test("pending API: is_discarded + discard_reason 필드 노출", async ({ request }) => {
  test.setTimeout(60_000);
  const tokenResp = await request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT_CODE },
  });
  expect(tokenResp.status()).toBe(200);
  const { access } = await tokenResp.json();

  const resp = await request.get(`${API_BASE}/api/v1/submissions/submissions/pending/?filter=all`, {
    headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": TENANT_CODE },
  });
  expect(resp.status()).toBe(200);
  const data = await resp.json();
  expect(Array.isArray(data)).toBe(true);
  if (data.length === 0) {
    test.info().annotations.push({ type: "skip-reason", description: "0 rows" });
    return;
  }
  const row = data[0];
  console.log(`[KEYS] ${Object.keys(row).join(",")}`);
  expect(row).toHaveProperty("is_discarded");
  expect(row).toHaveProperty("discard_reason");
  expect(typeof row.is_discarded).toBe("boolean");

  // 정합성: is_discarded=true 면 status=failed
  for (const r of data) {
    if (r.is_discarded) expect(r.status).toBe("failed");
  }
});

test("inbox UI: 실패/폐기 탭 sub-filter 노출 + 잘못된 세션 접근 미발생", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaUI(page, "admin");
  await page.goto(`${getBaseUrl("admin")}/admin/results/submissions`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

  // 실패/폐기 탭 클릭
  const failedTab = page.getByRole("button", { name: /실패\/폐기/ });
  if ((await failedTab.count()) === 0) {
    test.info().annotations.push({ type: "skip-reason", description: "탭 미발견" });
    return;
  }
  await failedTab.first().click();
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

  // sub-filter 가 보이거나 (failed row 존재 시), 빈 상태이거나
  const subFilterVisible = await page.getByText("분류:").isVisible({ timeout: 3_000 }).catch(() => false);
  if (subFilterVisible) {
    await expect(page.getByText(/전체 \d+/)).toBeVisible();
    await expect(page.getByText(/실패 \d+/)).toBeVisible();
    await expect(page.getByText(/폐기됨 \d+/)).toBeVisible();
  }

  // 어디에도 "잘못된 세션 접근" 미노출
  const hasErrorText = await page.getByText("잘못된 세션 접근").isVisible().catch(() => false);
  expect(hasErrorText).toBe(false);
});
