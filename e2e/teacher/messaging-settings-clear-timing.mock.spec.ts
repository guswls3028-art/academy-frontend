import { test, expect } from "../fixtures/strictTest";

const BASE =
  process.env.E2E_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.E2E_LOCAL_BASE_URL ||
  "http://127.0.0.1:5175";

test.describe("선생님 자동 발송 시점 초기화", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });

  test("빈 발송 시점을 유지하고 중첩 미리보기만 닫는다", async ({ page }) => {
    let minutesBefore: number | null = 30;
    let savedBody: unknown = null;

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, responseStatus = 200) => route.fulfill({
        status: responseStatus,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

      if (path === "/core/program/") {
        return json({
          tenantCode: "hakwonplus",
          display_name: "학원플러스",
          ui_config: { login_title: "학원플러스" },
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 101,
          username: "teacher-admin",
          name: "관리 선생님",
          is_staff: true,
          is_superuser: false,
          tenantRole: "admin",
        });
      }
      if (path === "/messaging/info/") {
        return json({
          messaging_provider: "solapi",
          alimtalk_available: true,
          delivery_policy: "verified_tenant_or_common_alimtalk",
          messaging_disabled: false,
        });
      }
      if (path === "/messaging/auto-send/" && request.method() === "PATCH") {
        savedBody = request.postDataJSON();
        const configs = (savedBody as { configs?: Array<{ minutes_before?: number | null }> }).configs ?? [];
        minutesBefore = configs[0]?.minutes_before ?? null;
      }
      if (path === "/messaging/auto-send/") {
        return json([{
          id: 501,
          trigger: "clinic_reminder",
          template: 701,
          template_name: "클리닉 안내",
          template_body: "클리닉 시작 안내입니다.",
          template_is_system: false,
          effective_template_is_approved: true,
          enabled: true,
          message_mode: "alimtalk",
          minutes_before: minutesBefore,
          policy_mode: "AUTO_DEFAULT",
          implementation_status: "implemented",
        }]);
      }
      return json({});
    });

    await page.addInitScript(() => {
      localStorage.setItem("access", "mock-access");
      localStorage.setItem("refresh", "mock-refresh");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    });

    await page.goto(`${BASE}/workspace/mobile/messaging-settings`, {
      waitUntil: "load",
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "메시지 설정" })).toBeVisible();

    await page.getByTitle("설정 편집").click();
    const timingInput = page.getByRole("spinbutton", { name: "분 전" });
    await expect(timingInput).toHaveValue("30");
    await timingInput.fill("");
    await page.getByRole("button", { name: "발송 시점 저장" }).click();

    await expect.poll(() => savedBody).toEqual({
      configs: [{
        trigger: "clinic_reminder",
        message_mode: "alimtalk",
        minutes_before: null,
      }],
    });

    await page.getByTitle("설정 편집").click();
    const reopenedTimingInput = page.getByRole("spinbutton", { name: "분 전" });
    await expect(reopenedTimingInput).toHaveValue("");

    await reopenedTimingInput.fill("45");
    const previewTrigger = page.getByRole("button", { name: "미리보기" });
    await previewTrigger.click();

    const previewSheet = page.getByRole("dialog", { name: "템플릿 미리보기" });
    await expect(previewSheet).toBeVisible();
    await previewSheet.evaluate((sheet) => {
      const hiddenAncestor = document.createElement("div");
      hiddenAncestor.style.display = "none";
      const hiddenButton = document.createElement("button");
      hiddenButton.textContent = "숨은 포커스 대상";
      hiddenAncestor.append(hiddenButton);
      sheet.append(hiddenAncestor);
    });
    const previewCloseButton = previewSheet.getByRole("button", { name: "닫기" });
    await previewCloseButton.focus();
    await page.keyboard.press("Tab");
    await expect(previewCloseButton).toBeFocused();
    await page.keyboard.press("Escape");

    await expect(previewSheet).toBeHidden();
    await expect(reopenedTimingInput).toBeVisible();
    await expect(reopenedTimingInput).toHaveValue("45");
    await expect(previewTrigger).toBeFocused();

    await page.mouse.click(10, 10);
    await expect(reopenedTimingInput).toBeHidden();
  });
});
