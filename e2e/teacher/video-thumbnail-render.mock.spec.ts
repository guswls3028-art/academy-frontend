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

test.describe("teacher session video thumbnails", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });

  test("강의 차시의 영상 카드가 API thumbnail_url 이미지를 표시한다", async ({ page }, testInfo) => {
    const lecture = {
      id: 215,
      title: "26-1 F 언남고 생명과학",
      subject: "생명과학",
      lecture_time: "18:00~21:30",
      start_date: "2026-05-14",
      end_date: "2026-07-02",
      color: "#7c3aed",
      chip_label: "26",
      is_active: true,
    };
    const session = {
      id: 245,
      lecture: lecture.id,
      order: 3,
      regular_order: 3,
      session_type: "REGULAR",
      title: "3차시",
      display_label: "3차시",
      date: "2026-05-28",
      lecture_title: lecture.title,
      lecture_color: lecture.color,
      lecture_chip_label: lecture.chip_label,
    };
    const videos = [
      {
        id: 448,
        title: "3회차 두각 언남고 생식세포 형성과 유전적 다양성 - 1",
        status: "READY",
        thumbnail_url: "/e2e/video-448-thumbnail.svg",
      },
      {
        id: 449,
        title: "3회차 두각 언남고 생식세포 형성과 유전적 다양성 - 2",
        status: "READY",
        thumbnail_url: "/e2e/video-449-thumbnail.svg",
      },
    ];
    const fallbackVideos = [
      {
        id: 450,
        title: "썸네일 없는 영상",
        status: "READY",
        thumbnail_url: null,
      },
      {
        id: 451,
        title: "썸네일 로드 실패 영상",
        status: "READY",
        thumbnail_url: "/e2e/broken-thumbnail.jpg",
      },
    ];

    await page.addInitScript(({ access, refresh }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
      localStorage.setItem("teacher:preferAdmin", "0");
    }, { access: fakeJwt(), refresh: fakeJwt() });

    await page.route("**/e2e/video-*-thumbnail.svg", async (route) => {
      const color = route.request().url().includes("448") ? "#7c3aed" : "#2563eb";
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="${color}"/></svg>`,
      });
    });
    await page.route("**/e2e/broken-thumbnail.jpg", (route) => route.fulfill({ status: 404 }));

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown) => route.fulfill({ json: body });

      if (path === "/core/program/") {
        return json({
          tenantCode: "hakwonplus",
          display_name: "박철 과학",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 2,
          username: "teacher",
          name: "박철",
          is_staff: true,
          is_superuser: false,
          tenantRole: "teacher",
          must_change_password: false,
        });
      }
      if (path === `/lectures/lectures/${lecture.id}/`) return json(lecture);
      if (path === "/lectures/lectures/") {
        return json(url.searchParams.get("is_active") === "true"
          ? { count: 1, results: [lecture] }
          : { count: 0, results: [] });
      }
      if (path === `/lectures/sessions/${session.id}/`) return json(session);
      if (path === "/lectures/sessions/") {
        return json(url.searchParams.get("lecture") === String(lecture.id)
          ? { count: 1, results: [session] }
          : { count: 0, results: [] });
      }
      if (path === "/media/videos/") {
        const requestedSession = url.searchParams.get("session");
        const isVideoListRequest = requestedSession == null && !url.searchParams.has("status");
        if (requestedSession === String(session.id)) {
          return json({ count: videos.length, results: videos });
        }
        if (isVideoListRequest) {
          const results = [...videos, ...fallbackVideos];
          return json({ count: results.length, results });
        }
        return json({ count: 0, results: [] });
      }

      return json({ count: 0, results: [] });
    });

    await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "강의", exact: true }).click();
    await expect(page.getByRole("heading", { name: "강의 관리", exact: true })).toBeVisible();

    await page.getByText(lecture.title, { exact: true }).click();
    await expect(page.getByRole("heading", { name: lecture.title, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "3 3차시 2026-05-28", exact: true }).click();
    await expect(page.getByRole("heading", { name: "3차시", exact: true })).toBeVisible();

    await page.locator("main").getByRole("button", { name: "영상", exact: true }).click();

    for (const video of videos) {
      const thumbnail = page.locator(`img[src="${video.thumbnail_url}"]`);
      await expect(thumbnail).toBeVisible();
      await expect(thumbnail).toHaveAttribute("src", video.thumbnail_url);
      await expect.poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }

    await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 900 });

    for (const video of videos) {
      await expect(page.locator(`img[src="${video.thumbnail_url}"]`)).toBeVisible();
    }

    await page.screenshot({ path: testInfo.outputPath("desktop-session.png"), fullPage: true });

    const videoMenu = page
      .getByRole("navigation", { name: "선생님 메뉴" })
      .getByRole("button", { name: "영상", exact: true });
    await expect(videoMenu).toHaveCount(1);
    await videoMenu.click();
    await expect(page.getByRole("heading", { name: "영상", exact: true })).toBeVisible();

    for (const video of videos) {
      const thumbnail = page.locator(`img[src="${video.thumbnail_url}"]`);
      await expect(thumbnail).toBeVisible();
      await expect.poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    for (const video of fallbackVideos) {
      await expect(page.getByRole("button", { name: video.title, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("video-thumbnail")).toHaveCount(4);
    await expect(page.getByTestId("video-thumbnail").locator("img")).toHaveCount(2);

    await page.screenshot({ path: testInfo.outputPath("desktop-video-list.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "영상", exact: true })).toBeVisible();

    for (const video of videos) {
      await expect(page.locator(`img[src="${video.thumbnail_url}"]`)).toBeVisible();
    }
    for (const video of fallbackVideos) {
      await expect(page.getByRole("button", { name: video.title, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("video-thumbnail")).toHaveCount(4);
    await expect(page.getByTestId("video-thumbnail").locator("img")).toHaveCount(2);

    await page.screenshot({ path: testInfo.outputPath("mobile-video-list.png"), fullPage: true });
  });
});
