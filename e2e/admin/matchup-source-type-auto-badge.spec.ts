// PATH: e2e/admin/matchup-source-type-auto-badge.spec.ts
//
// 자동 추천 뱃지 + filename 휴리스틱 시각 검증.
// 파일 추가 시 sourceTypeReason 노출 + 뱃지 가시.

import { test, expect, type Locator, type Page } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { openMatchupUploadModal } from "../helpers/matchup";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

const BASE = "https://hakwonplus.com";
const OUT = "../_artifacts/sessions/matchup-realuse-2026-05-09";

async function login(page: Page) {
  await loginViaUI(page, "admin");
}

async function openMatchup(page: Page): Promise<void> {
  await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
  await waitForCondition(
    async () => (await page.locator('button:has-text("업로드"), button:has-text("자료 등록"), button:has-text("참고자료"), button:has-text("시험지")').count()) > 0,
    { timeoutMs: 10_000, description: "matchup upload entry buttons visible" },
  );
}

async function openUploadModal(page: Page, intent: "reference" | "test"): Promise<Locator> {
  return openMatchupUploadModal(page, intent);
}

test.describe("매치업 자동 추천 뱃지", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("filename '해설' → explanation 추천", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await openMatchup(page);

    // "참고자료 업로드" 버튼 — intent="reference"
    const modal = await openUploadModal(page, "reference");

    // 파일 input — 가짜 파일 생성 (filename 휴리스틱만 시험)
    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    await fileInput.setInputFiles({
      name: "수학_해설지_2026.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 dummy"),
    });

    // source type UI는 의도적으로 숨김. data-testid/debug attr로 자동 추천 결과를 검증한다.
    const auto = page.locator('[data-testid="matchup-upload-source-type-auto"]');
    await expect(auto).toBeAttached({ timeout: 10_000 });
    await expect(auto).toHaveAttribute("data-source-type", "explanation");

    await page.screenshot({ path: `${OUT}/07-auto-badge-haeseol.png`, fullPage: true });
    await modal.screenshot({ path: `${OUT}/07b-modal-haeseol.png` });

    await modal.screenshot({ path: `${OUT}/07c-modal-auto-hidden-debug.png` });
  });

  test("filename '카카오톡' + jpg → student_exam_photo 추천", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    await openMatchup(page);

    const modal = await openUploadModal(page, "test");

    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    await fileInput.setInputFiles({
      name: "KakaoTalk_20260509_학생답안.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    });

    const badge = page.locator('[data-testid="matchup-upload-source-type-auto"]');
    await expect(badge).toBeAttached({ timeout: 10_000 });
    await expect(badge).toHaveAttribute("data-source-type", "student_exam_photo");
    await page.screenshot({ path: `${OUT}/08-auto-badge-kakao.png`, fullPage: true });
    await modal.screenshot({ path: `${OUT}/08b-modal-kakao.png` });
  });
});
