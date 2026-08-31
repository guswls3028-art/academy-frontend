import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installApi(page: Page, options: {
  hasResults: boolean;
  passScore?: number;
  resultStatus?: "NOT_SUBMITTED" | "PROCESSING" | "PARTIAL" | "DONE" | "FAILED";
  remediated?: boolean;
  sharedExam?: boolean;
}) {
  let exportCalls = 0;
  let analysisExportCalls = 0;
  const passScore = options.passScore ?? 60;
  const resultStatus = options.resultStatus ?? "DONE";
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === "/exams/77/") {
      await json(route, {
        id: 77,
        title: "7월 진단평가",
        exam_type: "regular",
        is_active: true,
        grading_mode: "choice",
        manual_grading_method: "correctness",
        max_score: 100,
        pass_score: passScore,
      });
      return;
    }
    if (path === "/results/admin/exams/77/summary/") {
      await json(route, {
        participant_count: options.hasResults ? 1 : 0,
        avg_score: options.hasResults ? 60 : 0,
        min_score: options.hasResults ? 60 : 0,
        max_score: options.hasResults ? 60 : 0,
        pass_count: options.hasResults ? 1 : 0,
        fail_count: 0,
        pass_rate: options.hasResults ? 1 : 0,
        clinic_count: 0,
      });
      return;
    }
    if (path === "/exams/77/lecture-assignments/") {
      const assignments = options.sharedExam
        ? [
            {
              lecture_id: 101,
              lecture_title: "A학교 강의",
              lecture_color: "#2563eb",
              lecture_chip_label: "A",
              pass_score: 60,
              uses_default_pass_score: true,
              roster_count: 1,
              selected_count: 1,
              sessions: [{ session_id: 1001, session_title: "중간고사", session_label: "1회차" }],
            },
            {
              lecture_id: 202,
              lecture_title: "B학교 강의",
              lecture_color: "#dc2626",
              lecture_chip_label: "B",
              pass_score: 70,
              uses_default_pass_score: false,
              roster_count: 1,
              selected_count: 1,
              sessions: [{ session_id: 2001, session_title: "중간고사", session_label: "1회차" }],
            },
          ]
        : [{
            lecture_id: 101,
            lecture_title: "공통수학2 정규반",
            lecture_color: "#2563eb",
            lecture_chip_label: "공",
            pass_score: passScore,
            uses_default_pass_score: true,
            roster_count: options.hasResults ? 1 : 0,
            selected_count: options.hasResults ? 1 : 0,
            sessions: [{ session_id: 1001, session_title: "진단평가", session_label: "1회차" }],
          }];
      await json(route, {
        exam_id: 77,
        default_pass_score: passScore,
        total_roster_count: assignments.reduce((sum, item) => sum + item.roster_count, 0),
        total_selected_count: assignments.reduce((sum, item) => sum + item.selected_count, 0),
        assignments,
      });
      return;
    }
    if (path === "/results/admin/exams/77/results/") {
      const lectureId = new URL(request.url()).searchParams.get("lecture_id");
      const sharedRows = [
        {
          enrollment_id: 901,
          student_name: "A학생",
          final_score: 65,
          exam_max_score: 100,
          ranking_score: 65,
          result_status: "DONE",
          passed: true,
          remediated: false,
          final_pass: true,
          achievement: "PASS",
          rank: 1,
          cohort_size: lectureId ? 1 : 2,
          lecture_id: 101,
          lecture_title: "A학교 강의",
          pass_score: 60,
        },
        {
          enrollment_id: 902,
          student_name: "B학생",
          final_score: 65,
          exam_max_score: 100,
          ranking_score: 65,
          result_status: "DONE",
          passed: false,
          remediated: false,
          final_pass: false,
          achievement: "FAIL",
          rank: 1,
          cohort_size: lectureId ? 1 : 2,
          lecture_id: 202,
          lecture_title: "B학교 강의",
          pass_score: 70,
        },
      ];
      const rows = options.sharedExam
        ? sharedRows.filter((row) => lectureId == null || String(row.lecture_id) === lectureId)
        : [{
        enrollment_id: 901,
        student_name: "김학생",
        final_score: 60,
        exam_max_score: 100,
        ranking_score: 60,
        result_status: resultStatus,
        passed: passScore > 0 ? true : null,
        remediated: options.remediated ?? false,
        final_pass: options.remediated || (passScore > 0 ? true : null),
        achievement: options.remediated ? "REMEDIATED" : passScore > 0 ? "PASS" : null,
        rank: 1,
        cohort_size: 1,
        lecture_id: 101,
        lecture_title: "공통수학2 정규반",
        pass_score: passScore,
      }];
      await json(route, options.hasResults ? rows : []);
      return;
    }
    if (path === "/results/admin/exams/77/questions/") {
      await json(route, options.hasResults ? [{
        question_id: 1001,
        question_number: 1,
        attempts: 1,
        correct: 0,
        accuracy: 0,
        avg_score: 0,
        max_score: 5,
      }] : []);
      return;
    }
    if (path === "/submissions/submissions/exams/77/") {
      await json(route, []);
      return;
    }
    if (path === "/results/admin/exams/77/wrong-note-export/") {
      exportCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Buffer.from("PK mock xlsx"),
      });
      return;
    }
    if (path === "/results/admin/exams/77/analysis-export/") {
      analysisExportCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Buffer.from("PK mock analysis xlsx"),
      });
      return;
    }
    await json(route, { detail: `Unhandled ${request.method()} ${path}` }, 404);
  });
  return {
    get exportCalls() { return exportCalls; },
    get analysisExportCalls() { return analysisExportCalls; },
  };
}

test("현재 사이트의 학생별 오답 엑셀을 데스크톱과 모바일에서 내려받는다", async ({ page }, testInfo) => {
  const calls = await installApi(page, { hasResults: true });
  await gotoAndSettle(page, `${BASE}/e2e-exam-results-export-harness.html`, {
    timeout: 60_000,
  });

  const button = page.getByRole("button", { name: "학생별 틀린 문항 (엑셀)" });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const desktopScreenshot = testInfo.outputPath("wrong-note-export-1920.png");
  await page.screenshot({ path: desktopScreenshot, fullPage: true });
  await testInfo.attach("wrong-note-export-1920", {
    path: desktopScreenshot,
    contentType: "image/png",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await button.scrollIntoViewIfNeeded();
  const bounds = await button.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  const mobileScreenshot = testInfo.outputPath("wrong-note-export-390.png");
  await page.screenshot({ path: mobileScreenshot, fullPage: true });
  await testInfo.attach("wrong-note-export-390", {
    path: mobileScreenshot,
    contentType: "image/png",
  });

  const downloadPromise = page.waitForEvent("download");
  await button.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("7월 진단평가_학생별_오답.xlsx");
  expect(calls.exportCalls).toBe(1);
});

test("수업 브리핑을 한눈에 확인하고 전문 분석 리포트를 내려받는다", async ({ page }, testInfo) => {
  const calls = await installApi(page, { hasResults: true });
  await gotoAndSettle(page, `${BASE}/e2e-exam-results-export-harness.html`, {
    timeout: 60_000,
  });

  await expect(page.getByRole("heading", { name: "이번 수업에서 바로 결정할 것" })).toBeVisible();
  await expect(page.getByText("표본 확인 후 판단", { exact: true })).toBeVisible();
  await expect(page.getByText("컷 판단 보류", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "점수 분포" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "보충 우선 문항" })).toBeVisible();
  await expect(
    page.getByLabel("보충 우선 문항").getByText("공통 개념 재설명", { exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  const passSummary = page.getByText("합격 1 · 미달 0 · 기준 적용 1명 · 보충 완료 0", { exact: true });
  await expect(passSummary).toBeVisible();
  const passSummaryLayout = await passSummary.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      whiteSpace: style.whiteSpace,
    };
  });
  expect(passSummaryLayout.whiteSpace).toBe("normal");
  expect(passSummaryLayout.scrollWidth).toBeLessThanOrEqual(passSummaryLayout.clientWidth + 1);

  const desktopScreenshot = testInfo.outputPath("exam-teaching-brief-1280.png");
  await page.screenshot({ path: desktopScreenshot, fullPage: true });
  await testInfo.attach("exam-teaching-brief-1280", {
    path: desktopScreenshot,
    contentType: "image/png",
  });

  const reportButton = page.getByRole("button", { name: "수업 분석 리포트 (엑셀)" });
  const downloadPromise = page.waitForEvent("download");
  await reportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("7월 진단평가_수업분석_리포트.xlsx");
  expect(calls.analysisExportCalls).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "이번 수업에서 바로 결정할 것" }).scrollIntoViewIfNeeded();
  const shell = page.getByRole("heading", { name: "이번 수업에서 바로 결정할 것" }).locator("xpath=ancestor::section");
  const box = await shell.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  const mobileScreenshot = testInfo.outputPath("exam-teaching-brief-390.png");
  await page.screenshot({ path: mobileScreenshot, fullPage: true });
  await testInfo.attach("exam-teaching-brief-390", {
    path: mobileScreenshot,
    contentType: "image/png",
  });
});

test("저장된 채점 결과가 없으면 오답 엑셀 버튼과 이유를 함께 비활성화한다", async ({ page }) => {
  await installApi(page, { hasResults: false });
  await gotoAndSettle(page, `${BASE}/e2e-exam-results-export-harness.html`, {
    timeout: 60_000,
  });

  const button = page.getByRole("button", { name: "학생별 틀린 문항 (엑셀)" });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("title", "채점 결과가 저장되면 내려받을 수 있습니다.");
  await expect(page.getByRole("button", { name: "수업 분석 리포트 (엑셀)" })).toBeDisabled();
});

test("합격 기준 미설정 결과를 합격으로 오인하지 않는다", async ({ page }) => {
  await installApi(page, { hasResults: true, passScore: 0 });
  await gotoAndSettle(page, `${BASE}/e2e-exam-results-export-harness.html`, {
    timeout: 60_000,
  });

  await expect(page.getByText("합격 기준 설정 필요", { exact: true })).toBeVisible();
  await expect(page.getByText("기준 미설정", { exact: true })).toBeVisible();
  await expect(page.getByText("컷 미설정", { exact: true })).toBeVisible();
  await expect(page.getByText(/합격 1 · 미달 0/)).toHaveCount(0);
});

test("채점 중 결과를 확정 통계와 다운로드에서 제외한다", async ({ page }) => {
  await installApi(page, { hasResults: true, resultStatus: "PROCESSING" });
  await gotoAndSettle(page, `${BASE}/e2e-exam-results-export-harness.html`, {
    timeout: 60_000,
  });

  await expect(page.getByText("아직 분석할 확정 채점 결과가 없습니다", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "수업 분석 리포트 (엑셀)" })).toBeDisabled();
});

test("수동 통과 학생을 보충 완료로 별도 집계한다", async ({ page }) => {
  await installApi(page, { hasResults: true, remediated: true });
  await gotoAndSettle(page, `${BASE}/e2e-exam-results-export-harness.html`, {
    timeout: 60_000,
  });

  await expect(page.getByText(/보충 완료 1/)).toBeVisible();
});

test("공유 시험은 전체와 강의별 성적을 각 강의 커트라인으로 전환한다", async ({ page }, testInfo) => {
  await installApi(page, { hasResults: true, sharedExam: true });
  await gotoAndSettle(page, `${BASE}/e2e-exam-results-export-harness.html`, {
    timeout: 60_000,
  });

  await expect(page.getByRole("heading", { name: "어느 강의 성적을 볼까요?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /전체 성적 2명 강의별 컷 적용/ })).toHaveAttribute("aria-pressed", "true");
  const studentResults = page.getByRole("region", { name: "시험 학생별 결과" });
  await expect(studentResults.getByText("A학생", { exact: true }).last()).toBeVisible();
  await expect(studentResults.getByText("B학생", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("합격 1 · 미달 1 · 기준 적용 2명 · 보충 완료 0", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /B학교 강의 1명 귀가 기준 70점/ }).click();
  await expect(page.getByRole("button", { name: /B학교 강의 1명 귀가 기준 70점/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /전체 성적 2명 강의별 컷 적용/ })).toBeVisible();
  await expect(studentResults.getByText("B학생", { exact: true }).last()).toBeVisible();
  await expect(studentResults.getByText("A학생", { exact: true })).toHaveCount(0);
  await expect(page.getByText("합격 0 · 미달 1 · 기준 적용 1명 · 보충 완료 0", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const scopePanel = page.getByRole("heading", { name: "어느 강의 성적을 볼까요?" }).locator("xpath=ancestor::section");
  const box = await scopePanel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  const screenshot = testInfo.outputPath("shared-exam-scope-390.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("shared-exam-scope-390", {
    path: screenshot,
    contentType: "image/png",
  });
});

test("시험 설정에서 다른 강의 차시와 귀가 기준을 390px에서도 선택한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/e2e-exam-results-export-harness.html?visual=assignments`, {
    timeout: 60_000,
  });

  const panel = page.getByRole("heading", { name: "시험을 보는 강의" }).locator("xpath=ancestor::section");
  await expect(page.getByText("2개 강의", { exact: true })).toBeVisible();
  await expect(page.getByText("대상 2명", { exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "A학교 강의 귀가 기준 점수" })).toHaveValue("60");
  await expect(page.getByRole("spinbutton", { name: "B학교 강의 귀가 기준 점수" })).toHaveValue("70");

  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(390);

  await page.getByRole("button", { name: "강의 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "이 시험에 강의 추가" });
  await dialog.getByRole("combobox", { name: "강의" }).selectOption("202");
  await expect(dialog.getByRole("spinbutton")).toHaveValue("70");
  await dialog.getByRole("combobox", { name: "강의" }).selectOption("303");
  await expect(dialog.getByRole("combobox", { name: /시험 차시/ })).toHaveValue("3001");
  await expect(dialog.getByRole("spinbutton")).toHaveValue("60");
  await expect(dialog.getByRole("button", { name: "강의 연결" })).toBeEnabled();

  const screenshot = testInfo.outputPath("shared-exam-assignments-390.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("shared-exam-assignments-390", {
    path: screenshot,
    contentType: "image/png",
  });
});
