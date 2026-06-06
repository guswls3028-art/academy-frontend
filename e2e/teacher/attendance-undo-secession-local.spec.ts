import { test, expect } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function isLocalBase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

test.describe("teacher attendance secession undo", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    serviceWorkers: "block",
  });

  test("퇴원 상태에서 일반 상태로 바꾼 뒤 되돌리면 confirm_secession이 함께 전송된다", async ({ page }) => {
    const patchBodies: Array<Record<string, unknown>> = [];
    const apiCalls: string[] = [];
    let currentStatus = "SECESSION";

    await page.addInitScript(({ access, refresh }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
      localStorage.setItem("teacher:preferAdmin", "0");
    }, { access: fakeJwt(), refresh: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      apiCalls.push(`${request.method()} ${path}`);

      if (path.endsWith("/api/v1/core/program/")) {
        await route.fulfill({
          json: {
            tenantCode: "hakwonplus",
            display_name: "실사용 테스트 학원",
            ui_config: {},
            feature_flags: {},
            is_active: true,
          },
        });
        return;
      }

      if (path.endsWith("/api/v1/core/me/")) {
        await route.fulfill({
          json: {
            id: 1,
            username: "teacher-realuse",
            name: "실사용 강사",
            phone: null,
            is_staff: true,
            is_superuser: false,
            tenantRole: "teacher",
            must_change_password: false,
          },
        });
        return;
      }

      if (path.endsWith("/api/v1/lectures/attendance/") && request.method() === "GET") {
        await route.fulfill({
          json: {
            count: 1,
            page_size: 200,
            results: [{
              id: 777,
              status: currentStatus,
              name: "실사용퇴원학생",
              student_name: "실사용퇴원학생",
              lecture_title: "토요 실사용반",
              lecture_color: "#2563eb",
              lecture_chip_label: "토",
            }],
          },
        });
        return;
      }

      if (/\/api\/v1\/lectures\/attendance\/777\/?$/.test(path) && request.method() === "PATCH") {
        const rawBody = request.postData() || "{}";
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          body = { __rawBody: rawBody };
        }
        patchBodies.push(body);
        currentStatus = typeof body.status === "string" ? body.status : currentStatus;
        await route.fulfill({
          json: {
            id: 777,
            status: currentStatus,
            name: "실사용퇴원학생",
          },
        });
        return;
      }

      await route.fulfill({ json: { count: 0, results: [] } });
    });

    await page.goto(`${BASE}/teacher/attendance/99`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "출석 체크" })).toBeVisible();
    await expect(page.getByText("실사용퇴원학생")).toBeVisible();
    await expect(page.getByText("퇴원", { exact: true })).toBeVisible();

    await page.getByText("실사용퇴원학생").click();
    await expect(page.getByText("출석 상태")).toBeVisible();
    const absentButton = page.getByRole("button", { name: "결석", exact: true });
    await expect(absentButton).toBeVisible();
    await absentButton.click();

    await expect.poll(() => patchBodies.length, {
      message: `출결 상태 변경 PATCH가 발생해야 합니다.\nAPI calls:\n${apiCalls.join("\n")}`,
    }).toBe(1);
    expect(patchBodies[0]).toEqual({ status: "ABSENT" });

    await page.getByRole("button", { name: "되돌리기" }).click();

    await expect.poll(() => patchBodies.length, {
      message: `퇴원 undo PATCH가 발생해야 합니다.\nAPI calls:\n${apiCalls.join("\n")}`,
    }).toBe(2);
    expect(patchBodies[1]).toEqual({
      status: "SECESSION",
      confirm_secession: true,
    });
  });
});
