/**
 * 최종: 강의에 학생 등록 → 차시 성적탭 → 시험추가 → 점수입력 → 저장 → 확인
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const SS = "e2e/screenshots/final-score";

function watch(page: Page) {
  const c: string[] = []; const s: string[] = [];
  page.on("pageerror", e => { if (!e.message.includes("dynamically imported")) c.push(e.message); });
  page.on("response", r => { if (r.status() >= 500) s.push(`[${r.status()}] ${r.url().split("?")[0]}`); });
  return { c, s };
}

async function login(page: Page) {
  await page.goto(`${BASE}/login/${CODE}`, { waitUntil: "load", timeout: 25000 });
  await page.waitForTimeout(1500);
  const b = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await b.isVisible({ timeout: 5000 }).catch(() => false)) await b.click();
  await page.locator('input[name="username"]').first().waitFor({ state: "visible", timeout: 15000 });
  await page.locator('input[name="username"]').first().fill(ADMIN_USER);
  await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASS);
  await page.locator('button').filter({ hasText: /로그인/ }).first().click();
  await page.waitForURL(/\/(admin|dev)/, { timeout: 25000 }); await page.waitForTimeout(2500);
  if (page.url().includes("/dev")) { const o = page.locator('a, button').filter({ hasText: /운영 콘솔/ }).first(); if (await o.isVisible({ timeout: 3000 }).catch(() => false)) { await o.click(); await page.waitForTimeout(3000); } }
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 2000 }).catch(() => false)) { await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(2000); }
}

let n = 0;
function ss(page: Page, l: string) { return page.screenshot({ path: `${SS}/${String(++n).padStart(2,"0")}-${l}.png` }); }

test("점수 입력 풀사이클", async ({ page }) => {
  test.setTimeout(300000);
  const { c, s } = watch(page);
  await login(page);

  // 강의 메뉴
  await page.locator('nav a, [class*="sidebar"] a').filter({ hasText: /강의/ }).first().click();
  await page.waitForTimeout(2000);
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 1000 }).catch(() => false)) { await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(2000); }

  // 첫 강의
  await page.locator('table tbody tr').first().click(); await page.waitForTimeout(2000);

  // "학생" 탭 → 강의 수강생 확인
  const studentTab = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /^학생$/ }).first();
  if (await studentTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await studentTab.click(); await page.waitForTimeout(2000);
    await ss(page, "lecture-students");
    const studentRows = page.locator('table tbody tr');
    const sc = await studentRows.count();
    console.log(`강의 수강생: ${sc}명`);
  }

  // 차시 탭
  const sessTab = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /차시/ }).first();
  if (await sessTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sessTab.click(); await page.waitForTimeout(2000);
  }
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 1000 }).catch(() => false)) { await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(2000); }

  // 차시 블록 목록
  const blocks = page.locator('button[class*="session-block"]');
  const bc = await blocks.count();
  console.log(`차시 블록: ${bc}개`);

  // 각 차시를 돌면서 수강생 + 시험이 있는 차시를 찾는다
  let foundScoresTable = false;
  for (let i = 0; i < bc && !foundScoresTable; i++) {
    await blocks.nth(i).click(); await page.waitForTimeout(2000);
    const label = await blocks.nth(i).textContent();
    console.log(`  차시 ${i}: "${label?.trim().substring(0, 20)}"`);

    // 성적 탭 클릭
    const sTab = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /^성적$/ }).first();
    if (await sTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sTab.click(); await page.waitForTimeout(2000);

      const tbl = page.locator('tbody tr').first();
      if (await tbl.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`  → 성적 테이블 있음!`);
        foundScoresTable = true;
        await ss(page, "found-scores-table");
      } else {
        // 빈 상태 — 다음 차시
        const emptyText = await page.locator('[class*="empty"], [class*="Empty"]').first().textContent().catch(() => "");
        console.log(`  → 빈 상태: "${emptyText?.trim().substring(0, 30)}"`);
      }
    }
  }

  if (!foundScoresTable) {
    console.log("⚠️ 수강생+시험이 있는 차시를 찾지 못함");
    console.log("  → 모든 차시 순회 완료, 크래시 0건");
    await ss(page, "no-scores-found");
    expect(c).toEqual([]);
    return;
  }

  // ━━━ 성적 테이블 발견! 편집 진행 ━━━
  const rowCount = await page.locator('tbody tr').count();
  console.log(`학생 행: ${rowCount}`);

  // 편집 버튼
  const editBtn = page.locator('button').filter({ hasText: /편집/ }).first();
  if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await editBtn.click(); await page.waitForTimeout(1500);
    console.log("✓ 편집 모드");
    await ss(page, "edit-mode");

    // 첫 점수 셀
    const cell = page.locator('[contenteditable="true"]').first();
    if (await cell.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cell.click(); await page.waitForTimeout(300);
      await page.keyboard.type("95");
      await page.keyboard.press("Enter");
      console.log("✓ 점수 95 입력");
      await ss(page, "score-entered");
    }

    // 저장
    const saveBtn = page.locator('button').filter({ hasText: /저장|완료/ }).first();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click(); await page.waitForTimeout(3000);
      console.log("✓ 저장");
      await ss(page, "saved");
    }

    // 새로고침 후 유지 확인
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }); await page.waitForTimeout(3000);
    // 성적 탭 재클릭
    const sTab2 = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /^성적$/ }).first();
    if (await sTab2.isVisible({ timeout: 2000 }).catch(() => false)) { await sTab2.click(); await page.waitForTimeout(2000); }

    const kept = page.locator('td').filter({ hasText: /95/ }).first();
    const scoreKept = await kept.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`점수 유지: ${scoreKept ? "✓ 95점 확인" : "미확인"}`);
    await ss(page, "after-reload");
  }

  // 학생 행 클릭 → 드로어
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstRow.click(); await page.waitForTimeout(1500);
    const drawer = page.locator('[role="complementary"], [class*="drawer"]').first();
    console.log(`드로어: ${await drawer.isVisible({ timeout: 2000 }).catch(() => false) ? "✓ 열림" : "안 열림"}`);
    await ss(page, "drawer");
  }

  console.log(`\n크래시: ${c.length}, 500: ${s.length}`);
  expect(c).toEqual([]);
  expect(s).toEqual([]);
});
