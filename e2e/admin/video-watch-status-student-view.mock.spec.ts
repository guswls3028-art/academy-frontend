import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const ARTIFACT_DIR = "C:/academy/_artifacts/sessions/godmin-video-student-view-0823";

function jwt(userId: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "godmin",
    user_id: userId,
  })}.sig`;
}

const ADMIN_ACCESS = jwt(12);
const SUPPORT_ACCESS = jwt(99);

type Evidence = {
  supportStarts: Array<{ path: string; authorization: string }>;
  sourceDownloads: string[];
};

async function installApp(page: Page, archived = false): Promise<Evidence> {
  const evidence: Evidence = { supportStarts: [], sourceDownloads: [] };
  let exportRequested = false;
  await installTenantOneInitScript(page);
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, ADMIN_ACCESS);

  const handleApi = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "godmin",
        display_name: "테스트 학원",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      const isSupport = request.headers().authorization === `Bearer ${SUPPORT_ACCESS}`;
      return json(isSupport ? {
        id: 99,
        username: "MOCK-STUDENT",
        name: "테스트학생",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        must_change_password: false,
        first_login_guide_required: false,
      } : {
        id: 12,
        username: "admin",
        name: "테스트관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/media/videos/596/stats/") {
      return json({
        video: {
          id: 596,
          session: 542,
          session_id: 542,
          title: "테스트 영상",
          status: "READY",
          source_type: "file",
          hls_url: null,
          youtube_video_id: null,
          duration: 3600,
          file_size: 1024,
          created_at: "2026-08-23T14:00:00+09:00",
          encoding_progress: 100,
          error_reason: null,
          view_count: 2,
          allow_skip: true,
          max_speed: 2,
          show_watermark: false,
          order: 1,
        },
        students: [
          {
            enrollment: 2001,
            student_id: 1001,
            student_name: "테스트학생",
            progress: 0.36,
            completed: false,
            attendance_status: "PRESENT",
            effective_rule: "free",
            access_mode: "FREE_REVIEW",
            school: "테스트고",
            grade: "2",
          },
          {
            enrollment: 2002,
            student_id: 1002,
            student_name: "긴이름테스트학생",
            progress: 0.92,
            completed: true,
            attendance_status: "ONLINE",
            effective_rule: "once",
            access_mode: "PROCTORED_CLASS",
            school: "테스트여고",
            grade: "3",
          },
          {
            enrollment: 2003,
            student_id: null,
            student_name: "식별정보없는학생",
            progress: 0,
            completed: false,
            attendance_status: "INACTIVE",
            effective_rule: "blocked",
            access_mode: "BLOCKED",
            school: "테스트고",
            grade: "1",
          },
        ],
        total_filtered: 3,
      });
    }
    if (path === "/media/videos/596/engagement/") {
      return json({ view_count: 2, like_count: 0, comment_count: 0 });
    }
    if (path === "/media/videos/596/comments/") {
      return json({ comments: [], total: 0 });
    }
    if (path === "/media/videos/596/source-download/" && request.method() === "POST") {
      evidence.sourceDownloads.push(request.headers().authorization || "");
      if (archived) return json({ code: "video_source_missing", detail: "보관된 원본 파일을 찾을 수 없습니다." }, 404);
      if (evidence.sourceDownloads.length === 1) {
        return json({ detail: "보관된 원본 파일을 찾을 수 없습니다." }, 404);
      }
      return json({
        download_url: "https://video-download.test/source.mov",
        filename: "test-source.mov",
        expires_in: 300,
      });
    }
    if (archived && path === "/media/videos/596/playback-export/") {
      if (request.method() === "GET") return json({ state: exportRequested ? "ready" : "not_requested" });
      if (!exportRequested) {
        exportRequested = true;
        return json({ state: "preparing" }, 202);
      }
      return json({
        state: "ready", download_url: "https://video-download.test/archive.mp4",
        filename: "archive.mp4", expires_in: 300,
      });
    }
    if (path === "/students/1001/support-session/" && request.method() === "POST") {
      evidence.supportStarts.push({
        path,
        authorization: request.headers().authorization || "",
      });
      return json({
        access: SUPPORT_ACCESS,
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        session_id: "11111111-1111-4111-8111-111111111111",
        student: { id: 1001, name: "테스트학생" },
      });
    }
    if (path === "/students/me/support-session/end/" && request.method() === "POST") {
      return json({ ended: true });
    }
    if (/^\/students\/1001\/support-sessions\/[0-9a-f-]+\/end\/$/.test(path)) {
      return json({ ended: true });
    }
    if (path === "/student/dashboard/") {
      return json({
        today_sessions: [],
        upcoming_sessions: [],
        assignments: [],
        exams: [],
        notices: [],
        badges: {},
        tenant_info: null,
      });
    }
    if (path === "/students/me/") {
      return json({ id: 1001, name: "테스트학생", ps_number: "MOCK-STUDENT" });
    }
    if (path === "/students/me/activity/" && request.method() === "POST") {
      return json({ accepted: true }, 202);
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/media/videos/public-session/") return json(null);
    return json([]);
  };

  await page.route("**/api/v1/**", handleApi);
  await page.context().route("**/api/v1/**", handleApi);
  return evidence;
}

test.use({ serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");

test("영상 상세에서 원본 누락 안내 후 첨부 파일을 다운로드할 수 있다", async ({ page, browserName }) => {
  const evidence = await installApp(page);
  await page.route("https://video-download.test/source.mov", (route) => route.fulfill({
    status: 200,
    headers: {
      "content-type": "video/quicktime",
      "content-disposition": 'attachment; filename="test-source.mov"',
    },
    body: "synthetic video attachment",
  }));
  await page.setViewportSize({ width: 1366, height: 900 });
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree?videoId=596&lectureId=502&sessionId=542`, {
    timeout: 45_000,
  });
  const button = page.getByRole("button", { name: "원본 다운로드", exact: true });
  await button.click();
  await expect(page.getByRole("alert").filter({ hasText: "보관된 원본 파일을 찾을 수 없습니다." })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await button.click();
  const saveLink = page.getByRole("link", { name: "파일 저장", exact: true });
  if (browserName === "webkit") {
    // WebKit route.fulfill records the mocked attachment response without producing a native download event.
    const [response] = await Promise.all([
      page.waitForResponse("https://video-download.test/source.mov"),
      saveLink.click(),
    ]);
    expect(response.headers()["content-disposition"]).toBe('attachment; filename="test-source.mov"');
  } else {
    const [download] = await Promise.all([page.waitForEvent("download"), saveLink.click()]);
    expect(download.suggestedFilename()).toBe("test-source.mov");
    expect(await download.failure()).toBeNull();
  }
  expect(evidence.sourceDownloads).toEqual([ADMIN_ACCESS, ADMIN_ACCESS].map((token) => `Bearer ${token}`));
  await expect(page.getByText("보관된 원본 파일을 찾을 수 없습니다.")).toHaveCount(0);
});

test("원본이 없는 영상은 재생본을 준비하고 준비가 끝나면 MP4를 받을 수 있다", async ({ page }) => {
  await installApp(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree?videoId=596&lectureId=502&sessionId=542`, {
    timeout: 45_000,
  });
  await page.getByRole("button", { name: "원본 다운로드", exact: true }).click();
  await page.getByRole("button", { name: "재생본 MP4 준비" }).click();
  await expect(page.getByRole("status").filter({ hasText: "재생본을 준비하고 있습니다." })).toBeVisible();
  await page.getByRole("button", { name: "재생본 받기" }).click({ timeout: 15_000 });
  const link = page.getByRole("link", { name: "파일 저장" });
  await expect(link).toHaveAttribute("download", "archive.mp4");
  await expect(link).toHaveAttribute("href", "https://video-download.test/archive.mp4");
});

test("영상 시청 현황은 학생별 명시적 화면 보기와 반응형 운영 위계를 제공한다", async ({ page }) => {
  const evidence = await installApp(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await gotoAndSettle(
    page,
    `${BASE}/workspace/videos/tree?videoId=596&lectureId=502&sessionId=542`,
    { timeout: 45_000 },
  );

  const watchStatus = page.getByRole("region", { name: "학생 시청 현황" });
  await expect(watchStatus).toBeVisible();
  await expect(watchStatus.getByRole("button", { name: "권한 관리" })).toHaveCount(1);
  await expect(watchStatus.getByRole("button", { name: "테스트학생 학생 화면 보기", exact: true })).toBeVisible();
  await expect(watchStatus.getByText("현장", { exact: true })).toBeVisible();
  await expect(watchStatus.getByText("복습", { exact: true })).toBeVisible();
  await expect(watchStatus.getByRole("progressbar", { name: "테스트학생 진도 36%", exact: true })).toBeVisible();
  const studentRows = watchStatus.getByRole("listitem");
  await expect(studentRows).toHaveCount(3);
  await expect(studentRows.first().getByRole("button")).toHaveCount(1);
  const unavailableRow = studentRows.filter({ hasText: "식별정보없는학생" });
  const unavailableButton = unavailableRow.getByRole("button", { name: "식별정보없는학생 학생 화면 보기" });
  await expect(unavailableButton).toBeDisabled();
  await expect(unavailableRow.getByText("학생 정보를 확인할 수 없어 화면을 열 수 없습니다.", { exact: true })).toBeVisible();

  if (process.env.CAPTURE_VIDEO_WATCH_STATUS === "1") {
    await page.screenshot({
      path: `${ARTIFACT_DIR}/video-watch-status-desktop.png`,
      fullPage: false,
    });
  }

  const popupPromise = page.waitForEvent("popup");
  await watchStatus.getByRole("button", { name: "테스트학생 학생 화면 보기", exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/\/student\/dashboard\?supportPreview=1$/, { timeout: 30_000 });
  await expect.poll(() => evidence.supportStarts).toEqual([{
    path: "/students/1001/support-session/",
    authorization: `Bearer ${ADMIN_ACCESS}`,
  }]);
  await popup.close();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileWatchStatus = page.getByRole("region", { name: "학생 시청 현황" });
  await expect(mobileWatchStatus).toBeVisible();
  await expect(mobileWatchStatus.getByRole("button", { name: "긴이름테스트학생 학생 화면 보기", exact: true })).toBeVisible();
  await expect(mobileWatchStatus.getByText("학생 정보를 확인할 수 없어 화면을 열 수 없습니다.", { exact: true })).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
  if (process.env.CAPTURE_VIDEO_WATCH_STATUS === "1") {
    await mobileWatchStatus.screenshot({
      path: `${ARTIFACT_DIR}/video-watch-status-mobile.png`,
    });
  }
});
