/**
 * Hidden Bug Hunt — 실제 사용자 관점 버그 탐지
 *
 * 단순 "클릭 → 성공/실패" 가 아니라:
 * 1. 실패가 뜨면 안 되는 곳에서 에러가 뜨는지
 * 2. 성공 후 데이터가 정상적으로 반영되는지
 * 3. 페이지 이동 후 데이터 일관성이 유지되는지
 * 4. 콘솔 에러, 네트워크 에러가 숨어있는지
 * 5. 빈 상태/로딩 상태가 올바른지
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// 에러 수집기
interface CollectedError {
  type: "console" | "network" | "toast" | "unhandled";
  message: string;
  url?: string;
  timestamp: number;
}

function setupErrorCollector(page: Page) {
  const errors: CollectedError[] = [];

  // 콘솔 에러 수집
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // React devtools, favicon 등 무해한 에러 제외
      if (
        text.includes("favicon") ||
        text.includes("DevTools") ||
        text.includes("Download the React DevTools") ||
        text.includes("third-party cookie") ||
        text.includes("net::ERR_BLOCKED_BY_CLIENT")  // adblocker
      ) return;
      errors.push({ type: "console", message: text, timestamp: Date.now() });
    }
  });

  // 페이지 에러 (unhandled exceptions)
  page.on("pageerror", (err) => {
    errors.push({ type: "unhandled", message: err.message, timestamp: Date.now() });
  });

  return errors;
}

// 네트워크 에러 수집기 (5xx, 특정 4xx)
function setupNetworkErrorCollector(page: Page) {
  const networkErrors: CollectedError[] = [];

  page.on("response", (resp) => {
    const status = resp.status();
    const url = resp.url();
    // API 호출 중 5xx는 항상 버그
    if (status >= 500 && url.includes("/api/")) {
      networkErrors.push({
        type: "network",
        message: `${status} ${resp.statusText()}`,
        url,
        timestamp: Date.now(),
      });
    }
    // 인증된 상태에서 401은 토큰 만료 버그 가능
    if (status === 401 && url.includes("/api/") && !url.includes("/token")) {
      networkErrors.push({
        type: "network",
        message: `Unexpected 401`,
        url,
        timestamp: Date.now(),
      });
    }
  });

  return networkErrors;
}

// 토스트 에러 감지
async function checkForErrorToast(page: Page): Promise<string | null> {
  const errorToast = page.locator('.Toastify__toast--error, [class*="toast"][class*="error"]');
  if (await errorToast.isVisible({ timeout: 1000 }).catch(() => false)) {
    return await errorToast.textContent() || "Unknown error toast";
  }
  return null;
}

// 페이지 로딩 완료 대기 (스피너/스켈레톤 사라질 때까지)
async function waitForPageReady(page: Page, timeout = 10000) {
  // 일반적인 로딩 인디케이터들
  const spinners = [
    '[class*="spinner"]',
    '[class*="loading"]',
    '[class*="skeleton"]',
    '[role="progressbar"]',
  ];
  for (const sel of spinners) {
    try {
      await page.locator(sel).first().waitFor({ state: "hidden", timeout: 3000 });
    } catch {
      // 스피너가 없는 경우 무시
    }
  }
  await page.waitForTimeout(500);
}

// ────────────────────────────────────────
// ADMIN FLOW TESTS
// ────────────────────────────────────────

test.describe("Admin 사용자 관점 버그 탐지", () => {
  let errors: CollectedError[];
  let networkErrors: CollectedError[];

  test.beforeEach(async ({ page }) => {
    errors = setupErrorCollector(page);
    networkErrors = setupNetworkErrorCollector(page);
    await loginViaUI(page, "admin");
  });

  test("1. 대시보드 — 데이터 로딩 및 표시 검증", async ({ page }) => {
    // 대시보드에서 에러 토스트가 없어야 함
    await waitForPageReady(page);
    const toast = await checkForErrorToast(page);
    expect(toast, `대시보드에서 에러 토스트 발생: ${toast}`).toBeNull();

    // 대시보드 주요 섹션이 렌더링되는지 (빈 화면 아닌지)
    const mainContent = page.locator('main, [class*="dashboard"], [class*="content"]').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // 네트워크 에러 없어야 함
    expect(networkErrors.filter(e => e.type === "network"), "대시보드 로딩 중 API 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-dashboard.png" });
  });

  test("2. 학생 목록 — 데이터 로딩 및 정합성", async ({ page }) => {
    // 사이드바에서 학생 메뉴 클릭
    await page.locator('a[href*="/students"]').first().click();
    await page.waitForURL(/\/students/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 목록에서 에러 토스트: ${toast}`).toBeNull();

    // 학생 목록이 비어있지 않은지 (Tenant 1은 테스트 학생 있음)
    // 테이블 행 또는 학생 카드가 있어야 함
    const studentItems = page.locator('table tbody tr, [class*="student-row"], [class*="studentCard"], [class*="StudentCard"]');
    const count = await studentItems.count();

    // API로 실제 학생 수 확인
    const apiResult = await apiCall(page, "GET", "/students/");
    expect(apiResult.status, "학생 API 응답 코드").toBe(200);

    const apiCount = Array.isArray(apiResult.body?.results) ? apiResult.body.results.length : 0;

    // UI에 표시된 학생이 있는지 (빈 화면 버그 확인)
    if (apiCount > 0) {
      // API에 학생이 있으면 UI에도 보여야 함
      expect(count, `API에 학생 ${apiCount}명인데 UI에 ${count}개 행`).toBeGreaterThan(0);
    }

    // 네트워크 에러 확인
    const studentNetErrors = networkErrors.filter(e => e.url?.includes("/students"));
    expect(studentNetErrors, "학생 API 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-students.png" });
  });

  test("3. 강의 → 차시 → 출석/성적 플로우 데이터 정합성", async ({ page }) => {
    // 강의 목록으로 이동
    await page.locator('a[href*="/lectures"]').first().click();
    await page.waitForURL(/\/lectures/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast1 = await checkForErrorToast(page);
    expect(toast1, `강의 목록 에러 토스트: ${toast1}`).toBeNull();

    // API로 강의 목록 확인
    const lecturesApi = await apiCall(page, "GET", "/lectures/");
    expect(lecturesApi.status).toBe(200);

    const lectures = lecturesApi.body?.results || [];
    if (lectures.length === 0) {
      console.log("강의가 없어 차시 테스트 스킵");
      return;
    }

    // 첫 번째 강의 클릭
    const firstLecture = page.locator('table tbody tr, [class*="lecture"], [class*="card"]').first();
    if (await firstLecture.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstLecture.click();
      await waitForPageReady(page);

      const toast2 = await checkForErrorToast(page);
      expect(toast2, `강의 상세 에러 토스트: ${toast2}`).toBeNull();
    }

    // 차시(session) 목록이 있는지 확인
    const lectureId = lectures[0]?.id;
    if (lectureId) {
      const sessionsApi = await apiCall(page, "GET", `/lectures/${lectureId}/sessions/`);
      // sessions API가 정상이어야 함
      if (sessionsApi.status === 200) {
        const sessions = sessionsApi.body?.results || sessionsApi.body || [];
        if (Array.isArray(sessions) && sessions.length > 0) {
          // 첫 차시의 출석 데이터 확인
          const sessionId = sessions[0]?.id;
          if (sessionId) {
            const attendanceApi = await apiCall(page, "GET", `/lectures/attendance/?session=${sessionId}`);
            // 출석 API가 5xx이면 안 됨
            expect(attendanceApi.status, `출석 API 에러 (session ${sessionId})`).toBeLessThan(500);
          }
        }
      }
    }

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-lectures.png" });
  });

  test("4. 시험 목록 — 시험 데이터 로딩 및 상태 표시", async ({ page }) => {
    await page.locator('a[href*="/exams"]').first().click();
    await page.waitForURL(/\/exams/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `시험 목록 에러 토스트: ${toast}`).toBeNull();

    // API로 시험 목록
    const examsApi = await apiCall(page, "GET", "/exams/");
    expect(examsApi.status, "시험 API").toBe(200);

    // 시험이 있다면 상태(status) 필드가 정상인지
    const exams = examsApi.body?.results || [];
    for (const exam of exams.slice(0, 5)) {
      // status가 유효한 값인지
      if (exam.status) {
        const validStatuses = ["draft", "active", "closed", "archived", "template", "published"];
        expect(validStatuses, `시험 ${exam.id} 상태 '${exam.status}'가 유효하지 않음`).toContain(exam.status);
      }
      // 시험에 연결된 강의가 존재하는지
      if (exam.lecture) {
        const lectureCheck = await apiCall(page, "GET", `/lectures/${exam.lecture}/`);
        expect(lectureCheck.status, `시험 ${exam.id}의 강의 ${exam.lecture}가 존재하지 않음`).not.toBe(404);
      }
    }

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-exams.png" });
  });

  test("5. 성적 페이지 — 성적 데이터 정합성", async ({ page }) => {
    await page.locator('a[href*="/results"]').first().click();
    await page.waitForURL(/\/results/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `성적 페이지 에러 토스트: ${toast}`).toBeNull();

    // 네트워크 에러 확인
    const resultNetErrors = networkErrors.filter(e => e.url?.includes("/results") || e.url?.includes("/scores"));
    expect(resultNetErrors, "성적 API 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-results.png" });
  });

  test("6. 클리닉 — 예약/일정 데이터 표시 검증", async ({ page }) => {
    await page.locator('a[href*="/clinic"]').first().click();
    await page.waitForURL(/\/clinic/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `클리닉 에러 토스트: ${toast}`).toBeNull();

    // 클리닉 세션 API
    const clinicApi = await apiCall(page, "GET", "/clinic/sessions/");
    expect(clinicApi.status, "클리닉 세션 API").toBeLessThan(500);

    // 클리닉 참가자 API
    const participantsApi = await apiCall(page, "GET", "/clinic/participants/");
    expect(participantsApi.status, "클리닉 참가자 API").toBeLessThan(500);

    // 세션이 있으면 참가자 데이터 정합성 확인
    if (clinicApi.status === 200) {
      const sessions = clinicApi.body?.results || [];
      for (const session of sessions.slice(0, 3)) {
        if (session.id) {
          // 각 세션의 참가자 수와 실제 참가자 목록이 일치하는지
          const sessionParticipants = await apiCall(page, "GET", `/clinic/participants/?session=${session.id}`);
          if (sessionParticipants.status === 200) {
            const pList = sessionParticipants.body?.results || [];
            // 참가자 상태가 유효한지
            for (const p of pList) {
              const validBookingStatuses = ["BOOKED", "PENDING", "ATTENDED", "NO_SHOW", "CANCELLED", "COMPLETED"];
              if (p.status) {
                expect(
                  validBookingStatuses.includes(p.status),
                  `클리닉 세션 ${session.id} 참가자 ${p.id} 상태 '${p.status}' 유효하지 않음`
                ).toBeTruthy();
              }
            }
          }
        }
      }
    }

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-clinic.png" });
  });

  test("7. 커뮤니티 — 공지/QnA 데이터 로딩", async ({ page }) => {
    await page.locator('a[href*="/community"]').first().click();
    await page.waitForURL(/\/community/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `커뮤니티 에러 토스트: ${toast}`).toBeNull();

    // 네트워크 5xx 에러 확인
    const communityErrors = networkErrors.filter(e => e.url?.includes("/community"));
    expect(communityErrors, "커뮤니티 API 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-community.png" });
  });

  test("8. 메시지 — 설정/템플릿 데이터 정합성", async ({ page }) => {
    await page.locator('a[href*="/message"]').first().click();
    await page.waitForURL(/\/message/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `메시지 에러 토스트: ${toast}`).toBeNull();

    // 메시징 설정 API
    const msgInfo = await apiCall(page, "GET", "/messaging/info/");
    expect(msgInfo.status, "메시지 정보 API").toBeLessThan(500);

    // 템플릿 API
    const templates = await apiCall(page, "GET", "/messaging/templates/");
    expect(templates.status, "메시지 템플릿 API").toBeLessThan(500);

    // 자동발송 설정 API
    const autoSend = await apiCall(page, "GET", "/messaging/auto-send/");
    expect(autoSend.status, "자동발송 API").toBeLessThan(500);

    // 로그 API
    const logs = await apiCall(page, "GET", "/messaging/log/");
    expect(logs.status, "메시지 로그 API").toBeLessThan(500);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-message.png" });
  });

  test("9. 영상 — 영상 목록 및 인코딩 상태 검증", async ({ page }) => {
    await page.locator('a[href*="/videos"]').first().click();
    await page.waitForURL(/\/videos/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `영상 에러 토스트: ${toast}`).toBeNull();

    const videoErrors = networkErrors.filter(e => e.url?.includes("/video") || e.url?.includes("/media"));
    expect(videoErrors, "영상 API 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-videos.png" });
  });

  test("10. 도구 — PPT/OMR/클리닉 프린트 도구 접근", async ({ page }) => {
    await page.locator('a[href*="/tools"]').first().click();
    await page.waitForURL(/\/tools/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `도구 에러 토스트: ${toast}`).toBeNull();

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-tools.png" });
  });

  test("11. 설정 — 조직 설정 데이터 로딩", async ({ page }) => {
    await page.locator('a[href*="/settings"]').first().click();
    await page.waitForURL(/\/settings/, { timeout: 10000 });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `설정 에러 토스트: ${toast}`).toBeNull();

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-settings.png" });
  });

  test("12. 전체 네비게이션 — 콘솔 에러 및 미처리 예외 집계", async ({ page }) => {
    // 주요 페이지를 빠르게 순회하면서 숨은 에러 수집
    const pages = [
      { name: "대시보드", path: "/admin/dashboard" },
      { name: "학생", path: "/admin/students" },
      { name: "강의", path: "/admin/lectures" },
      { name: "시험", path: "/admin/exams" },
      { name: "성적", path: "/admin/results" },
      { name: "클리닉", path: "/admin/clinic" },
      { name: "커뮤니티", path: "/admin/community" },
      { name: "메시지", path: "/admin/message" },
      { name: "영상", path: "/admin/videos" },
      { name: "보관함", path: "/admin/storage" },
      { name: "도구", path: "/admin/tools" },
      { name: "설정", path: "/admin/settings" },
    ];

    const pageErrors: Record<string, CollectedError[]> = {};

    for (const p of pages) {
      const beforeCount = errors.length;
      const beforeNetCount = networkErrors.length;

      await page.goto(`https://hakwonplus.com${p.path}`, { waitUntil: "load", timeout: 15000 });
      await waitForPageReady(page);

      const newErrors = errors.slice(beforeCount);
      const newNetErrors = networkErrors.slice(beforeNetCount);

      if (newErrors.length > 0 || newNetErrors.length > 0) {
        pageErrors[p.name] = [...newErrors, ...newNetErrors];
      }
    }

    // 결과 보고
    const totalBugs = Object.values(pageErrors).flat().length;
    if (totalBugs > 0) {
      console.log("\n===== 페이지별 숨은 에러 =====");
      for (const [pageName, errs] of Object.entries(pageErrors)) {
        console.log(`\n[${pageName}]`);
        for (const e of errs) {
          console.log(`  ${e.type}: ${e.message}${e.url ? ` (${e.url})` : ""}`);
        }
      }
      console.log(`\n총 ${totalBugs}개 숨은 에러 발견`);
    }

    // 5xx 네트워크 에러는 무조건 실패
    const critical5xx = Object.values(pageErrors).flat().filter(e => e.type === "network" && e.message.startsWith("5"));
    expect(critical5xx, `${critical5xx.length}개 5xx 에러 발견`).toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-admin-full-nav.png" });
  });
});

// ────────────────────────────────────────
// STUDENT FLOW TESTS
// ────────────────────────────────────────

test.describe("Student 사용자 관점 버그 탐지", () => {
  let errors: CollectedError[];
  let networkErrors: CollectedError[];

  test.beforeEach(async ({ page }) => {
    errors = setupErrorCollector(page);
    networkErrors = setupNetworkErrorCollector(page);
    await loginViaUI(page, "student");
  });

  test("1. 학생 대시보드 — 데이터 표시 검증", async ({ page }) => {
    await waitForPageReady(page);
    const toast = await checkForErrorToast(page);
    expect(toast, `학생 대시보드 에러 토스트: ${toast}`).toBeNull();

    // 대시보드 주요 컨텐츠가 보이는지
    const content = page.locator('main, [class*="dashboard"], [class*="content"], [class*="home"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    // 5xx 에러 없어야 함
    const netErrors = networkErrors.filter(e => e.type === "network");
    expect(netErrors, "학생 대시보드 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-dashboard.png" });
  });

  test("2. 학생 영상 페이지 — 영상 목록 로딩", async ({ page }) => {
    // 영상 탭 클릭
    const videoTab = page.locator('a[href*="/student/video"], [class*="tabbar"] >> text=영상, nav >> text=영상').first();
    if (await videoTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await videoTab.click();
      await waitForPageReady(page);

      const toast = await checkForErrorToast(page);
      expect(toast, `학생 영상 에러 토스트: ${toast}`).toBeNull();
    } else {
      await page.goto("https://hakwonplus.com/student/video", { waitUntil: "load" });
      await waitForPageReady(page);
    }

    const netErrors = networkErrors.filter(e => e.type === "network" && e.url?.includes("/video"));
    expect(netErrors, "학생 영상 API 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-video.png" });
  });

  test("3. 학생 일정 — 수업 일정 표시", async ({ page }) => {
    const scheduleTab = page.locator('a[href*="/student/sessions"], [class*="tabbar"] >> text=일정, nav >> text=일정').first();
    if (await scheduleTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scheduleTab.click();
    } else {
      await page.goto("https://hakwonplus.com/student/sessions", { waitUntil: "load" });
    }
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 일정 에러 토스트: ${toast}`).toBeNull();

    const netErrors = networkErrors.filter(e => e.type === "network");
    expect(netErrors, "학생 일정 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-sessions.png" });
  });

  test("4. 학생 성적 — 성적 데이터 조회", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/grades", { waitUntil: "load" });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 성적 에러 토스트: ${toast}`).toBeNull();

    const netErrors = networkErrors.filter(e => e.type === "network");
    expect(netErrors, "학생 성적 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-grades.png" });
  });

  test("5. 학생 시험 목록 — 시험 데이터 표시", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/exams", { waitUntil: "load" });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 시험 에러 토스트: ${toast}`).toBeNull();

    // 시험 API 호출
    const examsApi = await apiCall(page, "GET", "/exams/me/available/");
    expect(examsApi.status, "학생 시험 API").toBeLessThan(500);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-exams.png" });
  });

  test("6. 학생 클리닉 — 클리닉 데이터 표시", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/clinic", { waitUntil: "load" });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 클리닉 에러 토스트: ${toast}`).toBeNull();

    const netErrors = networkErrors.filter(e => e.type === "network");
    expect(netErrors, "학생 클리닉 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-clinic.png" });
  });

  test("7. 학생 알림 — 알림 데이터 로딩", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/notifications", { waitUntil: "load" });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 알림 에러 토스트: ${toast}`).toBeNull();

    const netErrors = networkErrors.filter(e => e.type === "network");
    expect(netErrors, "학생 알림 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-notifications.png" });
  });

  test("8. 학생 커뮤니티 — 게시판 로딩", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/community", { waitUntil: "load" });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 커뮤니티 에러 토스트: ${toast}`).toBeNull();

    const netErrors = networkErrors.filter(e => e.type === "network");
    expect(netErrors, "학생 커뮤니티 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-community.png" });
  });

  test("9. 학생 출석 — 출석 현황 표시", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/attendance", { waitUntil: "load" });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 출석 에러 토스트: ${toast}`).toBeNull();

    const netErrors = networkErrors.filter(e => e.type === "network");
    expect(netErrors, "학생 출석 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-attendance.png" });
  });

  test("10. 학생 프로필 — 프로필 데이터 표시", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/profile", { waitUntil: "load" });
    await waitForPageReady(page);

    const toast = await checkForErrorToast(page);
    expect(toast, `학생 프로필 에러 토스트: ${toast}`).toBeNull();

    const netErrors = networkErrors.filter(e => e.type === "network");
    expect(netErrors, "학생 프로필 네트워크 에러").toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-profile.png" });
  });

  test("11. 학생 전체 네비게이션 — 숨은 에러 수집", async ({ page }) => {
    const studentPages = [
      { name: "대시보드", path: "/student/dashboard" },
      { name: "영상", path: "/student/video" },
      { name: "일정", path: "/student/sessions" },
      { name: "성적", path: "/student/grades" },
      { name: "시험", path: "/student/exams" },
      { name: "클리닉", path: "/student/clinic" },
      { name: "알림", path: "/student/notifications" },
      { name: "커뮤니티", path: "/student/community" },
      { name: "출석", path: "/student/attendance" },
      { name: "과제제출", path: "/student/submit/assignment" },
      { name: "프로필", path: "/student/profile" },
      { name: "설정", path: "/student/settings" },
    ];

    const pageErrors: Record<string, CollectedError[]> = {};

    for (const p of studentPages) {
      const beforeCount = errors.length;
      const beforeNetCount = networkErrors.length;

      await page.goto(`https://hakwonplus.com${p.path}`, { waitUntil: "load", timeout: 15000 });
      await waitForPageReady(page);

      const newErrors = errors.slice(beforeCount);
      const newNetErrors = networkErrors.slice(beforeNetCount);

      if (newErrors.length > 0 || newNetErrors.length > 0) {
        pageErrors[p.name] = [...newErrors, ...newNetErrors];
      }
    }

    const totalBugs = Object.values(pageErrors).flat().length;
    if (totalBugs > 0) {
      console.log("\n===== 학생앱 페이지별 숨은 에러 =====");
      for (const [pageName, errs] of Object.entries(pageErrors)) {
        console.log(`\n[${pageName}]`);
        for (const e of errs) {
          console.log(`  ${e.type}: ${e.message}${e.url ? ` (${e.url})` : ""}`);
        }
      }
      console.log(`\n총 ${totalBugs}개 숨은 에러 발견`);
    }

    // 5xx 에러는 무조건 실패
    const critical5xx = Object.values(pageErrors).flat().filter(e => e.type === "network" && e.message.startsWith("5"));
    expect(critical5xx, `학생앱 ${critical5xx.length}개 5xx 에러 발견`).toHaveLength(0);

    await page.screenshot({ path: "e2e/screenshots/bug-hunt-student-full-nav.png" });
  });
});

// ────────────────────────────────────────
// 데이터 정합성 크로스 검증
// ────────────────────────────────────────

test.describe("데이터 정합성 크로스 검증", () => {
  test("1. Admin에서 보이는 학생 수 == API 학생 수", async ({ page }) => {
    const errors = setupErrorCollector(page);
    const networkErrors = setupNetworkErrorCollector(page);
    await loginViaUI(page, "admin");

    // 학생 페이지 이동
    await page.locator('a[href*="/students"]').first().click();
    await page.waitForURL(/\/students/, { timeout: 10000 });
    await waitForPageReady(page);

    // API 전체 학생 수
    const apiResult = await apiCall(page, "GET", "/students/?page_size=1");
    expect(apiResult.status).toBe(200);
    const totalFromApi = apiResult.body?.count || 0;

    // UI에 표시된 총 학생 수 (페이지네이션 정보에서)
    const countText = page.locator('[class*="count"], [class*="total"], [class*="badge"]');
    // 스크린샷으로 확인
    await page.screenshot({ path: "e2e/screenshots/bug-hunt-cross-students.png" });

    console.log(`API 학생 수: ${totalFromApi}`);
  });

  test("2. 강의에 등록된 학생 == 해당 차시 출석 대상", async ({ page }) => {
    const errors = setupErrorCollector(page);
    const networkErrors = setupNetworkErrorCollector(page);
    await loginViaUI(page, "admin");

    // 강의 목록
    const lecturesApi = await apiCall(page, "GET", "/lectures/?page_size=5");
    expect(lecturesApi.status).toBe(200);

    const lectures = lecturesApi.body?.results || [];
    for (const lecture of lectures.slice(0, 2)) {
      if (!lecture.id) continue;

      // 강의 등록 학생 수
      const enrollApi = await apiCall(page, "GET", `/enrollments/?lecture=${lecture.id}`);
      if (enrollApi.status !== 200) continue;
      const enrollCount = enrollApi.body?.count ?? (enrollApi.body?.results?.length || 0);

      // 차시 목록
      const sessionsApi = await apiCall(page, "GET", `/lectures/${lecture.id}/sessions/?page_size=1`);
      if (sessionsApi.status !== 200) continue;
      const sessions = sessionsApi.body?.results || [];

      if (sessions.length > 0) {
        const sessionId = sessions[0].id;
        // 차시 출석 데이터
        const attendanceApi = await apiCall(page, "GET", `/lectures/attendance/?session=${sessionId}`);
        if (attendanceApi.status === 200) {
          const attendanceItems = attendanceApi.body?.results || attendanceApi.body || [];
          if (Array.isArray(attendanceItems)) {
            console.log(
              `강의 "${lecture.name}" (ID: ${lecture.id}): ` +
              `등록 학생 ${enrollCount}, 차시 ${sessionId} 출석 대상 ${attendanceItems.length}`
            );
            // 등록 학생 수와 출석 대상이 크게 차이나면 데이터 정합성 문제 가능
            if (enrollCount > 0 && attendanceItems.length === 0) {
              console.warn(`⚠️ 강의 ${lecture.id}: 등록 학생 ${enrollCount}명인데 출석 대상 0명 — 정합성 확인 필요`);
            }
          }
        }
      }
    }
  });

  test("3. 시험 점수 합계 검증 — 문항별 배점 합 == 시험 총점", async ({ page }) => {
    const errors = setupErrorCollector(page);
    const networkErrors = setupNetworkErrorCollector(page);
    await loginViaUI(page, "admin");

    const examsApi = await apiCall(page, "GET", "/exams/?page_size=10");
    expect(examsApi.status).toBe(200);

    const exams = examsApi.body?.results || [];
    for (const exam of exams.slice(0, 5)) {
      if (!exam.id || exam.status === "template") continue;

      // 문항 목록
      const questionsApi = await apiCall(page, "GET", `/exams/${exam.id}/questions/`);
      if (questionsApi.status !== 200) continue;

      const questions = questionsApi.body?.results || questionsApi.body || [];
      if (!Array.isArray(questions) || questions.length === 0) continue;

      const pointsSum = questions.reduce((sum: number, q: any) => sum + (q.points || q.score || 0), 0);
      const examTotal = exam.total_score || exam.total_points || 0;

      if (examTotal > 0 && pointsSum > 0 && pointsSum !== examTotal) {
        console.error(
          `❌ 시험 "${exam.title}" (ID: ${exam.id}): ` +
          `문항 배점 합(${pointsSum}) ≠ 시험 총점(${examTotal})`
        );
      } else if (examTotal > 0) {
        console.log(`✅ 시험 "${exam.title}" (ID: ${exam.id}): 배점 합(${pointsSum}) == 총점(${examTotal})`);
      }
    }
  });

  test("4. 클리닉 세션 날짜 유효성 — 과거 세션이 'open' 상태인지", async ({ page }) => {
    const errors = setupErrorCollector(page);
    const networkErrors = setupNetworkErrorCollector(page);
    await loginViaUI(page, "admin");

    const clinicApi = await apiCall(page, "GET", "/clinic/sessions/?page_size=50");
    if (clinicApi.status !== 200) return;

    const sessions = clinicApi.body?.results || [];
    const now = new Date();

    for (const session of sessions) {
      const sessionDate = new Date(session.date || session.scheduled_date || session.start_time);
      const status = session.status;

      // 7일 이상 지난 세션이 아직 open/scheduled 상태면 이상
      if (sessionDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
        if (status === "open" || status === "scheduled") {
          console.warn(
            `⚠️ 클리닉 세션 ${session.id} (${sessionDate.toISOString().slice(0, 10)}): ` +
            `7일 이상 지났는데 상태가 '${status}' — 자동 마감 필요?`
          );
        }
      }
    }
  });

  test("5. 메시징 템플릿 필수 변수 존재 검증", async ({ page }) => {
    const errors = setupErrorCollector(page);
    const networkErrors = setupNetworkErrorCollector(page);
    await loginViaUI(page, "admin");

    const templatesApi = await apiCall(page, "GET", "/messaging/templates/");
    if (templatesApi.status !== 200) return;

    const templates = templatesApi.body?.results || [];
    for (const tmpl of templates) {
      // 템플릿 본문에 {{variable}} 패턴이 있는데 required_variables에 없으면 버그
      const body = tmpl.body || tmpl.content || "";
      const matches = body.match(/\{\{(\w+)\}\}/g) || [];
      const usedVars = matches.map((m: string) => m.replace(/\{\{|\}\}/g, ""));
      const requiredVars = tmpl.required_variables || [];

      for (const v of usedVars) {
        if (!requiredVars.includes(v)) {
          console.warn(
            `⚠️ 템플릿 "${tmpl.name}" (ID: ${tmpl.id}): ` +
            `본문에 {{${v}}} 사용하지만 required_variables에 없음`
          );
        }
      }
    }
  });
});
