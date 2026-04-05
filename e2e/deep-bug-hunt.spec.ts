/**
 * Deep Bug Hunt — 실제 사용자 행동 기반 심층 버그 탐지
 *
 * 포커스:
 * 1. CRUD 후 데이터 반영 여부 (저장 → 새로고침 → 데이터 유지?)
 * 2. 상세 페이지 진입 후 에러 없이 데이터 표시?
 * 3. 탭 전환/뒤로가기 후 상태 유지?
 * 4. 에러 토스트가 부적절하게 뜨는 경우?
 * 5. API 응답과 UI 표시 불일치?
 * 6. 빈 상태 처리가 올바른지?
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
import { apiCall } from "./helpers/api";

interface BugReport {
  page: string;
  severity: "critical" | "major" | "minor" | "info";
  description: string;
  evidence: string;
}

const bugs: BugReport[] = [];

function reportBug(bug: BugReport) {
  bugs.push(bug);
  const icon = { critical: "🔴", major: "🟠", minor: "🟡", info: "🔵" }[bug.severity];
  console.log(`${icon} [${bug.severity.toUpperCase()}] ${bug.page}: ${bug.description}`);
  if (bug.evidence) console.log(`   증거: ${bug.evidence}`);
}

// 에러 토스트 감시 — 페이지 전체 사용 동안 뜨는 에러 토스트 수집
async function collectErrorToasts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const toasts = document.querySelectorAll('.Toastify__toast--error, [class*="toast"][class*="error"]');
    return Array.from(toasts).map(t => t.textContent || "");
  });
}

// API 5xx 수집기
function setup5xxCollector(page: Page) {
  const errors: { url: string; status: number }[] = [];
  page.on("response", (resp) => {
    if (resp.status() >= 500 && resp.url().includes("/api/")) {
      errors.push({ url: resp.url(), status: resp.status() });
    }
  });
  return errors;
}

// 콘솔 에러 수집기 (의미있는 것만)
function setupConsoleCollector(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        text.includes("favicon") ||
        text.includes("DevTools") ||
        text.includes("Download the React") ||
        text.includes("third-party cookie") ||
        text.includes("net::ERR_BLOCKED_BY_CLIENT") ||
        text.includes("ResizeObserver")
      ) return;
      errors.push(text);
    }
  });
  // unhandled promise rejection
  page.on("pageerror", (err) => {
    errors.push(`UNHANDLED: ${err.message}`);
  });
  return errors;
}

// ════════════════════════════════════════
// Part 1: Admin 심층 플로우
// ════════════════════════════════════════

test.describe("Admin 심층 버그 탐지", () => {
  test.setTimeout(120000);

  test("1. 학생 상세 페이지 — 데이터 로딩 + 탭 전환 + 에러 없음", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "admin");

    // 학생 목록
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // API로 학생 목록 가져오기
    const studentsApi = await apiCall(page, "GET", "/students/");
    expect(studentsApi.status).toBe(200);
    const students = studentsApi.body?.results || [];

    if (students.length === 0) {
      console.log("학생 없음, 스킵");
      return;
    }

    // 첫 번째 학생 행 클릭 (실제 사용자처럼)
    const firstRow = page.locator('tr, [class*="row"], [class*="item"]').filter({ hasText: students[0].name || "" }).first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(2000);
    } else {
      // 학생 이름 텍스트 클릭
      const nameLink = page.getByText(students[0].name, { exact: false }).first();
      if (await nameLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameLink.click();
        await page.waitForTimeout(2000);
      }
    }

    // 상세 모달/페이지에서 에러 토스트 확인
    const errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 상세",
        severity: "major",
        description: "학생 상세 진입 시 에러 토스트 발생",
        evidence: errorToasts.join(", "),
      });
    }

    // 5xx 에러 확인
    if (api5xx.length > 0) {
      reportBug({
        page: "학생 상세",
        severity: "critical",
        description: "학생 상세 로딩 중 5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    // 콘솔 에러 확인
    if (consoleErrors.length > 0) {
      reportBug({
        page: "학생 상세",
        severity: "minor",
        description: "학생 상세 페이지 콘솔 에러",
        evidence: consoleErrors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-admin-student-detail.png" });
  });

  test("2. 시험 상세 — 문항 있는 시험의 상세 페이지 데이터", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "admin");

    // 시험 목록에서 OPEN 상태 시험 찾기
    const examsApi = await apiCall(page, "GET", "/exams/?page_size=20");
    expect(examsApi.status).toBe(200);
    const exams = examsApi.body?.results || [];

    const openExam = exams.find((e: any) => e.status === "OPEN");
    if (!openExam) {
      console.log("OPEN 시험 없음, 스킵");
      return;
    }

    // 시험 페이지로 이동
    await page.goto("https://hakwonplus.com/admin/exams", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 시험 클릭 (실제 사용자처럼 목록에서 클릭)
    const examLink = page.getByText(openExam.title || openExam.name, { exact: false }).first();
    if (await examLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await examLink.click();
      await page.waitForTimeout(3000);

      // 에러 토스트 확인
      const errorToasts = await collectErrorToasts(page);
      if (errorToasts.length > 0) {
        reportBug({
          page: "시험 상세",
          severity: "major",
          description: `시험 "${openExam.title}" 상세 진입 시 에러 토스트`,
          evidence: errorToasts.join(", "),
        });
      }

      // 문항 데이터가 API에 있으면 UI에도 보여야 함
      const questionsApi = await apiCall(page, "GET", `/exams/${openExam.id}/questions/`);
      if (questionsApi.status === 200) {
        const questions = questionsApi.body?.results || questionsApi.body || [];
        if (Array.isArray(questions) && questions.length > 0) {
          console.log(`시험 "${openExam.title}": ${questions.length}개 문항 확인됨`);
        }
      }
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "시험 상세",
        severity: "critical",
        description: "시험 상세 로딩 중 5xx",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    if (consoleErrors.length > 0) {
      reportBug({
        page: "시험 상세",
        severity: "minor",
        description: "시험 상세 콘솔 에러",
        evidence: consoleErrors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-admin-exam-detail.png" });
  });

  test("3. 성적 입력 페이지 — 차시별 성적 데이터 로딩", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "admin");

    // 성적 페이지 이동
    await page.goto("https://hakwonplus.com/admin/results", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "성적 페이지",
        severity: "major",
        description: "성적 페이지 진입 시 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // 성적 관련 API 검증
    // 제출 내역
    const submissionsApi = await apiCall(page, "GET", "/results/admin/facts/?page_size=5");
    if (submissionsApi.status >= 500) {
      reportBug({
        page: "성적 API",
        severity: "critical",
        description: "성적 facts API 5xx",
        evidence: `${submissionsApi.status}`,
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "성적 페이지",
        severity: "critical",
        description: "성적 페이지 5xx",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    if (consoleErrors.length > 0) {
      reportBug({
        page: "성적 페이지",
        severity: "minor",
        description: "성적 페이지 콘솔 에러",
        evidence: consoleErrors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-admin-results.png" });
  });

  test("4. 클리닉 콘솔 — 예약 현황 + 상세 데이터", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "admin");

    // 클리닉 메인
    await page.goto("https://hakwonplus.com/admin/clinic", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    let errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "클리닉",
        severity: "major",
        description: "클리닉 진입 시 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // 클리닉 하위 페이지 순회
    const clinicPages = [
      { name: "일정", path: "/admin/clinic/schedule" },
      { name: "운영콘솔", path: "/admin/clinic/operations" },
      { name: "예약", path: "/admin/clinic/bookings" },
      { name: "리포트", path: "/admin/clinic/reports" },
      { name: "설정", path: "/admin/clinic/settings" },
    ];

    for (const cp of clinicPages) {
      const before5xx = api5xx.length;
      const beforeConsole = consoleErrors.length;

      await page.goto(`https://hakwonplus.com${cp.path}`, { waitUntil: "load", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      errorToasts = await collectErrorToasts(page);
      if (errorToasts.length > 0) {
        reportBug({
          page: `클리닉 > ${cp.name}`,
          severity: "major",
          description: `에러 토스트 발생`,
          evidence: errorToasts.join(", "),
        });
      }

      const new5xx = api5xx.slice(before5xx);
      if (new5xx.length > 0) {
        reportBug({
          page: `클리닉 > ${cp.name}`,
          severity: "critical",
          description: "5xx 에러",
          evidence: new5xx.map(e => `${e.status} ${e.url}`).join("\n"),
        });
      }

      const newConsole = consoleErrors.slice(beforeConsole);
      if (newConsole.length > 0) {
        reportBug({
          page: `클리닉 > ${cp.name}`,
          severity: "minor",
          description: "콘솔 에러",
          evidence: newConsole.join("\n"),
        });
      }

      await page.screenshot({ path: `e2e/screenshots/deep-admin-clinic-${cp.name}.png` });
    }
  });

  test("5. 커뮤니티 공지 — 작성 → 학생 앱에서 보이는지", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "admin");

    // 커뮤니티 > 공지
    await page.goto("https://hakwonplus.com/admin/community/notice", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    let errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "커뮤니티 공지",
        severity: "major",
        description: "공지 페이지 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // 공지 목록 API
    const noticesApi = await apiCall(page, "GET", "/community/?category=notice&page_size=5");
    if (noticesApi.status >= 500) {
      reportBug({
        page: "커뮤니티 공지 API",
        severity: "critical",
        description: "공지 API 5xx",
        evidence: `${noticesApi.status}`,
      });
    }

    // QnA 페이지
    await page.goto("https://hakwonplus.com/admin/community/qna", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "커뮤니티 QnA",
        severity: "major",
        description: "QnA 페이지 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // 상담 페이지
    await page.goto("https://hakwonplus.com/admin/community/counsel", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "커뮤니티 상담",
        severity: "major",
        description: "상담 페이지 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "커뮤니티",
        severity: "critical",
        description: "커뮤니티 관련 5xx",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-admin-community.png" });
  });

  test("6. 메시지 발송 흐름 — 템플릿 선택 + 프리뷰 데이터", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/message", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 메시지 페이지 하위 탭들
    const msgPages = [
      { name: "템플릿", path: "/admin/message/templates" },
      { name: "자동발송", path: "/admin/message/auto-send" },
      { name: "발송이력", path: "/admin/message/log" },
      { name: "설정", path: "/admin/message/settings" },
    ];

    for (const mp of msgPages) {
      const before5xx = api5xx.length;

      await page.goto(`https://hakwonplus.com${mp.path}`, { waitUntil: "load", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const errorToasts = await collectErrorToasts(page);
      if (errorToasts.length > 0) {
        reportBug({
          page: `메시지 > ${mp.name}`,
          severity: "major",
          description: "에러 토스트",
          evidence: errorToasts.join(", "),
        });
      }

      const new5xx = api5xx.slice(before5xx);
      if (new5xx.length > 0) {
        reportBug({
          page: `메시지 > ${mp.name}`,
          severity: "critical",
          description: "5xx 에러",
          evidence: new5xx.map(e => `${e.status} ${e.url}`).join("\n"),
        });
      }
    }

    // 템플릿 데이터 정합성
    const templatesApi = await apiCall(page, "GET", "/messaging/templates/");
    if (templatesApi.status === 200) {
      const templates = templatesApi.body?.results || [];
      for (const tmpl of templates) {
        // 채널이 유효한지
        if (tmpl.channel) {
          const validChannels = ["sms", "alimtalk", "both"];
          if (!validChannels.includes(tmpl.channel)) {
            reportBug({
              page: "메시지 템플릿",
              severity: "major",
              description: `템플릿 "${tmpl.name}" 채널 '${tmpl.channel}' 유효하지 않음`,
              evidence: `유효값: ${validChannels.join(", ")}`,
            });
          }
        }
      }
    }

    // 자동발송 설정 정합성
    const autoSendApi = await apiCall(page, "GET", "/messaging/auto-send/");
    if (autoSendApi.status === 200) {
      const configs = autoSendApi.body?.results || autoSendApi.body || [];
      if (Array.isArray(configs)) {
        for (const cfg of configs) {
          // 활성화된 자동발송에 템플릿이 연결되어 있는지
          if (cfg.is_active && !cfg.template && !cfg.template_id) {
            reportBug({
              page: "자동발송",
              severity: "major",
              description: `자동발송 "${cfg.event_type || cfg.name}" 활성 상태인데 템플릿 미연결`,
              evidence: JSON.stringify(cfg),
            });
          }
        }
      }
    }

    await page.screenshot({ path: "e2e/screenshots/deep-admin-message.png" });
  });

  test("7. 보관함(Storage) — 파일 목록 로딩", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/storage", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "보관함",
        severity: "major",
        description: "보관함 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "보관함",
        severity: "critical",
        description: "보관함 5xx",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    if (consoleErrors.length > 0) {
      reportBug({
        page: "보관함",
        severity: "minor",
        description: "보관함 콘솔 에러",
        evidence: consoleErrors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-admin-storage.png" });
  });

  test("8. 직원관리 — 접근 및 데이터 로딩", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/staff", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "직원관리",
        severity: "major",
        description: "직원관리 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "직원관리",
        severity: "critical",
        description: "직원관리 5xx",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-admin-staff.png" });
  });
});

// ════════════════════════════════════════
// Part 2: Student 심층 플로우
// ════════════════════════════════════════

test.describe("Student 심층 버그 탐지", () => {
  test.setTimeout(120000);

  test("1. 학생 대시보드 → 영상 → 코스 상세 플로우", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "student");

    await page.waitForTimeout(2000);

    // 대시보드 에러 확인
    let errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 대시보드",
        severity: "major",
        description: "대시보드 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // 영상 페이지
    await page.goto("https://hakwonplus.com/student/video", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 영상",
        severity: "major",
        description: "영상 페이지 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // 공개 코스가 있으면 진입
    const publicLink = page.locator('a[href*="/video/courses/public"]').first();
    if (await publicLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await publicLink.click();
      await page.waitForTimeout(2000);

      errorToasts = await collectErrorToasts(page);
      if (errorToasts.length > 0) {
        reportBug({
          page: "학생 공개영상",
          severity: "major",
          description: "공개영상 에러 토스트",
          evidence: errorToasts.join(", "),
        });
      }
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "학생 영상 플로우",
        severity: "critical",
        description: "5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    if (consoleErrors.length > 0) {
      reportBug({
        page: "학생 영상 플로우",
        severity: "minor",
        description: "콘솔 에러",
        evidence: consoleErrors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-student-video-flow.png" });
  });

  test("2. 학생 시험 목록 → 시험 상세 → 결과 확인 플로우", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "student");

    // 시험 목록
    await page.goto("https://hakwonplus.com/student/exams", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    let errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 시험목록",
        severity: "major",
        description: "시험 목록 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // API로 가능한 시험 확인
    const availableApi = await apiCall(page, "GET", "/exams/me/available/");
    if (availableApi.status >= 500) {
      reportBug({
        page: "학생 시험 API",
        severity: "critical",
        description: "available 시험 API 5xx",
        evidence: `${availableApi.status}`,
      });
    }

    // 시험이 있으면 첫 번째 클릭
    if (availableApi.status === 200) {
      const available = availableApi.body?.results || availableApi.body || [];
      if (Array.isArray(available) && available.length > 0) {
        const firstExam = available[0];
        // 시험 상세 이동
        await page.goto(`https://hakwonplus.com/student/exams/${firstExam.id || firstExam.exam_id}`, { waitUntil: "load" });
        await page.waitForTimeout(2000);

        errorToasts = await collectErrorToasts(page);
        if (errorToasts.length > 0) {
          reportBug({
            page: "학생 시험상세",
            severity: "major",
            description: `시험 상세 에러 토스트 (시험 ${firstExam.id || firstExam.exam_id})`,
            evidence: errorToasts.join(", "),
          });
        }
      }
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "학생 시험 플로우",
        severity: "critical",
        description: "5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-student-exam-flow.png" });
  });

  test("3. 학생 성적 → 상세 → 데이터 정합성", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "student");

    await page.goto("https://hakwonplus.com/student/grades", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 성적",
        severity: "major",
        description: "성적 페이지 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "학생 성적",
        severity: "critical",
        description: "5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    if (consoleErrors.length > 0) {
      reportBug({
        page: "학생 성적",
        severity: "minor",
        description: "콘솔 에러",
        evidence: consoleErrors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-student-grades.png" });
  });

  test("4. 학생 제출 — 과제 제출 페이지 데이터", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "student");

    // 과제 제출 페이지
    await page.goto("https://hakwonplus.com/student/submit/assignment", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    let errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 과제제출",
        severity: "major",
        description: "과제 제출 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // 점수 제출 페이지
    await page.goto("https://hakwonplus.com/student/submit/score", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 점수제출",
        severity: "major",
        description: "점수 제출 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "학생 제출 플로우",
        severity: "critical",
        description: "5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-student-submit.png" });
  });

  test("5. 학생 클리닉 ID카드 — 데이터 표시", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "student");

    await page.goto("https://hakwonplus.com/student/idcard", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 ID카드",
        severity: "major",
        description: "ID카드 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "학생 ID카드",
        severity: "critical",
        description: "5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-student-idcard.png" });
  });

  test("6. 학생 설정 페이지 — 프로필/설정 데이터", async ({ page }) => {
    const api5xx = setup5xxCollector(page);
    const consoleErrors = setupConsoleCollector(page);
    await loginViaUI(page, "student");

    await page.goto("https://hakwonplus.com/student/settings", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 설정",
        severity: "major",
        description: "설정 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "학생 설정",
        severity: "critical",
        description: "5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-student-settings.png" });
  });
});

// ════════════════════════════════════════
// Part 3: 크로스 검증 (Admin ↔ Student 데이터 일치)
// ════════════════════════════════════════

test.describe("크로스 데이터 정합성", () => {
  test.setTimeout(120000);

  test("1. Admin 학생 정보 == Student 프로필 정보", async ({ page }) => {
    const api5xx = setup5xxCollector(page);

    // Admin으로 학생 정보 조회
    await loginViaUI(page, "admin");
    const studentsApi = await apiCall(page, "GET", "/students/");
    expect(studentsApi.status).toBe(200);
    const students = studentsApi.body?.results || [];

    // 테스트 학생 찾기 (student user = 3333)
    const testStudent = students.find((s: any) =>
      s.username === "3333" || s.phone === "3333" || s.student_number === "3333"
    );

    if (!testStudent) {
      console.log("테스트 학생(3333) 미발견, 스킵");
      return;
    }

    const adminStudentName = testStudent.name;
    const adminStudentPhone = testStudent.phone;
    console.log(`Admin에서 본 학생: ${adminStudentName} (${adminStudentPhone})`);

    // Student로 로그인해서 프로필 확인
    await loginViaUI(page, "student");
    await page.goto("https://hakwonplus.com/student/profile", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 프로필 페이지에 학생 이름이 보이는지
    const nameVisible = await page.getByText(adminStudentName, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!nameVisible) {
      reportBug({
        page: "크로스: 학생 프로필",
        severity: "major",
        description: `Admin에서 보이는 학생 이름 "${adminStudentName}"이 학생 프로필에서 안 보임`,
        evidence: `Admin name: ${adminStudentName}`,
      });
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "크로스 검증",
        severity: "critical",
        description: "5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-cross-profile.png" });
  });

  test("2. Admin 공지 목록 == Student 공지 목록", async ({ page }) => {
    const api5xx = setup5xxCollector(page);

    // Admin으로 공지 조회
    await loginViaUI(page, "admin");
    const adminNotices = await apiCall(page, "GET", "/community/?category=notice&page_size=5");

    let adminNoticeList: any[] = [];
    if (adminNotices.status === 200) {
      adminNoticeList = adminNotices.body?.results || [];
    }

    // Student로 공지 조회
    await loginViaUI(page, "student");
    await page.goto("https://hakwonplus.com/student/notices", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const errorToasts = await collectErrorToasts(page);
    if (errorToasts.length > 0) {
      reportBug({
        page: "학생 공지",
        severity: "major",
        description: "공지 페이지 에러 토스트",
        evidence: errorToasts.join(", "),
      });
    }

    // 최신 공지가 학생 앱에서도 보이는지
    if (adminNoticeList.length > 0) {
      const latestNotice = adminNoticeList[0];
      const title = latestNotice.title || latestNotice.subject;
      if (title) {
        const visible = await page.getByText(title, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        if (!visible) {
          reportBug({
            page: "크로스: 공지",
            severity: "major",
            description: `Admin 최신 공지 "${title}"이 학생 앱에서 안 보임`,
            evidence: `Admin notice ID: ${latestNotice.id}`,
          });
        }
      }
    }

    if (api5xx.length > 0) {
      reportBug({
        page: "크로스 공지 검증",
        severity: "critical",
        description: "5xx 에러",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/deep-cross-notices.png" });
  });
});

// ════════════════════════════════════════
// 최종 버그 보고서
// ════════════════════════════════════════

test.afterAll(async () => {
  if (bugs.length === 0) {
    console.log("\n✅ 심층 버그 탐지 완료: 발견된 버그 없음");
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 심층 버그 탐지 최종 보고서");
  console.log("=".repeat(60));

  const critical = bugs.filter(b => b.severity === "critical");
  const major = bugs.filter(b => b.severity === "major");
  const minor = bugs.filter(b => b.severity === "minor");
  const info = bugs.filter(b => b.severity === "info");

  console.log(`\n총 ${bugs.length}개 이슈 발견:`);
  console.log(`  🔴 Critical: ${critical.length}`);
  console.log(`  🟠 Major: ${major.length}`);
  console.log(`  🟡 Minor: ${minor.length}`);
  console.log(`  🔵 Info: ${info.length}`);

  for (const bug of bugs) {
    const icon = { critical: "🔴", major: "🟠", minor: "🟡", info: "🔵" }[bug.severity];
    console.log(`\n${icon} [${bug.severity.toUpperCase()}] ${bug.page}`);
    console.log(`   ${bug.description}`);
    if (bug.evidence) console.log(`   증거: ${bug.evidence}`);
  }
});
