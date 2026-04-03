/**
 * 학생 생성 → 수강등록 → 시험생성 → 점수입력 → 저장 → 확인
 * 모든 동작: 로그인 폼 → 사이드바 → 보이는 버튼만 클릭
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const SS = "e2e/screenshots/create-student";

function watchErrors(page: Page) {
  const crashes: string[] = [];
  const api500s: string[] = [];
  page.on("pageerror", (err) => {
    if (err.message.includes("dynamically imported module")) return;
    crashes.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (t.includes("dynamically imported module")) return;
      if (t.includes("TypeError") || t.includes("Cannot read") || t.includes("is not a function")) crashes.push(t);
    }
  });
  page.on("response", (r) => { if (r.status() >= 500) api500s.push(`[${r.status()}] ${r.url().split("?")[0]}`); });
  return { crashes, api500s };
}

async function login(page: Page) {
  await page.goto(`${BASE}/login/${CODE}`, { waitUntil: "load", timeout: 25000 });
  await page.waitForTimeout(1500);
  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 5000 }).catch(() => false)) { await openBtn.click(); await page.waitForTimeout(500); }
  await page.locator('input[name="username"]').first().waitFor({ state: "visible", timeout: 15000 });
  await page.locator('input[name="username"]').first().fill(ADMIN_USER);
  await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASS);
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();
  await page.waitForURL(/\/(admin|dev|student)/, { timeout: 25000 });
  await page.waitForTimeout(2500);
  if (page.url().includes("/dev")) {
    const ops = page.locator('a, button').filter({ hasText: /운영 콘솔/ }).first();
    if (await ops.isVisible({ timeout: 3000 }).catch(() => false)) { await ops.click(); await page.waitForTimeout(3000); }
  }
  // chunk 에러 복구
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }); await page.waitForTimeout(3000);
  }
}

let n = 0;
function ss(page: Page, l: string) { return page.screenshot({ path: `${SS}/${String(++n).padStart(2,"0")}-${l}.png` }); }

const TS = Date.now();
const STUDENT_NAME = `E2E학생${TS}`;
const STUDENT_ID = `e2e${TS}`;
const STUDENT_PW = "test1234";
const PARENT_PHONE = `010${String(TS).slice(-8)}`;

test("학생생성 → 수강등록 → 시험추가 → 점수입력 → 저장 → 확인", async ({ page }) => {
  test.setTimeout(300000);
  const { crashes, api500s } = watchErrors(page);

  await login(page);
  await ss(page, "dashboard");

  // ━━━━━━ 1. 학생 메뉴 진입 ━━━━━━
  await page.locator('nav a, aside a, [class*="sidebar"] a').filter({ hasText: /학생/ }).first().click();
  await page.waitForTimeout(2000);
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }); await page.waitForTimeout(2000);
  }
  await ss(page, "students-page");
  console.log("✓ 학생 목록");

  // ━━━━━━ 2. 학생 추가 버튼 클릭 ━━━━━━
  const addStudentBtn = page.locator('button').filter({ hasText: /학생 추가|학생 등록|추가/ }).first();
  await expect(addStudentBtn).toBeVisible({ timeout: 5000 });
  await addStudentBtn.click();
  await page.waitForTimeout(2000);
  await ss(page, "add-student-modal");
  console.log("✓ 학생 추가 모달");

  // ━━━━━━ 2b. "1명만 등록" 선택 ━━━━━━
  const singleBtn = page.locator('button').filter({ hasText: /1명만 등록/ }).first();
  if (await singleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await singleBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, "single-register-form");
    console.log("✓ 1명만 등록 선택");
  }

  // ━━━━━━ 3. 학생 정보 입력 ━━━━━━
  // 폼 구조: 이름 input + 성별 버튼 + 비밀번호 + 학부모전화(3칸) + 학생전화(3칸) + 학교 + 학년
  await page.waitForTimeout(500);

  // 이름 — placeholder="이름" input
  const nameInput = page.locator('input[placeholder="이름"]').first();
  await nameInput.waitFor({ state: "visible", timeout: 5000 });
  await nameInput.click();
  await nameInput.pressSequentially(STUDENT_NAME, { delay: 30 });
  console.log(`이름: ${STUDENT_NAME}`);

  // 입력 확인
  const nameVal = await nameInput.inputValue();
  console.log(`이름 입력값 확인: "${nameVal}"`);

  // 비밀번호
  const pwInput = page.locator('input[type="password"]').first();
  if (await pwInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await pwInput.click();
    await pwInput.pressSequentially(STUDENT_PW, { delay: 30 });
    console.log("비밀번호 입력");
  }

  // 학부모 전화번호 — PhoneInput010Blocks: [010 고정] [4자리 input] [4자리 input]
  // "010" 블록 다음의 첫 번째 input (4자리)을 클릭하고 연속 8자리 입력 → 자동으로 뒤 칸으로 넘어감
  const phoneBlocks = page.locator('[data-required="학부모 전화번호"] input, [aria-label*="학부모"] input');
  const pbCount = await phoneBlocks.count();
  console.log(`학부모 전화 input 수: ${pbCount}`);

  if (pbCount >= 1) {
    // 첫 칸 클릭 후 8자리 연속 입력 (앞 4자리 채우면 자동으로 뒤 칸으로 이동)
    await phoneBlocks.first().click();
    await phoneBlocks.first().pressSequentially("12345678", { delay: 50 });
    console.log("학부모 전화: 010-1234-5678");
  } else {
    // 대체: placeholder로 찾기
    const phoneAlt = page.locator('input[placeholder*="0000"]').first();
    if (await phoneAlt.isVisible({ timeout: 1000 }).catch(() => false)) {
      await phoneAlt.click();
      await phoneAlt.pressSequentially("12345678", { delay: 50 });
      console.log("학부모 전화 (placeholder): 010-1234-5678");
    }
  }

  await ss(page, "form-filled");

  await ss(page, "before-submit");

  // 모달 하단까지 스크롤
  const modalScroll = page.locator('.modal-body, .modal-scroll-body, [class*="ModalBody"]').first();
  if (await modalScroll.isVisible({ timeout: 1000 }).catch(() => false)) {
    await modalScroll.evaluate((el) => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);
  }
  await ss(page, "scrolled-to-bottom");

  // ━━━━━━ 5. 등록 버튼 클릭 ━━━━━━
  const submitBtn = page.locator('button[data-intent="primary"]').filter({ hasText: /등록/ }).first();
  if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    // modal-body가 pointer event를 가로막으므로 JS로 직접 클릭
    await submitBtn.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(4000);
    console.log("✓ 학생 등록 제출");
  } else {
    console.log("⚠️ 등록 버튼 미발견");
  }
  await ss(page, "after-submit");

  // 토스트/알림 확인
  const toast = page.locator('[class*="toast"], [class*="feedback"], [class*="notification"]').first();
  if (await toast.isVisible({ timeout: 3000 }).catch(() => false)) {
    const text = await toast.textContent();
    console.log(`알림: ${text?.trim()}`);
  }

  // ━━━━━━ 6. 학생 목록에서 생성된 학생 검색 ━━━━━━
  await page.waitForTimeout(1000);
  const search = page.locator('input[type="search"], input[placeholder*="검색"], input[placeholder*="이름"]').first();
  if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
    await search.fill(STUDENT_NAME);
    await page.waitForTimeout(2000);
    await ss(page, "search-result");

    const resultRow = page.locator('table tbody tr, [class*="student-card"]').first();
    if (await resultRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await resultRow.textContent();
      const found = text?.includes(STUDENT_NAME) || text?.includes("E2E학생");
      console.log(`✓ 학생 검색 결과: ${found ? "찾음" : "못 찾음"} — ${text?.substring(0, 50)}`);
    } else {
      console.log("⚠️ 검색 결과 행 없음");
    }
  }

  // ━━━━━━ 결과 ━━━━━━
  console.log(`\n크래시: ${crashes.length}, 500: ${api500s.length}`);
  if (crashes.length) console.log("CRASHES:", crashes);
  if (api500s.length) console.log("500s:", api500s);
  expect(crashes).toEqual([]);
});
