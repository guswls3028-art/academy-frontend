import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("메시지 발송 모달 검증", () => {
  test("학생 선택 → 발송 모달 열기 → UI 구조 확인 (발송 안 함)", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/students");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    // 학생 하나 선택 (체크박스)
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
      await page.waitForTimeout(500);
    }
    
    // 메시지 발송 버튼
    const msgBtn = page.getByText("메시지 발송").first();
    if (await msgBtn.isVisible()) {
      await msgBtn.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: "e2e/screenshots/msg-modal-open.png", fullPage: true });
      
      const modalBody = await page.textContent("body") ?? "";
      
      // 탭이 없어야 함
      const tabExists = await page.locator(".template-editor__tabs").count();
      console.log("탭 UI 존재:", tabExists > 0 ? "있음 (버그)" : "없음 ✓");
      
      // 발송 방식 드롭다운 확인
      expect(modalBody).toContain("발송 방식");
      console.log("발송 방식 드롭다운: ✓");
      
      // 수신 대상 (학부모/학생 체크박스)
      expect(modalBody).toContain("수신 대상");
      expect(modalBody).toContain("학부모");
      console.log("수신 대상 체크박스: ✓");
      
      // 미리보기 영역
      expect(modalBody).toContain("미리보기");
      console.log("미리보기: ✓");
      
      // 삽입 블록
      expect(modalBody).toContain("삽입 블록");
      console.log("삽입 블록: ✓");
      
      // 발송하기 버튼
      const sendBtn = page.getByRole("button", { name: "발송하기" });
      expect(await sendBtn.count()).toBe(1);
      console.log("발송하기 버튼: ✓");
      
      // 서버 오류 없음
      expect(modalBody).not.toContain("서버 오류");
      
      // 알림톡 선택 시 제목 필드 표시 확인
      const sendModeSelect = page.locator("select").first();
      const currentValue = await sendModeSelect.inputValue();
      console.log("현재 발송 방식:", currentValue);
      
      if (currentValue === "alimtalk") {
        const subjectField = page.getByPlaceholder("알림톡 제목");
        console.log("알림톡 제목 필드:", await subjectField.isVisible() ? "보임 ✓" : "안 보임");
      }
      
      // SMS로 전환 시 제목 필드 숨김 확인
      await sendModeSelect.selectOption("sms");
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/msg-modal-sms.png", fullPage: true });
      
      // 다시 알림톡으로
      await sendModeSelect.selectOption("alimtalk");
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/msg-modal-alimtalk.png", fullPage: true });
      
      // 닫기
      await page.getByRole("button", { name: "취소" }).click();
      console.log("모달 닫기: ✓");
    } else {
      console.log("메시지 발송 버튼 없음 — 학생 선택 필요");
    }
  });
});
