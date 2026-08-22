import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installApi(page: Page, options: { hasResults: boolean }) {
  let exportCalls = 0;
  let analysisExportCalls = 0;
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
        pass_score: 60,
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
    if (path === "/results/admin/exams/77/results/") {
      await json(route, options.hasResults ? [{
        enrollment_id: 901,
        student_name: "김학생",
        final_score: 60,
        exam_max_score: 100,
        ranking_score: 60,
        result_status: "DONE",
        passed: true,
        rank: 1,
        cohort_size: 1,
        lecture_title: "공통수학2 정규반",
      }] : []);
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

  const desktopScreenshot = testInfo.outputPath("exam-teaching-brief-1440.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: desktopScreenshot, fullPage: true });
  await testInfo.attach("exam-teaching-brief-1440", {
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
