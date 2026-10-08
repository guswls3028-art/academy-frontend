/** Parent selected-child QnA/counsel writes in the isolated qa-* development runtime. */
import { expect, test } from "../fixtures/strictTest";
import {
  api,
  assertNoHorizontalOverflow,
  assertQaStudentParentRuntime,
  cleanupQaFamily,
  createQaFamily,
  installQaStudentParentBoundary,
  loginAdmin,
  loginApi,
  loginThroughUi,
  logoutStudentApp,
  QA_BASE,
  QA_TENANT,
  QA_ADMIN_USER,
  QA_ADMIN_PASSWORD,
  reloadStudentApp,
  selectParentStudentThroughUi,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle } from "../helpers/wait";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

let family: QaFamily | null = null;
let adminAccess = "";
const postIds: number[] = [];
const runStamp = Date.now();
const qnaTitle = `QA 학부모 질문 ${runStamp}`;
const counselTitle = `QA 학부모 상담 ${runStamp}`;

async function cleanup(request: Parameters<typeof api>[0]): Promise<void> {
  if (!adminAccess) return;
  const failures: string[] = [];
  for (const id of postIds) {
    const removed = await api(request, "DELETE", `/community/posts/${id}/`, adminAccess);
    if (![200, 204, 404].includes(removed.status)) failures.push(`DELETE community post ${id} -> ${removed.status}`);
    const residue = await api(request, "GET", `/community/posts/${id}/`, adminAccess);
    if (residue.status !== 404) failures.push(`verify community post ${id} absent -> ${residue.status}`);
  }
  await cleanupQaFamily(request, adminAccess, family);
  if (failures.length) throw new Error(`student/parent community cleanup failed:\n${failures.join("\n")}`);
}

async function openCommunityTab(page: Parameters<typeof gotoAndSettle>[0], tab: "QnA" | "상담") {
  await gotoAndSettle(page, `${QA_BASE}/student/community`, { timeout: 30_000 });
  const entryName = tab === "QnA" ? /^내 질문과 답변/ : /^상담/;
  await page.getByRole("button", { name: entryName }).click();
  await expect(page.getByRole("button", { name: tab, exact: true })).toHaveAttribute("aria-pressed", "true");
}

test.describe.serial("[real-use] 학부모 선택 자녀 질문·상담", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  test.beforeAll(() => assertQaStudentParentRuntime());
  test.afterAll(async ({ request }) => cleanup(request));

  test("390px 저장·자녀 격리·reload/relogin·desktop을 완료한다", async ({ page, request }, testInfo) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    adminAccess = admin.access;
    family = await createQaFamily(request, admin.access, "community", 2);
    const primary = family.students[0];
    const sibling = family.students[1];

    await page.setViewportSize({ width: 390, height: 844 });
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await selectParentStudentThroughUi(page, primary);
    await gotoAndSettle(page, `${QA_BASE}/student/dashboard`, { timeout: 30_000 });
    await assertNoHorizontalOverflow(page);
    await page.getByRole("region", { name: "학부모 주요 확인" })
      .getByRole("link", { name: /^질문하기/ }).click();
    await page.getByPlaceholder("질문 제목").fill(qnaTitle);
    await page.locator(".ProseMirror").fill("선택한 자녀의 학습 질문입니다.");
    const attachment = {
      name: "qa-community-recovery.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    };
    let rejectFirstUpload = true;
    await page.route("**/api/v1/community/posts/*/attachments/", async (route) => {
      if (rejectFirstUpload && route.request().method() === "POST") {
        rejectFirstUpload = false;
        // Simulate an outage before dispatch; every real request still passes
        // through the context's isolated-development boundary via fallback.
        await route.fulfill({ status: 503, json: { detail: "QA 첨부 연결 일시 실패" } });
        return;
      }
      await route.fallback();
    });
    await page.locator(".community-file-picker__input").setInputFiles(attachment);
    const qnaResponsePromise = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/community/posts/")
    ));
    await page.getByRole("button", { name: "질문 보내기", exact: true }).click();
    const qnaResponse = await qnaResponsePromise;
    expect(qnaResponse.status()).toBe(201);
    expect(qnaResponse.request().headers()["x-student-id"]).toBe(String(primary.id));
    const qna = await qnaResponse.json() as { id: number; created_by: number; author_role?: string; post_type: string };
    expect(qna).toMatchObject({ created_by: primary.id, author_role: "parent", post_type: "qna" });
    postIds.push(qna.id);
    await expect(page.getByRole("alert")).toContainText("QA 첨부 연결 일시 실패");
    await assertNoHorizontalOverflow(page);
    await reloadStudentApp(page);
    await openCommunityTab(page, "QnA");
    await page.getByRole("button", { name: "질문하기", exact: true }).click();
    await expect(page.getByPlaceholder("질문 제목")).toHaveValue(qnaTitle);
    await expect(page.getByRole("button", { name: "첨부 다시 시도", exact: true })).toBeDisabled();
    await page.locator(".community-file-picker__input").setInputFiles(attachment);
    const uploadResponsePromise = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith(`/api/v1/community/posts/${qna.id}/attachments/`));
    await page.getByRole("button", { name: "첨부 다시 시도", exact: true }).click();
    const uploaded = await uploadResponsePromise;
    expect(uploaded.status()).toBe(201);
    expect(uploaded.request().headers()["x-student-id"]).toBe(String(primary.id));
    expect(await uploaded.json()).toMatchObject([{ original_name: attachment.name }]);
    await expect(page.getByText(qnaTitle, { exact: true })).toBeVisible();
    const persisted = await api<{ attachments: Array<{ original_name: string }> }>(request, "GET", `/community/posts/${qna.id}/`, adminAccess);
    expect(persisted.status).toBe(200);
    expect(persisted.body.attachments).toHaveLength(1);
    expect(persisted.body.attachments[0].original_name).toBe(attachment.name);

    await openCommunityTab(page, "상담");
    await page.getByRole("button", { name: "상담 신청하기", exact: true }).click();
    await page.getByPlaceholder("예: 진로 상담, 학습 방법 상담").fill(counselTitle);
    await page.locator(".ProseMirror").fill("선택한 자녀의 상담 요청입니다.");
    const counselResponsePromise = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/community/posts/")
    ));
    await page.getByRole("button", { name: "상담 신청하기", exact: true }).click();
    const counselResponse = await counselResponsePromise;
    expect(counselResponse.status()).toBe(201);
    expect(counselResponse.request().headers()["x-student-id"]).toBe(String(primary.id));
    const counsel = await counselResponse.json() as { id: number; created_by: number; author_role?: string; post_type: string };
    expect(counsel).toMatchObject({ created_by: primary.id, author_role: "parent", post_type: "counsel" });
    postIds.push(counsel.id);
    await expect(page.getByText(counselTitle, { exact: true })).toBeVisible();

    await reloadStudentApp(page);
    await page.getByRole("button", { name: "상담", exact: true }).click();
    await expect(page.getByText(counselTitle, { exact: true })).toBeVisible();
    await selectParentStudentThroughUi(page, sibling);
    await openCommunityTab(page, "QnA");
    await expect(page.getByText(qnaTitle, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "상담", exact: true }).click();
    await expect(page.getByText(counselTitle, { exact: true })).toHaveCount(0);

    await selectParentStudentThroughUi(page, primary);
    await logoutStudentApp(page);
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await openCommunityTab(page, "QnA");
    await expect(page.getByText(qnaTitle, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole("button", { name: "상담", exact: true }).click();
    await expect(page.getByText(counselTitle, { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();

    // The same deployed artifact must attribute the parent's question to the
    // selected student in staff detail and persist a shared student memo.
    const adminContext = await page.context().browser()!.newContext({ viewport: { width: 1366, height: 900 } });
    const adminPage = await adminContext.newPage();
    const adminBoundary = await installQaStudentParentBoundary(adminPage, request);
    const adminBrowser = attachStrictBrowserGuards(adminPage);
    try {
      await gotoAndSettle(adminPage, QA_BASE + "/login/" + QA_TENANT);
      await adminPage.getByTestId("login-username").fill(QA_ADMIN_USER);
      await adminPage.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
      await adminPage.getByTestId("login-submit").click();
      await expect(adminPage).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
      await acknowledgeInitialAccountPromptsIfVisible(adminPage);
      await gotoAndSettle(adminPage, QA_BASE + "/workspace/students/" + primary.id);
      const detail = adminPage.getByTestId("student-detail-overlay");
      await detail.getByRole("tab", { name: /^질문/ }).click();
      await expect(detail.getByText(qnaTitle, { exact: true })).toBeVisible();
      await expect(detail.getByText(counselTitle, { exact: true })).toHaveCount(0);
      const sharedMemo = "QA 학생 상세 저장·후속 화면 확인";
      const memo = detail.getByRole("textbox", { name: "학생 공통 메모" });
      await memo.fill(sharedMemo);
      const saved = adminPage.waitForResponse((response) => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === "/api/v1/students/" + primary.id + "/");
      await detail.getByRole("tab", { name: /^수강/ }).click();
      expect((await saved).status()).toBe(200);
      await expect(detail.getByText("저장됨", { exact: true })).toBeVisible();
      await adminPage.reload({ waitUntil: "domcontentloaded" });
      await expect(memo).toHaveValue(sharedMemo);
      await assertNoHorizontalOverflow(adminPage);
      await adminPage.screenshot({ path: testInfo.outputPath("student-detail-development-desktop.png") });
      await adminPage.setViewportSize({ width: 390, height: 844 });
      await detail.getByRole("button", { name: "연락처·메모 보기" }).click();
      await expect(memo).toHaveValue(sharedMemo);
      await assertNoHorizontalOverflow(adminPage);
      await adminPage.screenshot({ path: testInfo.outputPath("student-detail-development-mobile.png") });
      await gotoAndSettle(adminPage, QA_BASE + "/workspace/students/" + sibling.id);
      await detail.getByRole("tab", { name: /^질문/ }).click();
      await expect(detail.getByText("질문 이력이 없습니다.", { exact: true })).toBeVisible();
      await expect(detail.getByText(qnaTitle, { exact: true })).toHaveCount(0);
      const studentTokens = await loginApi(request, primary.ps_number, primary.password);
      const studentProfile = await api<{ memo: string }>(request, "GET", "/student/me/", studentTokens.access);
      expect(studentProfile.status).toBe(200);
      expect(studentProfile.body.memo).toBe(sharedMemo);
      adminBoundary.assertClean();
      adminBrowser.assertZeroDefects();
    } finally {
      await adminContext.close();
    }
  });
});
