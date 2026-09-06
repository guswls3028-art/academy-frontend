/**
 * One-child parent journey for the disposable production-shaped development tenant.
 * The surrounding SSM owner creates and destroys the qa-* tenant; this spec owns
 * only the synthetic family rows listed in `family`.
 */
import { expect, test } from "../fixtures/strictTest";
import {
  assertAuthoritativeStudent,
  assertNoHorizontalOverflow,
  assertParentProjection,
  assertQaStudentParentRuntime,
  cleanupQaFamily,
  createQaFamily,
  installQaStudentParentBoundary,
  loginAdmin,
  loginApi,
  loginThroughUi,
  logoutStudentApp,
  QA_BASE,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { waitForRenderSettled } from "../helpers/wait";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

test.describe.serial("[real-use] 자녀 1명 학부모", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  let adminAccess = "";
  let family: QaFamily | null = null;

  test.beforeAll(() => {
    assertQaStudentParentRuntime();
  });

  test.afterAll(async ({ request }) => {
    await cleanupQaFamily(request, adminAccess, family);
  });

  test("생성·학부모 로그인·단일 자녀 projection·reload·relogin을 완료한다", async ({ page, request }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    adminAccess = admin.access;
    family = await createQaFamily(request, admin.access, "single", 1);
    const child = family.students[0];
    await assertAuthoritativeStudent(request, admin.access, child);

    const parent = await loginApi(request, family.parentPhone, family.parentPassword);
    await assertParentProjection(request, parent.access, child);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await expect(page.getByRole("tablist", { name: "자녀 선택" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "우리 아이 요약" })).toBeVisible();
    await expect(page.locator(".stu-topbar__name")).toContainText(child.name);
    await assertNoHorizontalOverflow(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.locator(".stu-topbar__name")).toContainText(child.name);

    await logoutStudentApp(page);
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await expect(page.locator(".stu-topbar__name")).toContainText(child.name);

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${QA_BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.getByRole("region", { name: "우리 아이 요약" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
