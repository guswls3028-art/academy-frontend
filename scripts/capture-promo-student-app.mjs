import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const baseUrl = (process.env.PROMO_CAPTURE_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const outputDir = resolve(process.cwd(), "public", "promo");
const thumbnailOne = `${baseUrl}/promo/student-video-thumb-calculus.svg`;
const thumbnailTwo = `${baseUrl}/promo/student-video-thumb-sequence.svg`;
const previewVideoUrl = `${baseUrl}/promo/.student-video-preview.capture.mp4`;
const previewVideoPath = resolve(outputDir, ".student-video-preview.capture.mp4");
const temporaryDir = mkdtempSync(join(tmpdir(), "hakwonplus-promo-capture-"));
const previewFramePath = join(temporaryDir, "student-video-preview.png");

const pad = (value) => String(value).padStart(2, "0");
const toLocalYmd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const examDay = new Date(today);
examDay.setDate(today.getDate() + 2);
const recentClassDates = [7, 14, 21, 27].map((daysAgo) => {
  const date = new Date(today);
  date.setDate(today.getDate() - daysAgo);
  return toLocalYmd(date);
});

const dashboard = {
  notices: [
    {
      id: 3101,
      title: "고2 내신 심화반 8월 수업 안내",
      created_at: today.toISOString(),
      is_urgent: false,
    },
  ],
  today_sessions: [
    {
      id: 901,
      title: "고2 내신 심화반",
      date: toLocalYmd(today),
      status: "scheduled",
      type: "session",
      start_time: "18:30:00",
    },
  ],
  badges: { clinic_upcoming: false },
  tenant_info: {
    name: "학원플러스 대치관",
    phone: "02-000-0000",
    headquarters_phone: "02-000-0000",
    academies: [],
  },
};

const sessions = [
  {
    id: 901,
    title: "고2 내신 심화반",
    date: toLocalYmd(tomorrow),
    status: "scheduled",
    type: "session",
    start_time: "18:30:00",
  },
  {
    id: 902,
    title: "고2 내신 심화반 · 수열 실전 문제",
    date: toLocalYmd(examDay),
    status: "scheduled",
    type: "session",
    start_time: "18:30:00",
  },
  ...recentClassDates.map((date, index) => ({
    id: 910 + index,
    title: `고2 내신 심화반 ${index + 1}회`,
    date,
    status: "completed",
    type: "session",
    start_time: "18:30:00",
  })),
];

const grades = {
  exams: [
    {
      exam_id: 2201,
      enrollment_id: 801,
      title: "7월 내신 대비 점검",
      total_score: 92,
      max_score: 100,
      is_pass: true,
      achievement: "PASS",
      session_title: "미적분 핵심 정리",
      lecture_title: "고2 내신 심화반",
      submitted_at: "2026-07-20T11:00:00+09:00",
    },
  ],
  homeworks: [
    {
      homework_id: 2301,
      enrollment_id: 801,
      title: "함수와 그래프 복습",
      score: 10,
      max_score: 10,
      passed: true,
      achievement: "PASS",
      session_title: "미적분 핵심 정리",
      lecture_title: "고2 내신 심화반",
    },
  ],
  exam_trend: [
    { label: "6월 2주", score_pct: 84 },
    { label: "6월 4주", score_pct: 88 },
    { label: "7월 2주", score_pct: 92 },
  ],
  exam_summary: {
    scored_count: 3,
    average_score_pct: 88,
    latest_score_pct: 92,
    change_pct_points: 4,
    best_score_pct: 92,
  },
};

const exams = {
  items: [
    {
      id: 2401,
      title: "8월 내신 대비 점검",
      open_at: `${toLocalYmd(examDay)}T09:00:00+09:00`,
      close_at: `${toLocalYmd(examDay)}T23:00:00+09:00`,
      allow_retake: true,
      max_attempts: 2,
      pass_score: 80,
      max_score: 100,
      has_result: false,
      attempt_count: 0,
    },
  ],
};

const videoHome = {
  public: {
    session_id: 903,
    lecture_id: 703,
    video_count: 2,
    total_duration: 1260,
    thumbnail_url: thumbnailTwo,
  },
  lectures: [
    {
      id: 701,
      title: "고2 내신 심화반",
      enrollment_id: 801,
      video_count: 5,
      total_duration: 4860,
      thumbnail_url: thumbnailOne,
      sessions: [
        { id: 901, title: "미적분 핵심 정리", order: 1, date: toLocalYmd(today) },
        { id: 902, title: "수열 실전 문제", order: 2, date: toLocalYmd(tomorrow) },
      ],
    },
    {
      id: 702,
      title: "고1 공통수학 실전반",
      enrollment_id: 802,
      video_count: 4,
      total_duration: 3720,
      thumbnail_url: thumbnailTwo,
      sessions: [
        { id: 904, title: "함수의 기초", order: 1, date: toLocalYmd(today) },
      ],
    },
  ],
};

const videoItems = {
  901: [
    {
      id: 501,
      session_id: 901,
      enrollment_id: 801,
      title: "함수와 그래프 핵심 풀이",
      status: "READY",
      source_type: "s3",
      thumbnail_url: thumbnailOne,
      duration: 1320,
      progress: 38,
      completed: false,
      last_position: 502,
      allow_skip: true,
      max_speed: 2,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
      order: 1,
    },
    {
      id: 502,
      session_id: 901,
      enrollment_id: 801,
      title: "접선의 방정식 대표 문제",
      status: "READY",
      source_type: "s3",
      thumbnail_url: thumbnailTwo,
      duration: 1080,
      progress: 100,
      completed: true,
      last_position: 1080,
      allow_skip: true,
      max_speed: 2,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
      order: 2,
    },
    {
      id: 503,
      session_id: 901,
      enrollment_id: 801,
      title: "서술형 풀이 점검",
      status: "READY",
      source_type: "s3",
      thumbnail_url: thumbnailOne,
      duration: 840,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 2,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
      order: 3,
    },
  ],
  902: [
    {
      id: 504,
      session_id: 902,
      enrollment_id: 801,
      title: "수열 실전 문제 1",
      status: "READY",
      source_type: "s3",
      thumbnail_url: thumbnailTwo,
      duration: 960,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 2,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
      order: 1,
    },
  ],
  903: [],
  904: [],
};

function json(body) {
  return {
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  };
}

async function waitForStablePage(page, text) {
  await page.locator(".student-layout__header .stu-topbar").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.complete ? image.decode().catch(() => undefined) : new Promise((resolveImage) => {
        image.addEventListener("load", resolveImage, { once: true });
        image.addEventListener("error", resolveImage, { once: true });
      })),
    );
    window.scrollTo(0, 0);
    document.querySelector(".student-layout__main")?.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
}

async function captureStudentScreen(page, name) {
  const temporaryPng = join(temporaryDir, `${name}.png`);
  const outputWebp = resolve(outputDir, `${name}.webp`);
  await page.locator(".student-layout").screenshot({ path: temporaryPng });
  execFileSync("ffmpeg", [
    "-y",
    "-i", temporaryPng,
    "-c:v", "libwebp",
    "-preset", "picture",
    "-quality", "82",
    outputWebp,
  ], { stdio: "ignore" });
}

const browser = await chromium.launch({ headless: true });
const renderContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const renderPage = await renderContext.newPage();
await renderPage.setContent(
  `<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#091826}img{display:block;width:100%;height:100%;object-fit:cover}</style><img src="${thumbnailOne}" alt="">`,
);
await renderPage.locator("img").evaluate((image) => image.decode());
await renderPage.screenshot({ path: previewFramePath });
await renderContext.close();

execFileSync("ffmpeg", [
  "-y",
  "-framerate", "1/30",
  "-loop", "1",
  "-i", previewFramePath,
  "-t", "1320",
  "-r", "1/30",
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-crf", "30",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  previewVideoPath,
], { stdio: "ignore" });

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "ko-KR",
  colorScheme: "light",
});
const page = await context.newPage();

await page.addInitScript(() => {
  localStorage.setItem("access", "promo-capture-access");
  localStorage.setItem("refresh", "promo-capture-refresh");
  localStorage.setItem("tenant_code", "hakwonplus");
  sessionStorage.setItem("tenantCode", "hakwonplus");
});

await page.route("**/api/v1/**", async (route) => {
  const requestUrl = new URL(route.request().url());
  const path = requestUrl.pathname;

  if (path === "/api/v1/core/me/") {
    await route.fulfill(json({
      id: 1001,
      username: "promo.student",
      name: "김하늘",
      phone: "010-0000-0000",
      is_staff: false,
      is_superuser: false,
      tenantRole: "student",
      must_change_password: false,
    }));
    return;
  }
  if (path === "/api/v1/student/me/") {
    await route.fulfill(json({
      id: 1001,
      name: "김하늘",
      username: "promo.student",
      profile_photo_url: null,
      school_type: "HIGH",
      high_school: "대치고",
      grade: 2,
    }));
    return;
  }
  if (path === "/api/v1/student/dashboard/") {
    await route.fulfill(json(dashboard));
    return;
  }
  if (path === "/api/v1/student/sessions/me/") {
    await route.fulfill(json(sessions));
    return;
  }
  if (path === "/api/v1/student/grades/") {
    await route.fulfill(json(grades));
    return;
  }
  if (path === "/api/v1/student/exams/") {
    await route.fulfill(json(exams));
    return;
  }
  if (path === "/api/v1/student/video/me/") {
    await route.fulfill(json(videoHome));
    return;
  }
  if (path === "/api/v1/student/video/me/stats/") {
    await route.fulfill(json({
      total_videos: 11,
      completed_videos: 6,
      completion_rate: 55,
      total_watch_duration: 6020,
      total_content_duration: 9840,
      lectures: [],
    }));
    return;
  }

  const playbackMatch = path.match(/^\/api\/v1\/student\/video\/videos\/(\d+)\/playback\/$/);
  if (playbackMatch) {
    const videoId = Number(playbackMatch[1]);
    const selectedVideo = Object.values(videoItems).flat().find((item) => item.id === videoId) ?? videoItems[901][0];
    await route.fulfill(json({
      video: {
        ...selectedVideo,
        view_count: 24,
        like_count: 3,
        comment_count: 1,
        is_liked: false,
        created_at: "2026-07-24T18:30:00+09:00",
      },
      play_url: previewVideoUrl,
      hls_url: null,
      mp4_url: previewVideoUrl,
      policy: {
        allow_seek: true,
        monitoring_enabled: false,
        access_mode: "FREE_REVIEW",
        playback_rate: { max: 2, ui_control: true },
        watermark: { enabled: false },
      },
    }));
    return;
  }

  const commentMatch = path.match(/^\/api\/v1\/student\/video\/videos\/(\d+)\/comments\/$/);
  if (commentMatch) {
    await route.fulfill(json({
      total: 1,
      comments: [
        {
          id: 601,
          content: "13번은 그래프 이동 순서까지 다시 확인해 보세요.",
          author_type: "teacher",
          author_name: "담당 선생님",
          author_photo_url: null,
          is_edited: false,
          is_deleted: false,
          is_mine: false,
          created_at: "2026-07-25T20:10:00+09:00",
          reply_count: 0,
          replies: [],
        },
      ],
    }));
    return;
  }

  const sessionVideoMatch = path.match(/^\/api\/v1\/student\/video\/sessions\/(\d+)\/videos\/$/);
  if (sessionVideoMatch) {
    const sessionId = Number(sessionVideoMatch[1]);
    await route.fulfill(json({ items: videoItems[sessionId] ?? [] }));
    return;
  }

  if (path === "/api/v1/clinic/participants/") {
    await route.fulfill(json({ results: [] }));
    return;
  }
  if (path.startsWith("/api/v1/community/posts/")) {
    await route.fulfill(json({ results: [], items: [] }));
    return;
  }

  await route.fulfill(json({ results: [], items: [] }));
});

try {
  await page.goto(`${baseUrl}/student/dashboard`, { waitUntil: "domcontentloaded" });
  await waitForStablePage(page, "오늘 확인할 일이 있어요");
  await captureStudentScreen(page, "student-app-home");

  await page.goto(`${baseUrl}/student/video`, { waitUntil: "domcontentloaded" });
  await waitForStablePage(page, "고2 내신 심화반");
  await captureStudentScreen(page, "student-video-app");

  await page.getByText("고2 내신 심화반", { exact: true }).first().click();
  await waitForStablePage(page, "차시 목록");
  await captureStudentScreen(page, "student-video-course");

  await page.getByText("미적분 핵심 정리", { exact: false }).first().click();
  await waitForStablePage(page, "함수와 그래프 핵심 풀이");
  await captureStudentScreen(page, "student-video-list");

  await page.getByText("함수와 그래프 핵심 풀이", { exact: true }).first().click();
  await waitForStablePage(page, "함수와 그래프 핵심 풀이");
  await page.getByText("담당 선생님", { exact: true }).waitFor({ state: "visible", timeout: 8_000 });
  await captureStudentScreen(page, "student-video-player");
} finally {
  await context.close();
  await browser.close();
  rmSync(previewVideoPath, { force: true });
  rmSync(temporaryDir, { recursive: true, force: true });
}

console.log("학생앱 홍보 화면 5장을 새로 저장했습니다.");
