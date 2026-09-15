import { devices, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";
import {
  deleteCommunityPost,
  deleteCommunityPostAttachment,
  type CommunityHttpClient,
} from "../../src/shared/api/contracts/community";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const QUESTION_ID = 4332;
const CORS_HEADERS = {
  "access-control-allow-origin": BASE,
  "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};
const IPAD_PROFILE = {
  userAgent: devices["iPad Pro 11"].userAgent,
  viewport: devices["iPad Pro 11"].viewport,
  deviceScaleFactor: devices["iPad Pro 11"].deviceScaleFactor,
  isMobile: devices["iPad Pro 11"].isMobile,
  hasTouch: devices["iPad Pro 11"].hasTouch,
};
const IMAGE_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="100%" height="100%" fill="#f8f4ea"/><text x="70" y="130" font-size="56">20. 자연선택 문제</text><path d="M120 800 Q300 350 480 800 T840 800" fill="none" stroke="#222" stroke-width="18"/></svg>',
).toString("base64")}`;
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seed(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "커뮤니티 route-mock 검증은 로컬 서버 전용",
  );
  await page.addInitScript((jwt) => {
    if (!/^https?:$/.test(location.protocol)) return;
    const generation = "community-materials-test";
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    localStorage.setItem(
      `academy:auth-tokens:v1:${generation}`,
      JSON.stringify({ access: jwt, refresh: `${jwt}-refresh`, generation }),
    );
    localStorage.setItem("academy:auth-active-generation:v1", generation);
  }, localJwt());
}

async function installApi(page: Page) {
  let answered = false;
  const question = () => ({
    id: QUESTION_ID,
    post_type: "qna",
    title: "프린트 진화와 자연선택 20번",
    content: "사진 속 20번 문제에서 (가)와 (나)의 차이를 설명해 주세요.",
    created_by: 20,
    created_by_display: "천예지",
    created_by_deleted: false,
    author_role: "student",
    created_at: "2026-08-23T01:21:00Z",
    updated_at: "2026-08-23T01:21:00Z",
    replies_count: answered ? 1 : 0,
    mappings: [{
      id: 1,
      post: QUESTION_ID,
      node: 1,
      created_at: "2026-08-23T01:21:00Z",
      node_detail: {
        id: 1,
        level: "COURSE",
        lecture: 1,
        session: null,
        lecture_title: "26-2 중간 개포고",
        session_title: null,
      },
    }],
    attachments: [{
      id: 79,
      original_name: "20번-문제.jpg",
      size_bytes: 283400,
      content_type: "image/jpeg",
      created_at: "2026-08-23T01:21:00Z",
      download_url: IMAGE_DATA_URL,
    }, {
      id: 80,
      original_name: "20번-풀이.pdf",
      size_bytes: 512000,
      content_type: "application/pdf",
      created_at: "2026-08-23T01:21:00Z",
    }, {
      id: 81,
      original_name: "21번-문제.png",
      size_bytes: 302400,
      content_type: "image/png",
      created_at: "2026-08-23T01:22:00Z",
    }, {
      id: 82,
      original_name: "22번-문제.jpg",
      size_bytes: 294800,
      content_type: "image/jpeg",
      created_at: "2026-08-23T01:23:00Z",
      download_url: `${BASE}/mock/expired-question-image.jpg`,
    }],
    category_label: "개포",
    meta: { matchup_results: [] },
  });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      headers: CORS_HEADERS,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
    if (path === "/staffs/me/") return json({ id: 12, is_payroll_manager: true });
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/community/admin/posts/") {
      return url.searchParams.get("post_type") === "qna"
        ? json({ count: 1, results: [question()] })
        : json({ count: 0, results: [] });
    }
    if (path === `/community/posts/${QUESTION_ID}/`) return json(question());
    if (path === `/community/posts/${QUESTION_ID}/attachments/80/download/`) {
      return json({
        url: `${BASE}/mock/20-number-solution.pdf`,
        original_name: "20번-풀이.pdf",
      });
    }
    if (path === `/community/posts/${QUESTION_ID}/attachments/81/download/`) {
      return json({ url: PNG_DATA_URL, original_name: "21번-문제.png" });
    }
    if (path === `/community/posts/${QUESTION_ID}/attachments/82/download/`) {
      return json({ url: IMAGE_DATA_URL, original_name: "22번-문제.jpg" });
    }
    if (path === `/community/posts/${QUESTION_ID}/replies/`) {
      if (request.method() === "POST") {
        answered = true;
        return json({
          id: 91,
          question: QUESTION_ID,
          content: "광합성량 차이는 선택압 변화로 설명할 수 있습니다.",
          created_at: "2026-08-23T02:00:00Z",
          created_by_display: "관리자",
          author_role: "staff",
        }, 201);
      }
      return json(answered ? [{
        id: 91,
        question: QUESTION_ID,
        content: "광합성량 차이는 선택압 변화로 설명할 수 있습니다.",
        created_at: "2026-08-23T02:00:00Z",
        created_by_display: "관리자",
        author_role: "staff",
      }] : []);
    }
    if (path === "/students/20/") return json({ id: 20, name: "천예지", enrollments: [] });
    if (path === "/lectures/attendance/arrival-overview/") {
      return json({
        today: "2026-08-23",
        tomorrow: "2026-08-24",
        range_end: "2026-08-30",
        range_days: 7,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
        items: [],
      });
    }
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0 });
    if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
    return json({ count: 0, results: [] });
  });
}

async function installStudentAttachmentApi(page: Page, parent = false) {
  const downloadStudentIds: Array<string | undefined> = [];
  const question = {
    id: QUESTION_ID,
    post_type: "qna",
    title: "20번 풀이 확인",
    content: "<p>첨부한 풀이 파일을 확인해 주세요.</p>",
    created_by: 20,
    created_by_display: "천예지",
    author_role: parent ? "parent" : "student",
    created_at: "2026-08-23T01:21:00Z",
    updated_at: "2026-08-23T01:21:00Z",
    replies_count: 0,
    mappings: [],
    attachments: [{
      id: 80,
      original_name: "20번-풀이.pdf",
      size_bytes: 512000,
      content_type: "application/pdf",
      created_at: "2026-08-23T01:21:00Z",
    }],
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      headers: CORS_HEADERS,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", is_active: true, ui_config: {}, feature_flags: {} });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: parent ? "parent-12" : "student-20",
        name: parent ? "천보호" : "천예지",
        is_staff: false,
        is_superuser: false,
        tenantRole: parent ? "parent" : "student",
        linkedStudents: parent ? [{ id: 20, name: "천예지" }] : [],
      });
    }
    if (path === "/student/me/") {
      return json({
        id: 20,
        username: "student-20",
        name: "천예지",
        displayName: parent ? "천예지 학생 학부모님" : "천예지",
        is_student: true,
        isParentReadOnly: parent,
      });
    }
    if (path === "/student/video/me/") return json({ lectures: [] });
    if (path === "/community/posts/my-activity/") {
      return json({ is_student: true, days: 30, post_count: 1, reply_count: 0, received_likes: 0, rank: null, total_active_students: 1, badges: [] });
    }
    if (["/community/posts/notices/", "/community/posts/board/", "/community/posts/materials/"].includes(path)) return json([]);
    if (path === "/community/posts/" && request.method() === "GET") {
      return json({ count: 1, next: null, previous: null, results: [question] });
    }
    if (path === `/community/posts/${QUESTION_ID}/`) return json(question);
    if (path === `/community/posts/${QUESTION_ID}/replies/`) return json([]);
    if (path === `/community/posts/${QUESTION_ID}/attachments/80/download/`) {
      downloadStudentIds.push(request.headers()["x-student-id"]);
      return json({ url: `${BASE}/mock/20-number-solution.pdf`, original_name: "20번-풀이.pdf" });
    }
    return json({ count: 0, next: null, previous: null, results: [] });
  });

  return { downloadStudentIds };
}

async function openStudentPdfQuestion(page: Page) {
  await expect(page.getByText("20번 풀이 확인", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByText("20번 풀이 확인", { exact: true }).click();
  return page.getByRole("button", { name: /20번-풀이\.pdf/ });
}

test("커뮤니티 DELETE는 endpoint별 exact partial payload만 삭제 완료로 분류한다", async () => {
  const clientFor = (error?: unknown) => ({
    delete: async () => {
      if (error) throw error;
      return { data: undefined };
    },
  }) as unknown as CommunityHttpClient;
  const partial = (deleted: { posts: number; attachments: number; r2_objects: number }) => ({
    response: {
      status: 502,
      data: {
        code: "community_storage_cleanup_pending",
        detail: "DB 삭제 뒤 원본 파일 정리가 남았습니다.",
        deleted,
        storage_cleanup: { pending: 1, failed: 1, cleaned: 0 },
      },
    },
  });

  await expect(deleteCommunityPost(clientFor(), QUESTION_ID)).resolves.toEqual({ status: "deleted" });
  await expect(deleteCommunityPost(clientFor(partial({ posts: 1, attachments: 2, r2_objects: 0 })), QUESTION_ID))
    .resolves.toMatchObject({ status: "deleted_with_storage_cleanup_pending" });

  const invalidPostCounts = partial({ posts: 0, attachments: 2, r2_objects: 0 });
  await expect(deleteCommunityPost(clientFor(invalidPostCounts), QUESTION_ID)).rejects.toBe(invalidPostCounts);

  await expect(deleteCommunityPostAttachment(
    clientFor(partial({ posts: 0, attachments: 1, r2_objects: 0 })),
    QUESTION_ID,
    80,
  )).resolves.toMatchObject({ status: "deleted_with_storage_cleanup_pending" });

  const invalidAttachmentCounts = partial({ posts: 0, attachments: 0, r2_objects: 0 });
  await expect(deleteCommunityPostAttachment(clientFor(invalidAttachmentCounts), QUESTION_ID, 80))
    .rejects.toBe(invalidAttachmentCounts);

  const ordinaryFailure = { response: { status: 503, data: { detail: "일반 삭제 실패" } } };
  await expect(deleteCommunityPost(clientFor(ordinaryFailure), QUESTION_ID)).rejects.toBe(ordinaryFailure);
});

test.describe("커뮤니티 QnA 작업대", () => {
  test.use({ serviceWorkers: "block" });

  test.beforeEach(async ({ page }) => {
    await seed(page);
    await installApi(page);
    await installLocalAuthApiStubs(page);
  });

  test("데스크톱에서 문제 이미지와 답변기를 함께 보고 미답변 수를 즉시 줄인다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });

    await expect(page.locator(".qna-inbox__reference-pane")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".qna-inbox__answer-pane")).toBeVisible();
    await expect(page.getByTitle("답변 필요 질문 1건").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "QnA 1" })).toBeVisible();

    const workbenchGeometry = await page.locator(".qna-inbox__workbench").evaluate((workbench) => {
      const reference = workbench.querySelector<HTMLElement>(".qna-inbox__reference-pane")?.getBoundingClientRect();
      const answer = workbench.querySelector<HTMLElement>(".qna-inbox__answer-pane")?.getBoundingClientRect();
      const composer = workbench.querySelector<HTMLElement>(".qna-inbox__composer")?.getBoundingClientRect();
      if (!reference || !answer || !composer) throw new Error("QnA 작업대 영역을 찾지 못했습니다.");
      return {
        referenceWidth: reference.width,
        answerWidth: answer.width,
        answerTop: answer.top,
        answerHeight: answer.height,
        composerTop: composer.top,
      };
    });
    expect(workbenchGeometry.answerWidth).toBeGreaterThan(workbenchGeometry.referenceWidth);
    expect(workbenchGeometry.composerTop).toBeLessThan(
      workbenchGeometry.answerTop + workbenchGeometry.answerHeight * 0.45,
    );

    const problemImage = page.locator(".qna-inbox__image-stage img");
    await page.getByRole("button", { name: "오른쪽으로 90도 회전" }).click();
    await expect(problemImage).toHaveCSS("transform", /matrix\(0, 1, -1, 0/);
    await page.getByRole("button", { name: "이미지 확대" }).click();
    await expect(page.locator(".qna-inbox__viewer-zoom")).toHaveText("125%");
    await expect(page.getByRole("link", { name: "문제 이미지 원본 열기" })).toHaveAttribute("href", /^data:image\/svg\+xml/);

    const editor = page.locator(".qna-inbox__answer-pane .ProseMirror");
    await editor.fill("광합성량 차이는 선택압 변화로 설명할 수 있습니다.");
    await page.getByRole("button", { name: "답변 등록" }).click();
    await expect(page.getByText("답변이 등록되었습니다.")).toBeVisible();
    await expect(page.getByTitle("답변 필요 질문 1건")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "QnA 1" })).toHaveCount(0);
  });

  test("데스크톱 새로고침 뒤 PDF 풀이 파일을 키보드로 다운로드한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".qna-inbox__reference-pane")).toBeVisible({ timeout: 60_000 });
    const pdfDownload = page.getByRole("button", { name: "20번-풀이.pdf 다운로드" });
    await expect(pdfDownload).toBeVisible();
    const presignRequest = page.waitForRequest((request) => (
      new URL(request.url()).pathname.endsWith(`/community/posts/${QUESTION_ID}/attachments/80/download/`)
    ));
    await pdfDownload.focus();
    await page.keyboard.press("Enter");
    await presignRequest;
  });

  test("URL이 없거나 만료된 이미지도 숨기지 않고 원본을 다시 요청한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });

    await expect(page.getByText("이미지 3장 · 파일 1개", { exact: true })).toBeVisible();
    await expect(page.getByText("첨부된 문제 사진이 없습니다.")).toHaveCount(0);
    const missingPreview = page.getByRole("button", { name: "21번-문제.png 원본 다시 요청" });
    const expiredPreview = page.getByRole("button", { name: "22번-문제.jpg 원본 다시 요청" });
    await expect(missingPreview).toBeVisible();
    await expect(expiredPreview).toBeVisible();
    await expect(page.getByText(/이미지 미리보기를 준비하지 못했습니다/)).toBeVisible();
    await expiredPreview.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "test-results/community-qna-image-recovery-desktop.png",
      fullPage: true,
    });

    const presignRequest = page.waitForRequest((request) => (
      new URL(request.url()).pathname.endsWith(`/community/posts/${QUESTION_ID}/attachments/81/download/`)
    ));
    const downloadEvent = page.waitForEvent("download");
    await missingPreview.click();
    await presignRequest;
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("21번-문제.png");
    expect(await download.failure()).toBeNull();
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const bytes = await readFile(downloadPath!);
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  test("390px 자료/답변 전환에서 작성 내용을 보존하고 가로 넘침이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });

    await expect(page.getByRole("tab", { name: /질문 자료/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "20번-풀이.pdf 다운로드" })).toBeVisible();
    await page.getByRole("tab", { name: "답변 작성" }).click();
    const editor = page.locator(".qna-inbox__answer-pane .ProseMirror");
    await editor.fill("작성 중인 답변은 보존됩니다.");
    await page.getByRole("tab", { name: /질문 자료/ }).click();
    await page.getByRole("tab", { name: "답변 작성" }).click();
    await expect(editor).toContainText("작성 중인 답변은 보존됩니다.");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("비이미지 다운로드 실패는 파일을 유지하고 다시 누를 수 있게 복구한다", async ({ page }) => {
    let releaseDownload!: () => void;
    const downloadGate = new Promise<void>((resolve) => {
      releaseDownload = resolve;
    });
    await page.route(`**/api/v1/community/posts/${QUESTION_ID}/attachments/80/download/`, async (route) => {
      await downloadGate;
      await route.fulfill({
        status: 503,
        headers: CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({ detail: "temporary download failure" }),
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });

    const pdfDownload = page.getByRole("button", { name: "20번-풀이.pdf 다운로드" });
    await pdfDownload.click();
    await expect(pdfDownload).toBeDisabled();
    await expect(pdfDownload.locator(".qna-inbox__file-action")).toHaveText("준비 중…");
    releaseDownload();
    await expect(page.getByText("다운로드 URL을 가져오지 못했습니다.")).toBeVisible();
    await expect(pdfDownload).toBeEnabled();
    await expect(pdfDownload).toBeVisible();
  });

  test("학생은 PDF 질문을 새로고침 뒤에도 열고 다운로드한다", async ({ page }) => {
    await installStudentAttachmentApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/student/community?tab=qna`, { timeout: 60_000 });

    await expect(await openStudentPdfQuestion(page)).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    const pdfDownload = await openStudentPdfQuestion(page);
    const presignRequest = page.waitForRequest((request) => (
      new URL(request.url()).pathname.endsWith(`/community/posts/${QUESTION_ID}/attachments/80/download/`)
    ));
    await pdfDownload.click();
    await presignRequest;
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("DB 삭제 완료 뒤 스토리지 정리 대기 응답은 재삭제 없이 상세를 닫고 목록을 갱신한다", async ({ page }) => {
    let deleteRequests = 0;
    let listRequests = 0;
    await page.route("**/api/v1/community/admin/posts/**", async (route) => {
      listRequests += 1;
      await route.fallback();
    });
    await page.route(`**/api/v1/community/posts/${QUESTION_ID}/`, async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      deleteRequests += 1;
      await route.fulfill({
        status: 502,
        headers: CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({
          code: "community_storage_cleanup_pending",
          detail: "질문은 삭제됐지만 일부 원본 파일 정리가 지연되고 있습니다.",
          deleted: { posts: 1, attachments: 2, r2_objects: 1 },
          storage_cleanup: { pending: 1, failed: 0, cleaned: 1 },
        }),
      });
    });

    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });
    await page.locator(".qna-inbox__thread-actions").getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("alertdialog", { name: "질문 삭제" }).getByRole("button", { name: "삭제", exact: true }).click();

    await expect(page.getByText(/질문은 삭제됐지만 일부 원본 파일 정리가 지연/)).toBeVisible();
    await expect(page.getByText(/원본 파일 1개/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "프린트 진화와 자연선택 20번" })).toHaveCount(0);
    await expect.poll(() => listRequests).toBeGreaterThan(1);
    expect(deleteRequests).toBe(1);
  });

  test("학부모는 선택 자녀의 PDF 질문을 새로고침 뒤에도 열고 같은 범위로 다운로드한다", async ({ page }) => {
    const harness = await installStudentAttachmentApi(page, true);
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/student/community?tab=qna`, { timeout: 60_000 });

    await expect(await openStudentPdfQuestion(page)).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    const pdfDownload = await openStudentPdfQuestion(page);
    await pdfDownload.click();
    await expect.poll(() => harness.downloadStudentIds).toContain("20");
  });

  test("데스크톱 공지 이미지를 본문 data URL이 아닌 첨부파일로 저장한다", async ({ page }) => {
    const createBodies: unknown[] = [];
    let uploadRequests = 0;
    let uploadContentType = "";
    let multipartFilenameCount = 0;
    await page.route("**/api/v1/community/posts/991/attachments/", async (route) => {
      uploadRequests += 1;
      uploadContentType = route.request().headers()["content-type"] || "";
      multipartFilenameCount = (route.request().postDataBuffer()?.toString("utf8").match(/filename="29번-정답-정오\.svg"/g) || []).length;
      await route.fulfill({ status: 201, headers: CORS_HEADERS, contentType: "application/json", body: "[]" });
    });
    await page.route("**/api/v1/community/posts/", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      createBodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        headers: CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({ id: 991, post_type: "notice", title: "29번 정답 정오", content: "", attachments: [], mappings: [] }),
      });
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoAndSettle(page, `${BASE}/workspace/community/notice`, { timeout: 60_000 });

    await page.getByRole("button", { name: "+ 추가" }).click();
    await page.getByPlaceholder("공지 제목을 입력하세요").fill("29번 정답 정오");
    await page.locator('.cms-form__body input[type="file"][accept="image/*"]').setInputFiles({
      name: "29번-정답-정오.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1600"><rect width="720" height="1600" fill="#fff"/><text x="40" y="100" font-size="48">29번 정답 정오</text></svg>',
      ),
    });

    const formBody = page.locator(".qna-inbox__thread > .cms-form__body");
    const submit = page.getByRole("button", { name: "등록", exact: true });
    await expect(formBody.getByText("29번-정답-정오.svg", { exact: true })).toBeVisible();
    await expect(formBody.locator(".ProseMirror img")).toHaveCount(0);
    await submit.click();

    await expect(page.getByText("공지가 등록되었습니다.")).toBeVisible();
    expect(createBodies).toHaveLength(1);
    expect(createBodies[0]).toEqual({
      post_type: "notice",
      title: "29번 정답 정오",
      content: "",
      node_ids: [],
    });
    expect(uploadRequests).toBe(1);
    expect(uploadContentType).toContain("multipart/form-data");
    expect(multipartFilenameCount).toBe(1);
  });

  test("390px에서 공지 이미지를 첨부파일로 한 번만 등록한다", async ({ page }) => {
    const noticeImageSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1600"><rect width="720" height="1600" fill="#fff"/><text x="40" y="100" font-size="48">29번 정답 정오</text></svg>';
    const createBodies: unknown[] = [];
    let uploadRequests = 0;
    let uploadContentType = "";
    let multipartFilenameCount = 0;
    const uploadKeys: string[] = [];
    let releaseCreate: (() => void) | undefined;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    await page.route("**/api/v1/community/posts/", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      createBodies.push(route.request().postDataJSON());
      await createGate;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 991,
          post_type: "notice",
          title: "29번 정답 정오",
          content: "",
          attachments: [],
          mappings: [],
        }),
      });
    });
    await page.route("**/api/v1/community/posts/991/attachments/", async (route) => {
      uploadRequests += 1;
      uploadContentType = route.request().headers()["content-type"] || "";
      const body = route.request().postDataBuffer()?.toString("utf8") ?? "";
      multipartFilenameCount += (body.match(/filename="29번-정답-정오\.svg"/g) || []).length;
      const uploadKey = body.match(/name="idempotency_key"\r\n\r\n([^\r\n]+)/)?.[1];
      if (uploadKey) uploadKeys.push(uploadKey);
      await route.fulfill({
        status: uploadRequests === 1 ? 503 : 201,
        headers: CORS_HEADERS,
        contentType: "application/json",
        body: uploadRequests === 1 ? JSON.stringify({ detail: "첨부 응답 연결이 끊겼습니다." }) : "[]",
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/notice`, { timeout: 60_000 });

    await page.getByRole("button", { name: "+ 추가" }).click();
    await page.getByPlaceholder("공지 제목을 입력하세요").fill("29번 정답 정오");
    await page.locator('.cms-form__body input[type="file"][accept="image/*"]').setInputFiles({
      name: "29번-정답-정오.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(noticeImageSvg),
    });

    const formBody = page.locator(".qna-inbox__thread > .cms-form__body");
    const submit = page.getByRole("button", { name: "등록", exact: true });
    await expect(formBody.getByText("29번-정답-정오.svg", { exact: true })).toBeVisible();
    await expect(formBody.locator(".ProseMirror img")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await submit.click();
    const pendingSubmit = page.getByRole("button", { name: "등록 중…" });
    await expect(pendingSubmit).toBeDisabled();
    await pendingSubmit.click({ force: true });
    await expect.poll(() => createBodies).toHaveLength(1);
    expect(createBodies[0]).toEqual({
      post_type: "notice",
      title: "29번 정답 정오",
      content: "",
      node_ids: [],
    });

    releaseCreate?.();
    await expect(page.getByText("공지는 저장됐지만 첨부파일 등록에 실패했습니다.", { exact: false })).toBeVisible();
    await expect.poll(() => createBodies).toHaveLength(1);
    expect(uploadRequests).toBe(1);
    expect(uploadContentType).toContain("multipart/form-data");
    expect(multipartFilenameCount).toBe(1);
    expect(uploadKeys).toHaveLength(1);
    await expect(page.getByRole("button", { name: "첨부 다시 시도", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("공지 제목을 입력하세요")).toHaveAttribute("readonly", "");
    await expect(page.locator(".cms-attach__item-remove")).toBeDisabled();

    await page.getByRole("button", { name: "첨부 다시 시도", exact: true }).click();
    await expect(page.getByText("공지가 등록되었습니다.")).toBeVisible();
    expect(createBodies).toHaveLength(1);
    expect(uploadRequests).toBe(2);
    expect(multipartFilenameCount).toBe(2);
    expect(uploadKeys).toHaveLength(2);
    expect(uploadKeys[1]).toBe(uploadKeys[0]);
  });

  test.describe("iPad 프로필 자료 첨부 게이트", () => {
    test.use(IPAD_PROFILE);

  for (const viewport of [
    { name: "데스크톱", width: 1366, height: 900 },
    { name: "390px", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} 자료 등록에서 운영 문서 파일을 네이티브 입력으로 선택한다 @materials-file-picker`, async ({ page }) => {
      let uploadContentType = "";
      let uploadRequests = 0;
      let multipartFilenameCount = 0;
      let createRequests = 0;
      await page.route("**/api/v1/community/posts/990/attachments/", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_HEADERS });
          return;
        }
        uploadRequests += 1;
        uploadContentType = route.request().headers()["content-type"] || "";
        multipartFilenameCount = (route.request().postDataBuffer()?.toString("utf8").match(/filename="암기TEST\.pdf"/g) || []).length;
        await route.fulfill({
          status: 201,
          headers: CORS_HEADERS,
          contentType: "application/json",
          body: JSON.stringify([{ id: 77, original_name: "암기TEST.pdf", size_bytes: 35 }]),
        });
      });
      await page.route("**/api/v1/community/posts/", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        createRequests += 1;
        await route.fulfill({
          status: 201,
          headers: CORS_HEADERS,
          contentType: "application/json",
          body: JSON.stringify({
            id: 990,
            post_type: "materials",
            title: "암기TEST",
            content: "",
            created_at: "2026-08-25T12:00:00Z",
            attachments: [],
            mappings: [],
          }),
        });
      });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoAndSettle(page, `${BASE}/workspace/community/materials`, { timeout: 60_000 });

      await page.getByRole("button", { name: "+ 자료 등록" }).click();
      await page.getByPlaceholder("자료 제목을 입력하세요").fill("암기TEST");
      const fileInput = page.getByLabel("첨부할 파일 선택");
      await expect(fileInput).toBeAttached();
      const fileInputId = await fileInput.getAttribute("id");
      expect(fileInputId).toBeTruthy();
      const picker = page.locator(`label[for="${fileInputId}"]`);
      await expect(picker).toBeVisible();
      const chooserPromise = page.waitForEvent("filechooser");
      await picker.click();
      const chooser = await chooserPromise;
      expect(chooser.isMultiple()).toBe(true);
      await chooser.setFiles({
        name: "암기TEST.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("material room attachment regression"),
      });

      await expect(page.getByText("암기TEST.pdf", { exact: true })).toBeVisible();
      await expect(page.getByText("파일당 최대 50MB · 최대 10개")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.getByRole("button", { name: "등록", exact: true }).click();
      await expect.poll(() => uploadContentType).toContain("multipart/form-data");
      await expect.poll(() => uploadRequests).toBe(1);
      expect(multipartFilenameCount).toBe(1);
      expect(createRequests).toBe(1);
      await expect(page.getByText("자료가 등록되었습니다.")).toBeVisible();
    });
  }

  test("390px 자료 첨부 선택 취소와 업로드 실패 뒤에도 작성 내용을 보존한다 @materials-file-picker", async ({ page }) => {
    let uploadRequests = 0;
    await page.route("**/api/v1/community/posts/992/attachments/", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      uploadRequests += 1;
      await route.fulfill({
        status: 503,
        headers: CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({ detail: "첨부 저장 실패" }),
      });
    });
    await page.route("**/api/v1/community/posts/", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({
        status: 201,
        headers: CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({
          id: 992,
          post_type: "materials",
          title: "선택 보존 자료",
          content: "",
          created_at: "2026-08-29T12:49:00Z",
          attachments: [],
          mappings: [],
        }),
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/materials`, { timeout: 60_000 });

    await page.getByRole("button", { name: "+ 자료 등록" }).click();
    const title = page.getByPlaceholder("자료 제목을 입력하세요");
    await title.fill("선택 보존 자료");
    const fileInput = page.getByLabel("첨부할 파일 선택");
    const fileInputId = await fileInput.getAttribute("id");
    expect(fileInputId).toBeTruthy();
    const picker = page.locator(`label[for="${fileInputId}"]`);

    let chooserPromise = page.waitForEvent("filechooser");
    await picker.click();
    let chooser = await chooserPromise;
    await chooser.setFiles({
      name: "보존자료.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("preserve material after cancel and upload failure"),
    });
    await expect(page.getByText("보존자료.pdf", { exact: true })).toBeVisible();

    chooserPromise = page.waitForEvent("filechooser");
    await picker.click();
    chooser = await chooserPromise;
    await chooser.setFiles([]);
    await expect(page.getByText("보존자료.pdf", { exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expect.poll(() => uploadRequests).toBe(1);
    await expect(page.getByText("첨부 저장 실패", { exact: true })).toBeVisible();
    await expect(title).toHaveValue("선택 보존 자료");
    await expect(page.getByText("보존자료.pdf", { exact: true })).toBeVisible();
    expect(uploadRequests).toBe(1);
  });
  });
});
