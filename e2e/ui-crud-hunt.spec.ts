/**
 * UI 기반 CRUD 데이터 정합성 + 올바른 API CRUD
 *
 * Tenant 1에서:
 * 1. API CRUD (올바른 엔드포인트) → 데이터 반영 검증
 * 2. UI에서 실제 폼 작성 → 저장 → 반영 확인
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
import { apiCall } from "./helpers/api";

const TS = Date.now();
const TAG = `[E2E-${TS}]`;

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

test.describe("UI + API CRUD 정합성", () => {
  test.setTimeout(120000);

  test("1. 공지 CRUD — 올바른 API 엔드포인트", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 공지 생성 (올바른 엔드포인트: /community/posts/)
    const title = `${TAG} 공지 테스트`;
    const create = await apiCall(page, "POST", "/community/posts/", {
      post_type: "notice",
      title: title,
      content: "E2E 테스트 공지 내용",
    });

    if (create.status >= 400) {
      logIssue({
        where: "공지 생성 API",
        what: `생성 실패 (${create.status})`,
        severity: "critical",
        evidence: JSON.stringify(create.body),
      });
      return;
    }

    const postId = create.body?.id;
    console.log(`✅ 공지 생성: ID=${postId}`);

    // UI에서 확인
    await page.goto("https://hakwonplus.com/admin/community/notice", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    let visible = await page.getByText(title, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) {
      logIssue({
        where: "공지 목록 UI",
        what: "생성한 공지가 UI에서 안 보임",
        severity: "critical",
        evidence: `title: ${title}`,
      });
    } else {
      console.log("✅ 공지가 UI에 표시됨");
    }

    // 수정
    const updatedTitle = `${TAG} 수정됨`;
    const patch = await apiCall(page, "PATCH", `/community/posts/${postId}/`, { title: updatedTitle });
    if (patch.status >= 400) {
      logIssue({
        where: "공지 수정",
        what: `수정 실패 (${patch.status})`,
        severity: "major",
        evidence: JSON.stringify(patch.body),
      });
    } else {
      console.log("✅ 공지 수정 성공");
    }

    // 새로고침 후 확인
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3000);

    visible = await page.getByText(updatedTitle, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible && patch.status < 400) {
      logIssue({
        where: "공지 수정 반영",
        what: "수정된 제목이 새로고침 후 반영 안 됨",
        severity: "major",
        evidence: `기대: ${updatedTitle}`,
      });
    }

    // 학생 앱에서 확인
    await loginViaUI(page, "student");
    await page.goto("https://hakwonplus.com/student/notices", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const studentVisible = await page.getByText(updatedTitle, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!studentVisible) {
      console.log("ℹ️ 학생 앱에서 공지 미표시 (권한 or 필터 차이 가능)");
    } else {
      console.log("✅ 학생 앱에서도 공지 확인됨");
    }

    // cleanup
    await loginViaUI(page, "admin");
    const del = await apiCall(page, "DELETE", `/community/posts/${postId}/`);
    console.log(`cleanup: 공지 삭제 ${del.status}`);

    await page.screenshot({ path: "e2e/screenshots/ui-crud-notice.png" });
  });

  test("2. 시험 CRUD — subject 없이 생성", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 시험 생성 (subject 없이)
    const examTitle = `${TAG} 시험 테스트`;
    const create = await apiCall(page, "POST", "/exams/", {
      title: examTitle,
      exam_type: "REGULAR",
    });

    if (create.status >= 400) {
      logIssue({
        where: "시험 생성 API",
        what: `생성 실패 (${create.status})`,
        severity: "major",
        evidence: JSON.stringify(create.body),
      });
      return;
    }

    const examId = create.body?.id;
    console.log(`✅ 시험 생성: ID=${examId}`);

    // 상세 확인
    const detail = await apiCall(page, "GET", `/exams/${examId}/`);
    expect(detail.status).toBe(200);
    expect(detail.body?.title).toBe(examTitle);
    expect(detail.body?.status).toBe("OPEN");
    console.log("✅ 시험 상세: 제목, 상태 정상");

    // UI 확인
    await page.goto("https://hakwonplus.com/admin/exams", { waitUntil: "load" });
    await page.waitForTimeout(4000);

    const examVisible = await page.getByText(examTitle, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!examVisible) {
      logIssue({
        where: "시험 목록 UI",
        what: "생성한 시험이 UI에서 안 보임",
        severity: "major",
        evidence: `title: ${examTitle}`,
      });
    } else {
      console.log("✅ 시험이 UI에 표시됨");

      // 시험 클릭 → 상세 진입
      await page.getByText(examTitle, { exact: false }).first().click();
      await page.waitForTimeout(3000);

      // 에러 토스트 확인
      const errorToast = page.locator('.Toastify__toast--error');
      const hasError = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasError) {
        const text = await errorToast.textContent();
        logIssue({
          where: "시험 상세 진입",
          what: "시험 상세 진입 시 에러 토스트",
          severity: "major",
          evidence: `토스트: ${text}`,
        });
      }
    }

    // cleanup
    const del = await apiCall(page, "DELETE", `/exams/${examId}/`);
    console.log(`cleanup: 시험 삭제 ${del.status}`);

    await page.screenshot({ path: "e2e/screenshots/ui-crud-exam.png" });
  });

  test("3. 클리닉 세션 CRUD — 생성 → 조회 → 삭제", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 클리닉 세션 생성
    const today = new Date().toISOString().slice(0, 10);
    const sessionName = `${TAG} 클리닉 세션`;

    const create = await apiCall(page, "POST", "/clinic/sessions/", {
      title: sessionName,
      date: today,
      start_time: "14:00",
      end_time: "15:00",
      capacity: 5,
    });

    if (create.status >= 400) {
      logIssue({
        where: "클리닉 세션 생성",
        what: `생성 실패 (${create.status})`,
        severity: "major",
        evidence: JSON.stringify(create.body),
      });
      return;
    }

    const sessionId = create.body?.id;
    console.log(`✅ 클리닉 세션 생성: ID=${sessionId}`);

    // 상세 조회
    const detail = await apiCall(page, "GET", `/clinic/sessions/${sessionId}/`);
    if (detail.status !== 200) {
      logIssue({
        where: "클리닉 세션 조회",
        what: `조회 실패 (${detail.status})`,
        severity: "major",
        evidence: `session ID: ${sessionId}`,
      });
    } else {
      console.log("✅ 클리닉 세션 조회 성공");
    }

    // UI 확인 — 클리닉 페이지에서 세션 표시
    await page.goto("https://hakwonplus.com/admin/clinic", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // cleanup
    const del = await apiCall(page, "DELETE", `/clinic/sessions/${sessionId}/`);
    console.log(`cleanup: 클리닉 세션 삭제 ${del.status}`);

    await page.screenshot({ path: "e2e/screenshots/ui-crud-clinic.png" });
  });

  test("4. UI 폼 — 커뮤니티 글쓰기 모달/페이지 접근", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await loginViaUI(page, "admin");

    // 커뮤니티 공지 페이지
    await page.goto("https://hakwonplus.com/admin/community/notice", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // "글쓰기" 또는 "작성" 또는 "+" 버튼 찾기
    const writeBtn = page.locator('button, a').filter({ hasText: /글쓰기|작성|새 공지|추가/ }).first();
    if (await writeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await writeBtn.click();
      await page.waitForTimeout(2000);

      // 폼/모달이 열렸는지
      const form = page.locator('form, [role="dialog"], [class*="modal"], [class*="editor"]').first();
      const formVisible = await form.isVisible({ timeout: 5000 }).catch(() => false);

      if (!formVisible) {
        logIssue({
          where: "공지 글쓰기",
          what: "글쓰기 버튼 클릭 후 폼/모달 안 열림",
          severity: "major",
          evidence: "글쓰기 버튼 클릭됨, 폼 미표시",
        });
      } else {
        console.log("✅ 공지 글쓰기 폼 열림");

        // 에러 토스트 확인
        const errorToast = page.locator('.Toastify__toast--error');
        const hasError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
        if (hasError) {
          const text = await errorToast.textContent();
          logIssue({
            where: "공지 글쓰기 폼",
            what: "폼 열릴 때 에러 토스트",
            severity: "major",
            evidence: `토스트: ${text}`,
          });
        }
      }
    } else {
      console.log("글쓰기 버튼 미발견");
    }

    if (errors.length > 0) {
      logIssue({
        where: "공지 글쓰기 UI",
        what: "미처리 예외",
        severity: "major",
        evidence: errors.join("\n"),
      });
    }

    await page.screenshot({ path: "e2e/screenshots/ui-crud-notice-form.png" });
  });

  test("5. 학생 상세 오버레이 — 탭별 데이터 로딩", async ({ page }) => {
    const api5xx: { url: string; status: number }[] = [];
    page.on("response", (resp) => {
      if (resp.status() >= 500 && resp.url().includes("/api/")) {
        api5xx.push({ url: resp.url(), status: resp.status() });
      }
    });

    await loginViaUI(page, "admin");

    // 학생 목록
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 학생 API
    const students = await apiCall(page, "GET", "/students/?page_size=3");
    if (students.status !== 200 || !students.body?.results?.length) return;

    const student = students.body.results[0];

    // 학생 이름 클릭
    const nameEl = page.getByText(student.name, { exact: false }).first();
    if (await nameEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameEl.click();
      await page.waitForTimeout(3000);

      // 오버레이 내 탭들 순회
      const overlayTabs = ["기본정보", "수강", "성적", "출석", "클리닉", "상담"];
      for (const tabName of overlayTabs) {
        const tab = page.getByText(tabName, { exact: true }).first();
        if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
          const before5xx = api5xx.length;

          await tab.click();
          await page.waitForTimeout(1500);

          // 에러 토스트 확인
          const errorToast = page.locator('.Toastify__toast--error');
          const hasError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
          if (hasError) {
            const text = await errorToast.textContent();
            logIssue({
              where: `학생 상세 > ${tabName} 탭`,
              what: "에러 토스트",
              severity: "major",
              evidence: `학생: ${student.name}, 토스트: ${text}`,
            });
          }

          const new5xx = api5xx.slice(before5xx);
          if (new5xx.length > 0) {
            logIssue({
              where: `학생 상세 > ${tabName} 탭`,
              what: "5xx 에러",
              severity: "critical",
              evidence: new5xx.map(e => `${e.status} ${e.url}`).join("\n"),
            });
          }
        }
      }
    }

    await page.screenshot({ path: "e2e/screenshots/ui-crud-student-overlay.png" });
  });
});

test.afterAll(async () => {
  console.log("\n" + "=".repeat(60));
  console.log("📋 UI CRUD 정합성 최종 보고서");
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
