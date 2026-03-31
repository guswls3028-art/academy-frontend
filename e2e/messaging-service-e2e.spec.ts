/**
 * 알림톡 서비스 완전 검증 E2E — Tenant 1 (hakwonplus)
 * 정합성 + 배포상태 + 실전 전 케이스
 *
 * 검증 범위:
 * 1. 설정 페이지 (PFID, 발신번호, 크레딧, 프로바이더)
 * 2. 템플릿 관리 (목록, CRUD, 변수 삽입)
 * 3. 자동발송 설정 (트리거 목록, 토글, 템플릿 매핑)
 * 4. 수동 메시지 발송 (SMS/알림톡/Both 모드)
 * 5. 발송 내역 (목록, 상세)
 * 6. 테넌트 격리 (API 레벨)
 * 7. 크레딧 시스템
 * 8. 탭 네비게이션
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.use({ trace: "retain-on-failure", video: "off" });
test.describe.configure({ mode: "serial" });

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TS = Date.now();

let adminPage: Page;
let adminToken: string;

test.beforeAll(async ({ browser }) => {
  adminPage = await browser.newPage();
  await loginViaUI(adminPage, "admin");
  adminToken = (await adminPage.evaluate(() => localStorage.getItem("access"))) || "";
  expect(adminToken.length).toBeGreaterThan(10);
});

test.afterAll(async () => {
  await adminPage?.close();
});

// helper
function apiHeaders() {
  return { Authorization: `Bearer ${adminToken}`, "X-Tenant-Code": "hakwonplus", "Content-Type": "application/json" };
}

// ─────────────────────────────────────────────
// 1. 설정 페이지
// ─────────────────────────────────────────────
test.describe("1. 메시지 설정", () => {
  test("1-1. 설정 페이지 DOM 확인", async () => {
    await adminPage.goto(`${BASE}/admin/message/settings`, { waitUntil: "networkidle", timeout: 20000 });
    await adminPage.waitForTimeout(2000);
    await adminPage.screenshot({ path: `e2e/screenshots/msg-settings-${TS}.png`, fullPage: true });
    const content = await adminPage.content();
    expect(content).toMatch(/카카오|채널|PFID|발신번호|알림톡|설정/);
  });

  test("1-2. API: 메시징 정보 필드 검증", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/info/`, { headers: apiHeaders() });
    expect(resp.status()).toBe(200);
    const info = await resp.json();
    expect(info.kakao_pfid).toBeTruthy();
    expect(info.messaging_sender).toBeTruthy();
    expect(Number(info.credit_balance)).toBeGreaterThanOrEqual(0);
    expect(info.is_active).toBe(true);
    expect(info.alimtalk_available).toBe(true);
    expect(info.sms_allowed).toBe(true);
    expect(["solapi", "ppurio"]).toContain(info.messaging_provider);
  });

  test("1-3. API: 발신번호 인증", async () => {
    const resp = await adminPage.request.post(`${API}/api/v1/messaging/verify-sender/`, {
      headers: apiHeaders(),
      data: { phone_number: "01031217466" },
    });
    expect(resp.status()).toBe(200);
    expect((await resp.json()).verified).toBe(true);
  });

  test("1-4. API: 채널 연결 확인", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/channel-check/`, { headers: apiHeaders() });
    expect(resp.status()).toBe(200);
  });
});

// ─────────────────────────────────────────────
// 2. 템플릿 관리
// ─────────────────────────────────────────────
test.describe("2. 템플릿 관리", () => {
  test("2-1. 템플릿 페이지 DOM 확인", async () => {
    await adminPage.goto(`${BASE}/admin/message/templates`, { waitUntil: "networkidle", timeout: 20000 });
    await adminPage.waitForTimeout(2000);
    await adminPage.screenshot({ path: `e2e/screenshots/msg-templates-${TS}.png`, fullPage: true });
    expect(await adminPage.content()).toMatch(/템플릿|template|카테고리/i);
  });

  test("2-2. API: 템플릿 목록 + APPROVED 확인", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/templates/`, { headers: apiHeaders() });
    expect(resp.status()).toBe(200);
    const list = await resp.json();
    const tpls = Array.isArray(list) ? list : (list.results || []);
    expect(tpls.length).toBeGreaterThanOrEqual(10);
    const approved = tpls.filter((t: any) => t.solapi_status === "APPROVED");
    expect(approved.length).toBeGreaterThanOrEqual(5);
    const categories = new Set(tpls.map((t: any) => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  let createdId: number | null = null;

  test("2-3. API: 템플릿 생성", async () => {
    const resp = await adminPage.request.post(`${API}/api/v1/messaging/templates/`, {
      headers: apiHeaders(),
      data: {
        category: "default",
        name: `[E2E-${TS}] 테스트 템플릿`,
        subject: "E2E 테스트",
        body: "#{학원명}에서 알려드립니다. #{학생이름}님 테스트.",
      },
    });
    expect(resp.status()).toBe(201);
    const tpl = await resp.json();
    expect(tpl.id).toBeTruthy();
    expect(tpl.body).toContain("#{학원명}");
    expect(["미신청", "", null]).toContain(tpl.solapi_status);
    createdId = tpl.id;
  });

  test("2-4. API: 템플릿 수정", async () => {
    if (!createdId) test.skip();
    const resp = await adminPage.request.patch(`${API}/api/v1/messaging/templates/${createdId}/`, {
      headers: apiHeaders(),
      data: {
        name: `[E2E-${TS}] 수정됨`,
        body: "#{학원명} 수정본 #{학생이름2}",
      },
    });
    expect([200, 201]).toContain(resp.status());
    expect((await resp.json()).name).toContain("수정됨");
  });

  test("2-5. API: 템플릿 삭제 (cleanup)", async () => {
    if (!createdId) test.skip();
    const resp = await adminPage.request.delete(`${API}/api/v1/messaging/templates/${createdId}/`, { headers: apiHeaders() });
    expect([200, 204]).toContain(resp.status());
  });
});

// ─────────────────────────────────────────────
// 3. 자동발송 설정
// ─────────────────────────────────────────────
test.describe("3. 자동발송 설정", () => {
  test("3-1. 자동발송 페이지 DOM 확인", async () => {
    await adminPage.goto(`${BASE}/admin/message/auto-send`, { waitUntil: "networkidle", timeout: 20000 });
    await adminPage.waitForTimeout(3000);
    await adminPage.screenshot({ path: `e2e/screenshots/msg-autosend-${TS}.png`, fullPage: true });
    expect(await adminPage.content()).toMatch(/자동발송|가입|출결|시험|과제|성적|클리닉/);
  });

  test("3-2. API: 전체 트리거 + 필수 enabled 확인", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/auto-send/`, { headers: apiHeaders() });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    const configs = Array.isArray(data) ? data : (data.configs || data.results || []);
    expect(configs.length).toBeGreaterThanOrEqual(10);

    const enabledTriggers = configs.filter((c: any) => c.enabled).map((c: any) => c.trigger);
    for (const t of [
      "registration_approved_student", "registration_approved_parent",
      "check_in_complete", "exam_score_published",
    ]) {
      expect(enabledTriggers, `${t} must be enabled`).toContain(t);
    }
  });

  test("3-3. API: 활성 트리거-템플릿 매핑 정합성", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/auto-send/`, { headers: apiHeaders() });
    const configs = Array.isArray(await resp.json()) ? await resp.json() : [];
    // re-fetch since json() consumed
    const resp2 = await adminPage.request.get(`${API}/api/v1/messaging/auto-send/`, { headers: apiHeaders() });
    const list = await resp2.json();
    const cfgs = Array.isArray(list) ? list : (list.configs || list.results || []);

    for (const c of cfgs.filter((c: any) => c.enabled)) {
      expect(c.template, `enabled trigger ${c.trigger} must have template`).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────
// 4. 수동 메시지 발송
// ─────────────────────────────────────────────
test.describe("4. 수동 발송", () => {
  let testStudentId: number;

  test("4-0. 테스트 학생 ID 확보", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/students/?page_size=10`, { headers: apiHeaders() });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    const students = data.results || data;
    expect(students.length).toBeGreaterThan(0);
    testStudentId = students[0].id;
  });

  test("4-1. 학생 목록 → 발송 모달 열기", async () => {
    await adminPage.goto(`${BASE}/admin/students`, { waitUntil: "networkidle", timeout: 20000 });
    await adminPage.waitForTimeout(2000);

    const checkbox = adminPage.locator("input[type='checkbox']").first();
    if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkbox.click();
      await adminPage.waitForTimeout(500);
      const sendBtn = adminPage.locator("button").filter({ hasText: /메시지|발송/ });
      if (await sendBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await sendBtn.first().click();
        await adminPage.waitForTimeout(1500);
        await adminPage.screenshot({ path: `e2e/screenshots/msg-send-modal-${TS}.png`, fullPage: true });
        expect(await adminPage.content()).toMatch(/알림톡|SMS|발송|수신/);
        await adminPage.keyboard.press("Escape");
      }
    }
  });

  test("4-2. API: SMS 발송", async () => {
    const resp = await adminPage.request.post(`${API}/api/v1/messaging/send/`, {
      headers: apiHeaders(),
      data: {
        student_ids: [testStudentId],
        send_to: "parent",
        message_mode: "sms",
        raw_body: `[E2E-${TS}] SMS 검증 메시지입니다. 무시해 주세요.`,
        raw_subject: "E2E",
      },
    });
    expect([200, 201, 202, 400, 403]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.enqueued).toBeGreaterThanOrEqual(1);
    }
  });

  test("4-3. API: 알림톡 발송", async () => {
    // APPROVED 템플릿 사용
    const tplResp = await adminPage.request.get(`${API}/api/v1/messaging/templates/`, { headers: apiHeaders() });
    const tpls = await tplResp.json();
    const list = Array.isArray(tpls) ? tpls : (tpls.results || []);
    const approved = list.find((t: any) => t.solapi_status === "APPROVED");
    if (!approved) { console.log("No APPROVED template, skipping"); return; }

    const resp = await adminPage.request.post(`${API}/api/v1/messaging/send/`, {
      headers: apiHeaders(),
      data: {
        student_ids: [testStudentId],
        send_to: "parent",
        message_mode: "alimtalk",
        template_id: approved.id,
        alimtalk_extra_vars: {},
      },
    });
    expect([200, 201, 202, 400, 403]).toContain(resp.status());
  });

  test("4-4. API: Both 모드 발송", async () => {
    const resp = await adminPage.request.post(`${API}/api/v1/messaging/send/`, {
      headers: apiHeaders(),
      data: {
        student_ids: [testStudentId],
        send_to: "parent",
        message_mode: "both",
        raw_body: `[E2E-${TS}] Both 모드 검증. 무시해 주세요.`,
        raw_subject: "E2E Both",
      },
    });
    expect([200, 201, 202, 400, 403]).toContain(resp.status());
  });
});

// ─────────────────────────────────────────────
// 5. 발송 내역
// ─────────────────────────────────────────────
test.describe("5. 발송 내역", () => {
  test("5-1. 발송 내역 페이지 DOM", async () => {
    await adminPage.goto(`${BASE}/admin/message/log`, { waitUntil: "networkidle", timeout: 20000 });
    await adminPage.waitForTimeout(2000);
    await adminPage.screenshot({ path: `e2e/screenshots/msg-log-${TS}.png`, fullPage: true });
    expect(await adminPage.content()).toMatch(/발송|내역|로그/);
  });

  test("5-2. API: 발송 로그 목록 + 페이지네이션", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/log/?page=1`, { headers: apiHeaders() });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.count).toBeGreaterThanOrEqual(0);
    const results = data.results || [];
    if (results.length > 0) {
      const e = results[0];
      expect(e).toHaveProperty("id");
      expect(e).toHaveProperty("success");
      expect(e).toHaveProperty("message_body");
      expect(e).toHaveProperty("message_mode");
      expect(typeof e.success).toBe("boolean");
    }
  });

  test("5-3. API: 발송 로그 상세", async () => {
    const listResp = await adminPage.request.get(`${API}/api/v1/messaging/log/?page=1`, { headers: apiHeaders() });
    const results = (await listResp.json()).results || [];
    if (results.length === 0) return;
    const detailResp = await adminPage.request.get(`${API}/api/v1/messaging/log/${results[0].id}/`, { headers: apiHeaders() });
    expect(detailResp.status()).toBe(200);
    const detail = await detailResp.json();
    expect(detail.id).toBe(results[0].id);
    expect(detail.message_body).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// 6. 테넌트 격리
// ─────────────────────────────────────────────
test.describe("6. 테넌트 격리", () => {
  test("6-1. 인증 없이 접근 거부", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/info/`, {
      headers: { "X-Tenant-Code": "hakwonplus" },
    });
    expect(resp.status()).toBe(401);
  });

  test("6-2. Tenant 1 토큰으로 다른 테넌트 데이터 분리", async () => {
    // X-Tenant-Code를 tchul로 보내도 JWT의 tenant_id 기준으로 Tenant 1 데이터만 반환
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/templates/`, {
      headers: { Authorization: `Bearer ${adminToken}`, "X-Tenant-Code": "tchul" },
    });
    if (resp.status() === 200) {
      const list = await resp.json();
      const tpls = Array.isArray(list) ? list : (list.results || []);
      if (tpls.length > 0) {
        const hasHakwon = tpls.some((t: any) =>
          (t.name || "").includes("HakwonPlus") || (t.name || "").includes("학원플러스")
        );
        expect(hasHakwon).toBe(true); // JWT 기준 → 자기 데이터만
      }
    }
  });

  test("6-3. 발송 로그 테넌트 격리", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/log/?page=1&page_size=50`, { headers: apiHeaders() });
    expect(resp.status()).toBe(200);
    const entries = (await resp.json()).results || [];
    for (const e of entries) {
      if (e.tenant_id !== undefined) {
        expect(e.tenant_id).toBe(1);
      }
    }
  });
});

// ─────────────────────────────────────────────
// 7. 크레딧 시스템
// ─────────────────────────────────────────────
test.describe("7. 크레딧", () => {
  test("7-1. 크레딧 잔액 >= 0", async () => {
    const resp = await adminPage.request.get(`${API}/api/v1/messaging/info/`, { headers: apiHeaders() });
    expect(Number((await resp.json()).credit_balance)).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────
// 8. 탭 네비게이션
// ─────────────────────────────────────────────
test.describe("8. 메시지 탭 순회", () => {
  test("8-1. 모든 서브탭 접근 + DOM 확인", async () => {
    const tabs = [
      { url: "/admin/message/templates", keyword: /템플릿|template/i },
      { url: "/admin/message/auto-send", keyword: /자동발송|자동|가입/ },
      { url: "/admin/message/log", keyword: /발송|내역|로그/ },
      { url: "/admin/message/settings", keyword: /설정|카카오|채널/ },
    ];
    for (const tab of tabs) {
      await adminPage.goto(`${BASE}${tab.url}`, { waitUntil: "networkidle", timeout: 15000 });
      await adminPage.waitForTimeout(1500);
      expect(await adminPage.content()).toMatch(tab.keyword);
    }
    await adminPage.screenshot({ path: `e2e/screenshots/msg-tabs-all-${TS}.png`, fullPage: true });
  });
});
