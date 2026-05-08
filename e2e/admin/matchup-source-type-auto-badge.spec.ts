// PATH: e2e/admin/matchup-source-type-auto-badge.spec.ts
//
// 자동 추천 뱃지 + filename 휴리스틱 시각 검증.
// 파일 추가 시 sourceTypeReason 노출 + 뱃지 가시.

import { test, expect } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const ADMIN_USER = "admin97";
const ADMIN_PASS = "koreaseoul97";
const TENANT = "hakwonplus";

const OUT = "../_artifacts/sessions/matchup-realuse-2026-05-09";

async function login(page: import("@playwright/test").Page) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
  }, tokens);
}

test.describe("매치업 자동 추천 뱃지", () => {
  test.setTimeout(120_000);

  test("filename '해설' → explanation 추천", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // "참고자료 업로드" 버튼 — intent="reference"
    const refBtn = page.locator('button:has-text("자료 등록"), button:has-text("참고자료")').first();
    if (await refBtn.count() === 0) {
      // fallback — 첫 업로드 버튼
      await page.locator('button:has-text("업로드")').first().click();
    } else {
      await refBtn.click();
    }
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="matchup-upload-modal"]');
    await expect(modal).toBeVisible();

    // 파일 input — 가짜 파일 생성 (filename 휴리스틱만 시험)
    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    await fileInput.setInputFiles({
      name: "수학_해설지_2026.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 dummy"),
    });
    await page.waitForTimeout(800);

    // 자동 추천 뱃지 가시
    const badge = page.locator('[data-testid="matchup-upload-source-type-auto-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("자동 추천");

    // 추천 결과 — "해설지" active
    const expActive = page.locator('button[data-source-type="explanation"]');
    await expect(expActive).toBeVisible();
    const cls = await expActive.getAttribute("style");
    console.error("[explanation style]", cls?.slice(0, 200));

    await page.screenshot({ path: `${OUT}/07-auto-badge-haeseol.png`, fullPage: true });
    await modal.screenshot({ path: `${OUT}/07b-modal-haeseol.png` });

    // 사용자가 다른 항목 클릭 → 뱃지 사라짐
    await page.locator('button[data-source-type="academy_workbook"]').click();
    await page.waitForTimeout(300);
    const badgeAfter = page.locator('[data-testid="matchup-upload-source-type-auto-badge"]');
    expect(await badgeAfter.count()).toBe(0);
    await modal.screenshot({ path: `${OUT}/07c-modal-after-touch.png` });
  });

  test("filename '카카오톡' + jpg → student_exam_photo 추천", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const upBtn = page.locator('button:has-text("시험지"), button:has-text("업로드")').first();
    await upBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="matchup-upload-modal"]');
    await expect(modal).toBeVisible();

    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    await fileInput.setInputFiles({
      name: "KakaoTalk_20260509_학생답안.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    });
    await page.waitForTimeout(800);

    const badge = page.locator('[data-testid="matchup-upload-source-type-auto-badge"]');
    await expect(badge).toBeVisible();
    await page.screenshot({ path: `${OUT}/08-auto-badge-kakao.png`, fullPage: true });
    await modal.screenshot({ path: `${OUT}/08b-modal-kakao.png` });
  });
});
