/** Student baseline and parent selected-child inventory/score writes in isolated qa-* development. */
import { expect, test } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  api,
  assertNoHorizontalOverflow,
  assertQaStudentParentRuntime,
  cleanupQaFamily,
  createQaFamily,
  installQaStudentParentBoundary,
  loginAdmin,
  loginThroughUi,
  logoutStudentApp,
  QA_BASE,
  reloadStudentApp,
  seedBrowserAuth,
  selectParentStudentThroughUi,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { installReleaseContextGuard, releaseBoundaryFromEnv } from "../helpers/releaseApiBoundary";
import { gotoAndSettle } from "../helpers/wait";

test.setTimeout(360_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

let family: QaFamily | null = null;
let adminAccess = "";
const fileIds: string[] = [];
const folderIds: string[] = [];
const runStamp = Date.now();
const studentFile = `qa-student-inventory-${runStamp}.pdf`;
const parentFile = `qa-parent-inventory-${runStamp}.pdf`;
const scoreFile = `qa-parent-score-${runStamp}.pdf`;
const folderName = `QA 학부모 폴더 ${runStamp}`;

async function verifySchoolReportFlow(studentPage: Page, teacherPage: Page, primary: QaFamily["students"][number]) {
  const reportUrl = `${QA_BASE}/workspace/mobile/results?tab=school-report`;
  let teacherRequests = 0;
  teacherPage.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/results/school-reports/requests/")) {
      teacherRequests += 1;
    }
  });
  await gotoAndSettle(teacherPage, reportUrl, { timeout: 30_000 });
  const midterm = teacherPage.getByRole("button", { name: "2학기 중간", exact: true });
  await expect(midterm).toBeVisible({ timeout: 20_000 });
  await midterm.click();
  await teacherPage.getByRole("searchbox", { name: "학생 검색" }).fill(primary.name);
  const target = teacherPage.getByRole("checkbox", { name: `${primary.name} 선택` });
  await target.check();
  const requestButton = teacherPage.getByRole("button", { name: "앱으로 제출 요청" });
  await requestButton.click();
  const confirm = teacherPage.getByRole("alertdialog", { name: "성적표 제출 요청" });
  await expect(confirm.getByText(/학생 1명에게/)).toBeVisible();
  await confirm.getByRole("button", { name: "취소" }).click();
  expect(teacherRequests).toBe(0);

  await requestButton.click();
  await confirm.getByRole("button", { name: "앱 알림 보내기" }).click();
  await expect(teacherPage.getByText("요청함", { exact: true })).toBeVisible();
  expect(teacherRequests).toBe(1);
  await assertNoHorizontalOverflow(teacherPage);

  await gotoAndSettle(studentPage, `${QA_BASE}/student/notifications`, { timeout: 30_000 });
  await studentPage.getByRole("link", { name: /2학기 중간 성적표 제출/ }).click();
  await expect(studentPage).toHaveURL(/\/student\/submit\/school-report\?academic_year=\d{4}&semester=2&exam_round=first/);
  await studentPage.getByRole("button", { name: "점수 직접 입력" }).click();
  await studentPage.getByRole("textbox", { name: "과목 1" }).fill("수학");
  await studentPage.getByRole("button", { name: "성적표 제출", exact: true }).click();
  await expect(studentPage.getByRole("alert")).toContainText("1번째 과목명과 점수");
  await studentPage.getByRole("textbox", { name: "받은 점수 1" }).fill("0");
  await studentPage.getByRole("button", { name: "+ 과목 추가" }).click();
  await studentPage.getByRole("textbox", { name: "과목 2" }).fill("과학");
  await studentPage.getByRole("textbox", { name: "받은 점수 2" }).fill("92.5");
  await studentPage.getByRole("button", { name: "성적표 제출", exact: true }).click();
  await expect(studentPage.getByText("성적표를 제출했습니다.", { exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(studentPage);
  await reloadStudentApp(studentPage);
  await expect(studentPage.getByText("92.5", { exact: true })).toBeVisible();
  await expect(studentPage.getByText("0", { exact: true })).toBeVisible();

  await gotoAndSettle(teacherPage, reportUrl, { timeout: 30_000 });
  await expect(midterm).toBeVisible({ timeout: 20_000 });
  await midterm.click();
  await teacherPage.getByRole("searchbox", { name: "학생 검색" }).fill(primary.name);
  await expect(teacherPage.getByText("제출 · 2과목", { exact: true })).toBeVisible();
  await teacherPage.getByRole("button", { name: `${primary.name} 성적표 보기` }).click();
  const detail = teacherPage.getByRole("dialog", { name: primary.name });
  await expect(detail.getByText("92.5", { exact: true })).toBeVisible();
  await detail.getByRole("link", { name: "학생 상세에서 보기" }).click();
  await expect(teacherPage).toHaveURL(/\/workspace\/mobile\/students\/\d+\?tab=school-report/);
  await expect(teacherPage.getByRole("region", { name: "학교 성적표", exact: true }).getByText("수학", { exact: true })).toBeVisible();
  expect(teacherRequests).toBe(1);
}

async function cleanup(request: Parameters<typeof api>[0]): Promise<void> {
  if (!adminAccess) return;
  const failures: string[] = [];
  const studentPs = family?.students[0]?.ps_number;
  for (const id of fileIds) {
    const result = await api(
      request,
      "DELETE",
      `/storage/inventory/files/${id}/?scope=student&student_ps=${encodeURIComponent(studentPs || "")}`,
      adminAccess,
    );
    if (![200, 204, 404].includes(result.status)) failures.push(`DELETE inventory file ${id} -> ${result.status}`);
  }
  for (const id of folderIds) {
    const result = await api(
      request,
      "DELETE",
      `/storage/inventory/folders/${id}/?scope=student&student_ps=${encodeURIComponent(studentPs || "")}`,
      adminAccess,
    );
    if (![200, 204, 404].includes(result.status)) failures.push(`DELETE inventory folder ${id} -> ${result.status}`);
  }
  await cleanupQaFamily(request, adminAccess, family);
  if (failures.length) throw new Error(`student/parent storage cleanup failed:\n${failures.join("\n")}`);
}

async function uploadInventoryFile(
  page: Parameters<typeof gotoAndSettle>[0],
  name: string,
  selectedStudentId?: number,
  original?: { mimeType: string; buffer: Buffer },
): Promise<string> {
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).pathname.endsWith("/api/v1/storage/inventory/upload/")
  ));
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: original?.mimeType ?? "application/pdf",
    buffer: original?.buffer ?? Buffer.from(`isolated-${name}`),
  });
  const response = await responsePromise;
  expect([200, 201]).toContain(response.status());
  if (selectedStudentId) expect(response.request().headers()["x-student-id"]).toBe(String(selectedStudentId));
  const body = await response.json() as { id: string | number };
  const id = String(body.id);
  expect(id).not.toBe("");
  fileIds.push(id);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  return id;
}

test.describe.serial("[real-use] 학생·학부모 선택 자녀 자료함·성적표", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");
  test.beforeAll(() => assertQaStudentParentRuntime());
  test.afterAll(async ({ request }) => cleanup(request));

  test("학생 성적 취합·학생 기준선 뒤 학부모 390px 저장·삭제·자녀격리·reload/relogin·desktop을 완료한다", async ({ page, request, browser: engine }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    adminAccess = admin.access;
    family = await createQaFamily(request, admin.access, "storage", 2);
    const primary = family.students[0];
    const sibling = family.students[1];

    await page.setViewportSize({ width: 390, height: 844 });
    await loginThroughUi(page, primary.ps_number, primary.password);
    const teacherContext = await engine.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    try {
      const release = releaseBoundaryFromEnv(process.env);
      if (!release || release.mode !== "development") throw new Error("School report requires the isolated development boundary.");
      const teacherBoundary = await installReleaseContextGuard(teacherContext, release);
      const teacherPage = await teacherContext.newPage();
      const teacherBrowser = attachStrictBrowserGuards(teacherPage);
      await seedBrowserAuth(teacherPage, admin);
      await verifySchoolReportFlow(page, teacherPage, primary);
      teacherBoundary.assertClean();
      teacherBrowser.assertZeroDefects();
    } finally {
      await teacherContext.close();
    }
    await gotoAndSettle(page, `${QA_BASE}/student/inventory`, { timeout: 30_000 });
    await uploadInventoryFile(page, studentFile);
    await logoutStudentApp(page);

    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await selectParentStudentThroughUi(page, primary);
    const inventoryResponsePromise = page.waitForResponse((response) => (
      response.request().method() === "GET"
      && new URL(response.url()).pathname.endsWith("/api/v1/storage/inventory/")
    ));
    await gotoAndSettle(page, `${QA_BASE}/student/inventory`, { timeout: 30_000 });
    const inventoryResponse = await inventoryResponsePromise;
    const inventoryBody = await inventoryResponse.json().catch(() => ({})) as Record<string, unknown>;
    const inventoryRequest = inventoryResponse.request();
    const requestedStudentPs = new URL(inventoryRequest.url()).searchParams.get("student_ps");
    const requestedStudentId = inventoryRequest.headers()["x-student-id"];
    expect(
      inventoryResponse.status(),
      `parent inventory failed: ${JSON.stringify({
        code: inventoryBody.code,
        detail: inventoryBody.detail,
        selectedStudentMatches: requestedStudentId === String(primary.id),
        studentPsMatches: requestedStudentPs === primary.ps_number,
      })}`,
    ).toBe(200);
    expect(requestedStudentId).toBe(String(primary.id));
    await expect(page.getByText(studentFile, { exact: true })).toBeVisible();
    await uploadInventoryFile(page, parentFile, primary.id);
    const hancomOriginals = [
      { name: `qa-한글원본-${runStamp}.HWP`, mimeType: "application/octet-stream", buffer: await readFile(new URL("../fixtures/documents/public-resource-equation.hwp", import.meta.url)) },
      { name: `qa-한글원본-${runStamp}.hwpx`, mimeType: "application/zip", buffer: await readFile(new URL("../fixtures/documents/public-resource-report.hwpx", import.meta.url)) },
    ];
    for (const original of hancomOriginals) {
      await uploadInventoryFile(page, original.name, primary.id, original);
      await reloadStudentApp(page);
      const fileRow = page.getByText(original.name, { exact: true }).locator("..").locator("..");
      const downloading = page.waitForEvent("download");
      await fileRow.getByTitle("다운로드", { exact: true }).click();
      const downloaded = await downloading;
      expect(await downloaded.failure()).toBeNull();
      expect(downloaded.suggestedFilename()).toBe(original.name);
      expect(await readFile((await downloaded.path())!)).toEqual(original.buffer);
    }
    await page.getByRole("button", { name: "새 폴더", exact: true }).click();
    await page.getByPlaceholder("폴더 이름").fill(folderName);
    const folderResponsePromise = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/storage/inventory/folders/")
    ));
    await page.getByRole("button", { name: "생성", exact: true }).click();
    const folderResponse = await folderResponsePromise;
    expect([200, 201]).toContain(folderResponse.status());
    expect(folderResponse.request().headers()["x-student-id"]).toBe(String(primary.id));
    const folder = await folderResponse.json() as { id: string | number };
    folderIds.push(String(folder.id));
    await expect(page.getByText(folderName, { exact: true })).toBeVisible();
    await reloadStudentApp(page);
    await expect(page.getByText(parentFile, { exact: true })).toBeVisible();
    const folderRow = page.getByRole("button").filter({ hasText: folderName });
    await expect(folderRow).toBeVisible();
    await folderRow.getByTitle("폴더 삭제").click();
    const deleteFolderResponsePromise = page.waitForResponse((response) => (
      response.request().method() === "DELETE"
      && new URL(response.url()).pathname.endsWith(`/api/v1/storage/inventory/folders/${folder.id}/`)
    ));
    await page.getByRole("alertdialog", { name: "폴더 삭제" })
      .getByRole("button", { name: "삭제", exact: true })
      .click();
    const deleteFolderResponse = await deleteFolderResponsePromise;
    expect([200, 204]).toContain(deleteFolderResponse.status());
    folderIds.splice(folderIds.indexOf(String(folder.id)), 1);
    await expect(page.getByText(folderName, { exact: true })).toHaveCount(0);

    await gotoAndSettle(page, `${QA_BASE}/student/submit/score`, { timeout: 30_000 });
    await page.getByLabel("받은 점수").fill("91");
    const scoreResponsePromise = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/storage/inventory/upload/")
    ));
    await page.locator('input[type="file"]').setInputFiles({
      name: scoreFile,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"),
    });
    await page.getByRole("button", { name: "성적표 보내기" }).click();
    const scoreResponse = await scoreResponsePromise;
    expect([200, 201]).toContain(scoreResponse.status());
    expect(scoreResponse.request().headers()["x-student-id"]).toBe(String(primary.id));
    const score = await scoreResponse.json() as { id: string | number };
    expect(String(score.id)).not.toBe("");
    // A submitted score report is deliberately protected from direct inventory
    // deletion while its review is pending. cleanupQaFamily owns its teardown.
    const protectedDelete = await api(
      request,
      "DELETE",
      `/storage/inventory/files/${score.id}/?scope=student&student_ps=${encodeURIComponent(primary.ps_number)}`,
      adminAccess,
    );
    expect(protectedDelete.status).toBe(409);
    await expect(page.getByText("확인 대기")).toBeVisible();
    await reloadStudentApp(page);
    await expect(page.getByText("확인 대기")).toBeVisible();

    await selectParentStudentThroughUi(page, sibling);
    await gotoAndSettle(page, `${QA_BASE}/student/inventory`, { timeout: 30_000 });
    await expect(page.getByText(studentFile, { exact: true })).toHaveCount(0);
    await expect(page.getByText(parentFile, { exact: true })).toHaveCount(0);
    for (const original of hancomOriginals) await expect(page.getByText(original.name, { exact: true })).toHaveCount(0);
    await selectParentStudentThroughUi(page, primary);
    await logoutStudentApp(page);
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await gotoAndSettle(page, `${QA_BASE}/student/inventory`, { timeout: 30_000 });
    await expect(page.getByText(parentFile, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1366, height: 900 });
    await assertNoHorizontalOverflow(page);
    // Both roles complete a normal file deletion and read its durable result.
    for (const [name, selectedId] of [[parentFile, primary.id], [studentFile, undefined]] as const) {
      if (selectedId === undefined) {
        await logoutStudentApp(page);
        await loginThroughUi(page, primary.ps_number, primary.password);
        await gotoAndSettle(page, `${QA_BASE}/student/inventory`, { timeout: 30_000 });
        await expect(page.getByText(parentFile, { exact: true })).toHaveCount(0);
      }
      const fileRow = page.getByText(name, { exact: true }).locator("..").locator("..");
      await fileRow.getByTitle("삭제", { exact: true }).click();
      const deleting = page.waitForResponse((response) => response.request().method() === "DELETE"
        && new URL(response.url()).pathname.includes("/storage/inventory/files/"));
      await page.getByRole("alertdialog", { name: "파일 삭제" }).getByRole("button", { name: "삭제", exact: true }).click();
      const deleted = await deleting;
      expect(deleted.status()).toBe(204);
      expect(deleted.request().headers()["x-student-id"]).toBe(selectedId === undefined ? undefined : String(selectedId));
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      await reloadStudentApp(page);
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      for (const original of hancomOriginals) await expect(page.getByText(original.name, { exact: true })).toBeVisible();
    }
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
