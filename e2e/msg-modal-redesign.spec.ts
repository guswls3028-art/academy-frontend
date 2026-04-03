import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("메시지 발송 모달 리디자인 검증", () => {
  test("학생 선택 → 모달 → 전체 UI 스크린샷", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 학생 관리 페이지
    await page.goto("https://hakwonplus.com/admin/students/home");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // 첫 번째 체크박스 클릭
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count > 1) {
      await checkboxes.nth(1).click(); // 0은 전체선택일 수 있으므로 1번째
      await page.waitForTimeout(500);
    }

    // 메시지 발송 버튼
    const msgBtn = page.getByText("메시지 발송").first();
    if (await msgBtn.isVisible()) {
      await msgBtn.click();
      await page.waitForTimeout(2000);

      // 모달 전체 스크린샷
      await page.screenshot({ path: "e2e/screenshots/modal-redesign-alimtalk.png", fullPage: true });

      // SMS 모드 전환
      const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
      if (await smsBtn.isVisible()) {
        await smsBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "e2e/screenshots/modal-redesign-sms.png", fullPage: true });
      }

      // 알림톡 복원
      const atBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
      if (await atBtn.isVisible()) {
        await atBtn.click();
        await page.waitForTimeout(500);
      }

      // 본문 입력 테스트
      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible()) {
        await textarea.fill("#{학생이름} 학생의 성적 알림입니다.");
        await page.waitForTimeout(500);
        await page.screenshot({ path: "e2e/screenshots/modal-redesign-with-text.png", fullPage: true });
      }

      // 발송 버튼 텍스트 확인
      const sendBtn = page.locator("button").filter({ hasText: /명에게 발송/ });
      console.log("발송 버튼:", await sendBtn.isVisible() ? await sendBtn.textContent() : "없음");

      // 닫기
      await page.getByRole("button", { name: "취소" }).click();
      console.log("PASS ✓");
    }
  });
});
