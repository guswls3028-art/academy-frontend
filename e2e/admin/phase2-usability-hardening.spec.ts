import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

async function visitAdmin(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

test.describe("2차 운영 안정화: 막다른 화면과 원시 alert 제거", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("자료 메뉴의 성적표/메시지 보류 화면은 실제 대체 경로를 안내한다", async ({ page }) => {
    await visitAdmin(page, "/admin/materials/reports");

    await expect(page.getByText("성적표는 차시 성적탭에서 바로 확인할 수 있습니다")).toBeVisible();
    await expect(page.getByText("아직 구현되지 않은 기능입니다")).toHaveCount(0);

    const lecturesButton = page.getByRole("button", { name: "강의에서 성적표 열기" });
    await expect(lecturesButton).toBeVisible();
    await lecturesButton.click();
    await page.waitForURL(/\/admin\/lectures/, { timeout: 10_000 });

    await visitAdmin(page, "/admin/materials/messages");

    await expect(page.getByText("알림톡 템플릿과 발송 이력은 메시지 메뉴에서 관리합니다")).toBeVisible();
    await expect(page.getByText("아직 구현되지 않은 기능입니다")).toHaveCount(0);

    const templatesButton = page.getByRole("button", { name: "템플릿 관리" });
    await expect(templatesButton).toBeVisible();
    await templatesButton.click();
    await page.waitForURL(/\/admin\/message\/templates/, { timeout: 10_000 });
  });

  test("공개 모더레이션 차단 입력 오류는 브라우저 alert 대신 앱 피드백으로 처리된다", async ({ page }) => {
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await visitAdmin(page, "/admin/landing-public/inbox");
    await page.getByRole("button", { name: "차단 사용자" }).click();

    await expect(page.getByRole("heading", { name: "새 차단 추가" })).toBeVisible();
    await expect(page.getByLabel("차단할 사용자 ID")).toBeVisible();
    await expect(page.getByPlaceholder("user_id")).toHaveCount(0);

    await page.getByTestId("block-submit").click();
    await expect(page.getByText("차단할 사용자 ID를 숫자로 입력해 주세요.")).toBeVisible();
    expect(dialogs).toEqual([]);
  });
});
