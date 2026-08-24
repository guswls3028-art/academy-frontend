import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const QUESTION_ID = 4332;
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
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
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
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
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
});
