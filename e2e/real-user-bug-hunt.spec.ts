/**
 * Real User Bug Hunt — 실제 사용자가 겪을 수 있는 시나리오 기반 버그 탐지
 *
 * 실제 사용자 행동:
 * 1. 학생 클릭 → 오버레이/상세 → 정보 확인 → 닫기
 * 2. 시험 탭 전환 (강의별 시험 ↔ 템플릿 관리)
 * 3. 성적 페이지에서 차시 선택 → 성적 표시
 * 4. 커뮤니티 글 목록 → 상세 → 뒤로가기 → 목록 유지
 * 5. 메시지 발송 모달 열기 → 닫기 → 에러 없음
 * 6. 학생앱 사이드 드로어 메뉴 전체 순회
 * 7. 가이드 페이지 접근
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
import { apiCall } from "./helpers/api";

interface Bug {
  where: string;
  what: string;
  severity: "critical" | "major" | "minor";
  evidence: string;
}

const foundBugs: Bug[] = [];

function logBug(b: Bug) {
  foundBugs.push(b);
  const icon = { critical: "🔴", major: "🟠", minor: "🟡" }[b.severity];
  console.log(`${icon} ${b.where}: ${b.what}`);
  console.log(`   ${b.evidence}`);
}

function setup5xx(page: Page) {
  const list: { url: string; status: number }[] = [];
  page.on("response", r => {
    if (r.status() >= 500 && r.url().includes("/api/")) {
      list.push({ url: r.url(), status: r.status() });
    }
  });
  return list;
}

function setupConsole(page: Page) {
  const list: string[] = [];
  page.on("console", m => {
    if (m.type() === "error") {
      const t = m.text();
      if (t.includes("favicon") || t.includes("DevTools") || t.includes("Download the React") || t.includes("third-party") || t.includes("ERR_BLOCKED_BY_CLIENT") || t.includes("ResizeObserver")) return;
      list.push(t);
    }
  });
  page.on("pageerror", e => list.push(`UNHANDLED: ${e.message}`));
  return list;
}

async function getErrorToasts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const t = document.querySelectorAll('.Toastify__toast--error');
    return Array.from(t).map(el => el.textContent || "");
  });
}

// ════════════════════════════════════════
// Admin 실사용 시나리오
// ════════════════════════════════════════

test.describe("Admin 실사용 시나리오", () => {
  test.setTimeout(120000);

  test("1. 학생 목록 → 학생 클릭 → 오버레이/상세 → 정보 확인", async ({ page }) => {
    const api5xx = setup5xx(page);
    const consoleErr = setupConsole(page);
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 학생 행들 중 하나 클릭
    // 실제 학생 이름 찾기
    const students = await apiCall(page, "GET", "/students/?page_size=5");
    if (students.status !== 200 || !students.body?.results?.length) return;

    const firstName = students.body.results[0].name;
    const firstId = students.body.results[0].id;

    // 학생 이름 텍스트 클릭
    const nameEl = page.getByText(firstName, { exact: false }).first();
    if (await nameEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameEl.click();
      await page.waitForTimeout(2000);

      // 오버레이/모달/상세가 열렸는지
      const overlay = page.locator('[class*="overlay"], [class*="modal"], [class*="drawer"], [role="dialog"]').first();
      const isOverlay = await overlay.isVisible({ timeout: 3000 }).catch(() => false);

      // URL이 변경되었거나 오버레이가 열렸어야 함
      const urlChanged = page.url().includes(`/students/${firstId}`) || page.url().includes(`/students/`);

      if (!isOverlay && !urlChanged) {
        // 클릭은 됐는데 아무 반응 없는 경우 체크
        await page.screenshot({ path: "e2e/screenshots/real-student-click-no-response.png" });
      }

      // 에러 토스트 확인
      const toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({
          where: "학생 상세 진입",
          what: "학생 클릭 시 에러 토스트",
          severity: "major",
          evidence: toasts.join(", "),
        });
      }

      // 상세에서 학생 이름이 보여야 함
      const nameInDetail = await page.getByText(firstName).first().isVisible({ timeout: 3000 }).catch(() => false);
      if (!nameInDetail) {
        logBug({
          where: "학생 상세",
          what: `상세 진입했지만 학생 이름 "${firstName}" 미표시`,
          severity: "major",
          evidence: `학생 ID: ${firstId}`,
        });
      }
    }

    if (api5xx.length > 0) {
      logBug({ where: "학생 상세", what: "5xx", severity: "critical", evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n") });
    }

    await page.screenshot({ path: "e2e/screenshots/real-admin-student-detail.png" });
  });

  test("2. 시험 페이지 — 탭 전환 (강의별 시험 ↔ 템플릿 관리)", async ({ page }) => {
    const api5xx = setup5xx(page);
    const consoleErr = setupConsole(page);
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/exams", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // "강의별 시험" 탭
    const lectureTab = page.getByText("강의별 시험", { exact: false }).first();
    if (await lectureTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lectureTab.click();
      await page.waitForTimeout(2000);

      let toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({ where: "시험 > 강의별", what: "탭 전환 시 에러 토스트", severity: "major", evidence: toasts.join(", ") });
      }
    }

    // "템플릿 관리" 탭
    const templateTab = page.getByText("템플릿 관리", { exact: false }).first();
    if (await templateTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templateTab.click();
      await page.waitForTimeout(2000);

      let toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({ where: "시험 > 템플릿", what: "탭 전환 시 에러 토스트", severity: "major", evidence: toasts.join(", ") });
      }
    }

    // 다시 "강의별 시험" 탭으로 돌아가기
    if (await lectureTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lectureTab.click();
      await page.waitForTimeout(2000);

      let toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({ where: "시험 > 탭 재전환", what: "탭 왕복 시 에러", severity: "major", evidence: toasts.join(", ") });
      }
    }

    if (api5xx.length > 0) {
      logBug({ where: "시험 탭전환", what: "5xx", severity: "critical", evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n") });
    }

    if (consoleErr.length > 0) {
      logBug({ where: "시험 탭전환", what: "콘솔 에러", severity: "minor", evidence: consoleErr.join("\n") });
    }

    await page.screenshot({ path: "e2e/screenshots/real-admin-exam-tabs.png" });
  });

  test("3. 강의 → 차시 상세 → 탭들(출석/성적/시험/과제/영상) 순회", async ({ page }) => {
    const api5xx = setup5xx(page);
    const consoleErr = setupConsole(page);
    await loginViaUI(page, "admin");

    // 강의 목록 → 첫 강의
    const lecturesApi = await apiCall(page, "GET", "/lectures/?page_size=5");
    if (lecturesApi.status !== 200) return;

    const lectures = lecturesApi.body?.results || [];
    if (lectures.length === 0) {
      console.log("강의 없음, 스킵");
      return;
    }

    const lectureId = lectures[0].id;

    // 차시 목록
    const sessionsApi = await apiCall(page, "GET", `/lectures/${lectureId}/sessions/?page_size=3`);
    if (sessionsApi.status !== 200) return;

    const sessions = sessionsApi.body?.results || sessionsApi.body || [];
    if (!Array.isArray(sessions) || sessions.length === 0) {
      console.log("차시 없음, 스킵");
      return;
    }

    const sessionId = sessions[0].id;

    // 차시 상세 페이지 이동
    await page.goto(`https://hakwonplus.com/admin/lectures/${lectureId}/sessions/${sessionId}`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    let toasts = await getErrorToasts(page);
    if (toasts.length > 0) {
      logBug({ where: "차시 상세", what: "차시 상세 진입 에러 토스트", severity: "major", evidence: toasts.join(", ") });
    }

    // 차시 상세 내 탭들 순회
    const sessionTabs = [
      { name: "출석", path: "attendance" },
      { name: "성적", path: "scores" },
      { name: "시험", path: "exams" },
      { name: "과제", path: "assignments" },
      { name: "영상", path: "videos" },
    ];

    for (const tab of sessionTabs) {
      const before5xx = api5xx.length;

      // 탭 클릭 시도
      const tabEl = page.getByText(tab.name, { exact: true }).first();
      if (await tabEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tabEl.click();
        await page.waitForTimeout(2000);

        toasts = await getErrorToasts(page);
        if (toasts.length > 0) {
          logBug({
            where: `차시 > ${tab.name} 탭`,
            what: "탭 전환 시 에러 토스트",
            severity: "major",
            evidence: toasts.join(", "),
          });
        }

        const new5xx = api5xx.slice(before5xx);
        if (new5xx.length > 0) {
          logBug({
            where: `차시 > ${tab.name} 탭`,
            what: "5xx 에러",
            severity: "critical",
            evidence: new5xx.map(e => `${e.status} ${e.url}`).join("\n"),
          });
        }
      } else {
        // URL 기반으로 탭 이동
        await page.goto(
          `https://hakwonplus.com/admin/lectures/${lectureId}/sessions/${sessionId}/${tab.path}`,
          { waitUntil: "load", timeout: 10000 }
        ).catch(() => {});
        await page.waitForTimeout(2000);

        toasts = await getErrorToasts(page);
        if (toasts.length > 0) {
          logBug({
            where: `차시 > ${tab.name} (URL)`,
            what: "페이지 진입 에러 토스트",
            severity: "major",
            evidence: toasts.join(", "),
          });
        }
      }
    }

    if (consoleErr.length > 0) {
      logBug({
        where: "차시 상세 탭들",
        what: "콘솔 에러",
        severity: "minor",
        evidence: consoleErr.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/real-admin-session-tabs.png" });
  });

  test("4. 커뮤니티 공지 → 상세 → 뒤로가기 → 목록 유지", async ({ page }) => {
    const api5xx = setup5xx(page);
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/community/notice", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 공지 목록에서 첫 글 제목 가져오기
    const noticesApi = await apiCall(page, "GET", "/community/?category=notice&page_size=5");
    if (noticesApi.status !== 200 || !noticesApi.body?.results?.length) {
      console.log("공지 없음, 스킵");
      return;
    }

    const firstNotice = noticesApi.body.results[0];
    const title = firstNotice.title || firstNotice.subject;

    // 공지 클릭
    const noticeEl = page.getByText(title, { exact: false }).first();
    if (await noticeEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await noticeEl.click();
      await page.waitForTimeout(2000);

      // 에러 토스트 확인
      const toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({
          where: "공지 상세",
          what: "공지 상세 진입 에러 토스트",
          severity: "major",
          evidence: toasts.join(", "),
        });
      }

      // 뒤로가기
      await page.goBack();
      await page.waitForTimeout(2000);

      // 목록이 다시 보이는지 (데이터 유지)
      const listVisible = await noticeEl.isVisible({ timeout: 5000 }).catch(() => false);
      if (!listVisible) {
        logBug({
          where: "공지 목록",
          what: "뒤로가기 후 공지 목록이 사라짐 (데이터 미유지)",
          severity: "major",
          evidence: `공지 제목: ${title}`,
        });
      }
    }

    if (api5xx.length > 0) {
      logBug({ where: "공지 플로우", what: "5xx", severity: "critical", evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n") });
    }

    await page.screenshot({ path: "e2e/screenshots/real-admin-notice-back.png" });
  });

  test("5. 설정 페이지 — 각 설정 탭 순회 + 에러 없음", async ({ page }) => {
    const api5xx = setup5xx(page);
    const consoleErr = setupConsole(page);
    await loginViaUI(page, "admin");

    const settingsPaths = [
      { name: "프로필", path: "/admin/settings" },
      { name: "조직", path: "/admin/settings/organization" },
      { name: "외관", path: "/admin/settings/appearance" },
      { name: "랜딩", path: "/admin/settings/landing" },
      { name: "결제", path: "/admin/settings/billing" },
    ];

    for (const sp of settingsPaths) {
      const before5xx = api5xx.length;

      await page.goto(`https://hakwonplus.com${sp.path}`, { waitUntil: "load", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({
          where: `설정 > ${sp.name}`,
          what: "에러 토스트",
          severity: "major",
          evidence: toasts.join(", "),
        });
      }

      const new5xx = api5xx.slice(before5xx);
      if (new5xx.length > 0) {
        logBug({
          where: `설정 > ${sp.name}`,
          what: "5xx",
          severity: "critical",
          evidence: new5xx.map(e => `${e.status} ${e.url}`).join("\n"),
        });
      }
    }

    if (consoleErr.length > 0) {
      logBug({
        where: "설정 페이지들",
        what: "콘솔 에러",
        severity: "minor",
        evidence: consoleErr.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/real-admin-settings-all.png" });
  });

  test("6. 가이드 페이지 — 접근 가능 + 콘텐츠 로딩", async ({ page }) => {
    const api5xx = setup5xx(page);
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/guide", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const toasts = await getErrorToasts(page);
    if (toasts.length > 0) {
      logBug({
        where: "가이드",
        what: "가이드 페이지 에러 토스트",
        severity: "major",
        evidence: toasts.join(", "),
      });
    }

    // 빈 페이지가 아닌지 (콘텐츠가 있어야 함)
    const content = await page.locator('main, [class*="guide"], [class*="content"]').first().textContent().catch(() => "");
    if (!content || content.trim().length < 10) {
      logBug({
        where: "가이드",
        what: "가이드 페이지가 빈 페이지",
        severity: "minor",
        evidence: `컨텐츠 길이: ${content?.length || 0}`,
      });
    }

    await page.screenshot({ path: "e2e/screenshots/real-admin-guide.png" });
  });
});

// ════════════════════════════════════════
// Student 실사용 시나리오
// ════════════════════════════════════════

test.describe("Student 실사용 시나리오", () => {
  test.setTimeout(120000);

  test("1. 학생 사이드 드로어 → 모든 메뉴 순회", async ({ page }) => {
    const api5xx = setup5xx(page);
    const consoleErr = setupConsole(page);
    await loginViaUI(page, "student");

    const studentPages = [
      { name: "영상", path: "/student/video" },
      { name: "성적", path: "/student/grades" },
      { name: "시험", path: "/student/exams" },
      { name: "과제제출", path: "/student/submit/assignment" },
      { name: "클리닉", path: "/student/clinic" },
      { name: "ID카드", path: "/student/idcard" },
      { name: "일정", path: "/student/sessions" },
      { name: "공지", path: "/student/notices" },
      { name: "커뮤니티", path: "/student/community" },
      { name: "출석", path: "/student/attendance" },
      { name: "제출내역", path: "/student/submit" },
      { name: "인벤토리", path: "/student/inventory" },
      { name: "알림", path: "/student/notifications" },
      { name: "프로필", path: "/student/profile" },
      { name: "설정", path: "/student/settings" },
      { name: "가이드", path: "/student/guide" },
    ];

    for (const sp of studentPages) {
      const before5xx = api5xx.length;
      const beforeConsole = consoleErr.length;

      await page.goto(`https://hakwonplus.com${sp.path}`, { waitUntil: "load", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);

      const toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({
          where: `학생 > ${sp.name}`,
          what: "에러 토스트",
          severity: "major",
          evidence: toasts.join(", "),
        });
      }

      const new5xx = api5xx.slice(before5xx);
      if (new5xx.length > 0) {
        logBug({
          where: `학생 > ${sp.name}`,
          what: "5xx 에러",
          severity: "critical",
          evidence: new5xx.map(e => `${e.status} ${e.url}`).join("\n"),
        });
      }

      const newConsole = consoleErr.slice(beforeConsole);
      // unhandled exception만 보고 (일반 콘솔 에러는 너무 많을 수 있음)
      const unhandled = newConsole.filter(e => e.startsWith("UNHANDLED:"));
      if (unhandled.length > 0) {
        logBug({
          where: `학생 > ${sp.name}`,
          what: "미처리 예외",
          severity: "major",
          evidence: unhandled.join("\n"),
        });
      }
    }

    await page.screenshot({ path: "e2e/screenshots/real-student-all-pages.png" });
  });

  test("2. 학생 일정 → 차시 상세 → 정보 카드 표시", async ({ page }) => {
    const api5xx = setup5xx(page);
    await loginViaUI(page, "student");

    await page.goto("https://hakwonplus.com/student/sessions", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 차시 목록에서 항목 클릭
    const sessionItem = page.locator('[class*="session"], [class*="card"], [class*="item"]').first();
    if (await sessionItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionItem.click();
      await page.waitForTimeout(2000);

      const toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({
          where: "학생 차시 상세",
          what: "차시 클릭 시 에러 토스트",
          severity: "major",
          evidence: toasts.join(", "),
        });
      }
    }

    if (api5xx.length > 0) {
      logBug({ where: "학생 차시", what: "5xx", severity: "critical", evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n") });
    }

    await page.screenshot({ path: "e2e/screenshots/real-student-session-detail.png" });
  });

  test("3. 학생 공지 → 상세 → 뒤로가기", async ({ page }) => {
    const api5xx = setup5xx(page);
    await loginViaUI(page, "student");

    await page.goto("https://hakwonplus.com/student/notices", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 공지가 있으면 첫 번째 클릭
    const noticeItem = page.locator('[class*="notice"], [class*="card"], [class*="item"], li').first();
    if (await noticeItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      const noticeText = await noticeItem.textContent() || "";
      await noticeItem.click();
      await page.waitForTimeout(2000);

      const toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({
          where: "학생 공지 상세",
          what: "공지 클릭 시 에러 토스트",
          severity: "major",
          evidence: toasts.join(", "),
        });
      }

      // 뒤로가기
      await page.goBack();
      await page.waitForTimeout(2000);

      // 에러 확인
      const toasts2 = await getErrorToasts(page);
      if (toasts2.length > 0) {
        logBug({
          where: "학생 공지 목록 복귀",
          what: "뒤로가기 후 에러 토스트",
          severity: "major",
          evidence: toasts2.join(", "),
        });
      }
    }

    if (api5xx.length > 0) {
      logBug({ where: "학생 공지", what: "5xx", severity: "critical", evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n") });
    }

    await page.screenshot({ path: "e2e/screenshots/real-student-notice-back.png" });
  });

  test("4. 학생 새로고침 → 토큰 유지 + 리다이렉트 없음", async ({ page }) => {
    const api5xx = setup5xx(page);
    await loginViaUI(page, "student");

    // 여러 페이지에서 새로고침 테스트
    const pagesToRefresh = [
      "/student/dashboard",
      "/student/video",
      "/student/grades",
      "/student/notifications",
    ];

    for (const p of pagesToRefresh) {
      await page.goto(`https://hakwonplus.com${p}`, { waitUntil: "load" });
      await page.waitForTimeout(2000);

      // 새로고침
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(3000);

      // 로그인 페이지로 리다이렉트되지 않아야 함
      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        logBug({
          where: `학생 새로고침: ${p}`,
          what: "새로고침 후 로그인 페이지로 리다이렉트됨 (토큰 유실)",
          severity: "critical",
          evidence: `원래 경로: ${p}, 현재 URL: ${currentUrl}`,
        });
        break; // 토큰이 유실되면 이후 테스트 의미 없음
      }

      const toasts = await getErrorToasts(page);
      if (toasts.length > 0) {
        logBug({
          where: `학생 새로고침: ${p}`,
          what: "새로고침 후 에러 토스트",
          severity: "major",
          evidence: toasts.join(", "),
        });
      }
    }

    await page.screenshot({ path: "e2e/screenshots/real-student-refresh.png" });
  });
});

// ════════════════════════════════════════
// 최종 보고
// ════════════════════════════════════════

test.afterAll(async () => {
  console.log("\n" + "=".repeat(60));
  console.log("📋 실사용 시나리오 버그 탐지 최종 보고서");
  console.log("=".repeat(60));

  if (foundBugs.length === 0) {
    console.log("\n✅ 발견된 버그 없음");
    return;
  }

  const critical = foundBugs.filter(b => b.severity === "critical");
  const major = foundBugs.filter(b => b.severity === "major");
  const minor = foundBugs.filter(b => b.severity === "minor");

  console.log(`\n총 ${foundBugs.length}개 이슈:`);
  console.log(`  🔴 Critical: ${critical.length}`);
  console.log(`  🟠 Major: ${major.length}`);
  console.log(`  🟡 Minor: ${minor.length}`);

  for (const b of foundBugs) {
    const icon = { critical: "🔴", major: "🟠", minor: "🟡" }[b.severity];
    console.log(`\n${icon} [${b.where}] ${b.what}`);
    console.log(`   ${b.evidence}`);
  }
});
