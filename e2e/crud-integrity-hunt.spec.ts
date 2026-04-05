/**
 * CRUD 데이터 정합성 버그 탐지
 *
 * Tenant 1에서 실제 CRUD 후:
 * 1. 생성 → 목록에 나타나는지
 * 2. 수정 → 새로고침 후 유지되는지
 * 3. 삭제 → 목록에서 사라지는지
 * 4. 생성 데이터 cleanup
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

test.describe("CRUD 데이터 정합성", () => {
  test.setTimeout(120000);

  test("1. 커뮤니티 공지 CRUD — 생성 → 조회 → 수정 → 삭제", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 1. 공지 생성 (API)
    const title = `${TAG} 테스트 공지`;
    const createResult = await apiCall(page, "POST", "/community/", {
      category: "notice",
      title: title,
      content: "E2E 테스트 공지 내용입니다.",
      is_pinned: false,
    });

    if (createResult.status >= 400) {
      logIssue({
        where: "공지 생성",
        what: `공지 생성 실패 (${createResult.status})`,
        severity: "critical",
        evidence: JSON.stringify(createResult.body),
      });
      return;
    }

    const noticeId = createResult.body?.id;
    expect(noticeId, "생성된 공지 ID").toBeTruthy();
    console.log(`공지 생성됨: ID=${noticeId}, title="${title}"`);

    // 2. 목록에서 보이는지 확인 (UI)
    await page.goto("https://hakwonplus.com/admin/community/notice", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const noticeVisible = await page.getByText(title, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!noticeVisible) {
      logIssue({
        where: "공지 목록",
        what: "방금 생성한 공지가 목록에서 안 보임",
        severity: "critical",
        evidence: `title: ${title}, ID: ${noticeId}`,
      });
    } else {
      console.log("✅ 생성된 공지가 목록에 표시됨");
    }

    // 3. 수정 (API)
    const updatedTitle = `${TAG} 수정된 테스트 공지`;
    const updateResult = await apiCall(page, "PATCH", `/community/${noticeId}/`, {
      title: updatedTitle,
    });

    if (updateResult.status >= 400) {
      logIssue({
        where: "공지 수정",
        what: `공지 수정 실패 (${updateResult.status})`,
        severity: "major",
        evidence: JSON.stringify(updateResult.body),
      });
    } else {
      // 수정 후 새로고침해서 반영 확인
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(3000);

      const updatedVisible = await page.getByText(updatedTitle, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
      if (!updatedVisible) {
        logIssue({
          where: "공지 수정 반영",
          what: "수정한 공지 제목이 새로고침 후 반영 안 됨",
          severity: "major",
          evidence: `기대: ${updatedTitle}`,
        });
      } else {
        console.log("✅ 수정된 공지 제목이 반영됨");
      }
    }

    // 4. 학생 앱에서도 보이는지
    await loginViaUI(page, "student");
    await page.goto("https://hakwonplus.com/student/notices", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const studentVisible = await page.getByText(updatedTitle, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!studentVisible) {
      // API로 확인
      const studentNotices = await apiCall(page, "GET", "/community/?category=notice&page_size=5");
      const found = (studentNotices.body?.results || []).some((n: any) => n.id === noticeId);
      if (found) {
        logIssue({
          where: "학생 공지 UI",
          what: "API에는 있지만 학생 UI에서 안 보임 (UI 렌더링 문제)",
          severity: "major",
          evidence: `notice ID: ${noticeId}`,
        });
      } else {
        console.log("학생 API에서도 해당 공지 미발견 (권한/필터 차이일 수 있음)");
      }
    } else {
      console.log("✅ 학생 앱에서도 수정된 공지 표시됨");
    }

    // 5. 삭제 (cleanup)
    await loginViaUI(page, "admin");
    const deleteResult = await apiCall(page, "DELETE", `/community/${noticeId}/`);
    if (deleteResult.status >= 400 && deleteResult.status !== 204) {
      logIssue({
        where: "공지 삭제",
        what: `공지 삭제 실패 (${deleteResult.status})`,
        severity: "minor",
        evidence: JSON.stringify(deleteResult.body),
      });
    } else {
      console.log(`✅ 테스트 공지 삭제 완료 (ID: ${noticeId})`);

      // 삭제 후 목록에서 사라졌는지
      await page.goto("https://hakwonplus.com/admin/community/notice", { waitUntil: "load" });
      await page.waitForTimeout(3000);

      const stillVisible = await page.getByText(updatedTitle, { exact: false }).isVisible({ timeout: 3000 }).catch(() => false);
      if (stillVisible) {
        logIssue({
          where: "공지 삭제 반영",
          what: "삭제한 공지가 여전히 목록에 표시됨",
          severity: "critical",
          evidence: `title: ${updatedTitle}`,
        });
      } else {
        console.log("✅ 삭제된 공지가 목록에서 사라짐");
      }
    }

    await page.screenshot({ path: "e2e/screenshots/crud-notice.png" });
  });

  test("2. 시험 데이터 — 시험 생성 → 문항 추가 → 시험 조회 → 정합성 → cleanup", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 시험 생성
    const examTitle = `${TAG} 테스트 시험`;
    const createExam = await apiCall(page, "POST", "/exams/", {
      title: examTitle,
      exam_type: "regular",
      subject: "math",
    });

    if (createExam.status >= 400) {
      logIssue({
        where: "시험 생성",
        what: `시험 생성 실패 (${createExam.status})`,
        severity: "major",
        evidence: JSON.stringify(createExam.body),
      });
      return;
    }

    const examId = createExam.body?.id;
    console.log(`시험 생성됨: ID=${examId}, title="${examTitle}"`);

    // 시험 상세 API로 확인
    const examDetail = await apiCall(page, "GET", `/exams/${examId}/`);
    expect(examDetail.status).toBe(200);

    // 제목 일치 확인
    if (examDetail.body?.title !== examTitle) {
      logIssue({
        where: "시험 상세",
        what: `생성한 시험 제목 불일치 (기대: "${examTitle}", 실제: "${examDetail.body?.title}")`,
        severity: "critical",
        evidence: `exam ID: ${examId}`,
      });
    }

    // 상태 확인 (새 시험 = OPEN)
    if (examDetail.body?.status !== "OPEN") {
      logIssue({
        where: "시험 상태",
        what: `새 시험 기본 상태가 OPEN이 아님 (${examDetail.body?.status})`,
        severity: "major",
        evidence: `exam ID: ${examId}`,
      });
    }

    // UI에서 시험 목록 확인
    await page.goto("https://hakwonplus.com/admin/exams", { waitUntil: "load" });
    await page.waitForTimeout(4000);

    const examVisible = await page.getByText(examTitle, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!examVisible) {
      logIssue({
        where: "시험 목록 UI",
        what: "생성한 시험이 목록에서 안 보임",
        severity: "major",
        evidence: `title: ${examTitle}`,
      });
    } else {
      console.log("✅ 생성된 시험이 목록에 표시됨");
    }

    // Cleanup: 시험 삭제
    const deleteExam = await apiCall(page, "DELETE", `/exams/${examId}/`);
    if (deleteExam.status < 400 || deleteExam.status === 204) {
      console.log(`✅ 테스트 시험 삭제 완료 (ID: ${examId})`);
    } else {
      // 삭제 실패해도 큰 문제는 아님 (Tenant 1 테스트 데이터)
      console.log(`시험 삭제 상태: ${deleteExam.status}`);
    }

    await page.screenshot({ path: "e2e/screenshots/crud-exam.png" });
  });

  test("3. 메시지 템플릿 CRUD — 생성 → 조회 → 수정 → 삭제", async ({ page }) => {
    await loginViaUI(page, "admin");

    const tmplName = `${TAG} 테스트 템플릿`;
    const tmplBody = "안녕하세요 {{student_name}}님, 테스트 메시지입니다.";

    // 생성
    const create = await apiCall(page, "POST", "/messaging/templates/", {
      name: tmplName,
      body: tmplBody,
      channel: "sms",
    });

    if (create.status >= 400) {
      logIssue({
        where: "템플릿 생성",
        what: `템플릿 생성 실패 (${create.status})`,
        severity: "major",
        evidence: JSON.stringify(create.body),
      });
      return;
    }

    const tmplId = create.body?.id;
    console.log(`템플릿 생성됨: ID=${tmplId}`);

    // 조회
    const detail = await apiCall(page, "GET", `/messaging/templates/${tmplId}/`);
    expect(detail.status).toBe(200);

    if (detail.body?.name !== tmplName) {
      logIssue({
        where: "템플릿 조회",
        what: `템플릿 이름 불일치`,
        severity: "major",
        evidence: `기대: ${tmplName}, 실제: ${detail.body?.name}`,
      });
    }

    if (detail.body?.body !== tmplBody) {
      logIssue({
        where: "템플릿 조회",
        what: `템플릿 본문 불일치`,
        severity: "major",
        evidence: `기대: ${tmplBody}, 실제: ${detail.body?.body}`,
      });
    }

    // 수정
    const updatedName = `${TAG} 수정된 템플릿`;
    const update = await apiCall(page, "PATCH", `/messaging/templates/${tmplId}/`, {
      name: updatedName,
    });

    if (update.status >= 400) {
      logIssue({
        where: "템플릿 수정",
        what: `템플릿 수정 실패 (${update.status})`,
        severity: "major",
        evidence: JSON.stringify(update.body),
      });
    }

    // 수정 후 재조회
    const afterUpdate = await apiCall(page, "GET", `/messaging/templates/${tmplId}/`);
    if (afterUpdate.body?.name !== updatedName) {
      logIssue({
        where: "템플릿 수정 반영",
        what: "수정 후 이름이 반영 안 됨",
        severity: "critical",
        evidence: `기대: ${updatedName}, 실제: ${afterUpdate.body?.name}`,
      });
    } else {
      console.log("✅ 템플릿 수정 반영됨");
    }

    // UI 확인
    await page.goto("https://hakwonplus.com/admin/message/templates", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const tmplVisible = await page.getByText(updatedName, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (!tmplVisible) {
      logIssue({
        where: "템플릿 UI",
        what: "수정된 템플릿이 UI에서 안 보임",
        severity: "major",
        evidence: `name: ${updatedName}`,
      });
    }

    // 삭제
    const del = await apiCall(page, "DELETE", `/messaging/templates/${tmplId}/`);
    if (del.status < 400 || del.status === 204) {
      console.log(`✅ 테스트 템플릿 삭제 완료 (ID: ${tmplId})`);
    }

    await page.screenshot({ path: "e2e/screenshots/crud-template.png" });
  });

  test("4. 학생 목록 검색/필터 — 검색 결과 정합성", async ({ page }) => {
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 검색 입력 필드 찾기
    const searchInput = page.locator('input[type="search"], input[placeholder*="검색"], input[placeholder*="search"], input[name="search"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // API로 학생 이름 하나 가져오기
      const studentsApi = await apiCall(page, "GET", "/students/?page_size=1");
      if (studentsApi.status === 200 && studentsApi.body?.results?.length > 0) {
        const studentName = studentsApi.body.results[0].name;

        // 검색
        await searchInput.fill(studentName);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);

        // 에러 토스트 확인
        const errorToast = page.locator('.Toastify__toast--error');
        const hasError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
        if (hasError) {
          const text = await errorToast.textContent();
          logIssue({
            where: "학생 검색",
            what: "검색 시 에러 토스트",
            severity: "major",
            evidence: `검색어: ${studentName}, 토스트: ${text}`,
          });
        }

        // 검색 결과에 해당 학생이 있어야 함
        const resultVisible = await page.getByText(studentName, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        if (!resultVisible) {
          logIssue({
            where: "학생 검색",
            what: `"${studentName}" 검색했는데 결과에 안 보임`,
            severity: "major",
            evidence: `검색어: ${studentName}`,
          });
        } else {
          console.log(`✅ 학생 검색 "${studentName}" 정상`);
        }
      }
    } else {
      console.log("검색 입력 필드 미발견, 스킵");
    }

    await page.screenshot({ path: "e2e/screenshots/crud-student-search.png" });
  });
});

test.afterAll(async () => {
  console.log("\n" + "=".repeat(60));
  console.log("📋 CRUD 데이터 정합성 최종 보고서");
  console.log("=".repeat(60));

  if (issues.length === 0) {
    console.log("\n✅ 발견된 이슈 없음 — CRUD 정합성 검증 통과");
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
