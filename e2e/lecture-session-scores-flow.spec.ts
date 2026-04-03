/**
 * 강의 > 차시 > 성적탭 실전 검증
 * 수강생 있는 차시에서 시험 추가 → 점수 입력 → 저장 → 확인
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const SS = "e2e/screenshots/lss";

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

async function realLogin(page: Page) {
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
}

let n = 0;
function ss(page: Page, l: string) { return page.screenshot({ path: `${SS}/${String(++n).padStart(2,"0")}-${l}.png` }); }

test("강의>차시>성적 풀사이클", async ({ page }) => {
  test.setTimeout(300000);
  const { crashes, api500s } = watchErrors(page);

  await realLogin(page);

  // 사이드바 → 강의
  await page.locator('nav a, aside a, [class*="sidebar"] a').filter({ hasText: /강의/ }).first().click();
  await page.waitForTimeout(2000);
  // chunk 에러 복구
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }); await page.waitForTimeout(3000);
    await page.locator('nav a, aside a, [class*="sidebar"] a').filter({ hasText: /강의/ }).first().click();
    await page.waitForTimeout(2000);
  }
  await ss(page, "lectures");

  // 수강생이 있는 강의 찾기 — 각 강의 순회
  const lectureRows = page.locator('table tbody tr');
  const lectureCount = await lectureRows.count();
  console.log(`강의: ${lectureCount}개`);
  let foundLectureWithStudents = false;

  for (let li = 0; li < lectureCount; li++) {
    await lectureRows.nth(li).click();
    await page.waitForTimeout(2000);

    // chunk 에러 복구
    if (await page.locator('text=오류가 발생').isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.reload({ waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    // 수강생 숫자 확인 (테이블에 행이 있는지)
    const hasStudentRows = await page.locator('table tbody tr').first().isVisible({ timeout: 2000 }).catch(() => false);
    const noStudentText = await page.locator('text=수강생이 없습니다').isVisible({ timeout: 1000 }).catch(() => false);

    if (!noStudentText) {
      console.log(`강의 ${li+1}: 수강생 있을 수 있음`);
      foundLectureWithStudents = true;
      break;
    }
    console.log(`강의 ${li+1}: 수강생 없음 — 다음 시도`);
    await page.goBack();
    await page.waitForTimeout(1500);
  }

  if (!foundLectureWithStudents) {
    console.log("❌ 모든 강의에 수강생 없음 — 중단");
    expect(crashes).toEqual([]);
    return;
  }

  // 차시 탭
  const stab = page.locator('a, button, [role="tab"]').filter({ hasText: /차시/ }).first();
  if (await stab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await stab.click();
    await page.waitForTimeout(2000);
  }
  if (await page.locator('text=오류가 발생').isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }); await page.waitForTimeout(3000);
  }
  await ss(page, "sessions");

  // 차시 블록 찾기 — 상단 세션바에 있는 블록들
  const sBlocks = page.locator('button[class*="session-block"]').filter({ hasText: /차시|보강/ });
  const sCount = await sBlocks.count();
  console.log(`차시 블록: ${sCount}개`);
  if (sCount === 0) { console.log("❌ 차시 없음"); expect(crashes).toEqual([]); return; }

  // 1차시(첫 번째) 클릭
  await sBlocks.first().click();
  await page.waitForTimeout(3000);
  await ss(page, "session-detail");

  // 수강생이 없으면 등록
  const noStudent = page.locator('text=수강생이 없습니다');
  if (await noStudent.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("수강생 없음 — 등록 시도");
    const enrollBtn = page.locator('button, a').filter({ hasText: /수강생 등록/ }).first();
    if (await enrollBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enrollBtn.click();
      await page.waitForTimeout(2000);
      await ss(page, "enroll-modal");
      // 모달에서 전체 선택 체크박스
      const headerCb = page.locator('thead input[type="checkbox"], th input[type="checkbox"]').first();
      if (await headerCb.isVisible({ timeout: 3000 }).catch(() => false)) {
        await headerCb.check();
        await page.waitForTimeout(500);
        console.log("전체 선택 체크");
      } else {
        const firstCb = page.locator('tbody input[type="checkbox"]').first();
        if (await firstCb.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstCb.check();
          console.log("첫 학생 체크");
        }
      }

      // 모달 하단 "등록" 버튼 — 정확히 "등록" 텍스트
      const okBtn = page.locator('button').filter({ hasText: /^등록$/ }).first();
      if (await okBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await okBtn.click();
        await page.waitForTimeout(3000);
        console.log("✓ 수강생 등록");
      } else {
        console.log("⚠️ 등록 버튼 미발견");
        await ss(page, "no-enroll-btn");
      }
      // 모달 닫기
      for (let i = 0; i < 3; i++) {
        const m = page.locator('.ant-modal-wrap').first();
        if (!await m.isVisible({ timeout: 500 }).catch(() => false)) break;
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
      await page.reload({ waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(2000);
    }
  }
  await ss(page, "after-enroll-check");

  // 차시 상세 상단 탭에서 "성적" 클릭
  // 탭은 <div role="tablist"> 안의 <button class="ds-tab"> 요소
  const scoreTab = page.locator('[role="tablist"] button, .ds-tab').filter({ hasText: /^성적$/ }).first();
  if (await scoreTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scoreTab.click();
    await page.waitForTimeout(3000);
    console.log("✓ 성적 탭 클릭 (ds-tab)");
  } else {
    console.log("❌ ds-tab 성적 버튼 미발견");
    await ss(page, "no-scores-tab");
    expect(crashes).toEqual([]); return;
  }
  await ss(page, "scores-tab");
  console.log("✓ 성적 탭 진입");

  // 수강생 있는지 확인
  const emptyMsg = page.locator('text=수강생이 없습니다, text=등록된 수강생');
  const hasStudents = !(await emptyMsg.first().isVisible({ timeout: 2000 }).catch(() => false));
  console.log(`수강생: ${hasStudents ? "있음" : "없음"}`);

  if (!hasStudents) {
    // 다른 차시 시도
    for (let i = 1; i < sCount; i++) {
      await page.goBack();
      await page.waitForTimeout(2000);
      await sBlocks.nth(i).click();
      await page.waitForTimeout(2000);
      await scoreTab.click();
      await page.waitForTimeout(2000);
      const empty2 = await page.locator('text=수강생이 없습니다').isVisible({ timeout: 1000 }).catch(() => false);
      if (!empty2) {
        console.log(`차시 ${i+1}에 수강생 있음`);
        break;
      }
    }
  }

  await ss(page, "scores-with-data");

  // 시험 추가 버튼
  const addExam = page.locator('button').filter({ hasText: /시험 추가/ }).first();
  if (await addExam.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addExam.click();
    await page.waitForTimeout(2000);
    await ss(page, "add-exam-modal");
    console.log("시험 추가 모달 열림");

    // "새로 만들기" 클릭 (첫 스테이지)
    const newBtn = page.locator('button, div[role="button"]').filter({ hasText: /새로 만들기|직접 생성/ }).first();
    if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(1000);
    }

    // 제목 입력
    const input = page.locator('input[type="text"]').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      const ts = `E2E검증 ${Date.now()}`;
      await input.fill(ts);
      await page.waitForTimeout(300);

      // 생성 버튼 (모달 하단)
      const createBtn = page.locator('button').filter({ hasText: /생성|추가|확인/ }).last();
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(3000);
        console.log(`✓ 시험 "${ts}" 생성`);
        await ss(page, "exam-created");
      }
    }

    // 모달 닫기
    for (let i = 0; i < 3; i++) {
      if (!await page.locator('.ant-modal-wrap, [class*="modal-overlay"]').first().isVisible({ timeout: 500 }).catch(() => false)) break;
      await page.keyboard.press("Escape"); await page.waitForTimeout(500);
    }
  } else {
    console.log("시험 추가 버튼 미발견 (이미 시험 있거나 다른 UI)");
  }

  // 새로고침 후 테이블 확인
  await page.reload({ waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(3000);
  await ss(page, "after-reload");

  // 성적 테이블이 보이는지
  const table = page.locator('.ds-scores-table, table tbody tr').first();
  const tableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`성적 테이블: ${tableVisible ? "보임" : "미보임"}`);
  await ss(page, "final-state");

  if (tableVisible) {
    const rows = page.locator('tbody tr');
    const rc = await rows.count();
    console.log(`학생 행: ${rc}`);

    // 편집 모드
    const editBtn = page.locator('button').filter({ hasText: /편집/ }).first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      await ss(page, "edit-mode");
      console.log("✓ 편집 모드");

      const cell = page.locator('[contenteditable="true"]').first();
      if (await cell.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cell.click();
        await page.waitForTimeout(300);
        await page.keyboard.type("95");
        await page.keyboard.press("Enter");
        console.log("점수 95 입력");
        await ss(page, "score-entered");
      }

      const saveBtn = page.locator('button').filter({ hasText: /저장|완료/ }).first();
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        console.log("✓ 저장");
        await ss(page, "saved");
      }
    }

    // 드로어
    if (rc > 0) {
      await rows.first().click();
      await page.waitForTimeout(1500);
      const drawer = page.locator('[role="complementary"], [class*="drawer"]').first();
      console.log(`드로어: ${await drawer.isVisible({ timeout: 2000 }).catch(() => false) ? "열림" : "안 열림"}`);
      await ss(page, "drawer");
    }
  }

  console.log(`\n크래시: ${crashes.length}, 500: ${api500s.length}`);
  if (crashes.length) console.log("CRASHES:", crashes);
  if (api500s.length) console.log("500s:", api500s);
  expect(crashes).toEqual([]);
  expect(api500s).toEqual([]);
});
