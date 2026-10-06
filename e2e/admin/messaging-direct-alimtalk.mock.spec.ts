import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";
import { realMessagingSkipReason } from "../helpers/safety";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5214").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type MessagingState = {
  available: boolean;
  failInfo: boolean;
  channelStatus: "not_configured" | "pending_templates" | "active" | "suspended";
  requests: Array<{ method: string; path: string }>;
  actorId: number;
  role: "owner" | "teacher";
  tenantCode: string;
  sends: MockSend[];
  receipts: Map<string, { actorId: number; tenantCode: string; scopes: Set<string> }>;
  failure: "none" | "lost_response" | "student_failure";
  failureConsumed: boolean;
  failTrace: boolean;
  providerState: "pending" | "accepted" | "ambiguous";
  dispatchPending: boolean;
  traceQueries: string[];
};

type MockSend = {
  client_request_id: string;
  send_to: "student" | "parent";
  raw_body: string;
  student_ids: number[];
  scheduled_send_at?: string;
};

async function installMocks(
  page: Page,
  options: {
    available?: boolean;
    failInfo?: boolean;
    channelStatus?: MessagingState["channelStatus"];
  } = {},
): Promise<MessagingState> {
  const state: MessagingState = {
    available: options.available ?? true,
    failInfo: options.failInfo ?? false,
    channelStatus: options.channelStatus ?? "not_configured",
    requests: [],
    actorId: 12,
    role: "owner",
    tenantCode: "hakwonplus",
    sends: [],
    receipts: new Map(),
    failure: "none",
    failureConsumed: false,
    failTrace: false,
    providerState: "pending",
    dispatchPending: false,
    traceQueries: [],
  };

  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, localJwt());

  const json = (route: Route, body: unknown, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    state.requests.push({ method: request.method(), path });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (path === "/core/program/") {
      return json(route, {
        tenantCode: state.tenantCode,
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/subscription/") return json(route, { tenant_name: "실제 발송학원", is_subscription_active: true });
    if (path === "/core/me/") {
      return json(route, {
        id: state.actorId,
        username: "owner",
        name: "관리자",
        is_staff: true,
        is_superuser: false,
        tenantRole: state.role,
        must_change_password: false,
      });
    }
    if (path === "/messaging/info/") {
      if (state.failInfo) return json(route, { detail: "temporary failure" }, 503);
      return json(route, {
        alimtalk_available: state.available && state.channelStatus !== "suspended",
        delivery_policy: "verified_tenant_or_common_alimtalk",
        messaging_provider: "solapi",
        messaging_disabled: !state.available,
        messaging_disabled_reason: state.available ? "" : "운영 중지 상태입니다.",
        custom_channel_registered: state.channelStatus !== "not_configured",
        custom_channel_status: state.channelStatus,
        custom_channel_reference: state.channelStatus === "not_configured" ? "" : "채널 ····JTLe",
        custom_channel_approved_templates: state.channelStatus === "active" ? 10 : 0,
        custom_channel_required_templates: 10,
        custom_channel_test_available: state.channelStatus !== "not_configured",
        custom_channel_last_test_status: "sent",
      });
    }
    if (path === "/messaging/send/preflight/" && request.method() === "POST") {
      const body = request.postDataJSON() as { send_to?: "student" | "parent" };
      const sendTo = body.send_to ?? "parent";
      return json(route, {
        ok: true,
        can_send: true,
        mode: "now",
        send_to: sendTo,
        recipient: {
          selected: 1,
          resolved: 1,
          valid_phone: 1,
          skipped_no_phone: 0,
          duplicate_phone: 0,
          unique_phone: 1,
          invalid_or_deleted: 0,
          limit: 500,
        },
        template: {
          ok: true,
          source: "unified",
          name: "출석 안내 기본형",
          solapi_template_id: "E2E_TEMPLATE",
          solapi_status: "APPROVED",
          detail: "",
          uses_unified_template: true,
          template_type: "attendance",
        },
        preview_recipients: [{
          student_id: 41,
          student_name: "김알림",
          phone: sendTo === "student" ? "010****2222" : "010****4444",
          excluded: false,
          exclude_reason: "",
          full_message_body: "학원플러스입니다. 김알림 학생의 안내 사항입니다.",
        }],
        limits: {
          hourly_limit: 500,
          sent_last_hour: 0,
          remaining_this_hour: 500,
        },
        blockers: [],
        warnings: [],
      });
    }
    if (path === "/messaging/send/" && request.method() === "POST") {
      const payload = request.postDataJSON() as MockSend;
      state.sends.push(payload);
      if (state.failure === "student_failure" && payload.send_to === "student" && !state.failureConsumed) {
        state.failureConsumed = true;
        return json(route, { detail: "학생 요청을 접수하지 못했습니다.", request_id: payload.client_request_id, accepted_count: 0 }, 503);
      }
      let receipt = state.receipts.get(payload.client_request_id);
      if (!receipt) {
        receipt = { actorId: state.actorId, tenantCode: state.tenantCode, scopes: new Set() };
        state.receipts.set(payload.client_request_id, receipt);
      }
      const replayed = receipt.scopes.has(payload.send_to);
      receipt.scopes.add(payload.send_to);
      if (state.failure === "lost_response" && !state.failureConsumed) {
        state.failureConsumed = true;
        // Admission succeeded but no application acknowledgement reached the client.
        return json(route, { detail: "발송 응답 확인 시간이 초과되었습니다." }, 504);
      }
      return json(route, {
        detail: "접수했습니다.", request_id: payload.client_request_id, replayed,
        accepted_count: 1, enqueued: payload.scheduled_send_at ? 0 : 1,
        scheduled: payload.scheduled_send_at ? 1 : 0, enqueue_failed: 0,
        cancelled_count: 0, skipped_no_phone: 0,
      });
    }
    if (path === "/messaging/log/" && request.method() === "GET") {
      const query = new URL(request.url()).searchParams;
      const requestId = query.get("request_id");
      if (requestId === null) return json(route, { count: 0, results: [] });
      state.traceQueries.push(requestId);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
        return json(route, { request_id: "유효한 요청 UUID를 입력해 주세요." }, 400);
      }
      if (state.failTrace) return json(route, { detail: "결과 조회 일시 오류" }, 503);
      const canonicalId = requestId.toLowerCase();
      const receipt = state.receipts.get(canonicalId);
      if (!receipt || receipt.tenantCode !== state.tenantCode
        || (state.role === "teacher" && receipt.actorId !== state.actorId)) {
        return json(route, { count: 0, results: [], request_trace: null });
      }
      const accepted = receipt.scopes.size;
      const logs = state.providerState === "pending" ? [] : [...receipt.scopes].map((scope, index) => ({
        id: 600 + index, origin_id: canonicalId, sent_at: "2026-10-02T00:00:00Z",
        status: state.providerState === "accepted" ? "sent" : "ambiguous",
        success: state.providerState === "accepted", amount_deducted: "8",
        recipient_summary: `${scope === "parent" ? "학부모" : "학생"} 010****2222`,
        template_summary: "출석 안내", message_mode: "alimtalk",
        provider_delivery_status: state.providerState === "accepted" ? "provider_accepted" : "unavailable",
        provider_evidence: state.providerState === "accepted",
        body_visibility: state.role === "teacher" ? "restricted" : "available",
        message_body: state.role === "teacher" ? "" : "김알림 학생의 가상 안내입니다.",
      }));
      const status = query.get("status");
      const visibleLogs = status === "sent" ? logs.filter((log) => log.status === "sent") : logs;
      return json(route, {
        count: visibleLogs.length, results: visibleLogs,
        request_trace: {
          request_id: canonicalId, accepted_count: accepted,
          enqueued: state.dispatchPending ? 0 : accepted, scheduled: state.dispatchPending ? accepted : 0,
          enqueue_failed: 0, cancelled_count: 0, skipped_no_phone: 0,
          provider_accepted_count: state.providerState === "accepted" ? accepted : 0,
          provider_pending_count: 0,
          provider_failed_count: 0,
          provider_ambiguous_count: state.providerState === "ambiguous" ? accepted : 0,
          delivered_count: null,
        },
      });
    }
    if (/^\/messaging\/log\/\d+\/$/.test(path) && request.method() === "GET") {
      return json(route, {
        id: 600, sent_at: "2026-10-02T00:00:00Z", status: "sent", success: true,
        amount_deducted: "8", recipient_summary: "학생 010****2222", template_summary: "출석 안내",
        message_mode: "alimtalk", provider_delivery_status: "provider_accepted", provider_evidence: true,
        body_visibility: state.role === "teacher" ? "restricted" : "available",
        message_body: state.role === "teacher" ? "" : "김알림 학생의 가상 안내입니다.",
      });
    }
    if (path === "/messaging/operations/status/") {
      return json(route, {
        checked_at: "2026-10-02T00:00:00Z",
        worker: { status: "idle", last_seen_at: null, age_seconds: null, instance: "", version: "" },
        scheduled: { pending: 0, due_now: 0, overdue: 0, failed_24h: 0 },
        log_24h: { sent: 0, failed: 0, processing: 0, sending: 0, retryable_failed: 0, ambiguous: 0, action_required: 0, total: 0 },
        risks: [],
      });
    }
    if (path === "/students/" && request.method() === "GET") {
      return json(route, {
        count: 1,
        page_size: 50,
        results: [{
          id: 41,
          name: "김알림",
          display_name: "김알림",
          ps_number: "0041",
          omr_code: "0041",
          student_phone: "01011112222",
          parent_phone: "01033334444",
          school: "통합고",
          grade: 2,
          is_active: true,
          custom_fields: {},
          tags: [],
          enrollments: [],
        }],
      });
    }
    if (path === "/students/custom-fields/") return json(route, []);
    if (path === "/messaging/templates/") return json(route, []);
    if (path === "/messaging/auto-send/") return json(route, []);
    if (path === "/landing/has-published/") return json(route, { has_published: false });

    return json(route, { count: 0, next: null, previous: null, results: [] });
  });

  return state;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= window.innerWidth,
    root: document.documentElement.scrollWidth <= window.innerWidth,
  }))).toEqual({ body: true, root: true });
}

test.use({ serviceWorkers: "block" });

for (const action of ["delete", "duplicate"] as const) {
  test(`발송창 ${action} 후 돌아온 문구 관리에는 이전 캐시가 남지 않는다`, async ({ page }) => {
    const state = await installMocks(page);
    await page.clock.setFixedTime(new Date());
    const saved = {
      id: 891, name: "캐시 검증 안내문", category: "default", subject: "",
      body: "#{학생이름} 학생의 저장 안내입니다.", is_system: false, is_user_default: false,
      can_delete: true, created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z",
    };
    let rows = [saved];
    const mutations: string[] = [];
    await page.route("**/api/v1/messaging/templates/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === "DELETE") {
        mutations.push("delete");
        rows = [];
        return route.fulfill({ status: 204 });
      }
      if (path.endsWith("/duplicate/") && request.method() === "POST") {
        mutations.push("duplicate");
        const copy = { ...saved, id: 892, name: "복사 - 캐시 검증 안내문" };
        rows = [saved, copy];
        return route.fulfill({ json: copy });
      }
      if (request.method() === "GET") return route.fulfill({ json: rows });
      return route.fallback();
    });
    await gotoAndSettle(page, `${BASE}/workspace/message/templates`, { timeout: 30_000 });
    await expect(page.getByText(saved.name, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();
    await page.getByRole("checkbox", { name: "김알림 선택" }).check();
    await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();
    const compose = page.getByRole("dialog").filter({ hasText: "알림톡 발송" });
    await compose.getByRole("button", { name: /^(다른 문구 선택|문구 선택)$/ }).click();
    const picker = page.locator(".tpl-picker-modal");
    await picker.getByRole("button", { name: "더보기", exact: true }).click();
    await picker.getByRole("button", { name: action === "delete" ? "삭제" : "다른 이름으로 복제", exact: true }).click();
    if (action === "delete") {
      await page.getByRole("alertdialog", { name: "문구 삭제", exact: true })
        .getByRole("button", { name: "삭제", exact: true }).click();
      await expect(picker.getByText(saved.name, { exact: true })).toHaveCount(0);
    } else {
      await expect(picker.getByText("복사 - 캐시 검증 안내문", { exact: true })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await compose.getByRole("button", { name: "취소", exact: true }).click();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "알림톡 문구 만들기·수정" })).toBeVisible();
    const expectedName = action === "delete" ? saved.name : "복사 - 캐시 검증 안내문";
    if (action === "delete") await expect(page.getByText(expectedName, { exact: true })).toHaveCount(0);
    else await expect(page.getByText(expectedName, { exact: true })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    if (action === "delete") await expect(page.getByText(expectedName, { exact: true })).toHaveCount(0);
    else await expect(page.getByText(expectedName, { exact: true })).toBeVisible();
    expect(mutations).toEqual([action]);
    expect(state.requests.filter(({ method, path }) => method === "POST" && path === "/messaging/send/")).toEqual([]);
  });
}

test("메시지 화면에서 학생 선택과 알림톡 발송창까지 정확한 경로로 이어진다", async ({ page }) => {
  const state = await installMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, `${BASE}/workspace/message/templates`, { timeout: 30_000 });
  await expect(page.getByRole("tab", { name: "문구 편집" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "알림톡 문구 만들기·수정" })).toBeVisible();
  await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();

  await expect(page).toHaveURL(/\/workspace\/students\/home\?compose=alimtalk$/);
  await expect(page.getByRole("region", { name: "알림톡 발송 안내" })).toContainText(
    "알림톡을 보낼 학생을 선택하세요.",
  );
  await page.getByRole("checkbox", { name: "김알림 선택" }).check();
  await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "알림톡 발송" })).toBeVisible();
  await expect.poll(() => state.requests.filter(
    ({ method, path }) => method === "POST" && path === "/messaging/send/preflight/",
  ).length).toBeGreaterThan(0);
  const preview = page.locator(".send-modal__card--preview");
  await expect(preview).toContainText("김알림 학생의 안내 사항입니다.");
  await expect(preview).not.toContainText("홍길동");
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(preview).toContainText("김알림 학생의 안내 사항입니다.");
  await expectNoHorizontalOverflow(page);
  expect(state.requests.filter(
    ({ method, path }) => method !== "GET" && path !== "/messaging/send/preflight/",
  )).toEqual([]);
});

test("알림톡 운영 중지 상태는 발송 진입을 비활성화하고 설정 안내만 제공한다", async ({ page }) => {
  const state = await installMocks(page, { available: false });
  await gotoAndSettle(page, `${BASE}/workspace/message/templates`, { timeout: 30_000 });

  const action = page.getByRole("button", { name: "알림톡 보내기", exact: true });
  await expect(action).toBeDisabled();
  await expect(action).toHaveAttribute("title", "운영 중지 상태입니다.");
  await expect(page.getByText("운영 중지 상태입니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "설정 보기" })).toHaveAttribute(
    "href",
    "/workspace/message/settings",
  );
  expect(state.requests.filter(({ method }) => method !== "GET")).toEqual([]);
});

test("등록된 우리 학원 채널의 양식 준비 상태를 내부 ID 없이 보여준다", async ({ page }) => {
  await installMocks(page, { channelStatus: "pending_templates" });
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, `${BASE}/workspace/message/settings`, { timeout: 30_000 });

  await expect(page.getByText("우리 학원 채널 양식을 준비 중입니다.")).toBeVisible();
  await expect(page.getByText(/채널 ····JTLe 확인 완료/)).toBeVisible();
  await expect(page.getByText(/승인 양식 0\/10개/)).toBeVisible();
  await expect(page.getByText("최근 전용 채널 테스트: 발송 접수 확인")).toBeVisible();
  await expect(page.getByText(/KA01PF|API Key|API Secret|뿌리오/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("승인 양식이 달라진 전용 채널은 발송 중지 상태를 정확히 보여준다", async ({ page }) => {
  await installMocks(page, { channelStatus: "suspended" });
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, `${BASE}/workspace/message/settings`, { timeout: 30_000 });

  await expect(page.getByText("우리 학원 채널 발송을 확인해 주세요.")).toBeVisible();
  await expect(page.getByText("우리 학원 채널의 양식 상태가 달라 현재 해당 채널로 보낼 수 없습니다.")).toBeVisible();
  await expect(page.getByText(/채널 ····JTLe 발송 중지/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("알림톡 상태 조회 오류는 fail-closed로 막고 명시적 재확인 뒤에만 연다", async ({ page }) => {
  const state = await installMocks(page, { failInfo: true });
  await gotoAndSettle(page, `${BASE}/workspace/message/templates`, { timeout: 30_000 });

  const action = page.getByRole("button", { name: "알림톡 보내기", exact: true });
  await expect(action).toBeDisabled();
  const alert = page.getByRole("alert").filter({ hasText: "알림톡 상태를 불러오지 못했습니다." });
  await expect(alert).toBeVisible();

  state.failInfo = false;
  await alert.getByRole("button", { name: "다시 확인" }).click();
  await expect(action).toBeEnabled();
  await action.click();
  await expect(page).toHaveURL(/\/workspace\/students\/home\?compose=alimtalk$/);
  expect(state.requests.filter(({ method }) => method !== "GET")).toEqual([]);
});

async function openSendDraft(page: Page): Promise<void> {
  await gotoAndSettle(page, `${BASE}/workspace/students/home?compose=alimtalk`, { timeout: 30_000 });
  await page.getByRole("checkbox", { name: "김알림 선택" }).check();
  await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "안내문", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "보낼 내용 확인", exact: true })).toBeEnabled();
}

async function confirmSend(page: Page): Promise<void> {
  const mockOnlyReason = realMessagingSkipReason(BASE, "", "0");
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(BASE), mockOnlyReason ?? "발송 route-mock 검증은 로컬 서버 전용");
  await page.getByRole("button", { name: "보낼 내용 확인", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "보내기 전 마지막 확인" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "발송하기", exact: true }).click();
}

for (const width of [1366, 390]) {
  test(`이번 발송 ${width}px: 두 대상 한 UUID 접수 → 정확한 결과 → 새로고침`, async ({ page }, testInfo) => {
    const state = await installMocks(page);
    await page.setViewportSize({ width, height: 844 });
    await openSendDraft(page);
    await confirmSend(page);
    await expect(page.getByRole("button", { name: "이번 발송 결과 보기", exact: true })).toBeVisible();
    expect(state.sends).toHaveLength(2);
    const requestId = state.sends[0].client_request_id;
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Set(state.sends.map((send) => send.client_request_id)).size).toBe(1);
    expect(state.sends.map((send) => send.send_to)).toEqual(["parent", "student"]);
    await page.getByRole("button", { name: "이번 발송 결과 보기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/workspace/message/log\\?request_id=${requestId}$`));
    const summary = page.getByRole("region", { name: "이번 발송 접수 요약" });
    await expect(summary).toContainText("2 요청 접수");
    await expect(summary).toContainText("공급사 처리 중 0건");
    await expect(summary).toContainText("수신 결과 미확인");
    await expect(page.getByText("발송 기록 0건", { exact: true })).toBeVisible();
    await expect(page.getByText("발송 내역이 없습니다", { exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`request-trace-${width}.png`), fullPage: true });
    const queriedBeforeReload = state.traceQueries.length;
    await page.reload();
    await expect(summary).toContainText("2 요청 접수");
    await expect.poll(() => state.traceQueries.length).toBeGreaterThan(queriedBeforeReload);
    expect(state.traceQueries.every((id) => id === requestId)).toBe(true);
    expect(state.sends).toHaveLength(2);
    await expectNoHorizontalOverflow(page);
  });

  test(`이번 발송 ${width}px: 접수 후 응답 오류·부분 실패는 같은 요청으로 복구`, async ({ page }, testInfo) => {
    const state = await installMocks(page);
    state.failure = width === 390 ? "lost_response" : "student_failure";
    await page.setViewportSize({ width, height: 844 });
    await openSendDraft(page);
    await confirmSend(page);
    const recovery = page.getByRole("status", { name: "이번 발송 확인" });
    await expect(recovery).toBeVisible();
    const requestId = state.sends[0].client_request_id;
    await expect(recovery.getByRole("button", { name: "같은 요청으로 재시도" })).toBeEnabled();
    await recovery.scrollIntoViewIfNeeded();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`request-retry-${width}.png`), fullPage: true });
    await recovery.getByRole("button", { name: "같은 요청으로 재시도" }).click();
    await expect(page.getByRole("button", { name: "이번 발송 결과 보기", exact: true })).toBeVisible();
    expect(state.sends.every((send) => send.client_request_id === requestId)).toBe(true);
    expect(state.receipts.size).toBe(1);
    expect([...state.receipts.get(requestId)!.scopes]).toEqual(["parent", "student"]);
    await page.getByRole("button", { name: "이번 발송 결과 보기", exact: true }).click();
    await expect(page.getByRole("region", { name: "이번 발송 접수 요약" })).toContainText("2 요청 접수");
    expect(state.sends.filter((send) => send.send_to === "parent")).toHaveLength(2);
  });
}

test("이번 발송: 수정한 본문과 완료 후 새 발송은 새 UUID를 쓴다", async ({ page }) => {
  const state = await installMocks(page);
  state.failure = "student_failure";
  await openSendDraft(page);
  await confirmSend(page);
  const recovery = page.getByRole("status", { name: "이번 발송 확인" });
  await expect(recovery).toBeVisible();
  const originalId = state.sends[0].client_request_id;
  await page.getByRole("textbox", { name: "안내문", exact: true }).fill("변경한 안내문을 확인해 주세요.");
  await expect(recovery).toContainText("내용이나 대상이 바뀌었습니다.");
  await expect(recovery.getByRole("button", { name: "같은 요청으로 재시도" })).toBeDisabled();
  await confirmSend(page);
  await expect(page.getByRole("button", { name: "이번 발송 결과 보기", exact: true })).toBeVisible();
  const editedId = state.sends[2].client_request_id;
  expect(editedId).not.toBe(originalId);
  expect(state.sends.slice(2).every((send) => send.raw_body === "변경한 안내문을 확인해 주세요.")).toBe(true);
  await openSendDraft(page);
  await confirmSend(page);
  await expect.poll(() => state.sends.length).toBe(6);
  const newId = state.sends[4].client_request_id;
  expect(newId).not.toBe(editedId);
  expect(newId).not.toBe(originalId);
});

test("이번 발송: 공급사 접수·불명확 결과는 수신 성공으로 표시하지 않고 실패 조회를 복구한다", async ({ page }) => {
  const state = await installMocks(page);
  const requestId = "461a6c38-4051-4ac7-86cc-0ee4543e48f7";
  state.receipts.set(requestId, { actorId: 12, tenantCode: "hakwonplus", scopes: new Set(["parent", "student"]) });
  state.dispatchPending = true;
  await gotoAndSettle(page, `${BASE}/workspace/message/log?request_id=${requestId}`, { timeout: 30_000 });
  const summary = page.getByRole("region", { name: "이번 발송 접수 요약" });
  await expect(summary).toContainText("2 요청 접수");
  await expect(summary).toContainText("0 발송 처리 시작");
  await expect(summary).toContainText("2 처리 대기");
  state.dispatchPending = false;
  state.providerState = "accepted";
  await summary.getByRole("button", { name: "결과 새로 확인" }).click();
  await expect(summary).toContainText("공급사 접수 2건");
  await expect(summary).toContainText("수신 결과 미확인");
  await page.getByRole("button", { name: "접수 완료", exact: true }).click();
  await expect(summary).toContainText("2 요청 접수");
  expect(state.traceQueries.every((id) => id === requestId)).toBe(true);
  state.providerState = "ambiguous";
  await page.getByRole("button", { name: "전체", exact: true }).click();
  await summary.getByRole("button", { name: "결과 새로 확인" }).click();
  await expect(summary).toContainText("결과 확인 필요 2건");
  await expect(summary).toContainText("공급사 접수 0건");
  state.failTrace = true;
  await summary.getByRole("button", { name: "결과 새로 확인" }).click();
  await expect(page.getByText("이번 발송 결과를 불러오지 못했습니다", { exact: true })).toBeVisible();
  await expect(summary).not.toContainText("2 요청 접수");
  state.failTrace = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(summary).toContainText("결과 확인 필요 2건");
  expect(state.sends).toEqual([]);
});

test("이번 발송: 교직원 자기 요청은 마스킹하고 다른 사용자·테넌트·알 수 없는 요청은 같은 상태다", async ({ page }) => {
  const state = await installMocks(page);
  state.role = "teacher";
  state.providerState = "accepted";
  await page.setViewportSize({ width: 390, height: 844 });
  const ownId = "6b6016b0-9049-48bb-9d36-3c95c40f9c0b";
  const otherId = "d2ac48e2-77fd-4aa7-96f8-3769ddc1ce23";
  const tenantId = "a573ae7c-f6e3-411b-9a70-bf14c1bd5902";
  const missingId = "d7b69043-bbbc-411b-b822-9316e8d655d4";
  state.receipts.set(ownId, { actorId: 12, tenantCode: "hakwonplus", scopes: new Set(["student"]) });
  state.receipts.set(otherId, { actorId: 99, tenantCode: "hakwonplus", scopes: new Set(["student"]) });
  state.receipts.set(tenantId, { actorId: 12, tenantCode: "other-school", scopes: new Set(["student"]) });
  await gotoAndSettle(page, `${BASE}/workspace/message/log?request_id=${ownId}`, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "이번 발송 접수 요약" })).toContainText("1 요청 접수");
  await expect(page.getByRole("region", { name: "알림톡 발송 기록" })).toContainText("010****2222");
  await expect(page.getByText("김알림 학생의 가상 안내입니다.", { exact: true })).toHaveCount(0);
  await page.getByRole("region", { name: "알림톡 발송 기록" }).getByRole("button").first().click();
  const detail = page.getByRole("dialog", { name: "알림톡 발송 기록" });
  await expect(detail).toContainText("학원장·관리자 권한에서만 저장된 본문을 볼 수 있습니다.");
  await expect(detail).not.toContainText("김알림 학생의 가상 안내입니다.");
  await detail.getByRole("button", { name: "닫기", exact: true }).last().click();
  await gotoAndSettle(page, `${BASE}/workspace/message/log?request_id=${ownId.toUpperCase()}`, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "이번 발송 접수 요약" })).toContainText("1 요청 접수");
  for (const id of [otherId, tenantId, missingId]) {
    await gotoAndSettle(page, `${BASE}/workspace/message/log?request_id=${id}`, { timeout: 30_000 });
    await expect(page.getByText("현재 계정에서 확인 가능한 접수 결과가 없습니다.", { exact: false })).toBeVisible();
    await expect(page.getByRole("region", { name: "알림톡 발송 기록" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "이번 발송 접수 요약" })).not.toContainText("1 요청 접수");
    await expectNoHorizontalOverflow(page);
  }
  await page.getByRole("button", { name: "전체 발송 내역 보기", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/message\/log$/);
  await expect(page.getByText("발송 내역이 없습니다", { exact: true })).toBeVisible();
  expect(state.sends).toEqual([]);
});

test("이번 발송: 잘못된 UUID는 조회 오류를 보여주고 전체 내역은 명시적으로 연다", async ({ page }) => {
  const state = await installMocks(page);
  await gotoAndSettle(page, `${BASE}/workspace/message/log?request_id=invalid`, { timeout: 30_000 });
  await expect(page.getByText("이번 발송 결과를 불러오지 못했습니다", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/request_id=invalid$/);
  await expect(page.getByText("발송 내역이 없습니다", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "전체 발송 내역 보기", exact: true }).click();
  await expect(page.getByText("발송 내역이 없습니다", { exact: true })).toBeVisible();
  expect(state.sends).toEqual([]);
});


for (const width of [1366, 390]) {
  test(`늦은 문구 조회가 작성 중인 안내문을 덮어쓰지 않는다 ${width}px`, async ({ page }, testInfo) => {
    await installMocks(page);
    await page.setViewportSize({ width, height: 900 });
    let releaseTemplates!: () => void;
    const delayed = new Promise<void>((resolve) => { releaseTemplates = resolve; });
    await page.route("**/api/v1/messaging/templates/**", async (route) => {
      await delayed;
      await route.fulfill({ json: [{ id: 990, name: "늦게 도착한 기본 문구", category: "attendance",
        body: "기본 안내", is_system: false, is_user_default: true, alimtalk_readiness: "ready" }] });
    });
    await gotoAndSettle(page, `${BASE}/workspace/students/home?compose=alimtalk`, { timeout: 30_000 });
    await page.getByRole("checkbox", { name: "김알림 선택" }).check();
    await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();
    const compose = page.getByRole("dialog").filter({ hasText: "알림톡 발송" });
    const editor = compose.getByRole("textbox", { name: "안내문", exact: true });
    await editor.fill("직접 작성 중인 안내문을 보존해 주세요.");
    releaseTemplates();
    await expect.poll(() => page.locator(".send-modal__tpl-bar").textContent()).not.toBeNull();
    await expect(editor).toHaveText("직접 작성 중인 안내문을 보존해 주세요.");
    await expect(compose.getByRole("button", { name: /보낼 내용 확인/ })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`compose-draft-${width}.png`) });
    await expectNoHorizontalOverflow(page);
  });
}


for (const width of [1366, 390]) {
  test(`퇴원 안내 조회 재시도와 응답 유실 복구는 완료로 오인시키지 않는다 ${width}px`, async ({ page }, testInfo) => {
    await installMocks(page);
    await page.setViewportSize({ width, height: 900 });
    let previewCount = 0;
    const confirmations: string[] = [];
    const token = "a164b6b4-8027-434d-86ea-1a9dff812249";
    await page.route("**/api/v1/students/bulk_delete/**", (route) => route.fulfill({ json: { deleted: 1 } }));
    await page.route("**/api/v1/messaging/manual-notification/preview/**", (route) => {
      previewCount++;
      if (previewCount === 1) return route.fulfill({ status: 503, json: { detail: "미리보기 일시 오류" } });
      return route.fulfill({ json: {
        preview_token: token, total_count: 1, excluded_count: 0, session_title: "", lecture_title: "",
        message_preview: "퇴원 처리 안내", recipients: [{ student_id: 41, student_name: "김알림",
          phone: "010****4444", status: "", excluded: false, message_body: "퇴원 안내",
          full_message_body: "안녕하세요, 합성 학원입니다. 김알림 학생의 퇴원 처리가 완료되었습니다." }],
      } });
    });
    await page.route("**/api/v1/messaging/manual-notification/confirm/**", (route) => {
      confirmations.push(route.request().postDataJSON().preview_token);
      if (confirmations.length === 1) return route.fulfill({ status: 504, json: { detail: "접수 응답 확인 지연" } });
      return route.fulfill({ json: { batch_id: token, sent_count: 0, accepted_count: 1,
        pending_count: 1, failed_count: 0, blocked_count: 0 } });
    });
    await gotoAndSettle(page, `${BASE}/workspace/students/home`, { timeout: 30_000 });
    await page.getByRole("checkbox", { name: "김알림 선택" }).check();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("alertdialog").filter({ hasText: "학생 삭제" }).getByRole("button", { name: "삭제", exact: true }).click();
    const modal = page.getByRole("dialog").filter({ hasText: "퇴원 처리 완료 안내 발송" });
    await expect(modal.getByRole("alert")).toContainText("미리보기 일시 오류");
    await modal.getByRole("button", { name: "미리보기 다시 불러오기" }).click();
    await expect(modal.locator(".notification-preview__kakao-pane")).toContainText("김알림 학생");
    await modal.getByRole("checkbox").check();
    await modal.getByRole("button", { name: "1건 발송", exact: true }).click();
    await expect(modal.getByRole("alert")).toContainText("접수 응답 확인 지연");
    await modal.getByRole("button", { name: "같은 요청으로 다시 확인" }).click();
    await expect(modal.getByRole("status")).toContainText("알림톡 1건 접수");
      await expect(modal.getByRole("status")).toBeInViewport();
    await expect(modal.getByRole("status")).toContainText("처리 대기 1건");
    await expect(modal.getByRole("status")).not.toContainText("발송 완료");
    expect(confirmations).toEqual([token, token]);
    expect(previewCount).toBe(2);
    await page.screenshot({ path: testInfo.outputPath(`withdrawal-recovery-${width}.png`) });
    await expectNoHorizontalOverflow(page);
    await modal.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(modal).toBeHidden();
  });
}


async function openWithdrawalNotice(page: Page) {
  await page.getByRole("checkbox", { name: "김알림 선택" }).check();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("alertdialog").filter({ hasText: "학생 삭제" }).getByRole("button", { name: "삭제", exact: true }).click();
  return page.getByRole("dialog").filter({ hasText: "퇴원 처리 완료 안내 발송" });
}

test("만료된 미리보기는 재확인 후 다시 동의하고 차단만 된 응답을 성공으로 표시하지 않는다", async ({ page }, testInfo) => {
  await installMocks(page);
  await page.setViewportSize({ width: 390, height: 900 });
  let previewCount = 0;
  const confirmations: string[] = [];
  await page.route("**/api/v1/students/bulk_delete/**", (route) => route.fulfill({ json: { deleted: 1 } }));
  await page.route("**/api/v1/messaging/manual-notification/preview/**", (route) => {
    previewCount++;
    return route.fulfill({ json: { preview_token: `preview-${previewCount}`, total_count: 1, excluded_count: 0,
      session_title: "", lecture_title: "", message_preview: "퇴원 안내", recipients: [{ student_id: 41,
        student_name: "김알림", phone: "010****4444", status: "", excluded: false,
        message_body: "퇴원 안내", full_message_body: "김알림 학생의 퇴원 처리 안내입니다." }] } });
  });
  await page.route("**/api/v1/messaging/manual-notification/confirm/**", (route) => {
    confirmations.push(route.request().postDataJSON().preview_token);
    return confirmations.length === 1
      ? route.fulfill({ status: 400, json: { code: "preview_expired", detail: "미리보기가 만료되었습니다." } })
      : route.fulfill({ json: { batch_id: "qa-blocked-batch", sent_count: 0, accepted_count: 0,
        pending_count: 0, blocked_count: 1, failed_count: 0 } });
  });
  await gotoAndSettle(page, `${BASE}/workspace/students/home`, { timeout: 30_000 });
  const modal = await openWithdrawalNotice(page);
  await modal.getByRole("checkbox").check();
  await modal.getByRole("button", { name: "1건 발송", exact: true }).click();
  await modal.getByRole("button", { name: "미리보기 다시 불러오기" }).click();
  await expect(modal.getByRole("checkbox")).not.toBeChecked();
  await expect(modal.getByRole("button", { name: "1건 발송", exact: true })).toBeDisabled();
  await modal.getByRole("checkbox").check();
  await modal.getByRole("button", { name: "1건 발송", exact: true }).click();
  await expect(modal.getByRole("status")).toContainText("알림톡 0건 접수");
  await expect(modal.getByRole("status")).toContainText("차단 1건");
  await expect(modal.getByRole("status")).toHaveAttribute("data-warning", "true");
  expect(confirmations).toEqual(["preview-1", "preview-2"]);
  await page.screenshot({ path: testInfo.outputPath("withdrawal-blocked-390.png") });
  await expectNoHorizontalOverflow(page);
  await modal.getByRole("link", { name: "발송 기록 보기" }).click();
  await expect(page).toHaveURL(/\/workspace\/message\/log$/);
});

test("닫은 알림창의 늦은 미리보기는 다시 연 창을 덮어쓰지 않는다", async ({ page }) => {
  await installMocks(page);
  let previewCount = 0;
  let releaseOld!: () => void;
  const oldResponse = new Promise<void>((resolve) => { releaseOld = resolve; });
  await page.route("**/api/v1/students/bulk_delete/**", (route) => route.fulfill({ json: { deleted: 1 } }));
  await page.route("**/api/v1/messaging/manual-notification/preview/**", async (route) => {
    const sequence = ++previewCount;
    if (sequence === 1) await oldResponse;
    await route.fulfill({ json: { preview_token: `preview-${sequence}`, total_count: 1, excluded_count: 0,
      session_title: "", lecture_title: "", message_preview: "퇴원 안내", recipients: [{ student_id: 41,
        student_name: "김알림", phone: "010****4444", status: "", excluded: false,
        message_body: "퇴원 안내", full_message_body: sequence === 1 ? "과거 창의 안내" : "새 창의 최신 안내" }] } });
  });
  await gotoAndSettle(page, `${BASE}/workspace/students/home`, { timeout: 30_000 });
  const first = await openWithdrawalNotice(page);
  await expect.poll(() => previewCount).toBe(1);
  await first.getByRole("button", { name: "취소", exact: true }).click();
  await expect(first).toBeHidden();
  const second = await openWithdrawalNotice(page);
  await expect(second).toContainText("새 창의 최신 안내");
  const oldArrived = page.waitForResponse((response) => response.url().includes("manual-notification/preview/"));
  releaseOld();
  await oldArrived;
  await expect(second).not.toContainText("과거 창의 안내");
  await expect(second).toContainText("새 창의 최신 안내");
});

test("저장 문구 조회 오류를 재시도해도 직접 작성한 초안은 보존된다", async ({ page }) => {
  await installMocks(page);
  let available = false;
  await page.route("**/api/v1/messaging/templates/**", (route) => available
    ? route.fulfill({ json: [] })
    : route.fulfill({ status: 503, json: { detail: "저장 문구 조회 오류" } }));
  await gotoAndSettle(page, `${BASE}/workspace/students/home?compose=alimtalk`, { timeout: 30_000 });
  await page.getByRole("checkbox", { name: "김알림 선택" }).check();
  await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();
  const modal = page.getByRole("dialog").filter({ hasText: "알림톡 발송" });
  await expect(modal.getByRole("alert")).toContainText("저장 문구 조회 오류");
  const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
  await editor.fill("조회 오류 중 작성한 안내문");
  available = true;
  await modal.getByRole("button", { name: "문구 다시 불러오기" }).click();
  await expect(modal.getByRole("alert")).toBeHidden();
  await expect(editor).toHaveText("조회 오류 중 작성한 안내문");
  await expect(modal.getByRole("button", { name: /보낼 내용 확인/ })).toBeEnabled();
});
