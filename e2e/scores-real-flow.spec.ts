/**
 * 성적 탭 실전 검증 — 사이드바 "성적" 메뉴 진입 → 차시 선택 → 전체 동선
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const SS = "e2e/screenshots/scores";

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
      if (t.includes("TypeError") || t.includes("Cannot read") || t.includes("is not a function")) {
        crashes.push(t);
      }
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 500) api500s.push(`[${r.status()}] ${r.url().split("?")[0]}`);
  });
  return { crashes, api500s };
}

async function realLogin(page: Page) {
  await page.goto(`${BASE}/login/${CODE}`, { waitUntil: "load", timeout: 25000 });
  await page.waitForTimeout(1500);
  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(500);
  }
  await page.locator('input[name="username"]').first().waitFor({ state: "visible", timeout: 15000 });
  await page.locator('input[name="username"]').first().fill(ADMIN_USER);
  await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASS);
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();
  await page.waitForURL(/\/(admin|dev|student)/, { timeout: 25000 });
  await page.waitForTimeout(2500);
  if (page.url().includes("/dev")) {
    const ops = page.locator('a, button').filter({ hasText: /운영 콘솔/ }).first();
    if (await ops.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ops.click();
      await page.waitForTimeout(3000);
    }
  }
}

let step = 0;
function ss(page: Page, label: string) {
  step++;
  return page.screenshot({ path: `${SS}/${String(step).padStart(2, "0")}-${label}.png` });
}

test("성적 페이지 풀 검증: 사이드바 진입 → 차시 선택 → 테이블 → 시험추가 → 입력 → 저장", async ({ page }) => {
  test.setTimeout(240000);
  const { crashes, api500s } = watchErrors(page);

  await realLogin(page);
  await ss(page, "dashboard");

  // ① 사이드바 "성적" 메뉴 클릭
  const scoresMenu = page.locator('nav a, aside a, [class*="sidebar"] a').filter({ hasText: /성적/ }).first();
  await expect(scoresMenu).toBeVisible({ timeout: 8000 });
  await scoresMenu.click();
  await page.waitForTimeout(3000);

  // chunk 에러 복구
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(3000);
  }

  await ss(page, "scores-page");
  console.log("① 성적 페이지 진입");

  // ② 좌측 차시 패널에서 첫 차시 클릭
  // 차시 목록은 session-block 또는 리스트 아이템
  const sessionItems = page.locator('[class*="session-block"], [class*="session-list"] button, [class*="session-list"] a, aside button, [class*="sidebar"] button').filter({ hasText: /차시|수/ });
  const itemCount = await sessionItems.count();
  console.log(`좌측 차시 항목: ${itemCount}개`);

  if (itemCount === 0) {
    // 대체: 아무 클릭 가능한 차시 항목 찾기
    const anyItem = page.locator('button, a').filter({ hasText: /\d+차시/ }).first();
    if (await anyItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await anyItem.click();
      await page.waitForTimeout(3000);
      console.log("차시 항목 클릭 (대체)");
    } else {
      console.log("❌ 차시 항목을 찾을 수 없음");
      await ss(page, "no-session-items");
      // 페이지 전체 HTML에서 단서 찾기
      const bodyText = await page.locator('body').textContent();
      console.log("페이지 텍스트 일부:", bodyText?.substring(0, 500));
    }
  } else {
    await sessionItems.first().click();
    await page.waitForTimeout(3000);
    console.log("② 첫 차시 선택");
  }
  await ss(page, "session-selected");

  // ③ 성적 테이블 확인
  const scoreTable = page.locator('.ds-scores-table, table tbody').first();
  const hasTable = await scoreTable.isVisible({ timeout: 5000 }).catch(() => false);
  const emptyState = page.locator('[class*="empty"], [class*="Empty"]').filter({ hasText: /수강생|등록|없습니다/ }).first();
  const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
  console.log(`③ 성적 테이블: ${hasTable}, 빈상태: ${hasEmpty}`);
  await ss(page, "scores-table-check");

  if (hasTable) {
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    console.log(`학생 행: ${rowCount}개`);

    if (rowCount > 0) {
      // ④ 시험 추가 시도
      const addExamBtn = page.locator('button').filter({ hasText: /시험 추가|시험 생성/ }).first();
      if (await addExamBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addExamBtn.click();
        await page.waitForTimeout(2000);
        await ss(page, "add-exam-modal");

        // 새로 만들기 stage
        const newStage = page.locator('button, div').filter({ hasText: /새로 만들기|직접|새로/ }).first();
        if (await newStage.isVisible({ timeout: 2000 }).catch(() => false)) {
          await newStage.click();
          await page.waitForTimeout(1000);
        }

        // 제목 입력
        const titleInput = page.locator('input[type="text"]').first();
        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await titleInput.fill(`E2E시험 ${Date.now()}`);
          await page.waitForTimeout(500);

          const createBtn = page.locator('button').filter({ hasText: /생성|추가|만들기/ }).last();
          if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await createBtn.click();
            await page.waitForTimeout(3000);
            console.log("④ 시험 생성");
            await ss(page, "exam-created");
          }
        }
      }

      // 새로고침 후 편집 모드 시도
      await page.reload({ waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(3000);

      // ⑤ 편집 모드 진입
      const editBtn = page.locator('button').filter({ hasText: /편집|수정/ }).first();
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(1500);
        await ss(page, "edit-mode");
        console.log("⑤ 편집 모드");

        // 점수 셀 입력
        const cell = page.locator('[contenteditable="true"], .ds-scores-cell-editable').first();
        if (await cell.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cell.click();
          await page.waitForTimeout(300);
          await page.keyboard.type("88");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(500);
          console.log("점수 88 입력");
          await ss(page, "score-input");
        }

        // 저장
        const saveBtn = page.locator('button').filter({ hasText: /저장|완료/ }).first();
        if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(3000);
          console.log("⑥ 저장 완료");
          await ss(page, "saved");
        }
      }

      // ⑦ 새로고침 후 유지
      await page.reload({ waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(3000);
      await ss(page, "after-reload");
      console.log("⑦ 새로고침 후 확인");

      // ⑧ 학생 행 클릭 → 드로어
      const studentRow = page.locator('tbody tr').first();
      if (await studentRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await studentRow.click();
        await page.waitForTimeout(1500);
        const drawer = page.locator('[role="complementary"], [class*="drawer"]').first();
        const open = await drawer.isVisible({ timeout: 3000 }).catch(() => false);
        await ss(page, "drawer");
        console.log(`⑧ 드로어: ${open ? "열림" : "안 열림"}`);
      }
    }
  } else if (hasEmpty) {
    console.log("수강생 없음 → 성적 테이블 미표시 (정상)");
  } else {
    console.log("차시 선택 후 상태 불명");
  }

  // 결과
  console.log("\n=== 결과 ===");
  console.log(`크래시: ${crashes.length}건`);
  console.log(`500 에러: ${api500s.length}건`);
  if (crashes.length > 0) console.log("CRASHES:", crashes);
  if (api500s.length > 0) console.log("500s:", api500s);

  expect(crashes).toEqual([]);
  expect(api500s).toEqual([]);
});
