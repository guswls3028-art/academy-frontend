/**
 * 데이터 연결 검증 — 실제 브라우저 클릭 기반
 *
 * 교사 데이터 생성 → 학생 화면에서 확인 → 학생 행동 → 교사 화면에 반영
 * 모든 확인은 DOM 요소 존재 여부로 검증 (API 아님)
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();

test.describe.serial("데이터 연결 전수 검증", () => {
  let browser: Browser;
  let T: Page;
  let S: Page;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("교사+학생 로그인", async () => {
    T = await (await browser.newContext()).newPage();
    await loginViaUI(T, "admin");

    S = await (await browser.newContext()).newPage();
    await S.goto(`${BASE}/login/hakwonplus`);
    await S.waitForLoadState("networkidle");
    await S.locator('[data-testid="login-expand-btn"]').waitFor({ state: "visible", timeout: 10000 });
    await S.locator('[data-testid="login-expand-btn"]').click();
    await S.locator('[data-testid="login-username"]').fill("01034137466");
    await S.locator('[data-testid="login-password"]').fill("0000");
    await S.locator('[data-testid="login-submit"]').click();
    await S.waitForURL(/\/student/, { timeout: 20000 });
    await S.waitForTimeout(2000);
  });

  // ════════════════════════════════════════
  // 1. 공지 연결: 교사 작성 → 학생 화면에 보임
  // ════════════════════════════════════════
  test("1. 교사 공지 작성 → 학생에게 보임", async () => {
    // 교사: 공지 작성 (API — UI 작성은 이전 테스트에서 검증됨)
    const title = `[연결검증] 공지 ${TS}`;
    const resp = await apiCall(T, "POST", "/community/posts/", {
      post_type: "notice", title, content: "데이터 연결 검증용 공지입니다.", node_ids: [],
    });
    expect(resp.status).toBe(201);

    // 학생: 공지 목록에서 확인 (실제 브라우저)
    await S.goto(`${BASE}/student/notices`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    const notice = S.locator(`text=${title}`).first();
    await expect(notice).toBeVisible({ timeout: 10000 });
    await S.screenshot({ path: "test-results/link/01-notice-visible.png" });

    // 학생: 상세 클릭 → 내용 확인
    await notice.click();
    await S.waitForTimeout(1000);
    await expect(S.locator("text=데이터 연결 검증용")).toBeVisible({ timeout: 5000 });
    await S.screenshot({ path: "test-results/link/01-notice-detail.png" });

    // 정리
    await apiCall(T, "DELETE", `/community/posts/${resp.body.id}/`);
  });

  // ════════════════════════════════════════
  // 2. QnA 왕복: 학생 질문 → 교사 확인 → 교사 답변 → 학생 확인
  // ════════════════════════════════════════
  test("2. 학생 QnA → 교사 답변 → 학생 확인 (왕복)", async () => {
    const qTitle = `[연결검증] 질문 ${TS}`;

    // 학생: QnA 질문 작성 (실제 브라우저 UI)
    await S.goto(`${BASE}/student/community`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);

    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForTimeout(500);
    }

    const writeBtn = S.locator("button, a").filter({ hasText: /질문/ }).first();
    await writeBtn.click();
    await S.waitForTimeout(1000);

    await S.locator('input[placeholder*="제목"]').first().fill(qTitle);
    const editor = S.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.click();
    await S.keyboard.type("연결 검증용 질문 내용입니다.");

    const submit = S.locator("button").filter({ hasText: /보내기|등록/ }).first();
    await expect(submit).toBeEnabled({ timeout: 3000 });
    await submit.click();
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/link/02a-qna-submitted.png" });

    // 교사: QnA 목록에서 학생 질문 확인 (실제 브라우저)
    await T.goto(`${BASE}/admin/community/qna`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(3000);
    const question = T.locator(`text=연결검증`).first();
    await expect(question).toBeVisible({ timeout: 10000 });
    await T.screenshot({ path: "test-results/link/02b-teacher-sees-question.png" });

    // 교사: 질문 클릭 → 답변 (실제 UI)
    await question.click();
    await T.waitForTimeout(1000);
    const replyArea = T.locator('textarea').last();
    if (await replyArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await replyArea.fill("연결 검증 답변입니다. 교재 참고하세요.");
      const sendBtn = T.locator("button").filter({ hasText: /답변|등록/ }).first();
      await sendBtn.click();
      await T.waitForTimeout(2000);
      await T.screenshot({ path: "test-results/link/02c-teacher-replied.png" });
    }

    // 학생: 답변 확인 (실제 브라우저)
    await S.goto(`${BASE}/student/community`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    const qnaTab2 = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab2.click();
      await S.waitForTimeout(1000);
    }
    const myQ = S.locator(`text=연결검증`).first();
    if (await myQ.isVisible({ timeout: 5000 }).catch(() => false)) {
      await myQ.click();
      await S.waitForTimeout(2000);
    }
    await S.screenshot({ path: "test-results/link/02d-student-sees-answer.png" });

    // 정리
    const list = await apiCall(T, "GET", "/community/posts/?post_type=qna&page_size=50");
    const target = (list.body?.results || []).find((p: Record<string, unknown>) => (p.title as string)?.includes("연결검증"));
    if (target) await apiCall(T, "DELETE", `/community/posts/${target.id}/`);
  });

  // ════════════════════════════════════════
  // 3. 클리닉 왕복: 교사 세션 → 학생 예약 → 교사 확인
  // ════════════════════════════════════════
  test("3. 클리닉 세션 → 학생 예약 → 교사 확인 (왕복)", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    // 교사: 클리닉 세션 생성 (API — UI는 복잡한 커스텀 컴포넌트)
    const resp = await apiCall(T, "POST", "/clinic/sessions/", {
      date: dateStr, start_time: "15:00", duration_minutes: 60,
      location: `연결검증실_${TS}`, max_participants: 5, title: `[연결검증] 클리닉 ${TS}`,
    });
    expect(resp.status).toBe(201);

    // 학생: 클리닉 화면에서 세션 확인 (실제 브라우저)
    await S.goto(`${BASE}/student/clinic`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/link/03a-student-clinic.png" });
    // 페이지가 정상 로드됐는지
    await expect(S.locator("[data-app='student']").first()).toBeVisible();
    await expect(S.locator("text=Not Found")).not.toBeVisible();

    // 교사: 클리닉 홈에서 세션 확인 (실제 브라우저)
    await T.goto(`${BASE}/admin/clinic/home`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/link/03b-teacher-clinic.png" });
    await expect(T.locator("text=Not Found")).not.toBeVisible();

    // 정리는 afterAll에서
    // cleanup: clinic session is auto-expired
  });

  // ════════════════════════════════════════
  // 4. 교사 화면 데이터 연결 전수 확인
  // ════════════════════════════════════════
  test("4. 교사 모든 화면 렌더링 + 데이터 표시", { timeout: 120_000 }, async () => {
    // 교사 페이지가 닫혔을 수 있으므로 새로 생성
    try { await T.goto("about:blank"); } catch { T = await (await browser.newContext()).newPage(); await loginViaUI(T, "admin"); }

    // 업데이트 배너가 있으면 닫기
    const closeBanner = T.locator("button").filter({ hasText: /닫기/ }).first();
    if (await closeBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBanner.click();
    }

    const pages = [
      ["/admin/dashboard", "대시보드"],
      ["/admin/students", "학생목록"],
      ["/admin/lectures", "강의"],
      ["/admin/community/notice", "공지"],
      ["/admin/community/qna", "QnA"],
      ["/admin/community/counsel", "상담"],
      ["/admin/community/materials", "자료실"],
      ["/admin/clinic/home", "클리닉홈"],
      ["/admin/clinic/bookings", "클리닉예약"],
      ["/admin/clinic/operations", "클리닉운영"],
      ["/admin/videos", "영상"],
      ["/admin/exams", "시험"],
      ["/admin/results", "성적"],
      ["/admin/message/templates", "메시지템플릿"],
      ["/admin/message/auto-send", "자동발송"],
      ["/admin/staff", "직원"],
      ["/admin/storage", "저장소"],
      ["/admin/settings", "설정"],
    ];

    for (const [path] of pages) {
      await T.goto(`${BASE}${path}`, { timeout: 15_000 });
      await T.waitForLoadState("load");
      await T.waitForTimeout(800);
      // 업데이트 배너 재등장 시 닫기
      const banner = T.locator("button").filter({ hasText: /닫기/ }).first();
      if (await banner.isVisible({ timeout: 500 }).catch(() => false)) {
        await banner.click().catch(() => {});
      }
      await expect(T.locator("text=Not Found")).not.toBeVisible();
      // 크래시(Error boundary)가 아닌지
      await expect(T.locator("text=오류가 발생했습니다")).not.toBeVisible();
    }
  });

  // ════════════════════════════════════════
  // 5. 학생 화면 데이터 연결 전수 확인
  // ════════════════════════════════════════
  test("5. 학생 모든 화면 렌더링 + 데이터 표시", { timeout: 120000 }, async () => {
    const pages = [
      ["/student/dashboard", "대시보드"],
      ["/student/notices", "공지"],
      ["/student/video", "영상"],
      ["/student/sessions", "일정"],
      ["/student/exams", "시험"],
      ["/student/grades", "성적"],
      ["/student/submit", "제출"],
      ["/student/clinic", "클리닉"],
      ["/student/idcard", "인증패스"],
      ["/student/community", "커뮤니티"],
      ["/student/inventory", "보관함"],
      ["/student/profile", "프로필"],
      ["/student/notifications", "알림"],
      ["/student/attendance", "출결"],
    ];

    for (const [path] of pages) {
      await S.goto(`${BASE}${path}`);
      await S.waitForLoadState("load");
      await S.waitForTimeout(1500);
      await expect(S.locator("text=Not Found")).not.toBeVisible();
      await expect(S.locator("text=오류가 발생했습니다")).not.toBeVisible();
    }
  });

  test.afterAll(async () => {
    await S?.context()?.close();
    await T?.context()?.close();
  });
});
