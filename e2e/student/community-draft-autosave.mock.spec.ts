import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const IS_LOCAL_BASE = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE);
const QNA_KEY = "student-community-draft:qna:hakwonplus:user:12";
const COUNSEL_KEY = "student-community-draft:counsel:hakwonplus:user:12";
const LEGACY_QNA_KEY = "student.community.qna.draft";
const OTHER_TENANT_KEY = "student-community-draft:qna:tchul:user:12";
const OTHER_USER_KEY = "student-community-draft:qna:hakwonplus:user:99";

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: "hakwonplus",
    user_id: 12,
  })).toString("base64url");
  return `e30.${payload}.student-draft`;
}

async function installStudentApi(page: Page, state: { failSubmit?: boolean } = {}) {
  const token = fakeJwt();
  await page.addInitScript(({ jwt }) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { jwt: token });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith("/token/refresh/")) return json({ access: token, refresh: `${token}-refresh` });
    if (path.endsWith("/core/program/")) {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", is_active: true, ui_config: {}, feature_flags: {} });
    }
    if (path.endsWith("/core/me/")) {
      return json({ id: 12, username: "student-12", name: "김하늘", is_staff: false, is_superuser: false, tenantRole: "student", linkedStudents: [] });
    }
    if (path.endsWith("/student/me/")) {
      return json({ id: 12, username: "student-12", name: "김하늘", displayName: "김하늘", is_student: true, isParentReadOnly: false });
    }
    if (path.endsWith("/student/video/me/")) {
      return json({ lectures: [{ id: 71, title: "고1 수학" }] });
    }
    if (path.endsWith("/community/posts/my-activity/")) {
      return json({ is_student: true, days: 30, post_count: 0, reply_count: 0, received_likes: 0, rank: null, total_active_students: 0, badges: [] });
    }
    if (path.endsWith("/community/posts/notices/") || path.endsWith("/community/posts/board/") || path.endsWith("/community/posts/materials/")) {
      return json([]);
    }
    if (path.endsWith("/community/posts/") && request.method() === "GET") {
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path.endsWith("/community/posts/") && request.method() === "POST") {
      if (state.failSubmit) return json({ detail: "질문 전송 실패" }, 503);
      return json({
        id: 901,
        post_type: "qna",
        title: "저장된 질문",
        content: "<p>저장된 본문</p>",
        created_by: 12,
        created_at: "2026-08-25T10:00:00+09:00",
        mappings: [],
        attachments: [],
      }, 201);
    }
    return json({ count: 0, next: null, previous: null, results: [] });
  });
}

async function openForm(page: Page, tab: "QnA" | "상담") {
  await page.goto(`${BASE}/student/community`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: tab, exact: true }).click();
  await page.getByRole("button", { name: tab === "QnA" ? "질문하기" : "상담 신청하기", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
}

async function flushPageDraft(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
}

async function readDraft(page: Page, key: string) {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

test.describe("학생 커뮤니티 durable draft", () => {
  test.skip(!IS_LOCAL_BASE, "학생 커뮤니티 초안 route-mock 검증은 로컬 dev 서버 전용");
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  test("QnA와 상담을 tenant/user/form별로 저장하고 첨부 재선택까지 복구한다", async ({ page }) => {
    await installStudentApi(page);
    await page.addInitScript(({ legacyKey, otherTenantKey, otherUserKey }) => {
      sessionStorage.setItem(legacyKey, JSON.stringify({ title: "예전 전역 초안" }));
      const savedAt = Date.now();
      localStorage.setItem(otherTenantKey, JSON.stringify({ version: 1, savedAt, data: { title: "다른 학원 초안", content: "다른 학원" } }));
      localStorage.setItem(otherUserKey, JSON.stringify({ version: 1, savedAt, data: { title: "다른 학생 초안", content: "다른 학생" } }));
    }, { legacyKey: LEGACY_QNA_KEY, otherTenantKey: OTHER_TENANT_KEY, otherUserKey: OTHER_USER_KEY });
    await openForm(page, "QnA");

    await expect(page.getByPlaceholder("질문 제목")).toHaveValue("");
    await expect(page.getByText("예전 전역 초안", { exact: true })).toHaveCount(0);
    await expect(page.getByText("다른 학원 초안", { exact: true })).toHaveCount(0);
    await expect(page.getByText("다른 학생 초안", { exact: true })).toHaveCount(0);

    await page.getByPlaceholder("질문 제목").fill("수학 질문 초안");
    await page.locator(".ProseMirror").fill("풀이 과정이 이해되지 않습니다.");
    await page.locator(".community-file-picker__input").setInputFiles({
      name: "question.png",
      mimeType: "image/png",
      buffer: Buffer.from("draft-image"),
    });
    await flushPageDraft(page);

    const qnaDraft = await readDraft(page, QNA_KEY);
    expect(qnaDraft).toMatchObject({
      version: 1,
      data: { title: "수학 질문 초안", hadAttachments: true },
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "QnA", exact: true }).click();
    await page.getByRole("button", { name: "질문하기", exact: true }).click();
    await expect(page.getByPlaceholder("질문 제목")).toHaveValue("수학 질문 초안");
    await expect(page.locator(".ProseMirror")).toContainText("풀이 과정이 이해되지 않습니다.");
    await expect(page.getByText("첨부파일은 다시 선택해 주세요.", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(({ legacyKey, otherTenantKey, otherUserKey }) => ({
      legacy: sessionStorage.getItem(legacyKey),
      otherTenant: localStorage.getItem(otherTenantKey),
      otherUser: localStorage.getItem(otherUserKey),
    }), { legacyKey: LEGACY_QNA_KEY, otherTenantKey: OTHER_TENANT_KEY, otherUserKey: OTHER_USER_KEY })).toEqual(expect.objectContaining({
      legacy: expect.stringContaining("예전 전역 초안"),
      otherTenant: expect.stringContaining("다른 학원 초안"),
      otherUser: expect.stringContaining("다른 학생 초안"),
    }));

    await page.getByRole("button", { name: "뒤로", exact: true }).click();
    await page.getByRole("button", { name: "상담", exact: true }).click();
    await page.getByRole("button", { name: "상담 신청하기", exact: true }).click();
    await page.getByPlaceholder("예: 진로 상담, 학습 방법 상담").fill("진로 상담 초안");
    await page.locator(".ProseMirror").fill("진학 방향을 상담하고 싶습니다.");
    await flushPageDraft(page);

    const counselDraft = await readDraft(page, COUNSEL_KEY);
    expect(counselDraft).toMatchObject({ version: 1, data: { title: "진로 상담 초안" } });
    expect((await readDraft(page, QNA_KEY)).data.title).toBe("수학 질문 초안");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "상담", exact: true }).click();
    await page.getByRole("button", { name: "상담 신청하기", exact: true }).click();
    await expect(page.getByPlaceholder("예: 진로 상담, 학습 방법 상담")).toHaveValue("진로 상담 초안");
  });

  test("저장소 실패를 숨기지 않고 제출은 계속 허용한다", async ({ page }) => {
    await installStudentApi(page);
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key: string, value: string) {
        if (key.startsWith("student-community-draft:")) throw new DOMException("quota", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    await openForm(page, "QnA");
    await page.getByPlaceholder("질문 제목").fill("저장 실패도 제출 가능");
    await page.locator(".ProseMirror").fill("초안 저장 실패를 사용자에게 보여 주세요.");

    await expect(page.getByRole("alert")).toContainText("초안을 저장하지 못했습니다");
    await expect(page.getByRole("button", { name: "질문 보내기", exact: true })).toBeEnabled();
  });

  test("형식이 잘못되거나 7일이 지난 초안은 복구하지 않고 exact key만 정리한다", async ({ page }) => {
    await installStudentApi(page);
    await page.addInitScript(({ qnaKey, counselKey }) => {
      localStorage.setItem(qnaKey, JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: { title: 17, content: "잘못된 형식" },
      }));
      localStorage.setItem(counselKey, JSON.stringify({
        version: 1,
        savedAt: Date.now() - (8 * 24 * 60 * 60 * 1000),
        data: { title: "만료 초안", content: "만료", categoryLabel: "", hadAttachments: false },
      }));
    }, { qnaKey: QNA_KEY, counselKey: COUNSEL_KEY });

    await openForm(page, "QnA");
    await expect(page.getByPlaceholder("질문 제목")).toHaveValue("");
    await expect.poll(() => readDraft(page, QNA_KEY)).toBeNull();
    await page.getByRole("button", { name: "뒤로", exact: true }).click();
    await page.getByRole("button", { name: "상담", exact: true }).click();
    await page.getByRole("button", { name: "상담 신청하기", exact: true }).click();
    await expect(page.getByPlaceholder("예: 진로 상담, 학습 방법 상담")).toHaveValue("");
    await expect.poll(() => readDraft(page, COUNSEL_KEY)).toBeNull();
  });

  test("다른 탭의 더 최신 초안을 감지하고 명시적으로 불러온다", async ({ page, context }) => {
    await installStudentApi(page);
    await openForm(page, "QnA");
    await page.getByPlaceholder("질문 제목").fill("첫 번째 탭 초안");
    await page.locator(".ProseMirror").fill("첫 번째 내용");
    await flushPageDraft(page);

    const second = await context.newPage();
    await installStudentApi(second);
    await openForm(second, "QnA");
    await expect(second.getByPlaceholder("질문 제목")).toHaveValue("첫 번째 탭 초안");

    await page.getByPlaceholder("질문 제목").fill("더 최신 초안");
    await flushPageDraft(page);
    await expect(second.getByRole("alert")).toContainText("다른 탭에서 더 최신 초안");
    await second.getByRole("button", { name: "다른 탭 초안 불러오기", exact: true }).click();
    await expect(second.getByPlaceholder("질문 제목")).toHaveValue("더 최신 초안");
    await second.close();
  });

  test("API 실패에는 초안을 유지하고 등록 성공 뒤에만 제거한다", async ({ page }) => {
    const state = { failSubmit: true };
    await installStudentApi(page, state);
    await openForm(page, "QnA");
    await page.getByPlaceholder("질문 제목").fill("제출 왕복 초안");
    await page.locator(".ProseMirror").fill("실패하면 이 내용을 보존해 주세요.");
    await flushPageDraft(page);
    expect((await readDraft(page, QNA_KEY)).data.title).toBe("제출 왕복 초안");

    await page.getByRole("button", { name: "질문 보내기", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("질문 전송 실패");
    expect((await readDraft(page, QNA_KEY)).data.title).toBe("제출 왕복 초안");

    state.failSubmit = false;
    await page.getByRole("button", { name: "질문 보내기", exact: true }).click();
    await expect.poll(() => readDraft(page, QNA_KEY)).toBeNull();
  });
});
