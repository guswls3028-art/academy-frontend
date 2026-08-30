import { devices, type Page, type Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

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
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0 });
    if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
    return json({ count: 0, results: [] });
  });
}

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

  test("390px 자료/답변 전환에서 작성 내용을 보존하고 가로 넘침이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/qna?id=${QUESTION_ID}`, { timeout: 60_000 });

    await expect(page.getByRole("tab", { name: /질문 자료/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "답변 작성" }).click();
    const editor = page.locator(".qna-inbox__answer-pane .ProseMirror");
    await editor.fill("작성 중인 답변은 보존됩니다.");
    await page.getByRole("tab", { name: /질문 자료/ }).click();
    await page.getByRole("tab", { name: "답변 작성" }).click();
    await expect(editor).toContainText("작성 중인 답변은 보존됩니다.");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("큰 이미지를 넣은 공지 작성 폼 안에서 등록 버튼까지 스크롤할 수 있다", async ({ page }) => {
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
    await expect(formBody.locator(".ProseMirror img")).toBeVisible();
    await expect.poll(() => formBody.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);

    const initialFormScrollTop = await formBody.evaluate((element) => element.scrollTop);
    await submit.scrollIntoViewIfNeeded();
    await expect.poll(() => formBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(initialFormScrollTop);
    await expect(submit).toBeInViewport();
  });

  test("390px에서 큰 이미지 위로 스크롤해 공지를 한 번만 등록한다", async ({ page }) => {
    const noticeImageSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1600"><rect width="720" height="1600" fill="#fff"/><text x="40" y="100" font-size="48">29번 정답 정오</text></svg>';
    const createBodies: unknown[] = [];
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
    await expect(formBody.locator(".ProseMirror img")).toBeVisible();
    const initialOuterScrollTop = await formBody.evaluate((element) => {
      let current = element.parentElement;
      while (current) {
        const overflowY = getComputedStyle(current).overflowY;
        if (/(auto|scroll)/.test(overflowY) && current.scrollHeight > current.clientHeight) {
          current.dataset.noticeScrollOwner = "true";
          return current.scrollTop;
        }
        current = current.parentElement;
      }
      throw new Error("공지 작성 화면의 바깥 세로 스크롤 영역을 찾지 못했습니다.");
    });
    const outerScroller = page.locator('[data-notice-scroll-owner="true"]');

    await formBody.hover();
    await page.mouse.wheel(0, 800);
    await expect.poll(() => outerScroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(initialOuterScrollTop);
    await expect(submit).toBeInViewport();
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
      content: `<img src="data:image/svg+xml;base64,${Buffer.from(noticeImageSvg).toString("base64")}"><p></p>`,
      node_ids: [],
    });

    releaseCreate?.();
    await expect(page.getByText("공지가 등록되었습니다.")).toBeVisible();
    await expect.poll(() => createBodies).toHaveLength(1);
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
