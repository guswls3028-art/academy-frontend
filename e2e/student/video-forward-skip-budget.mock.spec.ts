import { expect, test } from "../fixtures/strictTest";

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
    tenant_code: "ymath",
    user_id: 404,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

test.describe("student proctored video forward-skip budget", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });

  test("playback bootstrap fails closed when the explicit POST endpoint is unavailable", async ({ page }) => {
    const methods: string[] = [];
    await page.route("**/api/v1/student/video/videos/902/playback/**", async (route) => {
      methods.push(route.request().method());
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 405, json: { detail: "Method not allowed" } });
      }
      return route.fulfill({
        status: 200,
        json: {
          video: { id: 902, title: "legacy unsafe GET" },
          play_url: "https://cdn.hakwonplus.com/legacy/master.m3u8",
        },
      });
    });

    await page.goto(`${BASE}/favicon.svg`);
    const outcome = await page.evaluate(async () => {
      const { fetchStudentVideoPlayback } = await import(
        "/src/app_student/domains/video/api/video.api.ts"
      );
      try {
        await fetchStudentVideoPlayback(902, {});
        return "resolved";
      } catch {
        return "rejected";
      }
    });

    expect(outcome).toBe("rejected");
    expect(methods).toEqual(["POST"]);
  });

  test("10초 승인만 이동하고 서버 잔여량을 반영해 소진 시 잠근다", async ({ page }, testInfo) => {
    const video = {
      id: 901,
      session_id: 71,
      enrollment_id: 81,
      title: "수업 중 쉬는 시간이 포함된 미적분 특강",
      status: "READY",
      source_type: "s3",
      duration: 100,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: false,
      max_speed: 1,
      show_watermark: true,
      access_mode: "PROCTORED_CLASS",
    };
    let remainingSeconds = 20;
    let skipRequests = 0;
    const playbackMethods: string[] = [];

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "ymath");
      sessionStorage.setItem("tenantCode", "ymath");
    }, { token: fakeJwt() });

    await page.route("https://cdn.hakwonplus.com/e2e-budget/**", async (route) => {
      // Keep media loading pending so the test exercises the controls without
      // coupling this UI contract to a browser codec or HLS transmuxer.
      await new Promise<void>((resolveClose) => page.once("close", resolveClose));
      try {
        await route.abort();
      } catch {
        // Page teardown may have already disposed the intercepted request.
      }
    });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown) => route.fulfill({ json: body });

      if (path === "/core/program/") {
        return json({
          tenantCode: "ymath",
          display_name: "와이매쓰",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 404,
          username: "budget-student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          linkedStudentId: 41,
          linkedStudentName: "학생",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/901/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          expect(route.request().method()).toBe("GET");
          return json({
            ok: true,
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            policy_version: 1,
          });
        }
        playbackMethods.push(route.request().method());
        expect(route.request().method()).toBe("POST");
        return json({
          video,
          play_url: "https://cdn.hakwonplus.com/e2e-budget/master.m3u8",
          playback_token: "student-budget-token",
          policy_version: 1,
          policy: {
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            allow_seek: true,
            seek: {
              mode: "budgeted_forward",
              forward_limit: "budget",
              grace_seconds: 3,
              enabled: remainingSeconds > 0,
              step_seconds: 10,
              ratio_percent: 20,
              max_seconds: 1800,
              limit_seconds: 20,
              used_seconds: 20 - remainingSeconds,
              remaining_seconds: remainingSeconds,
              unavailable_reason: remainingSeconds > 0 ? "" : "limit_reached",
            },
            playback_rate: { max: 1, ui_control: true },
            watermark: { enabled: true, mode: "overlay" },
          },
        });
      }
      if (path === "/student/video/videos/901/forward-skip/") {
        skipRequests += 1;
        const grantedSeconds = Math.min(10, remainingSeconds);
        remainingSeconds -= grantedSeconds;
        return json({
          enabled: remainingSeconds > 0,
          step_seconds: 10,
          ratio_percent: 20,
          max_seconds: 1800,
          limit_seconds: 20,
          used_seconds: 20 - remainingSeconds,
          remaining_seconds: remainingSeconds,
          unavailable_reason: remainingSeconds > 0 ? "" : "limit_reached",
          granted_seconds: grantedSeconds,
        });
      }
      if (path === "/student/video/sessions/71/videos/") return json({ items: [video] });
      if (path === "/student/video/videos/901/comments/") return json({ comments: [], total: 0 });
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=901&enrollment=81&session=71`,
      { waitUntil: "domcontentloaded", timeout: 120_000 },
    );

    await expect.poll(() => playbackMethods.length).toBeGreaterThanOrEqual(1);
    expect(new Set(playbackMethods)).toEqual(new Set(["POST"]));
    await expect(page.getByText("10초씩 · 0:20 남음")).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: testInfo.outputPath("video-forward-skip-390.png"), fullPage: true });
    const forward = page.getByRole("button", { name: /10초 앞으로 건너뛰기/ });
    await forward.click();
    await expect(page.getByText("10초씩 · 0:10 남음")).toBeVisible();
    await forward.click();
    await expect(page.getByText("사용 가능한 시간을 모두 썼어요")).toBeVisible();
    await expect(forward).toBeDisabled();
    expect(skipRequests).toBe(2);

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasOverflow).toBe(false);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText("사용 가능한 시간을 모두 썼어요")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("video-forward-skip-1440.png"), fullPage: true });
    const desktopHasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(desktopHasOverflow).toBe(false);
  });
});
