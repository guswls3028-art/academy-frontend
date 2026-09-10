/**
 * Two-child parent journey for the disposable production-shaped development tenant.
 * No production origin, shared account, or uncontrolled recipient is permitted.
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
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { waitForRenderSettled } from "../helpers/wait";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

test.describe.serial("[real-use] 다중 자녀 학부모", () => {
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

  test("두 자녀 생성·전환·header 격리·reload·relogin을 완료한다", async ({ page, request }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    adminAccess = admin.access;
    family = await createQaFamily(request, admin.access, "switch", 2);
    const [first, second] = family.students;
    await assertAuthoritativeStudent(request, admin.access, first);
    await assertAuthoritativeStudent(request, admin.access, second);

    const parent = await loginApi(request, family.parentPhone, family.parentPassword);
    await assertParentProjection(request, parent.access, first);

    const studentScopedRequests: string[] = [];
    page.on("request", (requestItem) => {
      if (requestItem.url().includes("/api/v1/student/")) {
        studentScopedRequests.push(requestItem.headers()["x-student-id"] ?? "missing");
      }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    const switcher = page.getByRole("tablist", { name: "자녀 선택" });
    await expect(switcher).toBeVisible();
    const firstTab = switcher.getByRole("tab", { name: first.name });
    const secondTab = switcher.getByRole("tab", { name: second.name });
    await expect(firstTab).toHaveAttribute("aria-selected", "false");
    await expect(secondTab).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("heading", { name: "확인할 자녀를 선택해 주세요" })).toBeVisible();
    await expect.poll(() => studentScopedRequests).toEqual([]);

    const firstProjection = page.waitForRequest((requestItem) => (
      requestItem.url().includes("/api/v1/student/")
      && requestItem.headers()["x-student-id"] === String(first.id)
    ));
    await firstTab.click();
    await firstProjection;
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".stu-topbar__name")).toContainText(first.name);

    const secondProjection = page.waitForRequest((requestItem) => (
      requestItem.url().includes("/api/v1/student/")
      && requestItem.headers()["x-student-id"] === String(second.id)
    ));
    await secondTab.click();
    await secondProjection;
    await expect(secondTab).toHaveAttribute("aria-selected", "true");
    await expect(firstTab).toHaveAttribute("aria-selected", "false");
    await expect(page.locator(".stu-topbar__name")).toContainText(second.name);
    await assertParentProjection(request, parent.access, second, second.id);
    await assertNoHorizontalOverflow(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(switcher.getByRole("tab", { name: second.name })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".stu-topbar__name")).toContainText(second.name);

    await logoutStudentApp(page);
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await expect(page.getByRole("tab", { name: second.name })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".stu-topbar__name")).toContainText(second.name);
    expect(studentScopedRequests).not.toContain("missing");

    await page.setViewportSize({ width: 1366, height: 900 });
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
