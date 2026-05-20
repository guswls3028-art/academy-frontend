// 모듈 카드 그리드 시각 검수.
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test("LandingEditor 카드 그리드 — 학원장 진입 시 한 화면 모듈 한눈", async ({ page }) => {
  await loginViaUI(page, "tchul-admin");
  await gotoAndSettle(page, `${PROD}/admin/settings/landing`, { timeout: 20_000 });
  await expect(page.getByText("모듈 모음")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/^(ON|OFF)$/).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${OUT}/v3-card-grid-default.png`, fullPage: true });

  // 사이드바: "모듈 모음" 진입 노출
  const moduleNav = await page.getByText("모듈 모음").count();
  // 카드 그리드: ON/OFF 라벨 노출 (각 카드 우상단)
  const onCards = await page.getByText(/^ON$/).count();
  const offCards = await page.getByText(/^OFF$/).count();
  console.log(JSON.stringify({ moduleNav, onCards, offCards }));
  expect(moduleNav).toBeGreaterThanOrEqual(1);
  expect(onCards + offCards).toBeGreaterThanOrEqual(8);

  // 카드 "편집" 클릭 → 모달 열림
  const editBtns = page.getByRole("button", { name: "편집" });
  if (await editBtns.count() > 0) {
    await editBtns.first().click();
    await expect(page.getByRole("button", { name: "닫기" })).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: `${OUT}/v3-edit-modal.png`, fullPage: false });
    // ESC로 닫기
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "닫기" })).toBeHidden({ timeout: 5_000 });
  }
});
