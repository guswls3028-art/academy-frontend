/**
 * 회귀 E2E: UploadModal close 책임 이관(2026-04-29 commit `00d95582`) 후
 *   - 단일 파일 성공 → 모달 close
 *   - 다중 파일 모두 성공 → 모든 파일 끝난 후에만 close
 *   - 다중 파일 부분 실패 → 모달 유지 (사용자가 실패 인지 후 닫음)
 *
 * 운영 hakwonplus.com에서 storage/inventory/upload API를 playwright route로
 * 가로채 시뮬레이션. 실 R2 업로드는 안 함 → 데이터 부담 0.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PDF = path.resolve(__dirname, "../fixtures/test-matchup.pdf");

async function openInventoryUploadModal(page: import("@playwright/test").Page) {
  await page.goto("https://hakwonplus.com/admin/storage/matchup", {
    waitUntil: "load",
    timeout: 20_000,
  });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /^저장소$/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^추가$/ }).click();
  await page.waitForTimeout(300);
  await page.getByText("파일 업로드").click();
  await page.waitForTimeout(500);
}

test.describe("UploadModal close 회귀 (mock)", () => {
  test("단일 파일 성공 → 모달 자동 close", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    // 업로드 API mock — 즉시 성공 응답
    await page.route("**/storage/inventory/upload/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "mock-1", display_name: "mock", matchupDocumentId: null }),
      }),
    );

    await openInventoryUploadModal(page);
    const fileList = page.getByTestId("upload-modal-file-list");

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([PDF]);
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: /^업로드$/ }).click();
    // 단일 파일도 succeeded === files.length(=1) 조건으로 close
    await expect(fileList).not.toBeVisible({ timeout: 10_000 });
  });

  test("다중 파일 모두 성공 → 마지막 파일 끝난 후 close (조기 close 회귀 방지)", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    // 각 업로드에 250ms 인위 지연 → 다중 직렬 진행률 관찰
    await page.route("**/storage/inventory/upload/**", async (route) => {
      await new Promise((r) => setTimeout(r, 250));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: `mock-${Date.now()}`, display_name: "mock", matchupDocumentId: null }),
      });
    });

    await openInventoryUploadModal(page);
    const fileList = page.getByTestId("upload-modal-file-list");

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([PDF, PDF, PDF]);
    await page.waitForTimeout(400);

    // "3개 업로드" 버튼 클릭
    await page.getByRole("button", { name: /3개 업로드/ }).click();
    // 첫 파일 끝난 후 ~250ms 시점에서도 모달은 보여야 함 (close 회귀 방지)
    await page.waitForTimeout(400);
    await expect(fileList).toBeVisible();
    // 진행률 라벨 노출 (n/3)
    await expect(page.getByRole("button", { name: /업로드 중.*\d\/3/ })).toBeVisible({ timeout: 5_000 });
    // 모든 파일 완료 후 close
    await expect(fileList).not.toBeVisible({ timeout: 10_000 });
  });

  test("다중 파일 부분 실패 → 모달 유지 (사용자 인지 가능)", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    let count = 0;
    await page.route("**/storage/inventory/upload/**", async (route) => {
      count += 1;
      if (count === 2) {
        // 2번째 파일은 500 fail
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "mock 실패" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: `mock-${count}`, display_name: "mock", matchupDocumentId: null }),
        });
      }
    });

    await openInventoryUploadModal(page);
    const fileList = page.getByTestId("upload-modal-file-list");

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([PDF, PDF]);
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: /2개 업로드/ }).click();
    // 부분 실패 → 모달은 유지되어야 함
    await page.waitForTimeout(2000);
    await expect(fileList).toBeVisible();

    // 사용자가 명시적으로 닫음
    await page.getByRole("button", { name: /^취소$/ }).first().click();
    await expect(fileList).not.toBeVisible({ timeout: 3_000 });
  });
});
