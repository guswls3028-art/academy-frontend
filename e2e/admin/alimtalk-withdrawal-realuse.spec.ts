/** The real API/outbox/development mock worker journey; never a provider send. */
import { expect, test } from "../fixtures/strictTest";
import {
  api, expectApi, assertNoHorizontalOverflow, assertQaStudentParentRuntime,
  cleanupQaFamily, createQaFamily, installQaStudentParentBoundary, loginAdmin,
  QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_TENANT, STUDENT_PARENT_REALUSE_ENABLED, type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle } from "../helpers/wait";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type Config = { trigger: string; template: number | null; enabled: boolean };
type Receipt = { batch_id: string; accepted_count: number; failed_count: number; blocked_count: number };
type Log = { id: number; notification_type: string; target_id: string; status: string; provider_evidence: boolean };
let access = "";
let family: QaFamily | null = null;
let templateId: number | null = null;
let previous: Config | undefined;
let configured = false;

test.describe.serial("[real-use] 퇴원 알림 접수와 개발 mock worker", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires isolated qa-* development runner and SOLAPI_MOCK.");
  test.beforeAll(() => assertQaStudentParentRuntime());
  test.afterAll(async ({ request }) => {
    if (!access) return;
    if (configured) {
      await expectApi(request, "PATCH", "/messaging/auto-send/", access, { configs: [{
        trigger: "withdrawal_complete", template_id: previous?.template ?? null, enabled: previous?.enabled ?? false,
      }] });
    }
    await cleanupQaFamily(request, access, family);
    if (templateId != null) {
      expect((await api(request, "DELETE", `/messaging/templates/${templateId}/`, access)).status).toBe(204);
      expect((await api(request, "GET", `/messaging/templates/${templateId}/`, access)).status).toBe(404);
    }
  });

  test("desktop·390px 삭제 → 승인 봉투 확인 → 원본 접수 → 같은 요청 확인 → worker 기록·reload", async ({ page, request }, testInfo) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    access = (await loginAdmin(request)).access;
    family = await createQaFamily(request, access, "alimtalk-withdrawal", 2);
    const configs = await expectApi<Config[]>(request, "GET", "/messaging/auto-send/", access);
    previous = configs.find((item) => item.trigger === "withdrawal_complete");
    const template = await expectApi<{ id: number }>(request, "POST", "/messaging/templates/", access, {
      name: `QA withdrawal ${family.students[0].id}`, category: "default", body: "#{학생이름} 퇴원 안내",
    });
    templateId = template.id;
    await expectApi(request, "PATCH", "/messaging/auto-send/", access, { configs: [{
      trigger: "withdrawal_complete", template_id: templateId, enabled: false, message_mode: "alimtalk",
    }] });
    configured = true;
    await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`, { timeout: 45_000 });
    await page.getByTestId("login-username").fill(QA_ADMIN_USER);
    await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(page);

    for (const [index, width] of [1366, 390].entries()) {
      const student = family.students[index];
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/students/home`);
      await page.locator('[data-guide="students-search"]').fill(student.name);
      await page.getByRole("checkbox", { name: `${student.name} 선택`, exact: true }).check();
      await page.getByRole("button", { name: "삭제", exact: true }).click();
      const previewResponse = page.waitForResponse((response) => response.request().method() === "POST"
        && new URL(response.url()).pathname.endsWith("/messaging/manual-notification/preview/"));
      await page.getByRole("alertdialog").filter({ hasText: "학생 삭제" }).getByRole("button", { name: "삭제", exact: true }).click();
      const preview = await previewResponse;
      expect(preview.status()).toBe(200);
      const payload = await preview.json() as { preview_token: string; total_count: number };
      expect(payload.total_count).toBe(1);
      expect(payload.preview_token).toBeTruthy();
      const modal = page.getByRole("dialog").filter({ hasText: "퇴원 처리 완료 안내 발송" });
      await expect(modal.locator(".notification-preview__kakao-pane")).toContainText("퇴원");
      await modal.getByRole("checkbox").check();
      const confirmResponse = page.waitForResponse((response) => response.request().method() === "POST"
        && new URL(response.url()).pathname.endsWith("/messaging/manual-notification/confirm/"));
      await modal.getByRole("button", { name: "1건 발송", exact: true }).click();
      const confirm = await confirmResponse;
      expect(confirm.status()).toBe(200);
      const receipt = await confirm.json() as Receipt;
      expect(receipt).toMatchObject({ accepted_count: 1, failed_count: 0, blocked_count: 0 });
      await expect(modal.getByRole("status")).toContainText("알림톡 1건 접수");
      await expect(modal.getByRole("status")).toBeInViewport();
      await expect(modal.getByRole("status")).not.toContainText("발송 완료");
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`alimtalk-receipt-${width}.png`) });
      const replay = await expectApi<Receipt>(request, "POST", "/messaging/manual-notification/confirm/", access, {
        preview_token: payload.preview_token,
      });
      expect(replay.batch_id).toBe(receipt.batch_id);
      expect(replay.accepted_count).toBe(1);
      let logId: number | undefined;
      await expect.poll(async () => {
        const logs = await expectApi<{ results: Log[] }>(request, "GET", "/messaging/log/?page_size=50", access);
        const matching = logs.results.filter((row) => row.notification_type === "withdrawal_complete"
          && row.target_id === String(student.id));
        logId = matching[0]?.id;
        return { count: matching.length, sent: matching[0]?.status, evidence: matching[0]?.provider_evidence };
      }, { timeout: 90_000, intervals: [1000, 2000, 3000] }).toEqual({ count: 1, sent: "sent", evidence: true });
      await modal.getByRole("link", { name: "발송 기록 보기" }).click();
      await expect(page).toHaveURL(/\/workspace\/message\/log$/);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "발송 내역", exact: true })).toBeVisible();
      await expect(page.getByRole("region", { name: "알림톡 발송 기록" })).toContainText("퇴원");
      const persisted = await expectApi<{ results: Log[] }>(request, "GET", "/messaging/log/?page_size=50", access);
      expect(persisted.results.filter((row) => row.notification_type === "withdrawal_complete"
        && row.target_id === String(student.id)).map((row) => row.id)).toEqual([logId]);
      await assertNoHorizontalOverflow(page);
    }
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
