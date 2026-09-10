import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";


const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 8401;
const SESSION_ID = 8402;

type VideoRow = {
  id: number;
  title: string;
  source_type: "s3";
  file: null;
  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;
  order: number;
  status: "READY";
  created_at: string;
};

type MockState = {
  videos: VideoRow[];
  bulkPayloads: Array<Record<string, unknown>>;
  patchPayloads: Array<{ id: number; payload: Record<string, unknown> }>;
  failNextBulk?: boolean;
};

type Viewer = "admin" | "student";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page, state: MockState, viewer: Viewer = "admin") {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json(viewer === "admin"
        ? {
            id: 12,
            username: "admin",
            name: "관리자",
            is_staff: true,
            is_superuser: true,
            tenantRole: "admin",
            must_change_password: false,
          }
        : {
            id: 8600,
            username: "policy-student",
            name: "정책 확인 학생",
            is_staff: false,
            is_superuser: false,
            tenantRole: "student",
            must_change_password: false,
          });
    }
    if (path === "/student/me/") {
      return json({
        id: 8600,
        username: "policy-student",
        name: "정책 확인 학생",
        ps_number: "policy-student",
        is_student: true,
        isParentReadOnly: false,
      });
    }
    if (path === `/lectures/lectures/${LECTURE_ID}/`) {
      return json({
        id: LECTURE_ID,
        title: "중3 과학",
        name: "중3 과학",
        subject: "SCIENCE",
        start_date: "2026-09-01",
        end_date: "2026-12-31",
      });
    }
    if (path === `/lectures/sessions/${SESSION_ID}/`) {
      return json({
        id: SESSION_ID,
        lecture: LECTURE_ID,
        title: "3회차 명인 통과연합 발전과 에너지원",
        display_label: "3회차",
        order: 3,
        regular_order: 3,
        session_type: "REGULAR",
        date: "2026-09-07",
      });
    }
    if (path === "/lectures/sessions/" && method === "GET") {
      return json([{
        id: SESSION_ID,
        lecture: LECTURE_ID,
        title: "3회차 명인 통과연합 발전과 에너지원",
        display_label: "3회차",
        order: 3,
        regular_order: 3,
        session_type: "REGULAR",
        date: "2026-09-07",
      }]);
    }
    if (path === "/media/videos/" && method === "GET") {
      return json({ count: state.videos.length, results: state.videos });
    }
    if (path === `/student/video/sessions/${SESSION_ID}/videos/` && method === "GET") {
      return json({
        items: state.videos.map((video) => ({
          ...video,
          session_id: SESSION_ID,
          enrollment_id: 8601,
          duration: 1_800,
          progress: 0,
          completed: false,
          last_position: 0,
          access_mode: "PROCTORED_CLASS",
        })),
      });
    }
    const playbackMatch = path.match(/^\/student\/video\/videos\/(\d+)\/playback\/$/);
    if (playbackMatch && method === "GET" && url.searchParams.get("access_check") === "1") {
      return json({
        ok: true,
        access_mode: "PROCTORED_CLASS",
        monitoring_enabled: true,
        policy_version: 7,
      });
    }
    if (playbackMatch && method === "POST") {
      const video = state.videos.find((row) => row.id === Number(playbackMatch[1]));
      if (!video) return json({ detail: "영상을 찾을 수 없습니다." }, 404);
      return json({
        video: {
          ...video,
          session_id: SESSION_ID,
          enrollment_id: 8601,
          duration: 1_800,
          progress: 0,
          completed: false,
          last_position: 0,
          access_mode: "PROCTORED_CLASS",
        },
        play_url: `https://cdn.example.test/videos/${video.id}/master.m3u8`,
        hls_url: `https://cdn.example.test/videos/${video.id}/master.m3u8`,
        playback_token: "policy-playback-token",
        playback_session_id: "policy-playback-session",
        playback_expires_at: Math.floor(Date.now() / 1_000) + 600,
        policy_version: 7,
        policy: {
          access_mode: "PROCTORED_CLASS",
          monitoring_enabled: true,
          allow_seek: video.allow_skip,
          playback_rate: { max: video.max_speed, ui_control: true },
          watermark: { enabled: video.show_watermark, mode: "overlay", fields: [] },
          source: { type: "s3", provider: "uploaded" },
        },
      });
    }
    if (path.match(/^\/student\/video\/videos\/\d+\/progress\/$/) && method === "POST") {
      const payload = request.postDataJSON() as { progress?: number; last_position?: number };
      return json({
        video_id: Number(path.split("/")[4]),
        enrollment_id: 8601,
        progress: payload.progress ?? 0,
        last_position: payload.last_position ?? 0,
        completed: false,
      });
    }
    if (path === "/students/me/activity/" && method === "POST") return json({ ok: true });
    if (path.includes("/playback/") && method === "POST") return json({ ok: true });
    if (path.match(/^\/student\/video\/videos\/\d+\/comments\/$/)) {
      return json({ comments: [], total: 0 });
    }
    if (path === "/media/videos/bulk-policy/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.bulkPayloads.push(payload);
      if (state.failNextBulk) {
        state.failNextBulk = false;
        return json({ detail: "정책을 저장하지 못했습니다. 다시 시도해 주세요." }, 503);
      }
      const ids = new Set(payload.video_ids as number[]);
      state.videos = state.videos.map((video) => ids.has(video.id) ? {
        ...video,
        ...(typeof payload.allow_skip === "boolean" ? { allow_skip: payload.allow_skip } : {}),
        ...(typeof payload.max_speed === "number" ? { max_speed: payload.max_speed } : {}),
      } : video);
      return json({ updated: ids.size, changed: ids.size });
    }
    const detailMatch = path.match(/^\/media\/videos\/(\d+)\/$/);
    if (detailMatch && method === "PATCH") {
      const id = Number(detailMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.patchPayloads.push({ id, payload });
      state.videos = state.videos.map((video) => (
        video.id === id ? { ...video, ...payload } as VideoRow : video
      ));
      return json(state.videos.find((video) => video.id === id));
    }
    if (path === "/enrollments/") return json([]);
    if (path === "/lectures/sections/") return json([]);
    if (path === "/lectures/attendance/") return json({ count: 0, results: [] });
    if (path === "/results/admin/clinic-targets/") return json([]);
    if (path === "/staffs/currently-working/") return json([]);
    return json({ count: 0, results: [] });
  });
}

async function openVideos(page: Page, state: MockState) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "영상 일괄 정책 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/videos`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await expect(page.getByRole("button", { name: "영상 추가", exact: true }).first())
    .toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("발전과 에너지원1", { exact: true })).toBeVisible();
}

async function openStudentPolicy(page: Page, state: MockState) {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await page.route("https://cdn.example.test/**", async (route) => {
    await new Promise<void>((resolve) => page.once("close", resolve));
    try {
      await route.abort();
    } catch {
      // Page teardown may have already disposed the pending media request.
    }
  });
  await installApi(page, state, "student");
  await page.goto(
    `${BASE}/student/video/play?video=8501&session=${SESSION_ID}&enrollment=8601`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await expect(page.getByRole("heading", { name: "발전과 에너지원1" })).toBeVisible({ timeout: 60_000 });
}

function makeState(): MockState {
  return {
    videos: [
      {
        id: 8501,
        title: "발전과 에너지원1",
        source_type: "s3",
        file: null,
        allow_skip: false,
        max_speed: 1,
        show_watermark: true,
        order: 1,
        status: "READY",
        created_at: "2026-09-07T12:00:00Z",
      },
      {
        id: 8502,
        title: "발전과 에너지원2",
        source_type: "s3",
        file: null,
        allow_skip: false,
        max_speed: 1,
        show_watermark: true,
        order: 2,
        status: "READY",
        created_at: "2026-09-07T12:05:00Z",
      },
    ],
    bulkPayloads: [],
    patchPayloads: [],
  };
}

test("현재 영상 전체의 건너뛰기와 배속을 일괄 저장하고 새로고침 뒤 학생 정책에도 반영한다", async ({ page, browser }) => {
  const state = makeState();
  await page.setViewportSize({ width: 1366, height: 768 });
  await openVideos(page, state);

  await expect(page.getByText("수강 중 자유 건너뛰기 제한", { exact: true })).toHaveCount(2);
  const selectAll = page.getByRole("checkbox", { name: "현재 목록 전체 선택" });
  await selectAll.check();
  await expect(page.getByText("2개 선택", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "선택한 영상 설정" }).click();

  const dialog = page.getByRole("dialog", { name: "영상 일괄 재생 설정" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("개별 학생 권한을 설정한 경우 학생별 설정이 우선합니다.")).toBeVisible();
  await dialog.getByLabel("건너뛰기 설정").selectOption("true");
  await dialog.getByLabel("최대 배속 설정").selectOption("1.5");
  await dialog.getByRole("button", { name: "2개 영상에 적용" }).click();

  await expect.poll(() => state.bulkPayloads).toEqual([{
    session_id: SESSION_ID,
    video_ids: [8501, 8502],
    allow_skip: true,
    max_speed: 1.5,
  }]);
  await expect(dialog).toBeHidden();
  await expect(selectAll).not.toBeChecked();
  await expect(page.getByText("자유 건너뛰기 허용", { exact: true })).toHaveCount(2);
  await expect(page.getByText("최대 1.50x", { exact: true })).toHaveCount(2);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("자유 건너뛰기 허용", { exact: true })).toHaveCount(2);
  await expect(page.getByText("최대 1.50x", { exact: true })).toHaveCount(2);

  const studentContext = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    serviceWorkers: "block",
  });
  const studentPage = await studentContext.newPage();
  try {
    await openStudentPolicy(studentPage, state);
    await expect(studentPage.getByText("자유롭게 이동 가능", { exact: true })).toBeVisible();
    await expect(studentPage.getByText("최대 1.5x까지 가능", { exact: true })).toBeVisible();
    await studentPage.reload({ waitUntil: "domcontentloaded" });
    await expect(studentPage.getByText("자유롭게 이동 가능", { exact: true })).toBeVisible();
    await expect(studentPage.getByText("최대 1.5x까지 가능", { exact: true })).toBeVisible();
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await studentContext.close();
  }
});

test("390px에서도 영상 일괄 설정을 저장하고 새로고침 후 유지한다", async ({ page }) => {
  const state = makeState();
  await page.setViewportSize({ width: 390, height: 844 });
  await openVideos(page, state);

  await page.getByRole("checkbox", { name: "현재 목록 전체 선택" }).check();
  await page.getByRole("button", { name: "선택한 영상 설정" }).click();
  const dialog = page.getByRole("dialog", { name: "영상 일괄 재생 설정" });
  await dialog.getByLabel("건너뛰기 설정").selectOption("true");
  await dialog.getByLabel("최대 배속 설정").selectOption("2");
  await dialog.getByRole("button", { name: "2개 영상에 적용" }).click();

  await expect.poll(() => state.bulkPayloads).toEqual([{
    session_id: SESSION_ID,
    video_ids: [8501, 8502],
    allow_skip: true,
    max_speed: 2,
  }]);
  await expect(page.getByText("자유 건너뛰기 허용", { exact: true })).toHaveCount(2);
  await expect(page.getByText("최대 2.00x", { exact: true })).toHaveCount(2);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("자유 건너뛰기 허용", { exact: true })).toHaveCount(2);
  await expect(page.getByText("최대 2.00x", { exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("단일 영상 수정에서 재생 정책을 함께 바꾸고 실제 PATCH로 저장한다", async ({ page }) => {
  const state = makeState();
  await openVideos(page, state);

  await page.getByRole("button", { name: "발전과 에너지원1 수정" }).click();
  const dialog = page.getByRole("dialog", { name: "영상 정보 수정" });
  await dialog.getByLabel("건너뛰기 설정").selectOption("true");
  await dialog.getByLabel("최대 배속 설정").selectOption("1.25");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();

  await expect.poll(() => state.patchPayloads).toEqual([{
    id: 8501,
    payload: { allow_skip: true, max_speed: 1.25 },
  }]);
  await expect(page.getByText("자유 건너뛰기 허용", { exact: true })).toHaveCount(1);
  await expect(page.getByText("최대 1.25x", { exact: true })).toHaveCount(1);
});

test("모바일 실패는 선택과 입력을 보존하고 오류를 표시하며 키보드 닫기 후 포커스를 복원한다", async ({ page }, testInfo) => {
  const state = makeState();
  state.failNextBulk = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await openVideos(page, state);

  const firstSelection = page.getByRole("checkbox", { name: "발전과 에너지원1 선택" });
  await firstSelection.check();
  const openButton = page.getByRole("button", { name: "선택한 영상 설정" });
  await openButton.click();
  const dialog = page.getByRole("dialog", { name: "영상 일괄 재생 설정" });
  await dialog.getByLabel("건너뛰기 설정").selectOption("true");
  await dialog.getByRole("button", { name: "1개 영상에 적용" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("정책을 저장하지 못했습니다. 다시 시도해 주세요.");
  await expect(dialog.getByLabel("건너뛰기 설정")).toHaveValue("true");
  await expect(firstSelection).toBeChecked();
  const metrics = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth + 1);
  for (const control of [
    dialog.getByLabel("건너뛰기 설정"),
    dialog.getByLabel("최대 배속 설정"),
    dialog.getByRole("button", { name: "1개 영상에 적용" }),
  ]) {
    await expect.poll(async () => {
      const box = await control.boundingBox();
      return box?.height ?? 0;
    }).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({
    path: testInfo.outputPath("video-bulk-policy-error-390.png"),
    fullPage: true,
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(openButton).toBeFocused();
  await expect(firstSelection).toBeChecked();
  await page.close();
});
