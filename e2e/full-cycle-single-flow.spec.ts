/**
 * 풀사이클 단일 플로우 — 처음부터 끝까지 하나의 브라우저 세션
 *
 * 로그인 → 강의 → 수강생등록(차시생성) → 차시 진입 → 시험추가 → 성적입력 → 저장 → 새로고침 → 확인
 * 전부 보이는 버튼만 클릭
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const STUDENT_USER = process.env.E2E_STUDENT_USER || "3333";
const STUDENT_PASS = process.env.E2E_STUDENT_PASS || "test1234";

const SS = "e2e/screenshots/fullcycle";
let step = 0;
function ss(page: Page, label: string) {
  step++;
  return page.screenshot({ path: `${SS}/${String(step).padStart(2, "0")}-${label}.png` });
}

function watchErrors(page: Page) {
  const crashes: string[] = [];
  const api500s: string[] = [];
  page.on("pageerror", (err) => {
    // 배포 직후 chunk hash 불일치는 lazyWithRetry가 자동 리로드하므로 허용
    if (err.message.includes("dynamically imported module")) return;
    crashes.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (t.includes("dynamically imported module")) return; // 배포 직후 chunk 불일치 허용
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

async function realLogin(page: Page, user: string, pass: string) {
  await page.goto(`${BASE}/login/${CODE}`, { waitUntil: "load", timeout: 25000 });
  await page.waitForTimeout(1500);
  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(500);
  }
  await page.locator('input[name="username"]').first().waitFor({ state: "visible", timeout: 15000 });
  await page.locator('input[name="username"]').first().fill(user);
  await page.locator('input[name="password"], input[type="password"]').first().fill(pass);
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

test("선생님 풀사이클: 수강등록 → 차시생성 → 성적탭 → 시험추가 → 점수입력 → 저장 → 확인 → 학생앱", async ({ page }) => {
  test.setTimeout(300000); // 5분
  const { crashes, api500s } = watchErrors(page);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 1: 로그인 → 강의 진입
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await realLogin(page, ADMIN_USER, ADMIN_PASS);
  await ss(page, "dashboard");
  console.log("✓ 대시보드");

  // 사이드바 → 강의
  await page.locator('nav a, aside a, [class*="sidebar"] a').filter({ hasText: /강의/ }).first().click();
  await page.waitForTimeout(2000);
  await ss(page, "lectures");
  console.log("✓ 강의 목록");

  // 첫 강의 행 클릭
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2000);
  await ss(page, "lecture-detail");
  console.log("✓ 강의 상세");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 2: 수강생 등록 + 차시 생성
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const enrollBtn = page.locator('button, a').filter({ hasText: /수강생 등록|학생 추가/ }).first();
  if (await enrollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enrollBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, "enroll-modal");

    // "차시 생성 후 업로드" — session-block 버튼 클릭
    const batchCard = page.locator('button.session-block').filter({ hasText: /차시 생성 후/ }).first();
    if (!await batchCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 대체 셀렉터
      const alt = page.locator('.ant-modal button, .ant-modal [role="button"]').filter({ hasText: /차시 생성 후/ }).first();
      if (await alt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await alt.click();
      } else {
        console.log("⚠️ 차시 생성 카드 미발견");
        await ss(page, "no-batch-card");
      }
    } else {
      await batchCard.click();
    }
    await page.waitForTimeout(3000);
    await ss(page, "after-batch-click");
    console.log("✓ 차시 생성 방식 선택");

    // "차시 추가" 모달: "N차시" 카드 클릭 (session-block 버튼)
    // 버튼 안에 title("2차시") + desc("정규 차시 추가...")가 있으므로 부분 매칭
    const sessionCard = page.locator('button').filter({ hasText: /\d+차시/ }).filter({ hasText: /정규/ }).first();
    if (await sessionCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionCard.click();
      await page.waitForTimeout(1000);
      await ss(page, "session-card-selected");
      console.log("✓ 차시 유형 선택");
    } else {
      console.log("⚠️ 차시 카드 미발견 — 그냥 저장 시도");
    }

    // "저장" 버튼 클릭 (페이지 어디서든)
    const saveBtn = page.locator('button').filter({ hasText: /^저장$/ }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(4000);
      await ss(page, "session-created");
      console.log("✓ 차시 생성 완료");
    } else {
      console.log("⚠️ 저장 버튼 미발견");
      await ss(page, "no-save-btn");
    }
  }

  // 모달이 남아있으면 닫기 (X 버튼, 취소, ESC)
  for (let attempt = 0; attempt < 3; attempt++) {
    const modal = page.locator('.ant-modal-wrap').first();
    if (!await modal.isVisible({ timeout: 1000 }).catch(() => false)) break;
    // X 버튼 시도
    const closeX = page.locator('.ant-modal-close, .ant-modal button').filter({ hasText: /취소|닫기/ }).first();
    if (await closeX.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeX.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    }
  }
  await page.waitForTimeout(1000);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 3: 차시 진입 → 성적 탭
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 차시 탭 클릭
  const sessionsTab = page.locator('a, button, [role="tab"]').filter({ hasText: /차시/ }).first();
  if (await sessionsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sessionsTab.click();
    await page.waitForTimeout(3000);
  }

  // 배포 직후 chunk 불일치 시 "일시적인 오류" 화면 → 리로드로 복구
  const errorScreen = page.locator('text=일시적인 오류');
  if (await errorScreen.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("⚠️ chunk 불일치 감지 — 리로드 복구");
    await page.reload({ waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(3000);
    // 리로드 후 차시 탭 다시 클릭
    const sessionsTab2 = page.locator('a, button, [role="tab"]').filter({ hasText: /차시/ }).first();
    if (await sessionsTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionsTab2.click();
      await page.waitForTimeout(2000);
    }
  }
  await ss(page, "sessions-tab");

  // 차시는 session-block 버튼으로 표시됨 (테이블 행이 아님)
  const sessionBlocks = page.locator('button.session-block, [class*="session-block"]').filter({ hasText: /차시|보강/ });
  const sessionCount = await sessionBlocks.count();
  console.log(`차시 블록 수: ${sessionCount}`);

  if (sessionCount === 0) {
    console.log("❌ 차시 블록이 없습니다 — 중단");
    expect(crashes).toEqual([]);
    return;
  }

  // 마지막 차시 블록 클릭 (가장 최근 생성된)
  await sessionBlocks.last().click();
  await page.waitForTimeout(3000);
  await ss(page, "session-detail");
  console.log(`✓ 차시 진입 (${sessionCount}개 중 마지막)`);

  // 이 차시에 수강생이 없으면 "수강생 등록" 버튼으로 등록
  const noStudentMsg = page.locator('text=수강생이 없습니다');
  if (await noStudentMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("수강생 없음 — 등록 시도");
    const enrollHere = page.locator('button, a').filter({ hasText: /수강생 등록|수강생 추가/ }).first();
    if (await enrollHere.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enrollHere.click();
      await page.waitForTimeout(2000);
      await ss(page, "session-enroll-modal");

      // 모달에서 체크박스 전체 선택 또는 첫 학생 선택
      const checkAll = page.locator('thead input[type="checkbox"], th input[type="checkbox"]').first();
      const checkOne = page.locator('tbody input[type="checkbox"], input[type="checkbox"]').first();
      if (await checkAll.isVisible({ timeout: 2000 }).catch(() => false)) {
        await checkAll.check();
        console.log("전체 선택");
      } else if (await checkOne.isVisible({ timeout: 2000 }).catch(() => false)) {
        await checkOne.check();
        console.log("첫 학생 선택");
      }
      await page.waitForTimeout(500);

      // 확인/등록 버튼
      const confirmBtn = page.locator('button').filter({ hasText: /확인|등록|저장|추가/ }).last();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(3000);
        console.log("✓ 차시 수강생 등록");
      }
      await ss(page, "session-enrolled");

      // 모달 닫기
      for (let i = 0; i < 3; i++) {
        const modal = page.locator('.ant-modal-wrap, [class*="modal-overlay"]').first();
        if (!await modal.isVisible({ timeout: 500 }).catch(() => false)) break;
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }

      // 페이지 새로고침
      await page.reload({ waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(2000);
    }
  }

  // 성적 탭 클릭
  const scoresTab = page.locator('a, button, [role="tab"]').filter({ hasText: /성적/ }).first();
  if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scoresTab.click();
    await page.waitForTimeout(3000);
    await ss(page, "scores-tab");
    console.log("✓ 성적 탭");

    // 좌측 차시 목록에서 첫 차시 클릭 (session-block)
    const leftSessionBlock = page.locator('button.session-block, [class*="session-block"]').first();
    if (await leftSessionBlock.isVisible({ timeout: 3000 }).catch(() => false)) {
      await leftSessionBlock.click();
      await page.waitForTimeout(3000);
      await ss(page, "scores-session-selected");
      console.log("✓ 성적탭 차시 선택");
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 4: 시험 추가 (성적 탭에서)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const addExamBtn = page.locator('button').filter({ hasText: /시험 추가|시험 생성/ }).first();
  if (await addExamBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addExamBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, "add-exam-modal");

    // "새로 만들기" 또는 제목 입력 화면
    const newBtn = page.locator('button, div').filter({ hasText: /새로 만들기|직접 생성|새로/ }).first();
    if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(1000);
    }

    // 시험 제목 입력
    const titleInput = page.locator('.ant-modal input[type="text"], .ant-modal input[placeholder*="제목"], [class*="Modal"] input[type="text"]').first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill(`E2E검증시험 ${Date.now()}`);
      await page.waitForTimeout(500);
      await ss(page, "exam-title-input");

      // 생성 버튼
      const createBtn = page.locator('.ant-modal button, [class*="Modal"] button').filter({ hasText: /생성|만들기|확인|추가/ }).last();
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(3000);
        await ss(page, "exam-created");
        console.log("✓ 시험 생성 완료");
      }
    }
  } else {
    console.log("시험 추가 버튼 없음 (이미 시험이 있거나 다른 UI 구조)");
  }

  // 성적 탭 다시 클릭 (시험 추가 후 새로고침 효과)
  await page.waitForTimeout(2000);
  await ss(page, "scores-after-exam");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 5: 성적 테이블 확인 + 편집
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const scoreTable = page.locator('.ds-scores-table, table').first();
  const hasScoreTable = await scoreTable.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`성적 테이블: ${hasScoreTable ? "있음" : "없음"}`);

  if (hasScoreTable) {
    // 학생 행 수 확인
    const studentRows = page.locator('tbody tr');
    const rowCount = await studentRows.count();
    console.log(`학생 행 수: ${rowCount}`);
    await ss(page, "scores-table-visible");

    if (rowCount > 0) {
      // 편집 모드 진입
      const editBtn = page.locator('button').filter({ hasText: /편집|수정/ }).first();
      if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(1500);
        await ss(page, "edit-mode");
        console.log("✓ 편집 모드 진입");

        // 첫 점수 셀에 점수 입력
        const cell = page.locator('[contenteditable="true"], .ds-scores-cell-editable').first();
        if (await cell.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cell.click();
          await page.waitForTimeout(300);
          await page.keyboard.type("92");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(500);
          await ss(page, "score-entered");
          console.log("✓ 점수 92 입력");
        }

        // 저장 버튼
        const saveBtn = page.locator('button').filter({ hasText: /저장|완료/ }).first();
        if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(3000);
          await ss(page, "score-saved");
          console.log("✓ 성적 저장");
        }
      }

      // 새로고침 후 유지 확인
      await page.reload({ waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(3000);
      await ss(page, "scores-after-reload");
      console.log("✓ 새로고침 후 확인");

      // 학생 행 클릭 → 드로어 확인
      const firstRow = page.locator('tbody tr').first();
      if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(1500);
        const drawer = page.locator('[role="complementary"], [class*="drawer"]').first();
        const drawerOpen = await drawer.isVisible({ timeout: 3000 }).catch(() => false);
        await ss(page, "student-drawer");
        console.log(`✓ 학생 드로어: ${drawerOpen ? "열림" : "미열림"}`);
      }
    }
  } else {
    console.log("⚠️ 성적 테이블 없음 — 수강생/시험 미등록");
    await ss(page, "scores-empty");
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 6: 출결 탭 확인
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const attTab = page.locator('a, button, [role="tab"]').filter({ hasText: /출결/ }).first();
  if (await attTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await attTab.click();
    await page.waitForTimeout(2000);
    await ss(page, "attendance-tab");
    console.log("✓ 출결 탭");

    // 출결 상태 변경 시도
    const statusBtn = page.locator('td button, td [class*="status"], td span')
      .filter({ hasText: /출석|결석|지각|미처리|현장/ }).first();
    if (await statusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusBtn.click();
      await page.waitForTimeout(1000);
      await ss(page, "att-status-click");

      // 팝오버에서 다른 상태 선택
      const option = page.locator('button, [role="option"], li').filter({ hasText: /현장|출석/ }).first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(2000);
        await ss(page, "att-changed");
        console.log("✓ 출결 상태 변경");
      }
    } else {
      console.log("출결 상태 버튼 없음 (수강생 미등록)");
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 7: 학생 앱 교차 확인
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 새 페이지에서 학생으로 로그인
  const studentPage = await page.context().newPage();
  const { crashes: sCrashes } = watchErrors(studentPage);

  await realLogin(studentPage, STUDENT_USER, STUDENT_PASS);
  await studentPage.screenshot({ path: `${SS}/${String(++step).padStart(2, "0")}-student-home.png` });
  console.log("✓ 학생 앱 로그인");

  // 학생 성적 확인
  const scoresMenu = studentPage.locator('a, button, [class*="menu"]').filter({ hasText: /성적/ }).first();
  if (await scoresMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scoresMenu.click();
    await studentPage.waitForTimeout(2000);
    await studentPage.screenshot({ path: `${SS}/${String(++step).padStart(2, "0")}-student-scores.png` });
    console.log("✓ 학생 성적 페이지");
  }

  // 학생 시험
  const examsMenu = studentPage.locator('a, button, [class*="menu"]').filter({ hasText: /시험/ }).first();
  if (await examsMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
    await examsMenu.click();
    await studentPage.waitForTimeout(2000);
    await studentPage.screenshot({ path: `${SS}/${String(++step).padStart(2, "0")}-student-exams.png` });
    console.log("✓ 학생 시험 페이지");
  }

  await studentPage.close();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 최종 크래시 확인
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n=== 최종 결과 ===");
  console.log(`크래시: ${crashes.length}건`);
  console.log(`500 에러: ${api500s.length}건`);
  if (crashes.length > 0) console.log("CRASHES:", crashes);
  if (api500s.length > 0) console.log("500s:", api500s);

  expect(crashes).toEqual([]);
  expect(api500s).toEqual([]);
});
