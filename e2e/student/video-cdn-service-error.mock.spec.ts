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
    tenant_code: "limglish",
    user_id: 1772,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

test.describe("student video CDN service errors", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });

  test("CDN 403을 학생 인터넷 문제로 안내하지 않고 새 재생 URL을 요청한다", async ({ page }) => {
    const video = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "여름특강 영작 2차시 - 인칭대명사와 부정문&의문문",
      status: "READY",
      source_type: "s3",
      duration: 1465,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
    };
    let playbackRequests = 0;

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
      localStorage.setItem("video_pos_562", JSON.stringify({ pos: 999, ts: Date.now() }));
      localStorage.setItem("student-current-video:enrollment:1304:limglish:user:9999", "777");
    }, { token: fakeJwt() });

    await page.route("https://cdn.hakwonplus.com/e2e/**", async (route) => {
      await route.fulfill({
        status: 403,
        headers: { "access-control-allow-origin": "*" },
        contentType: "text/plain",
        body: "invalid signature",
      });
    });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown) => route.fulfill({ json: body });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          linkedStudentId: 1,
          linkedStudentName: "학생",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        playbackRequests += 1;
        return json({
          video,
          play_url: "https://cdn.hakwonplus.com/e2e/master.m3u8?exp=1&sig=invalid&kid=v1&uid=1772",
          policy: {
            access_mode: "FREE_REVIEW",
            monitoring_enabled: false,
            allow_seek: true,
            playback_rate: { max: 1, ui_control: true },
          },
        });
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [video] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );

    await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible();
    await expect(page.getByText("영상 서비스에서 재생 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeVisible();
    await expect(page.getByText(/인터넷.*확인|새로고침/)).toHaveCount(0);

    const storageState = await page.evaluate(() => ({
      current: localStorage.getItem("student-current-video:enrollment:1304:limglish:user:1772"),
      legacyPosition: localStorage.getItem("video_pos_562"),
      otherUser: localStorage.getItem("student-current-video:enrollment:1304:limglish:user:9999"),
    }));
    expect(storageState.current).toBe("562");
    expect(JSON.parse(storageState.legacyPosition || "null")?.pos).toBe(999);
    expect(storageState.otherUser).toBe("777");

    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect.poll(() => playbackRequests).toBeGreaterThanOrEqual(2);
  });

  test("열린 무료복습 영상도 강의 종료 access check 403에서 즉시 닫는다", async ({ page }) => {
    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          linkedStudentId: 1,
          linkedStudentName: "학생",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          return json({ detail: "종료된 강의의 영상은 시청할 수 없습니다." }, 403);
        }
        return json({
          video: {
            id: 562,
            session_id: 394,
            enrollment_id: 1304,
            title: "종료 전 열어 둔 무료복습 영상",
            status: "READY",
            source_type: "youtube",
            youtube_video_id: "VnqgmOJaMGc",
            duration: 600,
            progress: 30,
            completed: false,
            last_position: 180,
            allow_skip: true,
            max_speed: 1,
            show_watermark: false,
            access_mode: "FREE_REVIEW",
          },
          play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
          playback_token: "signed-current-access-token",
          playback_session_id: null,
          playback_expires_at: Math.floor(Date.now() / 1000) + 600,
          policy: {
            access_mode: "FREE_REVIEW",
            monitoring_enabled: false,
            allow_seek: true,
            playback_rate: { max: 1, ui_control: true },
            source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
          },
        });
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    const rejectedAccessCheck = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 403;
    }, { timeout: 30_000 });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded" },
    );

    await rejectedAccessCheck;
    await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible();
    await expect(page.getByText("종료된 강의의 영상은 시청할 수 없습니다.")).toBeVisible();
    await expect(page.getByText("종료 전 열어 둔 무료복습 영상")).toHaveCount(0);
  });

  test("열린 무료복습이 수업 모드로 바뀌면 즉시 닫고 monitored bootstrap을 다시 받는다", async ({ page }) => {
    let playbackRequests = 0;
    let releasePolicyDrift!: () => void;
    let releaseProctoredBootstrap!: () => void;
    const policyDriftGate = new Promise<void>((resolve) => {
      releasePolicyDrift = resolve;
    });
    const proctoredBootstrapGate = new Promise<void>((resolve) => {
      releaseProctoredBootstrap = resolve;
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          linkedStudentId: 1,
          linkedStudentName: "학생",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          await policyDriftGate;
          return json({
            ok: true,
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            policy_version: 2,
          });
        }

        playbackRequests += 1;
        const proctored = playbackRequests > 1;
        if (proctored) await proctoredBootstrapGate;
        return json({
          video: {
            id: 562,
            session_id: 394,
            enrollment_id: 1304,
            title: "정책 전환 재생 영상",
            status: "READY",
            source_type: "youtube",
            youtube_video_id: "VnqgmOJaMGc",
            duration: 600,
            progress: 30,
            completed: false,
            last_position: 180,
            allow_skip: true,
            max_speed: 1,
            show_watermark: true,
            access_mode: proctored ? "PROCTORED_CLASS" : "FREE_REVIEW",
          },
          play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
          playback_token: proctored ? "proctored-token" : "free-review-token",
          playback_session_id: proctored ? "proctored-session" : null,
          playback_expires_at: Math.floor(Date.now() / 1000) + 600,
          policy_version: proctored ? 2 : 1,
          policy: {
            access_mode: proctored ? "PROCTORED_CLASS" : "FREE_REVIEW",
            monitoring_enabled: proctored,
            allow_seek: true,
            playback_rate: { max: 1, ui_control: true },
            watermark: { enabled: true, mode: "overlay", fields: ["user_id"] },
            source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
          },
        });
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );

    await expect(page.getByRole("heading", { name: "정책 전환 재생 영상" })).toBeVisible({
      timeout: 30_000,
    });
    releasePolicyDrift();

    await expect.poll(() => playbackRequests, { timeout: 30_000 }).toBe(2);
    await expect(page.getByText("정책 전환 재생 영상")).toHaveCount(0);

    releaseProctoredBootstrap();

    await expect(page.getByRole("heading", { name: "정책 전환 재생 영상" })).toBeVisible();
    await expect(page.getByText("온라인 수업 대체")).toHaveCount(1);
    expect(playbackRequests).toBe(2);
  });
});

test.describe("student video access races on desktop", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 1366, height: 768 },
    serviceWorkers: "block",
  });

  test("지연된 A 정책 응답은 B의 403 종료 상태를 해제하지 않는다", async ({ page }) => {
    let aPlaybackRequests = 0;
    let aRefetchRequests = 0;
    let aRefetchResponses = 0;
    let bPlaybackRequests = 0;
    let bAccessChecks = 0;
    let aPolicyDriftReleased = false;
    let releaseADrift!: () => void;
    let releaseARefetch!: () => void;
    const aDriftGate = new Promise<void>((resolve) => {
      releaseADrift = resolve;
    });
    const aRefetchGate = new Promise<void>((resolve) => {
      releaseARefetch = resolve;
    });
    const videoA = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "지연 응답 영상 A",
      status: "READY",
      source_type: "youtube",
      youtube_video_id: "VnqgmOJaMGc",
      duration: 600,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: true,
      access_mode: "FREE_REVIEW",
    };
    const videoB = {
      ...videoA,
      id: 563,
      title: "권한 종료 영상 B",
    };
    const playback = (
      video: typeof videoA,
      mode: "FREE_REVIEW" | "PROCTORED_CLASS",
      policyVersion: number,
    ) => ({
      video: { ...video, access_mode: mode },
      play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
      playback_token: `${video.id}-${mode}-token`,
      playback_session_id: mode === "PROCTORED_CLASS" ? `${video.id}-session` : null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 600,
      policy_version: policyVersion,
      policy: {
        access_mode: mode,
        monitoring_enabled: mode === "PROCTORED_CLASS",
        allow_seek: true,
        playback_rate: { max: 1, ui_control: true },
        source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
      },
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          linkedStudentId: 1,
          linkedStudentName: "학생",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          await aDriftGate;
          return json({
            ok: true,
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            policy_version: 2,
          });
        }
        aPlaybackRequests += 1;
        if (aPolicyDriftReleased) {
          aRefetchRequests += 1;
          await aRefetchGate;
          aRefetchResponses += 1;
          return json(playback(videoA, "PROCTORED_CLASS", 2));
        }
        return json(playback(videoA, "FREE_REVIEW", 1));
      }
      if (path === "/student/video/videos/563/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          bAccessChecks += 1;
          return json({ detail: "B 강의가 종료되어 시청할 수 없습니다." }, 403);
        }
        bPlaybackRequests += 1;
        return json(playback(videoB, "FREE_REVIEW", 1));
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [videoA, videoB] });
      }
      if (/\/student\/video\/videos\/\d+\/comments\/$/.test(path)) {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByRole("heading", { name: "지연 응답 영상 A" })).toBeVisible();
    expect(aPlaybackRequests).toBeGreaterThanOrEqual(1);

    aPolicyDriftReleased = true;
    releaseADrift();
    await expect.poll(() => aRefetchRequests, { timeout: 30_000 }).toBe(1);
    await page.evaluate(() => {
      window.history.pushState({}, "", "/student/video/play?video=563&enrollment=1304&session=394");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });

    await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible();
    await expect(page.getByText("B 강의가 종료되어 시청할 수 없습니다.")).toBeVisible();
    await expect(page.getByText("권한 종료 영상 B")).toHaveCount(0);
    const deniedRequestCounts = { bPlaybackRequests, bAccessChecks };

    releaseARefetch();
    await expect.poll(() => aRefetchResponses).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("B 강의가 종료되어 시청할 수 없습니다.")).toBeVisible();
    await expect(page.getByText("권한 종료 영상 B")).toHaveCount(0);
    expect({ bPlaybackRequests, bAccessChecks }).toEqual(deniedRequestCounts);
  });
});
