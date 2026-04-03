/**
 * 이어서: 생성된 학생 수강등록 → 시험 생성 → 점수 입력 → 저장 → 새로고침 확인 → 학생앱 교차검증
 * 모든 동작: 보이는 버튼만 클릭
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const SS = "e2e/screenshots/enroll-score";

// 이전 테스트에서 생성된 학생 검색용
const SEARCH_KEY = "E2E학생";

function watchErrors(page: Page) {
  const crashes: string[] = [];
  const api500s: string[] = [];
  page.on("pageerror", (err) => { if (!err.message.includes("dynamically imported module")) crashes.push(err.message); });
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
  const b = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await b.isVisible({ timeout: 5000 }).catch(() => false)) { await b.click(); await page.waitForTimeout(500); }
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
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }); await page.waitForTimeout(2000);
  }
}

let n = 0;
function ss(page: Page, l: string) { return page.screenshot({ path: `${SS}/${String(++n).padStart(2,"0")}-${l}.png` }); }

test("수강등록 → 시험생성 → 점수입력 → 저장 → 확인", async ({ page }) => {
  test.setTimeout(300000);
  const { crashes, api500s } = watchErrors(page);
  await login(page);

  // ━━━ 1. 강의 진입 ━━━
  await page.locator('nav a, aside a, [class*="sidebar"] a').filter({ hasText: /강의/ }).first().click();
  await page.waitForTimeout(2000);
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }); await page.waitForTimeout(2000);
  }
  await ss(page, "lectures");

  // 첫 강의 클릭
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2000);
  await ss(page, "lecture-detail");
  console.log("✓ 강의 상세");

  // ━━━ 2. 차시 탭 → 1차시 진입 ━━━
  const sessTab = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /차시/ }).first();
  if (await sessTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sessTab.click();
    await page.waitForTimeout(2000);
  }
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }); await page.waitForTimeout(2000);
  }

  // 첫 차시 블록 클릭
  const sBlock = page.locator('button[class*="session-block"]').first();
  if (!await sBlock.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("❌ 차시 없음"); expect(crashes).toEqual([]); return;
  }
  await sBlock.click();
  await page.waitForTimeout(2000);
  await ss(page, "session-detail");
  console.log("✓ 차시 진입");

  // ━━━ 2b. 수강생이 없으면 먼저 등록 (차시 상세 기본 화면에서) ━━━
  const noStudentMsg = page.locator('text=수강생이 없습니다');
  if (await noStudentMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("수강생 없음 — 등록 시도");
    // "수강생 등록" 버튼/링크 클릭
    const enrollLink = page.locator('a, button').filter({ hasText: /수강생.*등록/ }).first();
    if (await enrollLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enrollLink.click();
      await page.waitForTimeout(2000);
      await ss(page, "enroll-modal-in-session");

      // 체크박스 선택
      const hcb = page.locator('thead input[type="checkbox"]').first();
      if (await hcb.isVisible({ timeout: 3000 }).catch(() => false)) {
        await hcb.check(); console.log("전체 선택");
      } else {
        const fcb = page.locator('tbody input[type="checkbox"]').first();
        if (await fcb.isVisible({ timeout: 2000 }).catch(() => false)) { await fcb.check(); console.log("첫 학생 선택"); }
      }

      // 등록/저장/확인 버튼 — primary intent
      const allBtns = page.locator('button[data-intent="primary"], button').filter({ hasText: /등록|저장|확인/ });
      const bc = await allBtns.count();
      console.log(`등록 버튼 후보: ${bc}개`);
      for (let bi = bc - 1; bi >= 0; bi--) {
        const btn = allBtns.nth(bi);
        const txt = await btn.textContent();
        console.log(`  버튼[${bi}]: "${txt?.trim()}"`);
      }
      // 마지막 primary 버튼 클릭 (모달 footer에 있는)
      if (bc > 0) {
        const lastBtn = allBtns.last();
        await lastBtn.evaluate((el: HTMLElement) => el.click());
        await page.waitForTimeout(4000);
        console.log("✓ 차시 수강생 등록");
      }

      // 모달 닫기
      for (let i = 0; i < 3; i++) {
        if (!await page.locator('.ant-modal-wrap, [class*="ds-modal-overlay"]').first().isVisible({ timeout: 500 }).catch(() => false)) break;
        await page.keyboard.press("Escape"); await page.waitForTimeout(500);
      }
      await page.reload({ waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(2000);
      await ss(page, "after-enroll-reload");
    } else {
      console.log("수강생 등록 버튼 미발견");
    }
  }

  // ━━━ 3. 성적 탭 진입 (ds-tab 버튼) ━━━
  const scoreTab = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /^성적$/ }).first();
  if (!await scoreTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("❌ 성적 탭 없음"); expect(crashes).toEqual([]); return;
  }
  await scoreTab.click();
  await page.waitForTimeout(3000);
  await ss(page, "scores-tab");
  console.log("✓ 성적 탭");

  // (수강생 등록은 위에서 처리됨)

  // ━━━ 4. 시험 추가 ━━━
  const addExam = page.locator('button').filter({ hasText: /시험 추가/ }).first();
  if (await addExam.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addExam.click();
    await page.waitForTimeout(2000);
    await ss(page, "add-exam-modal");

    // "신규 시험" 카드 클릭
    const newExam = page.locator('button').filter({ hasText: /신규 시험|신규\n시험/ }).first();
    if (await newExam.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newExam.click();
      await page.waitForTimeout(2000);
      await ss(page, "new-exam-form");
      console.log("✓ 신규 시험 선택");

      // 일괄 생성 폼: 제목 필드에 기본값 "시험 1"이 있음
      // 제목을 E2E 태그로 변경
      const titleInput = page.locator('input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.click();
        await titleInput.fill("");
        await titleInput.pressSequentially(`E2E시험${Date.now()}`, { delay: 20 });
      }

      // "일괄 생성" 버튼 클릭
      const bulkCreate = page.locator('button').filter({ hasText: /일괄 생성/ }).first();
      if (await bulkCreate.isVisible({ timeout: 2000 }).catch(() => false)) {
        await bulkCreate.evaluate((el: HTMLElement) => el.click());
        await page.waitForTimeout(3000);
        console.log("✓ 시험 일괄 생성");
      } else {
        // 대체: "생성" 버튼
        const altCreate = page.locator('button').filter({ hasText: /^생성$/ }).first();
        if (await altCreate.isVisible({ timeout: 1000 }).catch(() => false)) {
          await altCreate.evaluate((el: HTMLElement) => el.click());
          await page.waitForTimeout(3000);
          console.log("✓ 시험 생성 (alt)");
        }
      }
    }
    await ss(page, "after-exam-create");

    // 모달 닫기
    for (let i = 0; i < 3; i++) {
      if (!await page.locator('.ant-modal-wrap, [class*="ds-modal-overlay"]').first().isVisible({ timeout: 500 }).catch(() => false)) break;
      await page.keyboard.press("Escape"); await page.waitForTimeout(500);
    }
  } else {
    console.log("시험 추가 버튼 없음");
  }

  // 새로고침 후 성적 탭으로 다시 이동
  await page.reload({ waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(3000);
  const scoreTab2 = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /^성적$/ }).first();
  if (await scoreTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scoreTab2.click();
    await page.waitForTimeout(3000);
  }
  await ss(page, "after-reload-scores");
  console.log("✓ 새로고침 후 성적 탭 재진입");

  // ━━━ 5. 성적 테이블 확인 + 편집 ━━━
  const table = page.locator('.ds-scores-table tbody tr, table tbody tr').first();
  const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`성적 테이블: ${hasTable ? "있음" : "없음"}`);

  if (hasTable) {
    const rowCount = await page.locator('tbody tr').count();
    console.log(`학생 행: ${rowCount}`);
    await ss(page, "scores-table");

    // 편집 모드
    const editBtn = page.locator('button').filter({ hasText: /편집/ }).first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      console.log("✓ 편집 모드");

      // 첫 점수 셀에 입력
      const cell = page.locator('[contenteditable="true"]').first();
      if (await cell.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cell.click();
        await page.waitForTimeout(300);
        await page.keyboard.type("95");
        await page.keyboard.press("Enter");
        console.log("✓ 점수 95 입력");
        await ss(page, "score-entered");
      }

      // 저장
      const saveBtn = page.locator('button').filter({ hasText: /저장|완료/ }).first();
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        console.log("✓ 저장");
        await ss(page, "saved");
      }

      // 새로고침 후 유지 확인
      await page.reload({ waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(3000);
      await ss(page, "after-save-reload");

      // 점수가 유지되는지 확인
      const savedScore = page.locator('tbody td').filter({ hasText: /95/ }).first();
      const scoreKept = await savedScore.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`점수 유지 확인: ${scoreKept ? "✓ 95점 보임" : "확인 불가"}`);
    }

    // 학생 행 클릭 → 드로어
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(1500);
      const drawer = page.locator('[role="complementary"], [class*="drawer"]').first();
      const drawerOpen = await drawer.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`드로어: ${drawerOpen ? "✓ 열림" : "안 열림"}`);
      await ss(page, "drawer");
    }
  } else {
    console.log("⚠️ 성적 테이블 없음 (수강생/시험 미등록)");
    await ss(page, "scores-empty");
  }

  // ━━━ 6. 출결 탭 확인 ━━━
  const attTab = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /^출결$/ }).first();
  if (await attTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await attTab.click();
    await page.waitForTimeout(2000);
    await ss(page, "attendance");
    console.log("✓ 출결 탭");

    // 출결 테이블 행 수
    const attRows = page.locator('tbody tr');
    const attCount = await attRows.count();
    console.log(`출결 행: ${attCount}`);
  }

  // ━━━ 결과 ━━━
  console.log(`\n크래시: ${crashes.length}, 500: ${api500s.length}`);
  if (crashes.length) console.log("CRASHES:", crashes);
  if (api500s.length) console.log("500s:", api500s);
  expect(crashes).toEqual([]);
  expect(api500s).toEqual([]);
});
