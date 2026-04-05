/**
 * DNB 최종 전수 검사 — 화면 어디에도 "고등" 텍스트 안보이는지
 */
import { test, expect, type Page } from "@playwright/test";

const DNB_BASE = "https://dnbacademy.co.kr";
const API_BASE = "https://api.hakwonplus.com";
const DNB_CODE = "dnb";

async function loginDnb(page: Page) {
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: "e2e_final_test", password: "test1234", tenant_code: DNB_CODE },
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
  await page.waitForTimeout(2500);
}

/** select/option/button에서 "고등" 문자열 검색 */
async function scanForHighSchool(page: Page, label: string) {
  // 모든 select의 option 텍스트
  const selects = page.locator("select");
  const selCount = await selects.count();
  for (let i = 0; i < selCount; i++) {
    const opts = await selects.nth(i).locator("option").allTextContents();
    if (opts.some(o => o === "고등")) {
      console.error(`❌ [${label}] select #${i} has "고등":`, opts);
      return false;
    }
  }
  // ds-choice-btn/segment 버튼에서 "고등"
  const btns = page.locator(".ds-choice-btn, [class*=segment] button");
  const btnCount = await btns.count();
  for (let i = 0; i < btnCount; i++) {
    const txt = (await btns.nth(i).textContent() || "").trim();
    if (txt === "고등" || txt === "고등학교") {
      console.error(`❌ [${label}] button "${txt}"`);
      return false;
    }
  }
  // placeholder에 "XX고" 있으면 안됨
  const inputs = page.locator("input[placeholder]");
  const inputCount = await inputs.count();
  for (let i = 0; i < inputCount; i++) {
    const ph = await inputs.nth(i).getAttribute("placeholder") || "";
    if (ph.includes("XX고") || ph === "고등학교") {
      console.error(`❌ [${label}] placeholder "${ph}"`);
      return false;
    }
  }
  console.log(`✓ [${label}] 고등 잔해 없음`);
  return true;
}

test.describe("DNB 최종 전수 검사", () => {
  test("선생앱: 학생추가/수정/필터 — 고등 잔해 없음", async ({ page }) => {
    await loginDnb(page);

    // 학생 메뉴
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(1500);

    // 1. 필터 영역 스캔
    expect(await scanForHighSchool(page, "학생목록")).toBeTruthy();

    // 2. 학생 추가 모달
    await page.locator("button").filter({ hasText: /학생 추가/ }).first().click();
    await page.waitForTimeout(800);
    const singleBtn = page.locator("button").filter({ hasText: /1명만 등록/ }).first();
    if (await singleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await singleBtn.click();
      await page.waitForTimeout(500);
    }
    expect(await scanForHighSchool(page, "학생추가모달")).toBeTruthy();

    // placeholder 체크
    const schoolInput = page.locator('input[name="school"]');
    const ph = await schoolInput.getAttribute("placeholder") || "";
    console.log("학교명 placeholder:", ph);
    expect(ph).toContain("XX초");
    expect(ph).not.toContain("XX고");

    await page.screenshot({ path: "e2e/screenshots/dnb-final-create.png" });

    // 모달 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // 3. 학생 수정 — 첫 학생 클릭
    const firstRow = page.locator("tr[data-row-key], table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(800);
      const editBtn = page.locator("button").filter({ hasText: /수정|편집/ }).first();
      if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(500);
        expect(await scanForHighSchool(page, "학생수정모달")).toBeTruthy();
        await page.keyboard.press("Escape");
      }
    }
  });

  test("회원가입 폼 — 고등 잔해 없음", async ({ page }) => {
    await page.goto(`${DNB_BASE}/login/dnb`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 로그인 버튼 → 회원가입
    const loginBtn = page.locator("button").filter({ hasText: /로그인/ }).first();
    if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }
    const signupLink = page.locator("a, button").filter({ hasText: /회원가입/ }).first();
    await signupLink.click();
    await page.waitForTimeout(1500);

    expect(await scanForHighSchool(page, "회원가입")).toBeTruthy();

    // 전체 버튼 텍스트에서 고등학교 확인
    const allBtns = await page.locator("button").allTextContents();
    const filtered = allBtns.map(t => t.trim()).filter(Boolean);
    expect(filtered.some(t => t === "고등학교" || t === "고등")).toBeFalsy();
    expect(filtered.some(t => t === "초등")).toBeTruthy();
    expect(filtered.some(t => t.includes("중"))).toBeTruthy();

    await page.screenshot({ path: "e2e/screenshots/dnb-final-signup.png" });
  });
});
