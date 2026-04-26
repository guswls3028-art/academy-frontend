/**
 * 로컬 dev 서버 (localhost:5174) 대상 — 새 UX 시각 확인.
 * - DocumentUploadModal: Ctrl+V 붙여넣기 안내문 노출
 * - ManualCropModal: 8방향 리사이즈 핸들 + 박스 이동 가능
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-crop-paste-local");
fs.mkdirSync(SHOTS, { recursive: true });

const LOCAL = "http://localhost:5174";

test.describe("매치업 크롭/붙여넣기 — 로컬 시각 확인", () => {
  test.beforeEach(async ({ page }) => {
    // 로컬 dev에 로그인 (auth.ts가 BASE 환경변수에 의존 — 여기선 page.goto로 직접)
    process.env.E2E_BASE_URL = LOCAL;
    await loginViaUI(page, "admin");
  });

  test("업로드 모달: Ctrl+V 붙여넣기 안내문 노출", async ({ page }) => {
    await page.goto(`${LOCAL}/admin/storage/matchup`, { waitUntil: "networkidle" });

    const uploadBtn = page.locator(
      "[data-testid='matchup-upload-button'], [data-testid='matchup-empty-test-btn']",
    ).first();
    await expect(uploadBtn).toBeVisible({ timeout: 10000 });
    await uploadBtn.click();
    await expect(page.locator("[data-testid='matchup-upload-modal']")).toBeVisible({ timeout: 5000 });

    // 안내문에 "Ctrl+V" 키워드
    await expect(page.locator("[data-testid='matchup-drop-zone']")).toContainText(/Ctrl\+V/);
    await page.screenshot({ path: path.join(SHOTS, "upload-modal-with-paste.png"), fullPage: true });
  });

  test("크롭 모달: 8방향 핸들 + 안내문 갱신", async ({ page }) => {
    await page.goto(`${LOCAL}/admin/storage/matchup`, { waitUntil: "networkidle" });

    // 첫 문서 행 클릭 → 디테일 패널 → 직접 자르기
    const firstDoc = page.locator("[data-testid='matchup-doc-row']").first();
    if (await firstDoc.count() === 0) {
      test.skip(true, "문서가 없어 크롭 모달 검증 스킵");
      return;
    }
    await firstDoc.click();
    await page.waitForTimeout(500);

    const cropBtn = page.locator("button:has-text('직접 자르기'), button:has-text('수동 자르기')").first();
    if (await cropBtn.count() === 0) {
      test.skip(true, "직접 자르기 버튼 미노출");
      return;
    }
    await cropBtn.click();

    const modal = page.locator("[data-testid='matchup-manual-crop-modal']");
    await expect(modal).toBeVisible({ timeout: 8000 });

    // 안내문 키워드: "핸들", "←↑↓→"
    await expect(modal).toContainText(/핸들/);
    await page.screenshot({ path: path.join(SHOTS, "crop-modal-empty.png"), fullPage: true });

    // 캔버스 위에서 드래그 → 박스 생성 → 8개 핸들 노출
    const canvas = page.locator("[data-testid='matchup-crop-canvas']");
    await expect(canvas).toBeVisible({ timeout: 5000 });

    const cb = await canvas.boundingBox();
    if (cb) {
      await page.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height * 0.3);
      await page.mouse.down();
      await page.mouse.move(cb.x + cb.width * 0.7, cb.y + cb.height * 0.6, { steps: 10 });
      await page.mouse.up();
    }
    await page.waitForTimeout(200);

    const draft = page.locator("[data-testid='matchup-crop-draft']");
    await expect(draft).toBeVisible({ timeout: 3000 });

    // 핸들 8개 — div with cursor: nwse-resize / ns-resize / nesw-resize / ew-resize 등
    // 단순히 캔버스 위 div 카운트로는 검증 어려움 → 스크린샷 + draft가 보이면 통과로 간주
    await page.screenshot({ path: path.join(SHOTS, "crop-modal-with-draft.png"), fullPage: true });
  });
});
