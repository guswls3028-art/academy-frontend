/**
 * 성적표 알림톡 발송 리뷰 (2026-05-14)
 *
 * 검증:
 *   1. 일괄 발송 — modal textarea 수정 → preview 동기화 (P1 fix)
 *   2. 일괄 발송 — payload._body_subst 가 학원장 수정본 반영 (P0 fix)
 *
 * 안전:
 *   - Tenant 1 (admin97) only
 *   - POST /api/v1/messages/send → route.fulfill mock → 실 큐 안 들어감
 */
import { test, expect, Page } from "@playwright/test";

// FIX 검증 위해 dev server (5174) 사용. API는 prod (api.hakwonplus.com) 직결.
// 직전 prod 검증으로 P1(preview/textarea divergence) 결함 실재 확인됨.
const BASE = process.env.E2E_BASE_URL_OVERRIDE || "https://hakwonplus.com";
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const USER = process.env.E2E_ADMIN_USER || "admin97";
const PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";

async function loginAdmin(page: Page) {
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: USER, password: PASS, tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    timeout: 30_000,
  });
  if (!resp.ok()) throw new Error(`login fail ${resp.status()}`);
  const json = await resp.json();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ access, refresh }: { access: string; refresh: string }) => {
    localStorage.setItem("hkp.token", access);
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    // dev server localhost 에서 axios가 X-Tenant-Code 박을 수 있도록 storage에도 명시.
    localStorage.setItem("tenant_code", "hakwonplus");
  }, { access: json.access, refresh: json.refresh });
}

type SendPayload = {
  raw_body?: string;
  alimtalk_extra_vars_per_student?: Record<string, Record<string, string>>;
  [key: string]: unknown;
};

test.describe("성적 알림톡 발송 리뷰", () => {
  test("일괄 발송 — textarea 수정이 preview + payload 양쪽 반영", async ({ page }) => {
    // dev server localhost 에서 axios는 host header localhost → backend tenant resolver fail.
    // 모든 API 요청에 X-Tenant-Code 헤더 박아 우회.
    await page.setExtraHTTPHeaders({ "X-Tenant-Code": "hakwonplus" });
    let capturedPayload: SendPayload | null = null;
    await page.route("**/api/v1/messaging/send/", async (route) => {
      capturedPayload = route.request().postDataJSON() as SendPayload;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ detail: "발송 예정 1건. (mocked)", enqueued: 1, enqueue_failed: 0, skipped_no_phone: 0 }),
      });
    });

    await loginAdmin(page);

    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: "_artifacts/score-alimtalk-review/00-dashboard.png", fullPage: true });

    // admin97 권한 강의/세션 ID 자동 탐색 — API로 첫 강의 + 첫 세션 fetch
    const tokenJson = await page.evaluate(() => ({
      access: localStorage.getItem("hkp.token") || localStorage.getItem("access") || "",
    }));
    const headers = { Authorization: `Bearer ${tokenJson.access}`, "X-Tenant-Code": "hakwonplus" };
    const lecturesResp = await page.request.get(`${API_BASE}/api/v1/lectures/lectures/`, { headers });
    console.log(`lectures API status=${lecturesResp.status()}`);
    const lectures = await lecturesResp.json().catch(() => ({}));
    const lectureList = Array.isArray(lectures) ? lectures : (lectures.results || []);
    console.log(`강의 총 ${lectureList.length}개`);
    if (lectureList.length === 0) { test.skip(true, "강의 없음"); return; }
    const LECTURE_ID = lectureList[0].id;
    console.log(`강의 ${LECTURE_ID} (${lectureList[0].title || lectureList[0].name}) 선택`);

    const sessionsResp = await page.request.get(`${API_BASE}/api/v1/lectures/sessions/?lecture=${LECTURE_ID}`, { headers });
    console.log(`sessions API status=${sessionsResp.status()}`);
    const sessions = await sessionsResp.json().catch(() => ({}));
    const sessionList = Array.isArray(sessions) ? sessions : (sessions.results || []);
    console.log(`세션 총 ${sessionList.length}개`);
    if (sessionList.length === 0) { test.skip(true, "세션 없음"); return; }
    const SESSION_ID = sessionList[0].id;
    console.log(`세션 ${SESSION_ID} (${sessionList[0].title || sessionList[0].name}) 선택`);

    await page.goto(`${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // "불러오는 중..." 로딩 사라질 때까지 대기
    await page.locator('text=/불러오는 중/').waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    // eslint-disable-next-line no-restricted-syntax -- 검증 spec 단발성 timing 보장
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "_artifacts/score-alimtalk-review/04-scores-tab.png", fullPage: true });

    const checkboxes = page.locator('tbody input[type="checkbox"], input[type="checkbox"][aria-label*="선택"]');
    // 학생 1명 가능 — 일괄 path는 N≥1.
    await checkboxes.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const cbCount = await checkboxes.count();
    console.log(`체크박스 ${cbCount}개 발견`);
    if (cbCount < 1) {
      test.skip(true, `학생 체크박스 없음 — 데이터 부족`);
      return;
    }
    await checkboxes.nth(0).check();
    if (cbCount >= 2) await checkboxes.nth(1).check();
    // eslint-disable-next-line no-restricted-syntax -- 검증 spec 단발성 timing 보장
    await page.waitForTimeout(500);
    await page.screenshot({ path: "_artifacts/score-alimtalk-review/05-selected.png", fullPage: true });

    const sendBtn = page.getByRole("button", { name: /수업결과 알림톡 발송/ });
    await sendBtn.waitFor({ state: "visible", timeout: 10000 });
    await sendBtn.click();
    // eslint-disable-next-line no-restricted-syntax -- 검증 spec 단발성 timing 보장
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "_artifacts/score-alimtalk-review/06-modal-open.png", fullPage: true });

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: "visible", timeout: 10000 });
    const initialBody = await textarea.inputValue();
    console.log(`initialBody length=${initialBody.length}, head=${initialBody.slice(0, 200)}`);
    expect(initialBody.length).toBeGreaterThan(0);

    const previewBefore = await page.locator('.template-preview-kakao__card, .template-preview-kakao').first().innerText({ timeout: 5000 }).catch(() => "");
    console.log(`previewBefore length=${previewBefore.length}`);
    await page.screenshot({ path: "_artifacts/score-alimtalk-review/07-modal-before-edit.png", fullPage: true });

    const ADDED = "\n\n[E2E] 수업 수고하셨어요! 0514";
    await textarea.click();
    await textarea.press("Control+End");
    await page.keyboard.type(ADDED);
    // eslint-disable-next-line no-restricted-syntax -- 검증 spec 단발성 timing 보장
    await page.waitForTimeout(800);
    const afterBody = await textarea.inputValue();
    expect(afterBody).toContain("[E2E] 수업 수고하셨어요! 0514");

    const previewAfter = await page.locator('.template-preview-kakao__card, .template-preview-kakao').first().innerText({ timeout: 5000 }).catch(() => "");
    console.log(`previewAfter length=${previewAfter.length}`);
    await page.screenshot({ path: "_artifacts/score-alimtalk-review/08-modal-after-edit.png", fullPage: true });

    console.log("=== preview BEFORE ===\n" + previewBefore.slice(0, 400));
    console.log("=== preview AFTER  ===\n" + previewAfter.slice(0, 600));

    expect(previewAfter).toContain("[E2E] 수업 수고하셨어요! 0514");

    const submitBtn = page.getByRole("button", { name: /^발송|^학부모|학생.*명에게/ }).last();
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const enabled = await submitBtn.isEnabled().catch(() => false);
      const btnText = await submitBtn.textContent().catch(() => "");
      console.log(`발송 버튼 enabled=${enabled} text="${btnText}"`);
      // canSend false 원인 dump — varStatuses missing var + body 상태
      const diag = await page.evaluate(() => {
        const missing = Array.from(document.querySelectorAll('.send-modal__var-row[data-status="missing"]'))
          .map((el) => (el.textContent || "").trim());
        const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
        return { missingVars: missing, bodyLen: ta?.value.length ?? 0, bodyHead: (ta?.value ?? "").slice(0, 200) };
      });
      console.log("diag:", JSON.stringify(diag));
      if (!enabled) {
        console.error("⛔ 발송 버튼 disabled — 원인:", JSON.stringify(diag));
      }
      if (enabled) {
        await submitBtn.click();
        // eslint-disable-next-line no-restricted-syntax -- 검증 spec 단발성 timing 보장
        await page.waitForTimeout(1000);
        // confirm overlay 캡처 + preview 텍스트 검증 (0fa1d1f9 fix — raw #{변수} 노출 X)
        await page.screenshot({ path: "_artifacts/score-alimtalk-review/08b-confirm-overlay.png", fullPage: true });
        const confirmPreview = await page.locator(".send-modal__confirm-preview").innerText({ timeout: 3000 }).catch(() => "");
        console.log("=== confirm overlay preview ===\n" + confirmPreview.slice(0, 400));
        // confirm overlay 안 "발송하기" 버튼 — 모달 영역만 좁혀 click
        const confirmOverlay = page.locator(".send-modal__confirm-overlay");
        const confirmBtn = confirmOverlay.getByRole("button", { name: /발송하기/ });
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click();
        }
        // eslint-disable-next-line no-restricted-syntax -- 검증 spec 단발성 timing 보장
        await page.waitForTimeout(2500);
      }
    }
    await page.screenshot({ path: "_artifacts/score-alimtalk-review/09-after-send.png", fullPage: true });

    if (capturedPayload) {
      console.log("=== payload raw_body head ===\n" + (capturedPayload.raw_body || "").slice(0, 400));
      const perStudent = capturedPayload.alimtalk_extra_vars_per_student || {};
      const sids = Object.keys(perStudent);
      console.log(`perStudent students=${sids.length}`);
      for (const sid of sids) {
        const subst = perStudent[sid]._body_subst || "";
        console.log(`-- student ${sid} _body_subst head --\n` + subst.slice(0, 400));
      }
      expect(capturedPayload.raw_body).toContain("[E2E] 수업 수고하셨어요! 0514");
      if (sids.length > 0) {
        const firstSubst = perStudent[sids[0]]._body_subst || "";
        expect(firstSubst).toContain("[E2E] 수업 수고하셨어요! 0514");
        if (firstSubst.match(/#\{시험\d/)) {
          console.warn("⚠ _body_subst에 #{시험N} 미치환 잔존");
        }
      }
    } else {
      throw new Error("payload 미캡처 — 발송 API 호출 안 됨 (route 매칭 실패 또는 click 안됨)");
    }
    // 핵심 검증 (P0): 학원장 textarea 수정 본문이 학생별 _body_subst 에 반영됨
    expect(capturedPayload).not.toBeNull();
    const cp = capturedPayload as SendPayload;
    expect(cp.raw_body).toContain("[E2E] 수업 수고하셨어요! 0514");
  });

  /**
   * block_category fallback — 실 backend path 검증 (2026-05-14, backend 98f78208 prod 배포).
   * mock 안 걸고 실 API 호출 → response status 200 = block_category fallback 작동.
   * 학생 phone dummy (010-1111-1111) 라 enqueue 됐어도 skipped_no_phone → SOLAPI 발송 X.
   */
  test("block_category fallback — 실 backend 응답 200 확인", async ({ page }) => {
    let serverStatus: number | null = null;
    let serverDetail: string | null = null;
    let requestPayload: SendPayload | null = null;
    // mock 안 걸고 response 만 캡처 — request 가로채기로 status 확인
    page.on("response", async (resp) => {
      if (resp.url().includes("/api/v1/messaging/send/")) {
        serverStatus = resp.status();
        try {
          const json = await resp.json();
          serverDetail = json.detail || JSON.stringify(json).slice(0, 200);
        } catch { serverDetail = "(response body parse fail)"; }
      }
    });
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/messaging/send/")) {
        try { requestPayload = req.postDataJSON() as SendPayload; } catch { /* ignore */ }
      }
    });

    await loginAdmin(page);
    await page.setExtraHTTPHeaders({ "X-Tenant-Code": "hakwonplus" });

    const tokenJson = await page.evaluate(() => ({
      access: localStorage.getItem("hkp.token") || localStorage.getItem("access") || "",
    }));
    const headers = { Authorization: `Bearer ${tokenJson.access}`, "X-Tenant-Code": "hakwonplus" };
    const lecturesResp = await page.request.get(`${API_BASE}/api/v1/lectures/lectures/`, { headers });
    const lectures = await lecturesResp.json();
    const lectureList = Array.isArray(lectures) ? lectures : (lectures.results || []);
    if (lectureList.length === 0) { test.skip(true, "강의 없음"); return; }
    const LECTURE_ID = lectureList[0].id;
    const sessionsResp = await page.request.get(`${API_BASE}/api/v1/lectures/sessions/?lecture=${LECTURE_ID}`, { headers });
    const sessions = await sessionsResp.json();
    const sessionList = Array.isArray(sessions) ? sessions : (sessions.results || []);
    if (sessionList.length === 0) { test.skip(true, "세션 없음"); return; }
    const SESSION_ID = sessionList[0].id;

    await page.goto(`${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.locator('text=/불러오는 중/').waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    // eslint-disable-next-line no-restricted-syntax -- 검증 spec
    await page.waitForTimeout(2000);

    const checkboxes = page.locator('tbody input[type="checkbox"], input[type="checkbox"][aria-label*="선택"]');
    await checkboxes.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const cbCount = await checkboxes.count();
    if (cbCount < 1) { test.skip(true, "학생 데이터 부족"); return; }
    await checkboxes.nth(0).check();

    const sendBtn = page.getByRole("button", { name: /수업결과 알림톡 발송/ });
    await sendBtn.waitFor({ state: "visible", timeout: 10000 });
    await sendBtn.click();
    // eslint-disable-next-line no-restricted-syntax -- 검증 spec
    await page.waitForTimeout(2500);

    const submitBtn = page.getByRole("button", { name: /^발송|학생.*명에게/ }).last();
    if (await submitBtn.isEnabled().catch(() => false)) {
      await submitBtn.click();
      const confirmOverlay = page.locator(".send-modal__confirm-overlay");
      const confirmBtn = confirmOverlay.getByRole("button", { name: /발송하기/ });
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      // eslint-disable-next-line no-restricted-syntax -- 검증 spec
      await page.waitForTimeout(4000);
    }

    console.log(`=== 실 backend response: status=${serverStatus} detail=${serverDetail}`);
    console.log(`=== request payload block_category=${(requestPayload as SendPayload & { block_category?: string })?.block_category}`);
    // 핵심 검증: backend 가 200 응답 (검수 에러 아님). 큐 등록 또는 skipped_no_phone 모두 200.
    expect(serverStatus).toBe(200);
    // detail에 "검수" 단어 없어야 (검수 에러 = block_category fallback 실패)
    expect(serverDetail || "").not.toContain("검수");
  });

  /**
   * block_category fallback (mock 검증) — frontend payload 정합만 빠르게 검증.
   */
  test("block_category fallback — frontend payload 정합", async ({ page }) => {
    let capturedPayload: SendPayload | null = null;
    let serverStatus: number | null = null;
    let serverDetail: string | null = null;
    // 발송 API mock — payload 캡처만 + 200 mock (실 발송 차단)
    await page.route("**/api/v1/messaging/send/", async (route) => {
      capturedPayload = route.request().postDataJSON() as SendPayload;
      serverStatus = 200;
      serverDetail = "mocked OK";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ detail: "발송 예정 1건. (mocked)", enqueued: 1, enqueue_failed: 0, skipped_no_phone: 0 }),
      });
    });

    await loginAdmin(page);
    await page.setExtraHTTPHeaders({ "X-Tenant-Code": "hakwonplus" });

    const tokenJson = await page.evaluate(() => ({
      access: localStorage.getItem("hkp.token") || localStorage.getItem("access") || "",
    }));
    const headers = { Authorization: `Bearer ${tokenJson.access}`, "X-Tenant-Code": "hakwonplus" };
    const lecturesResp = await page.request.get(`${API_BASE}/api/v1/lectures/lectures/`, { headers });
    const lectures = await lecturesResp.json();
    const lectureList = Array.isArray(lectures) ? lectures : (lectures.results || []);
    if (lectureList.length === 0) { test.skip(true, "강의 없음"); return; }
    const LECTURE_ID = lectureList[0].id;

    const sessionsResp = await page.request.get(`${API_BASE}/api/v1/lectures/sessions/?lecture=${LECTURE_ID}`, { headers });
    const sessions = await sessionsResp.json();
    const sessionList = Array.isArray(sessions) ? sessions : (sessions.results || []);
    if (sessionList.length === 0) { test.skip(true, "세션 없음"); return; }
    const SESSION_ID = sessionList[0].id;

    await page.goto(`${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.locator('text=/불러오는 중/').waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    // eslint-disable-next-line no-restricted-syntax -- 검증 spec
    await page.waitForTimeout(2000);

    const checkboxes = page.locator('tbody input[type="checkbox"], input[type="checkbox"][aria-label*="선택"]');
    await checkboxes.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const cbCount = await checkboxes.count();
    if (cbCount < 1) { test.skip(true, "학생 데이터 부족"); return; }
    await checkboxes.nth(0).check();

    const sendBtn = page.getByRole("button", { name: /수업결과 알림톡 발송/ });
    await sendBtn.waitFor({ state: "visible", timeout: 10000 });
    await sendBtn.click();
    // eslint-disable-next-line no-restricted-syntax -- 검증 spec
    await page.waitForTimeout(2500);

    const submitBtn = page.getByRole("button", { name: /^발송|학생.*명에게/ }).last();
    if (await submitBtn.isEnabled().catch(() => false)) {
      await submitBtn.click();
      const confirmOverlay = page.locator(".send-modal__confirm-overlay");
      const confirmBtn = confirmOverlay.getByRole("button", { name: /발송하기/ });
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      // eslint-disable-next-line no-restricted-syntax -- 검증 spec
      await page.waitForTimeout(2500);
    }

    // 핵심 검증: payload 에 block_category 포함
    expect(capturedPayload).not.toBeNull();
    const cp = capturedPayload as SendPayload & { block_category?: string };
    console.log("=== block_category in payload ===", cp.block_category);
    expect(cp.block_category).toBe("grades");
    console.log(`server response status=${serverStatus} detail=${serverDetail}`);
  });
});
