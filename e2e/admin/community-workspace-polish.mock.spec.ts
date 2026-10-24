import { devices, type Page, type Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs } from "../helpers/localAuthApiStubs";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";
import {
  deleteCommunityPost,
  deleteCommunityPostAttachment,
  type CommunityHttpClient,
  type PostAttachment,
} from "@/shared/api/contracts/community";

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
const qnaAttachmentsByPage = new WeakMap<Page, PostAttachment[]>();

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
    attachments: qnaAttachmentsByPage.get(page) ?? [{
      id: 79,
      original_name: "20번-문제.jpg",
      size_bytes: 283400,
      content_type: "image/jpeg",
      created_at: "2026-08-23T01:21:00Z",
      download_url: IMAGE_DATA_URL,
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
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0, qna_pending: answered ? 0 : 1, counsel_pending: 0, submission_pending: 0 });
    if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
    return json({ count: 0, results: [] });
  });
}

async function installEditableNotice(page: Page, options: { ambiguousUpload?: boolean; rejectContent?: boolean } = {}) {
  const state = {
    post: { id: 998, post_type: "notice", title: "36번 정답 정정", content: "<p>36번 정답은 3번입니다.</p>",
      attachments: [] as PostAttachment[], mappings: [], created_at: "2026-10-24T15:12:00Z", is_pinned: false },
    patches: [] as Record<string, unknown>[], uploadKeys: [] as string[],
  };
  await page.route("**/api/v1/community/admin/posts/**", (route) => route.fulfill({
    status: 200, headers: CORS_HEADERS, contentType: "application/json",
    body: JSON.stringify({ count: 1, results: [state.post] }),
  }));
  await page.route("**/api/v1/community/posts/998/", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      state.patches.push(body);
      if (options.rejectContent && "content" in body) {
        options.rejectContent = false;
        return route.fulfill({ status: 503, headers: CORS_HEADERS, contentType: "application/json", body: JSON.stringify({ detail: "본문 저장 실패" }) });
      }
      Object.assign(state.post, body);
    }
    return route.fulfill({ status: 200, headers: CORS_HEADERS, contentType: "application/json", body: JSON.stringify(state.post) });
  });
  await page.route("**/api/v1/community/posts/998/attachments/", async (route) => {
    const body = route.request().postDataBuffer()?.toString("utf8") ?? "";
    state.uploadKeys.push(body.match(/name="idempotency_key"\r\n\r\n([^\r\n]+)/)?.[1] ?? "");
    state.post.attachments = [{ id: 910, original_name: "정답-정정.png", size_bytes: 68, content_type: "image/png", created_at: "2026-10-24T15:12:00Z", download_url: IMAGE_DATA_URL }];
    const fail = options.ambiguousUpload && state.uploadKeys.length === 1;
    return route.fulfill({ status: fail ? 503 : 201, headers: CORS_HEADERS, contentType: "application/json",
      body: JSON.stringify(fail ? { detail: "업로드 응답 연결이 끊겼습니다." } : state.post.attachments) });
  });
  return state;
}

const CORRECTION_IMAGE = {
  name: "정답-정정.png", mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
};

test("커뮤니티 DELETE는 정확한 부분 완료 응답만 삭제 완료로 분류한다", async () => {
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
  const wrongPostCount = partial({ posts: 0, attachments: 2, r2_objects: 0 });
  await expect(deleteCommunityPost(clientFor(wrongPostCount), QUESTION_ID)).rejects.toBe(wrongPostCount);

  await expect(deleteCommunityPostAttachment(
    clientFor(partial({ posts: 0, attachments: 1, r2_objects: 0 })), QUESTION_ID, 80,
  )).resolves.toMatchObject({ status: "deleted_with_storage_cleanup_pending" });
  const wrongAttachmentCount = partial({ posts: 0, attachments: 0, r2_objects: 0 });
  await expect(deleteCommunityPostAttachment(clientFor(wrongAttachmentCount), QUESTION_ID, 80))
    .rejects.toBe(wrongAttachmentCount);
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

  for (const width of [1366, 390]) {
    test(`${width}px 기존 공지에 사진만 추가하고 저장·새로고침한다`, async ({ page }) => {
      const state = await installEditableNotice(page);
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${BASE}/workspace/community/notice?id=998`, { timeout: 60_000 });
      await page.getByRole("button", { name: "수정", exact: true }).click();
      await page.locator('input[type="file"][accept="image/*"]').setInputFiles(CORRECTION_IMAGE);
      await expect(page.getByAltText("정답-정정.png 미리보기")).toBeVisible();
      await expect(page.locator(".ProseMirror img")).toHaveCount(0);
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await expect(page.getByText("내용이 저장되었습니다.")).toBeVisible();
      expect(state.uploadKeys).toHaveLength(1);
      expect(state.uploadKeys[0]).not.toBe("");
      expect(state.patches).toHaveLength(0);
      await page.reload();
      const attachments = page.getByRole("region", { name: "첨부파일", exact: true });
      await expect(attachments.getByAltText("정답-정정.png", { exact: true })).toBeVisible();
      await expect.poll(() => attachments.getByRole("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: test.info().outputPath(`notice-edit-attachments-${width}.png`) });
    });
  }

  test("공지 첨부 응답 유실은 같은 키로 재시도하고 본문을 다시 저장하지 않는다", async ({ page }) => {
    const state = await installEditableNotice(page, { ambiguousUpload: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/notice?id=998`, { timeout: 60_000 });
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await page.locator(".ProseMirror").fill("정정 내용을 추가했습니다.");
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles(CORRECTION_IMAGE);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "선택한 파일은 유지됩니다" })).toBeVisible();
    await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "false");
    await expect(page.getByRole("button", { name: "정답-정정.png 제거", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "첨부 다시 시도", exact: true }).click();
    await expect(page.getByText("내용이 저장되었습니다.")).toBeVisible();
    expect(state.uploadKeys).toHaveLength(2);
    expect(state.uploadKeys[0]).toBeTruthy();
    expect(state.uploadKeys[1]).toBe(state.uploadKeys[0]);
    expect(state.patches.filter((body) => "content" in body)).toHaveLength(1);
    await page.reload();
    await expect(page.getByRole("region", { name: "첨부파일", exact: true }).getByRole("img")).toHaveCount(1);
  });

  test("공지 제목 재조회와 본문 저장 실패 뒤에도 초안·사진을 보존한다", async ({ page }) => {
    const state = await installEditableNotice(page, { rejectContent: true });
    await gotoAndSettle(page, `${BASE}/workspace/community/notice?id=998`, { timeout: 60_000 });
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await page.locator(".ProseMirror").fill("아직 저장하지 않은 정정 설명");
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles(CORRECTION_IMAGE);
    await page.getByTitle("클릭하여 제목 수정").click();
    await page.locator(".cms-detail__title-input").fill("36번 정답 정정 안내");
    await page.locator(".cms-detail__title-edit-row").getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("제목이 수정되었습니다.")).toBeVisible();
    await expect(page.locator(".ProseMirror")).toContainText("아직 저장하지 않은 정정 설명");
    await page.locator(".cms-detail__content-actions").getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "본문 저장 실패" })).toBeVisible();
    expect(state.uploadKeys).toHaveLength(0);
    await expect(page.locator(".ProseMirror")).toContainText("아직 저장하지 않은 정정 설명");
    await expect(page.getByAltText("정답-정정.png 미리보기")).toBeVisible();
    await page.locator(".cms-detail__content-actions").getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("내용이 저장되었습니다.")).toBeVisible();
    expect(state.uploadKeys).toHaveLength(1);
  });

  test("공지 여러 장 붙여넣기·드롭은 선택 목록에 남고 기존 첨부 포함 한도를 알린다", async ({ page }) => {
    const state = await installEditableNotice(page);
    state.post.attachments = Array.from({ length: 8 }, (_, index) => ({
      id: 100 + index, original_name: `기존-${index}.txt`, size_bytes: 10, content_type: "text/plain", created_at: "2026-10-24T15:12:00Z",
    }));
    await gotoAndSettle(page, `${BASE}/workspace/community/notice?id=998`, { timeout: 60_000 });
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await page.locator(".ProseMirror").evaluate((element) => {
      const clipboard = new DataTransfer();
      for (const name of ["붙여넣기-1.svg", "붙여넣기-2.svg"]) {
        clipboard.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"/>'], name, { type: "image/svg+xml" }));
      }
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole("button", { name: "붙여넣기-1.svg 제거", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "붙여넣기-2.svg 제거", exact: true })).toBeVisible();
    await page.locator(".ProseMirror").evaluate((element) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "넘친-이미지.svg", { type: "image/svg+xml" }));
      element.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
    });
    await expect(page.getByText("첨부파일은 기존 파일을 포함해 최대 10개까지 가능합니다.")).toBeVisible();
    await expect(page.getByRole("button", { name: "넘친-이미지.svg 제거", exact: true })).toHaveCount(0);
    await expect(page.locator(".ProseMirror img")).toHaveCount(0);
    expect(state.uploadKeys).toHaveLength(0);
  });

  test("부분 삭제는 재전송 없이 목록과 새로고침에 반영하고 정리 대기를 알린다", async ({ page }) => {
    let deleteRequests = 0;
    let deleted = false;
    let listRequests = 0;
    await page.route("**/api/v1/community/admin/posts/**", async (route) => {
      listRequests += 1;
      if (!deleted) return route.fallback();
      await route.fulfill({ status: 200, headers: CORS_HEADERS, contentType: "application/json",
        body: JSON.stringify({ count: 0, results: [] }) });
    });
    await page.route(`**/api/v1/community/posts/${QUESTION_ID}/`, async (route) => {
      if (route.request().method() === "DELETE") {
        deleteRequests += 1;
        deleted = true;
        return route.fulfill({ status: 502, headers: CORS_HEADERS, contentType: "application/json",
          body: JSON.stringify({ code: "community_storage_cleanup_pending",
            detail: "질문은 삭제됐지만 원본 파일 정리가 지연되고 있습니다.",
            deleted: { posts: 1, attachments: 1, r2_objects: 0 },
            storage_cleanup: { pending: 1, failed: 0, cleaned: 0 } }) });
      }
      if (deleted) return route.fulfill({ status: 404, headers: CORS_HEADERS, contentType: "application/json",
        body: JSON.stringify({ detail: "Not found." }) });
      return route.fallback();
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });
    await page.locator(".qna-inbox__thread-actions").getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("alertdialog", { name: "질문 삭제" }).getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByText(/질문은 삭제됐지만 원본 파일 정리가 지연/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "프린트 진화와 자연선택 20번" })).toHaveCount(0);
    await expect.poll(() => listRequests).toBeGreaterThan(1);
    await page.reload();
    await waitForRenderSettled(page);
    await expect(page.getByRole("heading", { name: "프린트 진화와 자연선택 20번" })).toHaveCount(0);
    expect(deleteRequests).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("데스크톱에서 문제 이미지와 답변기를 함께 보고 미답변 수를 즉시 줄인다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });

    await expect(page.locator(".qna-inbox__reference-pane")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".qna-inbox__answer-pane")).toBeVisible();
    await expect(page.getByTitle("답변 필요 질문 1건").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "QnA 1" })).toBeVisible();
    // WebKit needs the initial font/layout paint before geometry and pointer input.
    await waitForRenderSettled(page);

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
    const viewer = await page.locator(".qna-inbox__image-viewer").boundingBox();
    const originalButton = await page.getByRole("link", { name: "문제 이미지 원본 열기" }).boundingBox();
    expect(viewer).not.toBeNull();
    expect(originalButton).not.toBeNull();
    expect(originalButton!.x + originalButton!.width).toBeLessThanOrEqual(viewer!.x + viewer!.width + 1);

    const editor = page.locator(".qna-inbox__answer-pane .ProseMirror");
    await editor.fill("광합성량 차이는 선택압 변화로 설명할 수 있습니다.");
    await page.getByRole("button", { name: "문제 사진 크게 보며 답변하기" }).click();
    await expect(page.locator(".qna-inbox--expanded")).toBeVisible();
    const expandedGeometry = await page.locator(".qna-inbox__workbench").evaluate((workbench) => {
      const reference = workbench.querySelector<HTMLElement>(".qna-inbox__reference-pane")?.getBoundingClientRect();
      const answer = workbench.querySelector<HTMLElement>(".qna-inbox__answer-pane")?.getBoundingClientRect();
      if (!reference || !answer) throw new Error("확대된 QnA 작업 영역을 찾지 못했습니다.");
      return { referenceWidth: reference.width, referenceRight: reference.right, answerLeft: answer.left };
    });
    expect(expandedGeometry.referenceWidth).toBeGreaterThan(workbenchGeometry.referenceWidth);
    expect(expandedGeometry.referenceRight).toBeLessThanOrEqual(expandedGeometry.answerLeft + 1);
    const expandedEditorHeight = await page.locator(".qna-inbox__answer-pane .rich-editor__content").evaluate((element) => element.getBoundingClientRect().height);
    expect(expandedEditorHeight).toBeGreaterThan(400);
    await expect(editor).toContainText("광합성량 차이는 선택압 변화로 설명할 수 있습니다.");

    const problemImage = page.locator(".qna-inbox__image-stage img");
    await page.getByRole("button", { name: "오른쪽으로 90도 회전" }).click();
    await expect(problemImage).toHaveCSS("transform", /matrix\(0, 1, -1, 0/);
    await page.getByRole("button", { name: "이미지 확대" }).click();
    await expect(page.locator(".qna-inbox__viewer-zoom")).toHaveText("125%");
    await expect(page.getByRole("link", { name: "문제 이미지 원본 열기" })).toHaveAttribute("href", /^data:image\/svg\+xml/);

    await page.keyboard.press("Escape");
    await expect(page.locator(".qna-inbox--expanded")).toHaveCount(0);
    await expect(editor).toContainText("광합성량 차이는 선택압 변화로 설명할 수 있습니다.");
    await expect(page.locator(".qna-inbox__viewer-zoom")).toHaveText("125%");
    await page.getByRole("button", { name: "문제 사진 크게 보며 답변하기" }).click();
    await page.getByRole("button", { name: "답변 등록" }).click();
    await expect(page.getByText("답변이 등록되었습니다.")).toBeVisible();
    await expect(page.getByTitle("답변 필요 질문 1건")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "QnA 1" })).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".qna-inbox__answer-pane")).toContainText("광합성량 차이는 선택압 변화로 설명할 수 있습니다.");

    await page.setViewportSize({ width: 1100, height: 800 });
    await page.getByRole("button", { name: "문제 사진 크게 보며 답변하기" }).click();
    await expect(page.locator(".qna-inbox__reference-pane")).toBeVisible();
    await expect(page.locator(".qna-inbox__answer-pane")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("390px 자료/답변 전환에서 작성 내용을 보존하고 가로 넘침이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });

    await expect(page.getByRole("tab", { name: /질문 자료/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "문제 사진 크게 보며 답변하기" }).click();
    await expect(page.locator(".qna-inbox--expanded")).toBeVisible();
    const referenceOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(referenceOverflow).toBeLessThanOrEqual(1);
    await page.getByRole("tab", { name: "답변 작성" }).click();
    const editor = page.locator(".qna-inbox__answer-pane .ProseMirror");
    await editor.fill("작성 중인 답변은 보존됩니다.");
    await page.getByRole("button", { name: "화면 줄이기", exact: true }).click();
    await expect(editor).toContainText("작성 중인 답변은 보존됩니다.");
    await page.getByRole("tab", { name: /질문 자료/ }).click();
    await page.getByRole("tab", { name: "답변 작성" }).click();
    await expect(editor).toContainText("작성 중인 답변은 보존됩니다.");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("QnA 이미지와 PDF를 모두 보여주고 권한 확인 다운로드·깨진 미리보기를 복구한다", async ({ page }) => {
    const created_at = "2026-08-23T01:21:00Z";
    qnaAttachmentsByPage.set(page, [
      { id: 79, original_name: "20번-문제.jpg", size_bytes: 283400, content_type: "image/jpeg", created_at, download_url: IMAGE_DATA_URL },
      { id: 80, original_name: "수업-자료.pdf", size_bytes: 92000, content_type: "application/pdf", created_at },
      { id: 81, original_name: "복구-문제.jpg", size_bytes: 81200, content_type: "image/jpeg", created_at, download_url: `${BASE}/broken-image/81` },
    ]);
    let allowPdf = false;
    let allowPreview = false;
    let pdfRequests = 0;
    await page.route(`**/api/v1/community/posts/${QUESTION_ID}/attachments/80/download/`, async (route) => {
      pdfRequests += 1;
      expect(route.request().headers()["x-tenant-code"]).toBe("hakwonplus");
      await route.fulfill({
        status: allowPdf ? 200 : 403,
        headers: CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify(allowPdf ? { url: `${BASE}/qna-pdf/80`, original_name: "수업-자료.pdf" } : { detail: "다운로드 권한이 없습니다." }),
      });
    });
    await page.route(`**/api/v1/community/posts/${QUESTION_ID}/attachments/81/download/`, (route) => route.fulfill({
      status: allowPreview ? 200 : 403, headers: CORS_HEADERS, contentType: "application/json",
      body: JSON.stringify(allowPreview ? { url: IMAGE_DATA_URL, original_name: "복구-문제.jpg" } : { detail: "권한이 없습니다." }),
    }));
    await page.route("**/broken-image/81", (route) => route.fulfill({ status: 404, body: "" }));
    await page.route("**/qna-pdf/80", (route) => route.fulfill({
      status: 200,
      headers: { "content-disposition": 'attachment; filename="class-material.pdf"' },
      contentType: "application/pdf",
      body: "%PDF-1.4\n%%EOF",
    }));

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });
    const reference = page.getByRole("region", { name: "학생 질문 자료" });
    await expect(reference.locator(".qna-inbox__pane-caption")).toContainText("이미지 2장 · 파일 1개");
    const pdf = reference.getByRole("region", { name: "첨부파일" });
    await expect(pdf).toContainText("수업-자료.pdf");
    await pdf.getByRole("button", { name: "다운로드" }).click();
    await expect(pdf.getByRole("alert")).toContainText("다시 시도");
    allowPdf = true;
    const downloadPromise = page.waitForEvent("download");
    await pdf.getByRole("button", { name: "다운로드" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    expect(pdfRequests).toBe(2);
    await page.reload();
    await expect(page.getByRole("region", { name: "첨부파일" })).toContainText("수업-자료.pdf");

    await page.setViewportSize({ width: 390, height: 844 });
    const recovery = page.getByRole("region", { name: "미리보기 복구" });
    await expect(recovery).toContainText("복구-문제.jpg");
    await recovery.getByRole("button", { name: "다시 보기" }).click();
    await expect(recovery.getByRole("alert")).toContainText("다시 시도");
    allowPreview = true;
    await recovery.getByRole("button", { name: "다시 보기" }).click();
    await expect(recovery).toHaveCount(0);
    await expect(page.getByRole("img", { name: "복구-문제.jpg" })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("qna-attachments-mobile.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("여러 이미지의 동시 미리보기 복구는 응답 파일을 정확히 선택한다 @qna-preview-recovery", async ({ page }) => {
    qnaAttachmentsByPage.set(page, [80, 82].map((id) => ({
      id, original_name: `문제-${id}.jpg`, size_bytes: 81200, content_type: "image/jpeg", created_at: "2026-08-23T01:21:00Z",
    })));
    const release: Record<number, () => void> = {};
    const pending = Object.fromEntries([80, 82].map((id) => [id, new Promise<void>((resolve) => { release[id] = resolve; })]));
    const requests: number[] = [];
    await page.route(`**/api/v1/community/posts/${QUESTION_ID}/attachments/*/download/`, async (route) => {
      const id = Number(new URL(route.request().url()).pathname.split("/").at(-3));
      requests.push(id);
      await pending[id];
      await route.fulfill({ status: 200, headers: CORS_HEADERS, contentType: "application/json",
        body: JSON.stringify({ url: IMAGE_DATA_URL, original_name: `문제-${id}.jpg` }) });
    });
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });
      const first = page.locator(".qna-inbox__file-card").filter({ hasText: "문제-80.jpg" });
      const second = page.locator(".qna-inbox__file-card").filter({ hasText: "문제-82.jpg" });
      await first.getByRole("button", { name: "다시 보기" }).click();
      await second.getByRole("button", { name: "다시 보기" }).click();
      await expect.poll(() => requests.length).toBe(2);
      release[80]();
      await expect(page.getByRole("img", { name: "문제-80.jpg" })).toBeVisible();
      await expect(second.getByRole("button", { name: "불러오는 중…" })).toBeDisabled();
      release[82]();
      await expect(page.getByRole("region", { name: "미리보기 복구" })).toHaveCount(0);
      await expect(page.getByRole("img", { name: "문제-82.jpg" })).toBeVisible();
      await expect(page.getByRole("button", { name: "2번째 이미지 문제-82.jpg" })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "1번째 이미지 문제-80.jpg" }).click();
      await expect(page.getByRole("img", { name: "문제-80.jpg" })).toBeVisible();
    } finally {
      release[80]();
      release[82]();
    }
  });

  test("여러 첨부파일의 진행·실패 상태를 독립적으로 유지한다", async ({ page }) => {
    qnaAttachmentsByPage.set(page, [80, 82].map((id) => ({
      id, original_name: `자료-${id}.txt`, size_bytes: 30, content_type: "text/plain", created_at: "2026-08-23T01:21:00Z",
    })));
    const release: Record<number, () => void> = {};
    const pending = Object.fromEntries([80, 82].map((id) => [id, new Promise<void>((resolve) => { release[id] = resolve; })]));
    const requests: number[] = [];
    await page.route(`**/api/v1/community/posts/${QUESTION_ID}/attachments/*/download/`, async (route) => {
      const id = Number(new URL(route.request().url()).pathname.split("/").at(-3));
      requests.push(id);
      await pending[id];
      await route.fulfill({ status: 403, headers: CORS_HEADERS, contentType: "application/json", body: JSON.stringify({ detail: "권한이 없습니다." }) });
    });
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });
      const first = page.locator(".qna-inbox__file-card").filter({ hasText: "자료-80.txt" });
      const second = page.locator(".qna-inbox__file-card").filter({ hasText: "자료-82.txt" });
      await first.getByRole("button", { name: "다운로드" }).click();
      await second.getByRole("button", { name: "다운로드" }).click();
      await expect.poll(() => requests.length).toBe(2);
      await expect(first.getByRole("button")).toBeDisabled();
      await expect(second.getByRole("button")).toBeDisabled();
      release[80]();
      await expect(first.getByRole("alert")).toBeVisible();
      await expect(second.getByRole("button")).toBeDisabled();
      release[82]();
      await expect(second.getByRole("alert")).toBeVisible();
      await expect(first.getByRole("alert")).toBeVisible();
      expect(requests.sort()).toEqual([80, 82]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    } finally {
      release[80]();
      release[82]();
    }
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
