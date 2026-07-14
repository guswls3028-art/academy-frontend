/** 알림톡 발송 모달 경계조건 — 실제 발송 없이 채널·본문·확인 가드를 검증한다. */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function openFirstStudentMessageModal(page: import("@playwright/test").Page) {
  await gotoAndSettle(page, `${BASE}/admin/students`);
  const checkbox = page.locator("tbody input[type=checkbox]").first();
  await expect(checkbox).toBeVisible();
  await checkbox.check();
  await page.getByRole("button", { name: /메시지 발송/ }).click();
  const modal = page.locator(".send-message-modal");
  await expect(modal).toBeVisible();
  return modal;
}

test.describe("알림톡 발송 경계조건", () => {
  test.beforeEach(async ({ page }) => loginViaUI(page, "admin"));

  test("발송 모달에는 알림톡만 존재하고 SMS 전환 경로가 없다", async ({ page }) => {
    const modal = await openFirstStudentMessageModal(page);
    await expect(modal.getByText("알림톡", { exact: true }).first()).toBeVisible();
    await expect(modal.getByRole("button", { name: /^SMS$/ })).toHaveCount(0);
    await expect(modal.getByText(/LMS|문자 발송/)).toHaveCount(0);
  });

  test("빈 본문은 발송 확인 단계로 넘어가지 않는다", async ({ page }) => {
    const modal = await openFirstStudentMessageModal(page);
    const sendButton = modal.getByRole("button", { name: /명에게.*발송/ }).last();
    if (await sendButton.isVisible().catch(() => false)) {
      await expect(sendButton).toBeDisabled();
    }
    await expect(modal.getByRole("button", { name: "발송하기" })).toHaveCount(0);
  });

  test("좁은 화면에서도 닫기와 주요 발송 컨트롤에 접근할 수 있다", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 600 });
    const modal = await openFirstStudentMessageModal(page);
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: /닫기/ }).first()).toBeVisible();
    await expect(modal.getByText(/알림톡 발송|문구/).first()).toBeVisible();
  });
});
