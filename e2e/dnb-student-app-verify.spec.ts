/**
 * DNB 학생앱 프로필 — 초등/중등만 표시, 고등 없음
 */
import { test, expect, type Page } from "@playwright/test";

const DNB_BASE = "https://dnbacademy.co.kr";
const API_BASE = "https://api.hakwonplus.com";
const DNB_CODE = "dnb";

test("DNB 학생앱 프로필: 학교급 초등/중등, 고등 없음", async ({ page }) => {
  // 학생 로그인
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: "e2e_test_student", password: "test1234", tenant_code: DNB_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
    timeout: 15000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit", timeout: 20000 });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch {}
  }, { access: tokens.access, refresh: tokens.refresh, code: DNB_CODE });

  await page.goto(`${DNB_BASE}/student`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e/screenshots/dnb-student-home.png" });

  // 프로필 페이지 직접 이동
  await page.goto(`${DNB_BASE}/student/profile`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "e2e/screenshots/dnb-student-profile.png" });

  // 프로필에서 학교급 표시 확인
  const bodyText = await page.locator("body").textContent() || "";
  console.log("Profile page has 초등:", bodyText.includes("초등"));
  console.log("Profile page has 고등:", bodyText.includes("고등"));

  // 수정 모드 진입
  const editBtn = page.locator("button").filter({ hasText: /수정|편집/ }).first();
  if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/dnb-student-profile-edit.png" });

    // select/button에서 "고등" 없는지
    const allSelects = page.locator("select");
    const selCount = await allSelects.count();
    for (let i = 0; i < selCount; i++) {
      const opts = await allSelects.nth(i).locator("option").allTextContents();
      console.log(`Student profile select #${i}:`, opts);
      const hasHigh = opts.some(o => o === "고등");
      expect(hasHigh, `학생앱 프로필 select #${i} 고등 없어야 함`).toBeFalsy();

      // 초등 or 중등은 있어야 함 (학교급 select인 경우)
      if (opts.some(o => o === "초등" || o === "중등")) {
        expect(opts.some(o => o === "초등"), "초등 옵션 존재").toBeTruthy();
        expect(opts.some(o => o === "중등"), "중등 옵션 존재").toBeTruthy();
      }
    }

    // 학년 select 확인 (초등이면 1~6)
    for (let i = 0; i < selCount; i++) {
      const opts = await allSelects.nth(i).locator("option").allTextContents();
      if (opts.some(o => o.includes("학년"))) {
        console.log("Grade options in edit:", opts);
        // 현재 ELEMENTARY이므로 6학년까지
        expect(opts.some(o => o === "6학년"), "초등 6학년").toBeTruthy();
      }
    }

    console.log("✓ 학생앱 프로필 편집 OK — 고등 없음");
  } else {
    console.log("⚠ 수정 버튼 없음");
  }
});
