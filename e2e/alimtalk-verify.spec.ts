import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("알림톡 미리보기 + 템플릿 선택 확인", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
  await page.waitForTimeout(5000);

  // 학생 선택
  const cb = page.locator('table input[type="checkbox"]');
  if (await cb.count() > 1) await cb.nth(1).check();
  await page.waitForTimeout(300);

  // 모달 열기
  await page.locator("button").filter({ hasText: /메시지 발송/ }).first().click();
  await page.waitForTimeout(2000);

  // SMS 모드 확인 (기본값)
  const textarea = page.locator("textarea").first();
  console.log(">>> SMS textarea:", await textarea.isVisible());
  await page.screenshot({ path: "e2e/screenshots/alimtalk-verify-1-sms.png" });

  // 알림톡 전환
  await page.locator("button").filter({ hasText: "알림톡" }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e/screenshots/alimtalk-verify-2-tab.png" });

  // 드롭다운 select 확인
  const select = page.locator("select");
  const selectVisible = await select.isVisible().catch(() => false);
  console.log(">>> 알림톡 드롭다운:", selectVisible);

  if (selectVisible) {
    // 옵션 개수
    const options = select.locator("option");
    const oc = await options.count();
    console.log(`>>> 템플릿 옵션: ${oc}개`);

    // 첫 번째 템플릿 선택
    if (oc > 1) {
      await select.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "e2e/screenshots/alimtalk-verify-3-selected.png" });

      // 미리보기 (좌측 카카오 카드)
      const kakaoPreview = page.locator("text=카카오 알림톡 미리보기");
      console.log(">>> 카카오 미리보기:", await kakaoPreview.isVisible().catch(() => false));

      // readOnly 본문 확인
      const readonlyBody = page.locator('[style*="pre-wrap"]').first();
      if (await readonlyBody.isVisible({ timeout: 3000 }).catch(() => false)) {
        const bodyText = await readonlyBody.textContent();
        console.log(">>> 미리보기 본문 (50자):", bodyText?.substring(0, 50));
      }

      // 발송 버튼 문구
      const sendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).first();
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(">>> 발송 버튼:", await sendBtn.textContent());
      }
    }
  }

  // SMS로 다시 전환해도 정상인지
  await page.locator("button").filter({ hasText: "SMS" }).click();
  await page.waitForTimeout(500);
  const smsTextarea = page.locator("textarea").first();
  console.log(">>> SMS 복귀 textarea:", await smsTextarea.isVisible());
  await page.screenshot({ path: "e2e/screenshots/alimtalk-verify-4-back-sms.png" });
});
