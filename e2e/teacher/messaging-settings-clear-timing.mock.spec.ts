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

  test("빈 발송 시점을 null로 저장하고 재조회에서도 비어 있다", async ({ page }) => {
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
          sms_allowed: false,
          messaging_provider: "solapi",
          alimtalk_available: true,
          delivery_policy: "common_alimtalk_only",
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
    await expect(page.getByRole("spinbutton", { name: "분 전" })).toHaveValue("");
  });
});
