import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import {
  assertNoHorizontalOverflow, assertQaStudentParentRuntime, cleanupQaFamily,
  createQaFamily, expectApi, installQaStudentParentBoundary, loginAdmin,
  loginThroughUi, QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_TENANT,
  reloadStudentApp, selectParentStudentThroughUi, STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { gotoAndSettle } from "../helpers/wait";
import type { Survey, SurveyResponse } from "../../src/shared/api/surveys";

test.setTimeout(420_000);
// Authentication is real; retain only explicit synthetic screenshots and receipts.
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
const stamp = Date.now();
const evidence = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const owned = { family: null as QaFamily | null, adminAccess: "", surveyIds: [] as number[] };

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function createThroughUi(page: Page, kind: "memo" | "school_score"): Promise<Survey> {
  await gotoAndSettle(page, `${QA_BASE}/workspace/students/surveys/new`);
  await expect(page.getByLabel("설문 제목")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("radio", { name: kind === "memo" ? "학생 메모" : "성적 취합", exact: true }).check();
  await page.getByLabel("설문 제목").fill(`QA 설문 ${kind} ${stamp}`);
  await page.getByLabel("학생에게 안내할 내용").fill("선택한 자녀의 자료와 응답을 제출해 주세요.");
  await page.getByLabel("대상 선택").selectOption("selected");
  for (const student of owned.family!.students) {
    await page.getByLabel("대상 학생 검색").fill(student.name);
    await page.getByRole("checkbox", { name: `${student.name} QA 격리고등학교`, exact: true }).check();
  }
  if (kind === "memo") {
    await page.getByLabel("질문 제목").fill("가능한 보강 시간");
    await page.getByLabel("응답 방식").selectOption("single_choice");
    await page.getByRole("textbox", { name: /^선택지/ }).fill("토요일\n일요일");
    await page.getByText("응답 기간·정원·첨부 설정", { exact: true }).click();
    await page.getByLabel("사진·PDF 첨부 받기").check();
  } else {
    await page.getByLabel("시험 종류").selectOption("school_exam");
    await page.getByLabel("학년도", { exact: true }).fill("2026");
    await page.getByRole("combobox", { name: "학기", exact: true }).selectOption("2");
    await page.getByLabel("시험 시기").selectOption("second");
    await page.getByLabel("과목", { exact: true }).fill("수학");
  }
  const created = page.waitForResponse((r) => r.request().method() === "POST"
    && new URL(r.url()).pathname === "/api/v1/surveys/");
  await page.getByRole("button", { name: "설문 저장", exact: true }).click();
  const result = await created;
  expect(result.status()).toBe(201);
  const survey = await result.json() as Survey;
  owned.surveyIds.push(survey.id);
  expect(survey.audience.student_ids.sort()).toEqual(owned.family!.students.map((s) => s.id).sort());
  await page.getByRole("button", { name: "응답 시작", exact: true }).click();
  await expect(page.getByText(/대상 학생의 설문 목록/)).toBeVisible();
  return survey;
}

async function submitThroughUi(page: Page, surveyId: number, studentId: number) {
  const saved = page.waitForResponse((r) => r.request().method() === "PUT"
    && new URL(r.url()).pathname === `/api/v1/surveys/student/${surveyId}/response/`);
  await page.getByRole("button", { name: "응답 제출", exact: true }).click();
  const result = await saved;
  expect(result.status()).toBe(200);
  expect(await result.request().headerValue("x-student-id")).toBe(String(studentId));
  expect(await result.request().headerValue("x-tenant-code")).toBe(QA_TENANT);
  const response = await result.json() as SurveyResponse;
  expect(response.student_id).toBe(studentId);
  await expect(page.getByText("응답을 제출했습니다.", { exact: true })).toBeVisible();
  await reloadStudentApp(page);
  await expect(page.getByText("응답을 제출했습니다.", { exact: true })).toBeVisible();
  return response;
}

test.describe.serial("[real-use] 설문·성적 취합과 자녀별 응답", () => {
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the isolated qa-* development runner.");
  test.beforeAll(() => { assertQaStudentParentRuntime(); });
  test.afterAll(async ({ request }, testInfo) => {
    const cleanup = await cleanupQaFamily(request, owned.adminAccess, owned.family);
    // Published surveys are retained history. The owning runner must destroy the
    // exact disposable tenant and verify zero residue after this receipt.
    await testInfo.attach("survey-cleanup-receipt", {
      body: JSON.stringify({ family: cleanup, retainedSurveyIds: owned.surveyIds,
        remainingOwner: "setup_ymath_realuse_scenario --destroy exact qa-* tenant" }),
      contentType: "application/json",
    });
  });

  test("작성·자녀 응답·원본 ZIP·학생 기록·성적 검수 대기를 실제 저장한다", async ({ page, browser, request }, testInfo) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const admin = await loginAdmin(request);
    owned.adminAccess = admin.access;
    owned.family = await createQaFamily(request, admin.access, `survey-${stamp}`, 2);
    const [primary, peer] = owned.family.students;
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`);
    await page.getByTestId("login-username").fill(QA_ADMIN_USER);
    await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(page);
    const memo = await createThroughUi(page, "memo");
    const grade = await createThroughUi(page, "school_score");

    const parentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let memoResponse: SurveyResponse;
    try {
      const parentPage = await parentContext.newPage();
      const parentBoundary = await installQaStudentParentBoundary(parentPage, request);
      const guards = attachStrictBrowserGuards(parentPage);
      await parentPage.addInitScript((code) => {
        localStorage.setItem("tenant_code", code); sessionStorage.setItem("tenantCode", code);
      }, QA_TENANT);
      await gotoAndSettle(parentPage, `${QA_BASE}/student/surveys/${memo.id}`);
      await expect(parentPage.getByTestId("login-username")).toBeVisible({ timeout: 45_000 });
      await loginThroughUi(parentPage, owned.family.parentPhone, owned.family.parentPassword);
      await expect(parentPage).toHaveURL(`${QA_BASE}/student/surveys/${memo.id}`);
      await selectParentStudentThroughUi(parentPage, primary);
      await gotoAndSettle(parentPage, `${QA_BASE}/student/surveys/${memo.id}`);
      await parentPage.getByLabel("토요일", { exact: true }).check();
      await parentPage.getByLabel("설문 첨부파일").setInputFiles({ name: "시험범위.png", mimeType: "image/png", buffer: evidence });
      await expect(parentPage.getByText("시험범위.png", { exact: true })).toBeVisible();
      memoResponse = await submitThroughUi(parentPage, memo.id, primary.id);
      expect(memoResponse.attachments).toHaveLength(1);
      await capture(parentPage, testInfo, "survey-parent-saved-390");
      await selectParentStudentThroughUi(parentPage, peer);
      await expect(parentPage.getByRole("button", { name: "응답 제출", exact: true })).toBeVisible();
      await expect(parentPage.getByLabel("토요일", { exact: true })).not.toBeChecked();
      await expect(parentPage.getByText("시험범위.png", { exact: true })).toHaveCount(0);
      parentBoundary.assertClean(); guards.assertZeroDefects();
    } finally { await parentContext.close(); }

    await gotoAndSettle(page, `${QA_BASE}/workspace/students/surveys/${memo.id}`);
    await page.getByRole("button", { name: "미응답", exact: true }).click();
    await expect(page.getByText(peer.name, { exact: true })).toBeVisible();
    await expect(page.getByText(primary.name, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "전체", exact: true }).click();
    await page.getByText("현재 목록의 첨부 묶음 받기", { exact: true }).click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "묶음 1 · 1개", exact: true }).click();
    const zip = await JSZip.loadAsync(await readFile((await (await downloading).path())!));
    const files = Object.values(zip.files).filter((file) => !file.dir);
    expect(files).toHaveLength(1);
    expect(await files[0].async("nodebuffer")).toEqual(evidence);
    expect(files[0].name).toContain(`${primary.name}-${primary.id}/`);
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "응답 내려받기", exact: true }).click();
    const csv = await readFile((await (await csvDownload).path())!, "utf8");
    expect(csv).toContain(primary.name); expect(csv).toContain("토요일");
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await capture(page, testInfo, `survey-results-${width}`);
    }
    await page.locator("summary").filter({ hasText: primary.name }).click();
    await page.getByRole("link", { name: "학생 기록 보기", exact: true }).click();
    await page.getByText("설문으로 받은 정보", { exact: true }).click();
    await page.locator("summary").filter({ hasText: memo.title }).click();
    await expect(page.getByText("토요일", { exact: true })).toBeVisible();

    const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const studentPage = await studentContext.newPage();
      const studentBoundary = await installQaStudentParentBoundary(studentPage, request);
      const guards = attachStrictBrowserGuards(studentPage);
      await loginThroughUi(studentPage, peer.ps_number, peer.password);
      await gotoAndSettle(studentPage, `${QA_BASE}/student/surveys/${grade.id}`);
      await studentPage.getByRole("button", { name: "성적표 새로 등록", exact: true }).click();
      await studentPage.getByLabel("받은 점수").fill("93");
      await studentPage.locator('input[type="file"]').setInputFiles({ name: "성적표.png", mimeType: "image/png", buffer: evidence });
      await studentPage.getByRole("button", { name: "성적표 보내기", exact: true }).click();
      await expect(studentPage.getByText(/1과목이 이 설문과 연결됩니다/)).toBeVisible();
      const response = await submitThroughUi(studentPage, grade.id, peer.id);
      expect(response.score_submissions).toHaveLength(1);
      expect(response.score_submissions[0]).toMatchObject({ subject: "수학", status: "pending" });
      expect(Number(response.score_submissions[0].score)).toBe(93);
      await expect(studentPage.getByText("선생님 확인 대기", { exact: true })).toBeVisible();
      await capture(studentPage, testInfo, "survey-grade-saved-390");
      studentBoundary.assertClean(); guards.assertZeroDefects();
    } finally { await studentContext.close(); }
    await gotoAndSettle(page, `${QA_BASE}/workspace/students/surveys/${grade.id}`);
    await page.locator("summary").filter({ hasText: peer.name }).click();
    await expect(page.getByText("수학 93/100점", { exact: true })).toBeVisible();
    await expect(page.getByText("선생님 확인 대기", { exact: true })).toBeVisible();
    const history = await expectApi<{ results: SurveyResponse[] }>(request, "GET", `/surveys/students/${primary.id}/responses/`, admin.access);
    expect(history.results.map((r) => r.id)).toContain(memoResponse!.id);
    boundary.assertClean();
  });
});
