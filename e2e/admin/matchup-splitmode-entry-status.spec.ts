/**
 * 회귀 E2E: 매치업 모달 splitMode 직렬 업로드 시 entry 단위 상태 표시 (2026-04-29 R5).
 *  - 2개 파일 중 1개 fail → 첫 entry done(✓), 두번째 entry failed(✕)
 *  - 부분 실패 시 모달 유지
 *
 * playwright route mock으로 실 R2 업로드 없이 검증.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PDF = path.resolve(__dirname, "../fixtures/test-matchup.pdf");

test("매치업 splitMode 부분 실패 → entry 행 상태 ❌/✓ 표시 + 모달 유지", async ({ page }) => {
  test.setTimeout(60_000);
  await loginViaUI(page, "admin");

  // 첫 호출 success, 두번째 호출 fail
  let count = 0;
  await page.route("**/matchup/documents/upload/**", async (route) => {
    count += 1;
    if (count === 2) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "mock 실패" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: count, title: `mock-${count}`, status: "uploaded",
        }),
      });
    }
  });

  await page.goto("https://hakwonplus.com/admin/storage/matchup", {
    waitUntil: "load",
    timeout: 20_000,
  });
  await page.waitForTimeout(1500);

  await page.getByTestId("matchup-upload-button").click();
  await expect(page.getByTestId("matchup-upload-modal")).toBeVisible({ timeout: 5_000 });

  await page.getByTestId("matchup-file-input").setInputFiles([PDF, PDF]);
  await page.waitForTimeout(800);

  // splitMode on — 두 옵션 라디오 UI(2026-04-29 사고 후 toggle→radio).
  // PDF 2개면 자동 split-on이지만 사용자 명시 클릭으로 splitModeTouched=true 검증.
  await page.getByTestId("matchup-split-mode-toggle").click();
  await page.waitForTimeout(200);

  // submit (라벨: "2개 ... 동시 업로드")
  await page.getByTestId("matchup-upload-submit").click();

  // 두 entry 모두 처리 끝날 때까지 wait — 두번째가 failed 상태로 멈춰야 함
  const entries = page.getByTestId("matchup-upload-entry");
  await expect(async () => {
    const statuses = await entries.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-entry-status")),
    );
    expect(statuses).toEqual(["done", "failed"]);
  }).toPass({ timeout: 15_000 });

  // 모달 유지 — 사용자가 실패 인지 후 닫음
  await expect(page.getByTestId("matchup-upload-modal")).toBeVisible();

  await page.screenshot({
    path: "e2e/screenshots/realuse-r5-entry-status.png",
    fullPage: false,
  });

  await page.getByRole("button", { name: /^취소$/ }).first().click();
  await expect(page.getByTestId("matchup-upload-modal")).not.toBeVisible({ timeout: 3_000 });
});
