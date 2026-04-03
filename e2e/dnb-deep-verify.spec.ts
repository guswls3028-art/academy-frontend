/**
 * DNB 테넌트 전수 검사 — elementary_middle 모드에서 "고등" 잔해가 없는지
 * 모든 화면 구석구석 확인
 */
import { test, expect, type Page } from "@playwright/test";

const DNB_BASE = "https://dnbacademy.co.kr";
const API_BASE = "https://api.hakwonplus.com";
const DNB_CODE = "dnb";
const DNB_USER = "e2e_deep_test";
const DNB_PASS = "test1234";

async function loginDnb(page: Page) {
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: DNB_USER, password: DNB_PASS, tenant_code: DNB_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
    timeout: 15000,
  });
  if (resp.status() !== 200) throw new Error(`Login failed: ${resp.status()}`);
  const tokens = await resp.json() as { access: string; refresh: string };
  await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit", timeout: 20000 });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch {}
  }, { access: tokens.access, refresh: tokens.refresh, code: DNB_CODE });
  await page.goto(`${DNB_BASE}/admin`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);
}

/** 페이지 내 "고등" 텍스트가 선택지/버튼/드롭다운에 없는지 체크 */
async function assertNoHighSchoolUI(page: Page, context: string) {
  // select option에 "고등" 없는지
  const allSelects = page.locator("select");
  const count = await allSelects.count();
  for (let i = 0; i < count; i++) {
    const opts = await allSelects.nth(i).locator("option").allTextContents();
    const hasHigh = opts.some(o => o === "고등");
    if (hasHigh) {
      console.error(`[${context}] select #${i} has "고등" option:`, opts);
    }
    expect(hasHigh, `[${context}] select #${i} should not have 고등`).toBeFalsy();
  }
  // choice button에 "고등" 없는지
  const choiceBtns = page.locator(".ds-choice-btn, [class*=segment]");
  const btnCount = await choiceBtns.count();
  for (let i = 0; i < btnCount; i++) {
    const txt = await choiceBtns.nth(i).textContent();
    if (txt?.trim() === "고등") {
      console.error(`[${context}] choice btn #${i} is "고등"`);
    }
    expect(txt?.trim(), `[${context}] btn #${i}`).not.toBe("고등");
  }
}

test.describe("DNB 전수 검사 — 고등 잔해 없음", () => {
  test.beforeEach(async ({ page }) => {
    await loginDnb(page);
  });

  test("1. 학생 추가 모달 (1명 등록)", async ({ page }) => {
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(1500);

    await page.locator("button").filter({ hasText: /학생 추가/ }).first().click();
    await page.waitForTimeout(800);

    const singleBtn = page.locator("button").filter({ hasText: /1명만 등록/ }).first();
    if (await singleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await singleBtn.click();
      await page.waitForTimeout(500);
    }

    await assertNoHighSchoolUI(page, "학생등록모달");

    // 초등 선택 시 계열/출신중학교 없음
    const selects = page.locator("select.ds-select");
    await selects.first().selectOption("ELEMENTARY");
    await page.waitForTimeout(300);
    await expect(page.locator('input[name="major"]')).toHaveCount(0);
    await expect(page.locator('input[name="originMiddleSchool"]')).toHaveCount(0);

    // 초등 학년 6개
    const gradeOpts = await selects.nth(1).locator("option").allTextContents();
    expect(gradeOpts).toContain("6학년");

    await page.screenshot({ path: "e2e/screenshots/dnb-deep-create.png" });
    console.log("✓ 학생 추가 모달 OK");
  });

  test("2. 학생 수정 모달", async ({ page }) => {
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(1500);

    // 첫 번째 학생 클릭
    const firstRow = page.locator("tr[data-row-key], table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(1000);

      // 수정 버튼 찾기
      const editBtn = page.locator("button").filter({ hasText: /수정|편집/ }).first();
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(800);

        await assertNoHighSchoolUI(page, "학생수정모달");
        await page.screenshot({ path: "e2e/screenshots/dnb-deep-edit.png" });
        console.log("✓ 학생 수정 모달 OK");
      } else {
        console.log("⚠ 수정 버튼 없음 (학생 없을 수 있음)");
      }
    } else {
      console.log("⚠ 학생 행 없음");
    }
  });

  test("3. 학생 필터", async ({ page }) => {
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(1500);

    await assertNoHighSchoolUI(page, "학생필터");
    await page.screenshot({ path: "e2e/screenshots/dnb-deep-filter.png" });
    console.log("✓ 학생 필터 OK");
  });

  test("4. 클리닉 화면", async ({ page }) => {
    const clinicLink = page.locator("text=클리닉").first();
    if (await clinicLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clinicLink.click();
      await page.waitForTimeout(2000);

      await assertNoHighSchoolUI(page, "클리닉메인");
      await page.screenshot({ path: "e2e/screenshots/dnb-deep-clinic.png" });

      // 클리닉 생성 패널 열기
      const createBtn = page.locator("button").filter({ hasText: /생성|추가|새 세션/ }).first();
      if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        await assertNoHighSchoolUI(page, "클리닉생성");
        await page.screenshot({ path: "e2e/screenshots/dnb-deep-clinic-create.png" });
      }
      console.log("✓ 클리닉 OK");
    } else {
      console.log("⚠ 클리닉 메뉴 없음");
    }
  });

  test("5. 수업 > 수강생 등록 모달", async ({ page }) => {
    const lectureLink = page.locator("text=수업").first();
    if (await lectureLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lectureLink.click();
      await page.waitForTimeout(2000);

      // 첫 번째 수업 클릭
      const lectureRow = page.locator("a, tr, [class*=card]").filter({ hasText: /강의|수업|반/ }).first();
      if (await lectureRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await lectureRow.click();
        await page.waitForTimeout(1500);

        // 수강생 탭/관리 영역
        const enrollTab = page.locator("text=수강생").first();
        if (await enrollTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await enrollTab.click();
          await page.waitForTimeout(1000);

          // 수강생 추가 버튼
          const addBtn = page.locator("button").filter({ hasText: /추가|등록/ }).first();
          if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await addBtn.click();
            await page.waitForTimeout(1000);
            await assertNoHighSchoolUI(page, "수강생등록모달");
            await page.screenshot({ path: "e2e/screenshots/dnb-deep-enroll.png" });
          }
        }
      }
      console.log("✓ 수업/수강생 OK");
    } else {
      console.log("⚠ 수업 메뉴 없음");
    }
  });

  test("6. 가입 신청 페이지 (학생 가입 폼)", async ({ page }) => {
    // 가입 신청 페이지는 로그인 없이 접근
    await page.goto(`${DNB_BASE}/login/dnb`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 로그인 버튼 클릭하여 모달 열기
    const loginBtn = page.locator("button").filter({ hasText: /로그인/ }).first();
    if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(500);
    }

    // 가입 신청 링크/버튼
    const signupLink = page.locator("text=가입 신청").first();
    if (await signupLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signupLink.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: "e2e/screenshots/dnb-deep-signup.png" });

      // 학교 유형 segment 확인
      const segments = page.locator("[class*=segment] button, [class*=Segment] button");
      const segTexts = await segments.allTextContents();
      console.log("Signup segments:", segTexts);

      if (segTexts.length > 0) {
        expect(segTexts.some(t => t.includes("고등"))).toBeFalsy();
        // 초등 또는 중등이 있어야 함
        const hasElemOrMid = segTexts.some(t => t.includes("초등") || t.includes("중등"));
        expect(hasElemOrMid).toBeTruthy();
      }

      console.log("✓ 가입 신청 OK");
    } else {
      console.log("⚠ 가입 신청 링크 없음");
      await page.screenshot({ path: "e2e/screenshots/dnb-deep-signup-notfound.png" });
    }
  });
});
