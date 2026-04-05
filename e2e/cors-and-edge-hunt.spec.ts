/**
 * CORS 재현 + 엣지 케이스 버그 탐지
 *
 * 1. 클리닉 운영콘솔 CORS 에러 재현 및 영향 분석
 * 2. 빠른 페이지 전환 시 race condition
 * 3. 토큰 만료 시뮬레이션
 * 4. 특수 데이터(빈 목록, 긴 텍스트 등) 처리
 * 5. 동시 API 호출 에러
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
import { apiCall } from "./helpers/api";

interface Issue {
  where: string;
  what: string;
  severity: "critical" | "major" | "minor";
  evidence: string;
}

const issues: Issue[] = [];

function logIssue(i: Issue) {
  issues.push(i);
  const icon = { critical: "🔴", major: "🟠", minor: "🟡" }[i.severity];
  console.log(`${icon} ${i.where}: ${i.what}`);
  if (i.evidence) console.log(`   ${i.evidence}`);
}

test.describe("CORS 및 엣지 케이스 탐지", () => {
  test.setTimeout(120000);

  test("1. 클리닉 운영콘솔 CORS — 재현 테스트", async ({ page }) => {
    const corsErrors: string[] = [];
    const api5xx: { url: string; status: number }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("CORS")) {
        corsErrors.push(msg.text());
      }
    });
    page.on("response", (resp) => {
      if (resp.status() >= 500 && resp.url().includes("/api/")) {
        api5xx.push({ url: resp.url(), status: resp.status() });
      }
    });

    await loginViaUI(page, "admin");

    // 클리닉 운영콘솔로 직접 이동
    await page.goto("https://hakwonplus.com/admin/clinic/operations", { waitUntil: "load" });
    await page.waitForTimeout(5000); // 충분히 대기

    if (corsErrors.length > 0) {
      logIssue({
        where: "클리닉 운영콘솔",
        what: "CORS 에러 재현됨",
        severity: "minor",
        evidence: corsErrors[0].slice(0, 200),
      });

      // CORS 에러가 UI에 영향을 주는지 확인
      const errorToast = page.locator('.Toastify__toast--error');
      const hasVisibleError = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasVisibleError) {
        const text = await errorToast.textContent();
        logIssue({
          where: "클리닉 운영콘솔",
          what: "CORS 에러가 사용자에게 에러 토스트로 노출됨",
          severity: "major",
          evidence: `토스트: ${text}`,
        });
      } else {
        console.log("  → CORS 에러가 콘솔에만 뜨고 UI에는 영향 없음 (silent fail)");
      }
    } else {
      console.log("✅ CORS 에러 재현 안 됨 (간헐적 이슈일 수 있음)");
    }

    await page.screenshot({ path: "e2e/screenshots/cors-clinic-ops.png" });
  });

  test("2. 빠른 페이지 전환 — race condition 체크", async ({ page }) => {
    const errors: string[] = [];
    const api5xx: { url: string; status: number }[] = [];

    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (resp) => {
      if (resp.status() >= 500 && resp.url().includes("/api/")) {
        api5xx.push({ url: resp.url(), status: resp.status() });
      }
    });

    await loginViaUI(page, "admin");

    // 빠르게 페이지 전환 (사용자가 메뉴를 빠르게 클릭하는 상황)
    const fastPages = [
      "/admin/students",
      "/admin/exams",
      "/admin/results",
      "/admin/clinic",
      "/admin/community",
      "/admin/message",
      "/admin/videos",
      "/admin/students",  // 다시 돌아가기
    ];

    for (const p of fastPages) {
      // 페이지 로딩 완료를 기다리지 않고 빠르게 전환
      page.goto(`https://hakwonplus.com${p}`, { waitUntil: "commit" }).catch(() => {});
      await page.waitForTimeout(800); // 사용자가 빠르게 클릭하는 간격
    }

    // 마지막 페이지 로딩 대기
    await page.waitForTimeout(5000);

    if (errors.length > 0) {
      logIssue({
        where: "빠른 전환",
        what: "빠른 페이지 전환 시 미처리 예외 발생",
        severity: "major",
        evidence: errors.join("\n"),
      });
    }

    if (api5xx.length > 0) {
      logIssue({
        where: "빠른 전환",
        what: "빠른 전환 중 5xx",
        severity: "critical",
        evidence: api5xx.map(e => `${e.status} ${e.url}`).join("\n"),
      });
    }

    // 최종 상태에서 에러 토스트 확인
    const errorToast = page.locator('.Toastify__toast--error');
    const hasError = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) {
      const text = await errorToast.textContent();
      logIssue({
        where: "빠른 전환 후",
        what: "빠른 전환 후 에러 토스트 남아있음",
        severity: "major",
        evidence: `토스트: ${text}`,
      });
    }

    await page.screenshot({ path: "e2e/screenshots/cors-fast-nav.png" });
  });

  test("3. 학생앱 빠른 탭 전환 — race condition", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (err) => errors.push(err.message));

    await loginViaUI(page, "student");

    // 하단 탭바를 빠르게 전환
    const tabs = [
      "/student/video",
      "/student/sessions",
      "/student/notifications",
      "/student/community",
      "/student/dashboard",
      "/student/video",
    ];

    for (const t of tabs) {
      page.goto(`https://hakwonplus.com${t}`, { waitUntil: "commit" }).catch(() => {});
      await page.waitForTimeout(600);
    }

    await page.waitForTimeout(5000);

    if (errors.length > 0) {
      logIssue({
        where: "학생 빠른 탭전환",
        what: "빠른 탭 전환 시 미처리 예외",
        severity: "major",
        evidence: errors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/cors-student-fast-tab.png" });
  });

  test("4. API 응답 데이터 무결성 — FK 참조 유효성", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 시험 → 강의 FK 유효성
    const examsApi = await apiCall(page, "GET", "/exams/?page_size=20");
    if (examsApi.status === 200) {
      const exams = examsApi.body?.results || [];
      for (const exam of exams) {
        if (exam.lecture_id || exam.lecture) {
          const lectureId = exam.lecture_id || exam.lecture;
          const lectureApi = await apiCall(page, "GET", `/lectures/${lectureId}/`);
          if (lectureApi.status === 404) {
            logIssue({
              where: "데이터 정합성",
              what: `시험 "${exam.title}" (ID:${exam.id})가 존재하지 않는 강의 ${lectureId}를 참조`,
              severity: "critical",
              evidence: `exam.lecture=${lectureId}, API 404`,
            });
          }
        }
      }
    }

    // 클리닉 참가자 → 학생 FK 유효성
    const participantsApi = await apiCall(page, "GET", "/clinic/participants/?page_size=20");
    if (participantsApi.status === 200) {
      const participants = participantsApi.body?.results || [];
      for (const p of participants.slice(0, 10)) {
        if (p.student_id || p.student) {
          const studentId = p.student_id || p.student;
          const studentApi = await apiCall(page, "GET", `/students/${studentId}/`);
          if (studentApi.status === 404) {
            logIssue({
              where: "데이터 정합성",
              what: `클리닉 참가자 ${p.id}가 존재하지 않는 학생 ${studentId}를 참조`,
              severity: "critical",
              evidence: `participant.student=${studentId}, API 404`,
            });
          }
        }
      }
    }

    // 성적 → 시험 FK 유효성
    const factsApi = await apiCall(page, "GET", "/results/admin/facts/?page_size=10");
    if (factsApi.status === 200) {
      const facts = factsApi.body?.results || [];
      for (const fact of facts.slice(0, 5)) {
        if (fact.exam_id || fact.exam) {
          const examId = fact.exam_id || fact.exam;
          const examApi = await apiCall(page, "GET", `/exams/${examId}/`);
          if (examApi.status === 404) {
            logIssue({
              where: "데이터 정합성",
              what: `성적 fact ${fact.id}가 존재하지 않는 시험 ${examId}를 참조`,
              severity: "critical",
              evidence: `fact.exam=${examId}, API 404`,
            });
          }
        }
      }
    }
  });

  test("5. 동시 탭 — 같은 페이지 두 번 열기 + 데이터 충돌", async ({ browser }) => {
    // 두 개의 브라우저 컨텍스트로 동시 접근
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const errors1: string[] = [];
    const errors2: string[] = [];

    page1.on("pageerror", (err) => errors1.push(err.message));
    page2.on("pageerror", (err) => errors2.push(err.message));

    // 동시에 같은 계정으로 로그인
    await Promise.all([
      loginViaUI(page1, "admin"),
      loginViaUI(page2, "admin"),
    ]);

    // 동시에 같은 페이지 접근
    await Promise.all([
      page1.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" }),
      page2.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" }),
    ]);

    await Promise.all([
      page1.waitForTimeout(3000),
      page2.waitForTimeout(3000),
    ]);

    // 둘 다 에러 없이 정상 동작하는지
    if (errors1.length > 0) {
      logIssue({
        where: "동시 접근 탭1",
        what: "동시 접근 시 에러",
        severity: "major",
        evidence: errors1.join("\n"),
      });
    }

    if (errors2.length > 0) {
      logIssue({
        where: "동시 접근 탭2",
        what: "동시 접근 시 에러",
        severity: "major",
        evidence: errors2.join("\n"),
      });
    }

    await page1.screenshot({ path: "e2e/screenshots/cors-concurrent-tab1.png" });
    await page2.screenshot({ path: "e2e/screenshots/cors-concurrent-tab2.png" });

    await context1.close();
    await context2.close();
  });

  test("6. 브라우저 뒤로가기/앞으로가기 반복 — 상태 유지", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await loginViaUI(page, "admin");

    // 여러 페이지 순차 방문
    const visitOrder = [
      "/admin/dashboard",
      "/admin/students",
      "/admin/exams",
      "/admin/results",
      "/admin/clinic",
    ];

    for (const p of visitOrder) {
      await page.goto(`https://hakwonplus.com${p}`, { waitUntil: "load" });
      await page.waitForTimeout(1500);
    }

    // 뒤로가기 3번
    for (let i = 0; i < 3; i++) {
      await page.goBack();
      await page.waitForTimeout(2000);

      const errorToast = page.locator('.Toastify__toast--error');
      const hasError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasError) {
        const text = await errorToast.textContent();
        logIssue({
          where: `뒤로가기 ${i + 1}번째`,
          what: "뒤로가기 시 에러 토스트",
          severity: "major",
          evidence: `토스트: ${text}`,
        });
      }

      // 로그인 페이지로 빠지지 않아야 함
      if (page.url().includes("/login")) {
        logIssue({
          where: `뒤로가기 ${i + 1}번째`,
          what: "뒤로가기 시 로그인 페이지로 이동 (세션 유실)",
          severity: "critical",
          evidence: `URL: ${page.url()}`,
        });
        break;
      }
    }

    // 앞으로가기 2번
    for (let i = 0; i < 2; i++) {
      await page.goForward();
      await page.waitForTimeout(2000);

      const errorToast = page.locator('.Toastify__toast--error');
      const hasError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasError) {
        const text = await errorToast.textContent();
        logIssue({
          where: `앞으로가기 ${i + 1}번째`,
          what: "앞으로가기 시 에러 토스트",
          severity: "major",
          evidence: `토스트: ${text}`,
        });
      }
    }

    if (errors.length > 0) {
      logIssue({
        where: "히스토리 네비게이션",
        what: "뒤로/앞으로가기 중 미처리 예외",
        severity: "major",
        evidence: errors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/cors-history-nav.png" });
  });

  test("7. Admin 각 페이지 새로고침 — 직접 URL 접근 시 정상 렌더링", async ({ page }) => {
    const api5xx: { url: string; status: number }[] = [];
    page.on("response", (resp) => {
      if (resp.status() >= 500 && resp.url().includes("/api/")) {
        api5xx.push({ url: resp.url(), status: resp.status() });
      }
    });

    await loginViaUI(page, "admin");

    // SPA 라우팅이 아닌, 직접 URL로 접근 (새로고침/북마크 시나리오)
    const directPages = [
      "/admin/dashboard",
      "/admin/students",
      "/admin/exams",
      "/admin/results",
      "/admin/clinic",
      "/admin/community/notice",
      "/admin/community/qna",
      "/admin/message",
      "/admin/message/templates",
      "/admin/message/log",
      "/admin/videos",
      "/admin/storage",
      "/admin/tools",
      "/admin/staff",
      "/admin/settings",
      "/admin/guide",
    ];

    for (const p of directPages) {
      const before5xx = api5xx.length;

      await page.goto(`https://hakwonplus.com${p}`, { waitUntil: "load", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);

      // 로그인 페이지로 리다이렉트되지 않아야 함
      if (page.url().includes("/login")) {
        logIssue({
          where: `직접접근: ${p}`,
          what: "직접 URL 접근 시 로그인으로 리다이렉트 (SPA 라우팅 실패)",
          severity: "critical",
          evidence: `요청: ${p}, 현재: ${page.url()}`,
        });
        // 재로그인
        await loginViaUI(page, "admin");
        continue;
      }

      const new5xx = api5xx.slice(before5xx);
      if (new5xx.length > 0) {
        logIssue({
          where: `직접접근: ${p}`,
          what: "5xx 에러",
          severity: "critical",
          evidence: new5xx.map(e => `${e.status} ${e.url}`).join("\n"),
        });
      }

      // 에러 토스트 확인
      const errorToast = page.locator('.Toastify__toast--error');
      const hasError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasError) {
        const text = await errorToast.textContent();
        logIssue({
          where: `직접접근: ${p}`,
          what: "에러 토스트",
          severity: "major",
          evidence: `토스트: ${text}`,
        });
      }
    }
  });
});

test.afterAll(async () => {
  console.log("\n" + "=".repeat(60));
  console.log("📋 CORS & 엣지 케이스 최종 보고서");
  console.log("=".repeat(60));

  if (issues.length === 0) {
    console.log("\n✅ 발견된 이슈 없음");
    return;
  }

  const critical = issues.filter(i => i.severity === "critical");
  const major = issues.filter(i => i.severity === "major");
  const minor = issues.filter(i => i.severity === "minor");

  console.log(`\n총 ${issues.length}개 이슈:`);
  console.log(`  🔴 Critical: ${critical.length}`);
  console.log(`  🟠 Major: ${major.length}`);
  console.log(`  🟡 Minor: ${minor.length}`);

  for (const i of issues) {
    const icon = { critical: "🔴", major: "🟠", minor: "🟡" }[i.severity];
    console.log(`\n${icon} [${i.where}] ${i.what}`);
    console.log(`   ${i.evidence}`);
  }
});
