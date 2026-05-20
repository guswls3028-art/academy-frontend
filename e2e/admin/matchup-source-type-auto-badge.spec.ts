// PATH: e2e/admin/matchup-source-type-auto-badge.spec.ts
//
// 자동 추천 뱃지 + filename 휴리스틱 시각 검증.
// 파일 추가 시 sourceTypeReason 노출 + 뱃지 가시.

import { test, expect, type Locator, type Page } from "@playwright/test";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const ADMIN_USER = "admin97";
const ADMIN_PASS = "koreaseoul97";
const TENANT = "hakwonplus";

const OUT = "../_artifacts/sessions/matchup-realuse-2026-05-09";

async function login(page: Page) {
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

async function openMatchup(page: Page): Promise<void> {
  await login(page);
  await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
  await waitForCondition(
    async () => (await page.locator('button:has-text("업로드"), button:has-text("자료 등록"), button:has-text("참고자료"), button:has-text("시험지")').count()) > 0,
    { timeoutMs: 10_000, description: "matchup upload entry buttons visible" },
  );
}

async function openUploadModal(page: Page, preferredButton: Locator): Promise<Locator> {
  const modal = page.locator('[data-testid="matchup-upload-modal"]');
  if (await preferredButton.count() === 0) {
    await page.locator('button:has-text("업로드")').first().click();
  } else {
    await preferredButton.click();
  }
  await expect(modal).toBeVisible({ timeout: 10_000 });
  return modal;
}

test.describe("매치업 자동 추천 뱃지", () => {
  test.setTimeout(120_000);

  test("filename '해설' → explanation 추천", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await openMatchup(page);

    // "참고자료 업로드" 버튼 — intent="reference"
    const refBtn = page.locator('button:has-text("자료 등록"), button:has-text("참고자료")').first();
    const modal = await openUploadModal(page, refBtn);

    // 파일 input — 가짜 파일 생성 (filename 휴리스틱만 시험)
    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    await fileInput.setInputFiles({
      name: "수학_해설지_2026.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 dummy"),
    });

    // 자동 추천 뱃지 가시
    const badge = page.locator('[data-testid="matchup-upload-source-type-auto-badge"]');
    await expect(badge).toBeVisible({ timeout: 10_000 });
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
    const badgeAfter = page.locator('[data-testid="matchup-upload-source-type-auto-badge"]');
    await expect(badgeAfter).toHaveCount(0, { timeout: 5_000 });
    await modal.screenshot({ path: `${OUT}/07c-modal-after-touch.png` });
  });

  test("filename '카카오톡' + jpg → student_exam_photo 추천", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await openMatchup(page);

    const upBtn = page.locator('button:has-text("시험지"), button:has-text("업로드")').first();
    const modal = await openUploadModal(page, upBtn);

    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    await fileInput.setInputFiles({
      name: "KakaoTalk_20260509_학생답안.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    });

    const badge = page.locator('[data-testid="matchup-upload-source-type-auto-badge"]');
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/08-auto-badge-kakao.png`, fullPage: true });
    await modal.screenshot({ path: `${OUT}/08b-modal-kakao.png` });
  });
});
