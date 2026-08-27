import { test, expect } from "../fixtures/strictTest";
import type { Page, Route } from "@playwright/test";

const BASE =
  process.env.E2E_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.E2E_LOCAL_BASE_URL ||
  "http://127.0.0.1:5175";
const POST_ID = 990001;

async function installRegistrationPolicyMocks(
  page: Page,
  options: { registrationStatus: 200 | 403 | 503 },
) {
  const mutationRequests: string[] = [];
  let registrationStatus = options.registrationStatus;
  const registration = {
    id: 991001,
    name: "과거 가입 요청",
    phone: "01000000001",
    parent_phone: "01000000002",
    school_type: "HIGH",
    grade: "1",
    gender: "F",
    memo: "",
    status: "pending",
    created_at: "2026-08-23T00:00:00+09:00",
    high_school: "테스트고",
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (
      path.startsWith("/students/registration_requests/") &&
      request.method() !== "GET" &&
      request.method() !== "OPTIONS"
    ) {
      mutationRequests.push(`${request.method()} ${path}`);
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: registrationStatus === 403 ? "godmin" : "hakwonplus",
        display_name: "테스트 학원",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 101,
        username: "teacher",
        name: "선생님",
        phone: null,
        is_staff: true,
        is_superuser: false,
        tenantRole: "admin",
      });
    }
    if (path === "/students/registration_requests/") {
      if (registrationStatus === 403) {
        return json({
          code: "self_registration_disabled",
          detail: "이 학원은 운영정책상 학생 회원가입을 사용하지 않습니다.",
        }, 403);
      }
      if (registrationStatus === 503) {
        return json({ detail: "temporary failure" }, 503);
      }
      return json({ count: 1, results: [registration] });
    }
    if (path === "/lectures/sessions/") return json({ count: 0, results: [] });
    if (path === "/clinic/participants/") return json({ count: 0, results: [] });
    if (path === "/community/admin/posts/") return json({ count: 0, results: [] });
    if (path === "/submissions/submissions/pending/") return json([]);
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0 });
    if (path === "/core/landing/admin/consult/") return json({ summary: { unread: 0 } });
    if (path === "/community/admin/reports/pending-count/") return json({ count: 0 });
    if (path === "/community/notifications/unread-count/") return json({ count: 0 });
    if (path === "/lectures/attendance/arrival-overview/") {
      return json({
        generated_at: "2026-08-27T09:00:00+09:00",
        today: "2026-08-27",
        tomorrow: "2026-08-28",
        range_end: "2026-09-03",
        range_days: 7,
        soon_window_minutes: 60,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, overdue: 0, time_unset: 0 },
        items: [],
      });
    }
    return json({ count: 0, results: [] });
  });

  await page.addInitScript((tenantCode) => {
    localStorage.setItem("access", "mock-access");
    localStorage.setItem("refresh", "mock-refresh");
    localStorage.setItem("tenant_code", tenantCode);
    sessionStorage.setItem("tenantCode", tenantCode);
    localStorage.setItem("teacher:preferAdmin", "0");
  }, registrationStatus === 403 ? "godmin" : "hakwonplus");

  return {
    mutationRequests,
    setRegistrationStatus(status: 200 | 403 | 503) {
      registrationStatus = status;
    },
  };
}

test.describe("선생님 소통 모바일 답변 시트", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test("Q&A 답변 등록 버튼이 하단 탭바에 가려지지 않고 답변을 등록한다", async ({ page }) => {
    const post = {
      id: POST_ID,
      post_type: "qna",
      title: "[E2E] 모바일 답변 버튼 회귀",
      content: "<p>감수 1분열 중기는 다양성과 상관이 있는데</p><p>왜 감수 2분열 중기는 다양성과 상관이 없나요</p>",
      author_display_name: "어찬희",
      author_role: "student",
      replies_count: 0,
      created_at: "2026-06-03T08:49:00.000Z",
    };
    const replies: Array<{
      id: number;
      post: number;
      content: string;
      author_display_name: string;
      author_role: string;
      created_at: string;
    }> = [];

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });

      if (path === "/core/program/") {
        return json({
          tenantCode: "hakwonplus",
          display_name: "학원플러스",
          ui_config: { login_title: "학원플러스" },
          feature_flags: {},
          is_active: true,
        });
      }

      if (path === "/core/me/") {
        return json({
          id: 101,
          username: "teacher",
          name: "선생님",
          phone: null,
          is_staff: true,
          is_superuser: false,
          tenantRole: "admin",
        });
      }

      if (path === "/community/admin/posts/") {
        const postType = url.searchParams.get("post_type");
        const results = postType === "qna" ? [post] : [];
        return json({ results, count: results.length });
      }

      if (path === "/community/posts/" && request.method() === "GET") {
        return json({ results: [post], count: 1 });
      }

      if (path === `/community/posts/${POST_ID}/replies/` && request.method() === "GET") {
        return json({ results: replies, count: replies.length });
      }

      if (path === `/community/posts/${POST_ID}/replies/` && request.method() === "POST") {
        const raw = request.postData();
        let payload: { content?: string } = {};
        if (raw) {
          try {
            payload = JSON.parse(raw) as { content?: string };
          } catch {
            payload = Object.fromEntries(new URLSearchParams(raw)) as { content?: string };
          }
        }
        const reply = {
          id: 880001,
          post: POST_ID,
          content: `<p>${String(payload.content ?? "")}</p>`,
          author_display_name: "선생님",
          author_role: "staff",
          created_at: new Date().toISOString(),
        };
        replies.push(reply);
        post.replies_count = replies.length;
        return json(reply, 201);
      }

      return json({});
    });

    await page.addInitScript(() => {
      localStorage.setItem("access", "mock-access");
      localStorage.setItem("refresh", "mock-refresh");
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    });

    await page.goto(`${BASE}/workspace/mobile/comms?tab=qna`, { waitUntil: "load", timeout: 20_000 });

    await expect(page.getByText(post.title)).toBeVisible({ timeout: 10_000 });
    await page.getByText(post.title).click();
    await expect(page.getByText("감수 1분열 중기는 다양성과 상관이 있는데")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("왜 감수 2분열 중기는 다양성과 상관이 없나요")).toBeVisible();
    await expect.poll(async () => page.locator("body").innerText()).not.toContain("<p>");
    await expect(page.getByText("아직 답변이 없습니다")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "답변 작성" }).click();
    const sheet = page.getByRole("dialog", { name: "답변 작성" });
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    const answer = "감수 2분열이라서 그래요.";
    await sheet.getByPlaceholder(/답변을 입력하세요/).fill(answer);

    const submit = sheet.getByRole("button", { name: "등록" });
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect
      .poll(() => submit.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return target === el || el.contains(target);
      }))
      .toBe(true);

    const replyResponse = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes(`/community/posts/${POST_ID}/replies/`),
      { timeout: 10_000 },
    );
    await submit.click();
    expect((await replyResponse).status()).toBe(201);

    await expect(sheet).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(answer)).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => page.locator("body").innerText()).not.toContain("<p>");
  });
});

test.describe("선생님 가입 정책과 대기 업무 경계", () => {
  test.use({ serviceWorkers: "block" });

  test("자가 가입 비활성 요청은 업무로 광고하지 않고 기록 안내만 보여준다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { mutationRequests } = await installRegistrationPolicyMocks(page, { registrationStatus: 403 });

    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "load", timeout: 20_000 });
    await expect(page.getByText("가입 신청 학생", { exact: true })).toHaveCount(0);
    await expect(page.getByText("업무 확인 필요", { exact: true })).toHaveCount(0);
    await expect(page.getByText("정리됨", { exact: true }).first()).toBeVisible();

    await page.goto(`${BASE}/workspace/mobile/comms?tab=requests`, { waitUntil: "load", timeout: 20_000 });
    await expect(page.getByText("학생 자가 가입을 사용하지 않습니다", { exact: true })).toBeVisible();
    await expect(page.getByText(/정책 변경 전에 접수된 요청은 기록으로 보존/)).toBeVisible();
    await expect(page.getByRole("button", { name: "승인", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "거절", exact: true })).toHaveCount(0);
    expect(mutationRequests).toEqual([]);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("자가 가입 사용 학원은 대시보드 CTA에서 실제 처리 탭으로 이동한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await installRegistrationPolicyMocks(page, { registrationStatus: 200 });

    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "load", timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "가입 신청 학생 1건" })).toBeVisible();
    await page.getByRole("button", { name: "처리 필요 처리하러 가기" }).click();

    await expect(page).toHaveURL(/\/workspace\/mobile\/comms\?tab=requests$/);
    await expect(page.getByText("과거 가입 요청", { exact: true })).toBeVisible();
    await page.getByText("과거 가입 요청", { exact: true }).click();
    await expect(page.getByRole("button", { name: "승인", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "거절", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("대기 업무 일부 조회 실패를 0건이나 정리됨으로 합성하지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const policy = await installRegistrationPolicyMocks(page, { registrationStatus: 503 });

    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "load", timeout: 20_000 });
    await expect(page.getByText("업무 알림을 모두 불러오지 못했습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("정리됨", { exact: true })).toHaveCount(0);
    await expect(page.getByText("0건", { exact: true })).toHaveCount(0);
    await expect(page.getByText("처리 대기함이 비었습니다", { exact: true })).toHaveCount(0);
    await expect(page.getByText("처리 대기함을 모두 불러오지 못했습니다", { exact: true })).toBeVisible();

    policy.setRegistrationStatus(200);
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByRole("heading", { name: "가입 신청 학생 1건" })).toBeVisible();

    policy.setRegistrationStatus(503);
    await page.goto(`${BASE}/workspace/mobile/notifications`, { waitUntil: "load", timeout: 20_000 });
    await expect(page.getByText("일부 업무 알림을 불러오지 못했습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("처리할 업무 알림이 없습니다", { exact: true })).toHaveCount(0);

    await page.goto(`${BASE}/workspace/students/requests`, { waitUntil: "load", timeout: 20_000 });
    await expect(page.getByText("가입 신청을 불러오지 못했습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("대기 중인 가입 신청이 없습니다", { exact: true })).toHaveCount(0);
    await expect(page.getByText("자동 승인", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "선택 승인", exact: true })).toHaveCount(0);

    policy.setRegistrationStatus(200);
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByText("과거 가입 요청", { exact: true })).toBeVisible();
    await expect(page.getByText("자동 승인", { exact: true })).toBeVisible();
  });
});
