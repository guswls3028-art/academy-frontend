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

  for (const scenario of [
    { trigger: "clinic_reminder", unit: 1, label: "분 전", initial: 30, display: "30" },
    { trigger: "exam_scheduled_days_before", unit: 1440, label: "일 전", initial: 1440, display: "1" },
    { trigger: "assignment_due_hours_before", unit: 60, label: "시간 전", initial: 180, display: "3" },
  ]) {
  test(`${scenario.label}: 저장 단위·빈 값·재조회와 중첩 미리보기`, async ({ page }) => {
    let minutesBefore: number | null = scenario.initial;
    let savedBody: unknown = null;
    let enabled = true;
    let failToggle = true;
    let templateBody = "클리닉 시작 안내입니다.";
    let failPreview = false;

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
        const config = (savedBody as { configs: Array<{ minutes_before?: number | null; enabled?: boolean }> }).configs[0];
        if (typeof config.enabled === "boolean") {
          if (failToggle) return json({ detail: "설정을 저장하지 못했습니다." }, 503);
          enabled = config.enabled;
        }
        if ("minutes_before" in config) minutesBefore = config.minutes_before ?? null;
      }
      if (path === "/messaging/auto-send/") {
        if (request.method() === "GET" && failPreview) return json({ detail: "미리보기 연결 실패" }, 503);
        return json([{
          id: 501,
          trigger: scenario.trigger,
          template: 701,
          template_name: "클리닉 안내",
          template_body: templateBody,
          template_is_system: false,
          effective_template_is_approved: true,
          enabled,
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
    await expect(page.getByText("보내는 채널", { exact: true })).toBeVisible();
    await expect(page.getByText("발송 상태", { exact: true })).toBeVisible();
    await expect(page.getByText("공급자", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect(page.getByText(`${scenario.display}${scenario.label}`, { exact: true })).toBeVisible();
    const autoToggle = page.getByRole("switch");
    await autoToggle.click();
    await expect(page.getByRole("alert")).toContainText("변경하지 못했습니다");
    await expect(autoToggle).toHaveAttribute("aria-checked", "true");
    failToggle = false;
    await autoToggle.click();
    await expect(autoToggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("alert")).toHaveCount(0);

    await page.getByTitle("설정 편집").click();
    const timingInput = page.getByRole("spinbutton", { name: scenario.label });
    await expect(timingInput).toHaveValue(scenario.display);
    await timingInput.fill("");
    await page.getByRole("button", { name: "발송 시점 저장" }).click();

    await expect.poll(() => savedBody).toEqual({
      configs: [{
        trigger: scenario.trigger,
        message_mode: "alimtalk",
        minutes_before: null,
      }],
    });

    await page.getByTitle("설정 편집").click();
    const reopenedTimingInput = page.getByRole("spinbutton", { name: scenario.label });
    await expect(reopenedTimingInput).toHaveValue("");

    await reopenedTimingInput.fill("45");
    templateBody = "다른 화면에서 방금 저장한 안내입니다. #{선생님메모}";
    failPreview = true;
    const previewTrigger = page.getByRole("button", { name: "미리보기" });
    await previewTrigger.click();

    const previewSheet = page.getByRole("dialog", { name: "템플릿 미리보기" });
    await expect(previewSheet).toBeVisible();
    await expect(previewSheet.getByRole("alert")).toContainText("미리보기 연결 실패");
    failPreview = false;
    await previewSheet.getByRole("button", { name: "다시 불러오기", exact: true }).click();
    const envelope = previewSheet.getByLabel("카카오톡 실제 발송 미리보기");
    await expect(envelope).toContainText("다른 화면에서 방금 저장한 안내입니다.");
    await expect(envelope).not.toContainText("클리닉 시작 안내입니다.");
    await expect(envelope).not.toContainText("#{선생님메모}");
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

    await reopenedTimingInput.fill("-1");
    await expect(page.getByRole("alert")).toContainText("0 이상의 값");
    await expect(page.getByRole("button", { name: "발송 시점 저장" })).toBeDisabled();
    const nextTiming = scenario.unit === 1 ? "2" : "1.1";
    await reopenedTimingInput.fill(nextTiming);
    await page.getByRole("button", { name: "발송 시점 저장" }).click();
    await expect(reopenedTimingInput).toBeHidden();
    expect(minutesBefore).toBe(Math.round(Number(nextTiming) * scenario.unit));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(autoToggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText(`${nextTiming}${scenario.label}`, { exact: true })).toBeVisible();
    await page.getByTitle("설정 편집").click();
    await expect(page.getByRole("spinbutton", { name: scenario.label })).toHaveValue(nextTiming);
  });
  }
});
