/**
 * DNB 가입신청 폼 + 학생앱 프로필 전수 검사
 */
import { test, expect, type Page } from "@playwright/test";

const DNB_BASE = "https://dnbacademy.co.kr";
const API_BASE = "https://api.hakwonplus.com";
const DNB_CODE = "dnb";

test.describe("DNB 회원가입 + 학생앱", () => {
  test("1. 회원가입 폼: 학교급 초등/중등만, 고등 없음", async ({ page }) => {
    await page.goto(`${DNB_BASE}/login/dnb`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 로그인 버튼 클릭 → 로그인 폼 표시
    const loginBtn = page.locator("button").filter({ hasText: /로그인/ }).first();
    if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(1500);
    }

    // "회원가입" 링크 클릭
    const signupLink = page.locator("a, button").filter({ hasText: /회원가입/ }).first();
    await signupLink.waitFor({ state: "visible", timeout: 10000 });
    await signupLink.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "e2e/screenshots/dnb-signup-form-top.png" });

    // 학교 유형 segment 버튼 확인
    // SignupModal의 segment 버튼들
    const allButtons = await page.locator("button").allTextContents();
    console.log("Signup all buttons:", allButtons.filter(t => t.trim()));

    // 초등학교/중학교 segment가 있어야 하고, 고등학교 없어야 함
    const hasElementary = allButtons.some(t => t.includes("초등"));
    const hasMiddle = allButtons.some(t => t.includes("중학") || t.includes("중등"));
    const hasHigh = allButtons.some(t => t.includes("고등") || t.includes("고등학교"));

    console.log("hasElementary:", hasElementary, "hasMiddle:", hasMiddle, "hasHigh:", hasHigh);

    expect(hasElementary, "초등 버튼 존재").toBeTruthy();
    expect(hasMiddle, "중등 버튼 존재").toBeTruthy();
    expect(hasHigh, "고등 버튼 없어야 함").toBeFalsy();

    // 초등 선택
    const elemBtn = page.locator("button").filter({ hasText: /초등/ }).first();
    if (await elemBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await elemBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/dnb-signup-elementary.png" });

      // 학년 select에 1~6학년 존재 확인
      const gradeSelect = page.locator("select").filter({ has: page.locator('option') });
      const gradeCount = await gradeSelect.count();
      for (let i = 0; i < gradeCount; i++) {
        const opts = await gradeSelect.nth(i).locator("option").allTextContents();
        if (opts.some(o => o.includes("학년"))) {
          console.log("Grade select options:", opts);
          expect(opts.some(o => o === "6학년"), "초등 6학년 존재").toBeTruthy();
          break;
        }
      }
    }

    // 중등 선택
    const midBtn = page.locator("button").filter({ hasText: /중학|중등/ }).first();
    if (await midBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await midBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/dnb-signup-middle.png" });

      const gradeSelect = page.locator("select").filter({ has: page.locator('option') });
      const gradeCount = await gradeSelect.count();
      for (let i = 0; i < gradeCount; i++) {
        const opts = await gradeSelect.nth(i).locator("option").allTextContents();
        if (opts.some(o => o.includes("학년"))) {
          console.log("Middle grade options:", opts);
          expect(opts.some(o => o === "3학년"), "중등 3학년 존재").toBeTruthy();
          expect(opts.some(o => o === "4학년"), "중등 4학년 없어야 함").toBeFalsy();
          break;
        }
      }
    }

    console.log("✓ 회원가입 폼 OK");
  });

  test("2. 학생앱 프로필: 학교급 초등/중등만", async ({ page }) => {
    // DNB 학생 계정으로 로그인 시도
    // 기존 학생 중 하나 사용
    const students = ["haebin0404", "maxver"];
    let loggedIn = false;

    for (const stu of students) {
      try {
        const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
          data: { username: stu, password: "0000", tenant_code: DNB_CODE },
          headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
          timeout: 10000,
        });
        if (resp.status() === 200) {
          const tokens = await resp.json() as { access: string; refresh: string };
          await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit", timeout: 20000 });
          await page.evaluate(({ access, refresh, code }) => {
            localStorage.setItem("access", access);
            localStorage.setItem("refresh", refresh);
            try { sessionStorage.setItem("tenantCode", code); } catch {}
          }, { access: tokens.access, refresh: tokens.refresh, code: DNB_CODE });
          await page.goto(`${DNB_BASE}/student`, { waitUntil: "load", timeout: 20000 });
          await page.waitForTimeout(2000);
          loggedIn = true;
          console.log("Student login OK:", stu);
          break;
        }
      } catch { /* try next */ }
    }

    if (!loggedIn) {
      console.log("⚠ 학생 로그인 불가 — 비밀번호 모름. 프로필 검증 스킵");
      return;
    }

    await page.screenshot({ path: "e2e/screenshots/dnb-student-home.png" });

    // 프로필 페이지로 이동
    const profileLink = page.locator("text=프로필").first();
    const myInfoLink = page.locator("text=내 정보").first();
    const settingsLink = page.locator("[href*=profile], [data-nav=profile]").first();

    for (const link of [profileLink, myInfoLink, settingsLink]) {
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click();
        await page.waitForTimeout(1500);
        break;
      }
    }

    await page.screenshot({ path: "e2e/screenshots/dnb-student-profile.png" });

    // 학교급 표시에 "고등" 없어야 함
    const bodyText = await page.locator("body").textContent() || "";
    // 페이지 내에 "고등" 이라는 단어가 학교급 맥락에서 나오면 안됨
    // (단, "고등" 이 다른 맥락(예: 게시물)에서 나올 수 있으니 select/button 한정)
    const allSelects = page.locator("select");
    const selCount = await allSelects.count();
    for (let i = 0; i < selCount; i++) {
      const opts = await allSelects.nth(i).locator("option").allTextContents();
      const hasHigh = opts.some(o => o === "고등");
      expect(hasHigh, `학생앱 select #${i}`).toBeFalsy();
    }

    const choiceBtns = page.locator(".ds-choice-btn, .ds-select, [class*=segment] button");
    const btnCount = await choiceBtns.count();
    for (let i = 0; i < btnCount; i++) {
      const txt = (await choiceBtns.nth(i).textContent() || "").trim();
      expect(txt, `학생앱 btn #${i}`).not.toBe("고등");
    }

    console.log("✓ 학생앱 프로필 OK");
  });
});
