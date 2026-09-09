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
  loginThroughUi,
  logoutStudentApp,
  QA_BASE,
  reloadStudentApp,
  selectParentStudentThroughUi,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle } from "../helpers/wait";

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
  await page.getByRole("button", { name: tab, exact: true }).click();
}

test.describe.serial("[real-use] 학부모 선택 자녀 질문·상담", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  test.beforeAll(() => assertQaStudentParentRuntime());
  test.afterAll(async ({ request }) => cleanup(request));

  test("390px 저장·자녀 격리·reload/relogin·desktop을 완료한다", async ({ page, request }) => {
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
    await openCommunityTab(page, "QnA");
    await page.getByRole("button", { name: "질문하기", exact: true }).click();
    await page.getByPlaceholder("질문 제목").fill(qnaTitle);
    await page.locator(".ProseMirror").fill("선택한 자녀의 학습 질문입니다.");
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
    await expect(page.getByText(qnaTitle, { exact: true })).toBeVisible();

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
  });
});
