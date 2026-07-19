import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("관리자 개발자 노트", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("운영 릴리스 목록과 상세를 확인한다", async ({ page }) => {
    await page.goto(`${BASE}/admin/developer`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("patch-notes-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "운영에 반영된 변경만 기록합니다." })).toBeVisible();

    const latestRelease = page.getByRole("button", { name: /v1\.8\.1 알림톡 운영 체계 단순화/ });
    await expect(latestRelease).toBeVisible();
    await latestRelease.click();

    const dialog = page.getByRole("dialog", { name: "알림톡 운영 체계 단순화" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("발송 수단을 알림톡으로 명확히 고정", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "릴리스 상세 닫기" }).click();
    await expect(dialog).toBeHidden();
  });
});
