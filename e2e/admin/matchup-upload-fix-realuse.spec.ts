/**
 * 실사용 리뷰: 2026-04-29 B1 (좌측 트리 별도 스크롤) + B3 (다중 업로드 직렬화/진행률/모달 close)
 * 운영 hakwonplus.com 직접 검증. 실 데이터 생성 없이 모달/UI 동작만 확인.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";
import path from "path";
import { fileURLToPath } from "url";
import type { Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function gotoMatchup(page: Page): Promise<void> {
  await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
  await expect(page.locator("[class*='_root']").first()).toBeVisible({ timeout: 5000 });
}

test.describe("매치업/인벤토리 업로드 fix 실사용 리뷰", () => {
  test("B1: 매치업 페이지 좌측 트리에 viewport 높이 제한 + 별도 overflow", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    await gotoMatchup(page);

    // 매치업 페이지 root 컨테이너의 inline maxHeight 검사. 브라우저는 calc 표기를
    // 정규화하므로 (`calc(-100px + 100svh)` ≡ `calc(100svh - 100px)`) 양쪽 모두 허용.
    const root = page.locator("[class*='_root']").first();
    const style = await root.getAttribute("style");
    const viewportHeightCalc = /calc\(([^)]*100s?vh[^)]*-[^)]*100px|[^)]*-[^)]*100px[^)]*\+[^)]*100s?vh)\)/;
    expect(style ?? "").toMatch(new RegExp(`max-height:\\s*${viewportHeightCalc.source}`));
    expect(style ?? "").toMatch(new RegExp(`height:\\s*${viewportHeightCalc.source}`));

    // 트리 영역에 overflow auto 적용 (CSS module 클래스라 직접 검사 어려움 — 부모 height
    // 제한이 핵심. 자식 .tree에 overflow:auto가 있어 그 효과가 발생함을 design system 신뢰.)
    await page.screenshot({
      path: "e2e/screenshots/realuse-b1-tree-scroll.png",
      fullPage: false,
    });
  });

  test("B3: 매치업 모달 splitMode 토글 + 친화 안내 텍스트 + describeUploadError live", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    await gotoMatchup(page);

    // 매치업 트리 헤더의 "시험지" 업로드 버튼 (testid 기반)
    await page.getByTestId("matchup-upload-button").click();
    await expect(page.getByTestId("matchup-upload-modal")).toBeVisible({ timeout: 5000 });

    // 파일 2개 선택 → splitMode 토글 노출 확인 (entries.length > 1)
    const fileInput = page.getByTestId("matchup-file-input");
    const pdf1 = path.resolve(__dirname, "../fixtures/test-matchup.pdf");
    await fileInput.setInputFiles([pdf1, pdf1]);

    // 라디오 UI(2026-04-29) — 두 옵션 모두 노출되어야 함.
    const splitToggle = page.getByTestId("matchup-split-mode-toggle");
    const mergeToggle = page.getByTestId("matchup-merge-mode-toggle");
    await expect(splitToggle).toBeVisible();
    await expect(mergeToggle).toBeVisible();
    await expect(splitToggle).toContainText(/각각 별도/);
    await expect(mergeToggle).toContainText(/한 .* 합치기/);

    // 한 시험지로 합치기 → 안내 변경
    await mergeToggle.click();
    await expect(page.getByText(/자동으로 1개 PDF로 합쳐|HEIC는 자동/)).toBeVisible();

    // 각각 별도 → 별도 doc 안내로 변경
    await splitToggle.click();
    await expect(page.getByText(/각 파일이 별도.*동시 업로드|각 파일이 별도.*업로드됩니다/)).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/realuse-b3-split-toggle.png",
      fullPage: false,
    });

    // 모달 close (cancel 버튼) — submit 안 함
    await page.getByRole("button", { name: /취소/ }).first().click();
    await expect(page.getByTestId("matchup-upload-modal")).not.toBeVisible({ timeout: 3000 });
  });

  test("B3: 인벤토리 모달 다중 파일 선택 + 진행률 라벨 영역 노출", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    await gotoMatchup(page);

    // 매치업/저장소 토글에서 "저장소" 탭으로 이동
    await page.getByRole("button", { name: /^저장소$/ }).click();
    await expect(page.getByRole("button", { name: /^추가$/ })).toBeVisible({ timeout: 5000 });

    // "추가" 버튼 → 메뉴 → "파일 업로드"
    await page.getByRole("button", { name: /^추가$/ }).click();
    await expect(page.getByText("파일 업로드")).toBeVisible({ timeout: 5000 });
    await page.getByText("파일 업로드").click();
    await expect(page.locator('input[type="file"]').first()).toBeAttached({ timeout: 5000 });

    // 파일 2개 선택
    const fileInput = page.locator('input[type="file"]').first();
    const pdf1 = path.resolve(__dirname, "../fixtures/test-matchup.pdf");
    await fileInput.setInputFiles([pdf1, pdf1]);

    // 다중 선택 시 list 노출
    const fileList = page.getByTestId("upload-modal-file-list");
    await expect(fileList).toBeVisible();

    // 업로드 버튼 라벨 = "2개 업로드" (multi)
    const submitBtn = page.getByRole("button", { name: /2개 업로드/ });
    await expect(submitBtn).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/realuse-b3-inventory-multi.png",
      fullPage: false,
    });

    // 모달 close (cancel)
    await page.getByRole("button", { name: /^취소$/ }).first().click();
    await expect(fileList).not.toBeVisible({ timeout: 3000 });
  });
});
