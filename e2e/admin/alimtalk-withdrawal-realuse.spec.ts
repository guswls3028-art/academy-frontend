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

test.setTimeout(420_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type Config = { trigger: string; template: number | null; enabled: boolean };
type Receipt = { batch_id: string; accepted_count: number; failed_count: number; blocked_count: number };
type Log = { id: number; notification_type: string; target_id: string; status: string; provider_evidence: boolean };
let access = "";
let family: QaFamily | null = null;
let templateId: number | null = null;
let previous: Config | undefined;
let configured = false;
let editableTemplateId: number | null = null;
let previousReminder: Config | undefined;
let reminderConfigured = false;

test.describe.serial("[real-use] 퇴원 알림 접수와 개발 mock worker", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires isolated qa-* development runner and SOLAPI_MOCK.");
  test.beforeAll(() => assertQaStudentParentRuntime());
  test.afterAll(async ({ request }) => {
    if (!access) return;
    if (reminderConfigured) {
      await expectApi(request, "PATCH", "/messaging/auto-send/", access, { configs: [{
        trigger: "clinic_reminder", template_id: previousReminder?.template ?? null, enabled: previousReminder?.enabled ?? false,
      }] });
    }
    if (editableTemplateId != null) {
      expect((await api(request, "DELETE", `/messaging/templates/${editableTemplateId}/`, access)).status).toBe(204);
      expect((await api(request, "GET", `/messaging/templates/${editableTemplateId}/`, access)).status).toBe(404);
    }
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
    // Keep the synthetic recipient name within the approved 23-character field
    // so the preview can assert its complete identity without truncation.
    family = await createQaFamily(request, access, "alimtalk", 2);
    const configs = await expectApi<Config[]>(request, "GET", "/messaging/auto-send/", access);
    previous = configs.find((item) => item.trigger === "withdrawal_complete");
    previousReminder = configs.find((item) => item.trigger === "clinic_reminder");
    editableTemplateId = (await expectApi<{ id: number }>(request, "POST", "/messaging/templates/", access, {
      name: `QA editable ${family.students[0].id}`, category: "clinic", body: "예전에 저장한 합성 안내문",
    })).id;
    await expectApi(request, "PATCH", "/messaging/auto-send/", access, { configs: [{
      trigger: "clinic_reminder", template_id: editableTemplateId, enabled: false, message_mode: "alimtalk",
    }] });
    reminderConfigured = true;
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
      await gotoAndSettle(page, `${QA_BASE}/workspace/message/auto-send`);
      await page.getByRole("button", { name: "클리닉/상담", exact: true }).click();
      const reminderCard = page.locator('[data-card-state]').filter({ hasText: `QA editable ${family.students[0].id}` });
      await reminderCard.getByRole("button", { name: "문구 수정", exact: true }).click();
      // The submit label becomes "저장 중…" while PATCH is in flight.
      // Keep the dialog locator stable until the successful save really closes it.
      const editorDialog = page.getByRole("dialog").filter({ has: page.getByRole("textbox", { name: "안내문", exact: true }) });
      const newBody = `${width}px에서 직접 수정한 안내문입니다.\n시간에 맞춰 준비해 주세요.`;
      await editorDialog.getByRole("textbox", { name: "안내문", exact: true }).fill(newBody);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`alimtalk-editable-${width}.png`) });
      const saved = page.waitForResponse((response) => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/v1/messaging/templates/${editableTemplateId}/`);
      await editorDialog.getByRole("button", { name: "저장하고 적용" }).click();
      const saveResponse = await saved;
      expect(saveResponse.status()).toBe(200);
      expect((await saveResponse.json() as { body: string }).body).toBe(newBody);
      await expect(editorDialog).toBeHidden();
      const stored = await expectApi<{ body: string }>(request, "GET", `/messaging/templates/${editableTemplateId}/`, access);
      expect(stored.body).toBe(newBody);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "클리닉/상담", exact: true }).click();
      await expect(page.getByText(newBody, { exact: true })).toBeVisible();
      // Exercise both independent libraries against the real tenant API, then
      // consume the saved text in the mobile send UI before any submission.
      await gotoAndSettle(page, `${QA_BASE}/workspace/message/templates`);
      await page.getByRole("navigation", { name: "문구 카테고리" }).getByRole("button", { name: /^클리닉/ }).click();
      await page.getByText(`QA editable ${family.students[0].id}`, { exact: true }).click();
      const library = page.getByRole("dialog", { name: "문구 수정", exact: true });
      // Tiptap renders each saved line as a paragraph; textContent joins those
      // paragraphs without separators. Check every line and its order instead.
      await expect(library.getByRole("textbox", { name: "안내문", exact: true }).locator("p"))
        .toHaveText(newBody.split("\n"));
      const libraryBody = `${width}px 보관함에서 저장한 안내문입니다.`;
      await library.getByRole("textbox", { name: "안내문", exact: true }).fill(libraryBody);
      await library.getByRole("button", { name: "수정", exact: true }).click();
      await expect(library).toBeHidden();
      await gotoAndSettle(page, `${QA_BASE}/workspace/mobile/message-templates`);
      await page.getByRole("button", { name: `QA editable ${family.students[0].id} 편집`, exact: true }).click();
      const mobileEditor = page.getByRole("dialog", { name: "문구 편집", exact: true });
      await expect(mobileEditor.getByRole("textbox", { name: "안내 문구", exact: true })).toHaveText(libraryBody);
      const mobileBody = `${width}px 선생님 화면에서 저장한 최종 안내문입니다.`;
      await mobileEditor.getByRole("textbox", { name: "안내 문구", exact: true }).fill(mobileBody);
      await mobileEditor.getByRole("button", { name: "수정", exact: true }).click();
      await expect(mobileEditor).toBeHidden();
      expect((await expectApi<{ body: string }>(request, "GET", `/messaging/templates/${editableTemplateId}/`, access)).body).toBe(mobileBody);
      // A new context has no prior cookies, local storage or query cache.
      // Log in through the UI and consume the persisted copy in a new session.
      const reconnectedContext = await page.context().browser()!.newContext({
        viewport: { width, height: 900 }, serviceWorkers: "block",
      });
      try {
        const page = await reconnectedContext.newPage();
        const reconnectBoundary = await installQaStudentParentBoundary(page, request);
        const reconnectBrowser = attachStrictBrowserGuards(page);
        await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`, { timeout: 45_000 });
        await page.getByTestId("login-username").fill(QA_ADMIN_USER);
        await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
        await page.getByTestId("login-submit").click();
        await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
        await acknowledgeInitialAccountPromptsIfVisible(page);
        await gotoAndSettle(page, `${QA_BASE}/workspace/mobile/message-templates`);
        const mobileEditor = page.getByRole("dialog", { name: "문구 편집", exact: true });
        await page.getByRole("button", { name: `QA editable ${family.students[0].id} 편집`, exact: true }).click();
        await expect(mobileEditor.getByRole("textbox", { name: "안내 문구", exact: true })).toHaveText(mobileBody);
        await expect(mobileEditor).not.toContainText("예전에 저장한 합성 안내문");
        await expect(mobileEditor.getByRole("button", { name: "수정", exact: true })).toBeInViewport();
        await assertNoHorizontalOverflow(page);
        await page.screenshot({ path: testInfo.outputPath(`alimtalk-library-${width}.png`) });
        await mobileEditor.getByRole("button", { name: "닫기", exact: true }).click();
        await gotoAndSettle(page, `${QA_BASE}/workspace/mobile/students`);
        await page.getByPlaceholder("이름, 아이디, 전화번호, 학교").fill(student.name);
        await expect(page.getByRole("status").filter({ hasText: "총 1명 · 1명 표시" })).toBeVisible();
        await page.getByRole("button", { name: "선택", exact: true }).click();
        await expect(page.getByRole("button", { name: "전체 선택", exact: true })).toBeVisible();
        await expect(page.getByText(student.name, { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "전체 선택", exact: true }).click();
        await page.getByRole("button", { name: "알림톡", exact: true }).click();
        const compose = page.getByRole("dialog", { name: "1명에게 알림톡", exact: true });
        await compose.getByLabel("저장한 문구 불러오기").selectOption(String(editableTemplateId));
        await expect(compose.getByLabel("선생님 안내문 (자유롭게 수정)")).toHaveText(mobileBody);
        await compose.getByRole("button", { name: "수신자별 발송 문구 확인", exact: true }).click();
        const review = page.getByRole("dialog", { name: "보내기 전 마지막 확인", exact: true });
        await expect(review.getByLabel("카카오톡 실제 발송 미리보기")).toContainText(mobileBody);
        await expect(review).not.toContainText("예전에 저장한 합성 안내문");
        await expect(review.getByLabel("카카오톡 실제 발송 미리보기")).toContainText(student.name);
        await review.getByRole("button", { name: "문구 수정", exact: true }).click();
        await expect(compose.getByLabel("선생님 안내문 (자유롭게 수정)")).toHaveText(mobileBody);
        await compose.getByRole("button", { name: "닫기", exact: true }).click();
        reconnectBoundary.assertClean();
        reconnectBrowser.assertZeroDefects();
      } finally {
        await reconnectedContext.close();
      }
      await gotoAndSettle(page, `${QA_BASE}/workspace/mobile/messaging-settings`);
      const mobileReminder = page.getByRole("group").filter({ hasText: `QA editable ${family.students[0].id}` });
      await mobileReminder.getByTitle("설정 편집").click();
      await page.getByRole("button", { name: "미리보기", exact: true }).click();
      const settingsPreview = page.getByRole("dialog", { name: "템플릿 미리보기", exact: true });
      await expect(settingsPreview.getByLabel("카카오톡 실제 발송 미리보기")).toContainText(mobileBody);
      await settingsPreview.getByRole("button", { name: "닫기", exact: true }).click();
      await gotoAndSettle(page, `${QA_BASE}/workspace/message/auto-send`);
      await page.getByRole("button", { name: "클리닉/상담", exact: true }).click();
      await expect(page.getByText(mobileBody, { exact: true })).toBeVisible();
      const rendered = await expectApi<{ can_send: boolean; preview_recipients: Array<{ full_message_body: string }> }>(
        request, "POST", "/messaging/send/preflight/", access, {
          template_id: editableTemplateId, student_ids: [student.id], send_to: "parent", message_mode: "alimtalk",
          block_category: "clinic", alimtalk_extra_vars: { 클리닉장소: "QA 강의실", 클리닉날짜: "2026-10-19", 클리닉시간: "18:00" },
        },
      );
      expect(rendered.can_send).toBe(true);
      expect(rendered.preview_recipients).toHaveLength(1);
      expect(rendered.preview_recipients[0].full_message_body).toContain(mobileBody);
      expect(rendered.preview_recipients[0].full_message_body).not.toContain("예전에 저장한 합성 안내문");
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
