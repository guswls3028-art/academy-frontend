import { type Locator, type Page, type TestInfo } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";
import { assertInteractiveSurface } from "../helpers/assertInteractiveSurface";
import { captureGuideEvidence } from "../helpers/guideEvidence";
import { verifyFeatureGuideImages } from "../helpers/featureGuideEvidence";
import { verifyStudentLearningSummary } from "../helpers/studentLearningSummary";
import type { StudentGradeReportLayout } from "../../src/shared/api/contracts/studentGradeReportLayout";

const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const API_BASE = getApiBaseUrl().replace(/\/+$/, "");

async function verifyStudentAnalysisAndVideo(page: Page) {
  const [gradeResponse] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/student/grades/" && response.ok()),
    page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" }),
  ]);
  const { report_layout: layout } = await gradeResponse.json() as { report_layout?: StudentGradeReportLayout };
  const analysis = page.getByRole("tab", { name: "추이 분석", exact: true });
  const hasComparison = layout?.sections.some((section) => section.visible
    && ["score_comparison", "lecture_average", "improvement_priority"].includes(section.id)) ?? true;
  if (hasComparison) {
    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/student/grades/analytics/" && response.ok()),
      analysis.click(),
    ]);
  } else {
    await analysis.click();
  }
  await expect(analysis).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "성장 그래프", exact: true })).toBeVisible();
  if (layout?.sections.find((section) => section.id === "score_trend")?.visible !== false) {
    await expect(page.getByRole("region", { name: "회차별 성적 추이", exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "비교 분석 다시 시도" })).toHaveCount(0);

  await page.goto(`${BASE}/student/exams`, { waitUntil: "domcontentloaded" });
  const examAnalysis = page.getByRole("tab", { name: "결과 분석", exact: true });
  await examAnalysis.click();
  const examResult = page.getByRole("tabpanel", { name: "결과 분석", exact: true });
  const examReady = examResult.getByText("총 시험", { exact: true })
    .or(examResult.getByText("시험 데이터가 없습니다.", { exact: true }));
  await expect(examReady).toBeVisible();
  await page.reload();
  await expect(examAnalysis).toHaveAttribute("aria-selected", "true");
  await expect(examReady).toBeVisible();

  const [videoResponse] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/student/video/me/" && response.ok()),
    page.getByRole("navigation", { name: "하단 메뉴" }).getByRole("link", { name: "영상", exact: true }).click(),
  ]);
  await expect(page).toHaveURL(`${BASE}/student/video`);
  const catalog = page.getByRole("tabpanel", { name: "강의", exact: true });
  await expect(catalog.locator(".video-course-grid").or(catalog.getByText("등록된 영상이 없습니다", { exact: true }))).toBeVisible();
  const videoCatalog = await videoResponse.json() as {
    public?: { thumbnail_url?: string | null } | null;
    lectures?: { thumbnail_url?: string | null }[];
  };
  if ([videoCatalog.public, ...(videoCatalog.lectures ?? [])].some((item) =>
    /^https:\/\/cdn\.hakwonplus\.com\/tenants\/\d+\/video\/hls\/\d+\/thumbnail\.jpg\?/.test(item?.thumbnail_url ?? ""))) {
    const poster = catalog.locator('img[src^="https://cdn.hakwonplus.com/"][src*="/thumbnail.jpg?"]').first();
    await poster.scrollIntoViewIfNeeded();
    await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
  await page.getByRole("tab", { name: "통계", exact: true }).click();
  const videoStats = page.getByRole("tabpanel", { name: "통계", exact: true });
  await expect(videoStats.getByText("학습 완주율", { exact: true })
    .or(videoStats.getByText("시청 기록이 없습니다", { exact: true }))).toBeVisible();
  expect(await page.locator("html").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
}

async function verifyGuideJourney(
  page: Page,
  testInfo: TestInfo,
  guide: { scope: string; path: string; topic: string; title: string; target: string; targetReady: Locator },
) {
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const guideUrl = `${BASE}${guide.path}?topic=${guide.topic}`;
    await page.goto(guideUrl, { waitUntil: "domcontentloaded" });
    const article = page.getByRole("article", { name: guide.title });
    await expect(article.getByRole("heading", { name: "여기까지 확인하면 완료" })).toBeVisible();
    const action = article.getByRole("link", { name: `${guide.title} 화면 열기` });
    await assertInteractiveSurface(page, article, action);
    await captureGuideEvidence(article, action, testInfo, `live-guide-${guide.scope}-${width}`);
    const media = article.getByRole("region", { name: "화면으로 따라하기" });
    await expect(media).toBeVisible();
    const photo = media.locator("figure img");
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const firstPhoto = await photo.getAttribute("src");
    await media.getByRole("button", { name: "다음 화면 →", exact: true }).click();
    await expect(photo).not.toHaveAttribute("src", firstPhoto!);
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await testInfo.attach(`live-guide-${guide.scope}-${width}-photo`, {
      body: await photo.screenshot({ path: testInfo.outputPath(`live-guide-${guide.scope}-${width}-photo.png`) }), contentType: "image/png",
    });
    await media.locator("summary").click();
    const video = media.locator("video");
    await video.scrollIntoViewIfNeeded();
    await video.evaluate((element: HTMLVideoElement) => element.play());
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.2);
    await video.evaluate((element: HTMLVideoElement) => { element.currentTime = Math.min(5, element.duration / 2); });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.seeking)).toBe(false);
    await video.evaluate((element: HTMLVideoElement) => { element.textTracks[0].mode = "hidden"; });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.textTracks[0].cues?.length ?? 0)).toBeGreaterThan(1);
    await testInfo.attach(`live-guide-${guide.scope}-${width}-video`, {
      body: await video.screenshot({ path: testInfo.outputPath(`live-guide-${guide.scope}-${width}-video.png`) }), contentType: "image/png",
    });
    await media.locator("summary").click();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await action.click();
    await expect(page).toHaveURL(`${BASE}${guide.target}`);
    await expect(guide.targetReady).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(guideUrl);
    await expect(article).toBeVisible();
    await page.reload();
    await expect(article).toBeVisible();
    await expect(photo).toHaveAttribute("src", firstPhoto!);
    if (guide.scope !== "student") {
      await verifyFeatureGuideImages(page, testInfo, `live-guide-${guide.scope}-${width}-feature-reader`);
    }
  }
}

async function verifyStudentClinicSchedule(page: Page) {
  const completedClinicRead = (path: string) => page.waitForResponse((response) =>
    new URL(response.url()).pathname === path && response.request().method() === "GET" && response.status() === 200);
  await Promise.all([
    completedClinicRead("/api/v1/clinic/sessions/"),
    completedClinicRead("/api/v1/clinic/participants/"),
    page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" }),
  ]);
  await expect(page.getByRole("grid", { name: "클리닉 월간 일정" })).toBeVisible();
  const schedule = page.getByRole("tab", { name: /^내 일정(?:\s+\d+)?$/ });
  await schedule.click();
  await expect(schedule).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "내 일정", exact: true })).toBeVisible();
  expect(await page.locator("html").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
}

function trackedHostnames(): Set<string> {
  const hosts = new Set<string>();
  for (const url of [BASE, API_BASE]) {
    try {
      hosts.add(new URL(url).hostname);
    } catch {
      // Ignore malformed env input; the actual navigation/API assertions will fail.
    }
  }
  return hosts;
}

function attachProductionRequestGuard(page: Page) {
  const hostnames = trackedHostnames();
  const defects: string[] = [];

  function shouldTrack(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && hostnames.has(parsed.hostname);
    } catch {
      return false;
    }
  }

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!shouldTrack(url)) return;
    const errorText = request.failure()?.errorText || "unknown";
    if (errorText === "net::ERR_ABORTED") return;
    defects.push(`${request.method()} ${url} failed: ${errorText}`);
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!shouldTrack(url)) return;
    const request = response.request();
    const status = response.status();
    const resourceType = request.resourceType();
    const isApiResponse = (() => {
      try {
        return new URL(url).hostname === new URL(API_BASE).hostname;
      } catch {
        return false;
      }
    })();
    const isCriticalFrontAsset = ["document", "script", "stylesheet", "fetch", "xhr"].includes(resourceType);
    if (status >= 500 || (status >= 400 && (isApiResponse || isCriticalFrontAsset))) {
      defects.push(`${status} ${request.method()} ${resourceType} ${url}`);
    }
  });

  return {
    assertClean() {
      expect(defects, `Production request defects:\n${defects.join("\n")}`).toEqual([]);
    },
  };
}

test.describe("Production canary", () => {
  test("API healthz responds", async ({ request }) => {
    const resp = await request.get(`${API_BASE}/healthz`, { timeout: 30_000 });
    expect(resp.status()).toBe(200);
  });

  test("public promo page renders without browser or request defects", async ({ page }) => {
    const guard = attachProductionRequestGuard(page);

    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(`${BASE}/promo`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      expect(response?.ok(), `Unexpected /promo status ${response?.status()}`).toBe(true);
      await expect(page.getByRole("heading", { name: /학원의 모든 기록을/ })).toBeVisible();
      const showcase = page.getByTestId("promo-real-product-showcase");
      for (const name of [/합성 학생 출결 상태/, /오늘 수업과 다음 일정/]) {
        const trigger = showcase.getByRole("button", { name });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "실제 화면 크게 보기" });
        await expect(dialog.getByRole("img", { name })).toBeVisible();
        await expect.poll(() => dialog.getByRole("img").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
      }
      expect(await page.locator("html").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    }
    guard.assertClean();
  });

  test("public feature tab opens the image guide at desktop and mobile widths", async ({ page }, testInfo) => {
    const guard = attachProductionRequestGuard(page);
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}/promo/features`, { waitUntil: "domcontentloaded" });
      await page.getByRole("main").getByRole("link", { name: "기능 상세 가이드", exact: true }).click();
      await expect(page).toHaveURL(`${BASE}/promo/features/tour`);
      await verifyFeatureGuideImages(page, testInfo, `live-guide-public-${width}-feature-reader`);
    }
    guard.assertClean();
  });

  test("admin dashboard login survives production edge", async ({ page }, testInfo) => {
    test.setTimeout(420_000);
    const guard = attachProductionRequestGuard(page);

    await loginViaUI(page, "admin", { landingPath: "/workspace/dashboard" });

    expect(page.url()).toMatch(/\/(workspace|dev)(\/|$)/);
    await expect(page.locator("nav, [class*='sidebar'], [class*='header'], main").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "오늘 처리할 일", exact: true })).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    await page.goto(`${BASE}/admin/dashboard?compat=1#legacy-full`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page).toHaveURL(
      `${BASE}/workspace/dashboard?compat=1#legacy-full`,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("heading", { name: "오늘 처리할 일", exact: true })).toBeVisible();

    await page.goto(`${BASE}/teacher/classes?compat=1#legacy-mobile`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page).toHaveURL(
      `${BASE}/workspace/mobile/classes?compat=1#legacy-mobile`,
      { timeout: 15_000 },
    );
    // The redirect URL arrives before lazy route chunks and the lecture query.
    // Keep the context alive until the destination is usable; teardown must not
    // manufacture blocked static-asset errors or hide an unfinished route.
    await expect(page.getByRole("heading", { name: "강의 관리", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^강의목록 \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "강의 추가", exact: true })).toBeEnabled();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await verifyGuideJourney(page, testInfo, {
      scope: "admin", path: "/workspace/guide", topic: "homework",
      title: "과제 배정·제출 확인·평가", target: "/workspace/lectures",
      targetReady: page.getByRole("button", { name: "강의 추가", exact: true }),
    });
    await verifyGuideJourney(page, testInfo, {
      scope: "teacher", path: "/workspace/mobile/guide", topic: "attendance",
      title: "모바일 출결 입력", target: "/workspace/mobile/classes",
      targetReady: page.getByRole("heading", { name: "강의 관리", exact: true }),
    });
    // PR checks still observe the currently deployed version. The release job runs
    // these assertions only after verifying this candidate's exact live version.
    if (process.env.E2E_RELEASE_API_MODE === "readonly") {
      for (const width of [1366, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`${BASE}/workspace/clinic/schedule`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "지난 일정 불러오기", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "지난 일정 불러오기" });
        await expect(dialog.getByLabel("가져올 주의 날짜", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "4주 전", exact: true }).click();
        await expect(dialog.locator(".clinic-import__loading")).toHaveCount(0);
        await expect(dialog.getByRole("alert")).toHaveCount(0);
        await expect(dialog.getByRole("button", { name: "선택하세요", exact: true })).toBeDisabled();
        await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeInViewport();
        expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        // Do not retain production schedule titles, locations, or background data.
        await testInfo.attach(`live-clinic-import-${width}`, {
          body: await dialog.screenshot({ mask: [dialog.locator(".clinic-import__list")] }), contentType: "image/png",
        });
        await dialog.getByRole("button", { name: "취소", exact: true }).click();
        await expect(dialog).toHaveCount(0);
      }
    }
    guard.assertClean();
  });

  test("student dashboard login survives production edge", async ({ page }, testInfo) => {
    test.setTimeout(420_000);
    const guard = attachProductionRequestGuard(page);

    await loginViaUI(page, "student", { landingPath: "/student/dashboard" });

    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await verifyStudentLearningSummary(page, BASE);
      await verifyStudentAnalysisAndVideo(page);
      if (process.env.E2E_RELEASE_API_MODE === "readonly") await verifyStudentClinicSchedule(page);
    }

    expect(page.url()).toMatch(/\/student(\/|$)/);
    await expect(page.locator("[class*='tabbar'], [class*='tab-bar'], nav, main").first()).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await verifyGuideJourney(page, testInfo, {
      scope: "student", path: "/student/guide", topic: "submit-assignment",
      title: "과제 사진·동영상 제출", target: "/student/submit/assignment",
      targetReady: page.getByRole("heading", { name: "과제 제출", exact: true }),
    });
    guard.assertClean();
  });
});
