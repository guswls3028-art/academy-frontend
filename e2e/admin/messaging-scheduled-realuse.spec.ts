/**
 * 알림톡 예약 발송 실사용 canary.
 *
 * 운영 관리자 API와 같은 인증/테넌트 루트로 학생을 만든 뒤, 성적 안내 알림톡을
 * 미래 시각으로 예약하고 목록 조회 후 즉시 취소한다. 외부 발송은 발생하면 안 된다.
 */
import { test, expect } from "../fixtures/strictTest";
import type { APIRequestContext } from "@playwright/test";
import { getApiBaseUrl } from "../helpers/auth";

test.setTimeout(120_000);

const API = getApiBaseUrl();
const CODE = "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const TEST_PHONE = process.env.E2E_MESSAGING_TEST_PHONE || "01031217466";
const TS = Date.now();

type Tokens = { access: string; refresh: string };
type TemplateItem = {
  id: number;
  category: string;
  name: string;
};
type SendResponse = {
  detail: string;
  enqueued: number;
  scheduled?: number;
  skipped_no_phone: number;
};
type ScheduledItem = {
  id: number;
  status: "pending" | "sent" | "failed" | "cancelled";
  recipient_summary: string;
  message_preview: string;
  target_id: string;
  target_name: string;
  message_mode: string;
};
type ScheduledList = {
  results: ScheduledItem[];
  count: number;
};

const created: { access?: string; studentId?: number; scheduledId?: number } = {};

function headers(access: string): Record<string, string> {
  return {
    Authorization: `Bearer ${access}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": CODE,
  };
}

async function loginToken(request: APIRequestContext): Promise<Tokens> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  return await resp.json() as Tokens;
}

async function apiFetch<TBody>(
  request: APIRequestContext,
  method: string,
  path: string,
  access: string,
  data?: Record<string, unknown>,
): Promise<{ status: number; body: TBody }> {
  const resp = await request.fetch(`${API}/api/v1${path}`, {
    method,
    headers: headers(access),
    ...(data ? { data } : {}),
    timeout: 60_000,
  });
  let body: unknown = null;
  try { body = await resp.json(); } catch { body = null; }
  return { status: resp.status(), body: body as TBody };
}

async function expectApi<TBody>(
  request: APIRequestContext,
  method: string,
  path: string,
  access: string,
  data?: Record<string, unknown>,
  okStatuses: number[] = [200, 201],
): Promise<TBody> {
  const out = await apiFetch<TBody>(request, method, path, access, data);
  expect(
    okStatuses,
    `${method} ${path} -> ${out.status} ${JSON.stringify(out.body)}`,
  ).toContain(out.status);
  return out.body;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.access) return;
  if (created.scheduledId) {
    const current = await apiFetch<ScheduledItem>(
      request,
      "POST",
      `/messaging/scheduled/${created.scheduledId}/cancel/`,
      created.access,
    );
    expect([200, 400, 404], `cleanup cancel -> ${current.status}`).toContain(current.status);
  }
  if (created.studentId) {
    const deleted = await apiFetch<unknown>(request, "DELETE", `/students/${created.studentId}/`, created.access);
    expect([200, 202, 204, 404], `cleanup student -> ${deleted.status}`).toContain(deleted.status);
  }
}

test.describe.serial("[E2E] 알림톡 예약 발송 실사용 검증", () => {
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("성적 알림톡을 예약 큐에 만들고 즉시 취소한다", async ({ request }) => {
    const tokens = await loginToken(request);
    created.access = tokens.access;

    const templates = await expectApi<TemplateItem[]>(
      request,
      "GET",
      "/messaging/templates/?category=grades&include_system=true&page_size=50",
      tokens.access,
    );
    const scoreTemplate = templates.find((tpl) => tpl.category === "grades");
    expect(scoreTemplate, "성적 알림톡 예약 발송에 사용할 grades 템플릿이 있어야 함").toBeTruthy();

    const student = await expectApi<{ id: number }>(request, "POST", "/students/", tokens.access, {
      name: `[E2E-${TS}]예약발송카나리`,
      parent_phone: TEST_PHONE,
      ps_number: `e2emsg${String(TS).slice(-8)}`,
      no_phone: true,
      school_type: "HIGH",
      grade: 1,
      initial_password: "test1234",
      memo: "E2E scheduled messaging canary. 실제 발송 전 취소.",
    });
    created.studentId = Number(student.id);

    const scheduledSendAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const body = [
      "[성적표 예약발송 검증]",
      "강의: E2E 운영 카나리",
      "차시: 예약 발송 흐름",
      "",
      "┌ 결과 요약 ┐",
      "학생/학부모 대상 예약 큐 생성 검증입니다.",
      "실제 발송 전 즉시 취소됩니다.",
      "└ 확인 완료 ┘",
    ].join("\n");

    const send = await expectApi<SendResponse>(request, "POST", "/messaging/send/", tokens.access, {
      send_to: "parent",
      student_ids: [created.studentId],
      message_mode: "alimtalk",
      template_id: scoreTemplate?.id,
      raw_body: body,
      raw_subject: "",
      block_category: "grades",
      scheduled_send_at: scheduledSendAt,
      alimtalk_extra_vars: {
        강의명: "E2E 운영 카나리",
        차시명: "예약 발송",
      },
    });

    expect(send.enqueued, "예약 발송은 즉시 큐 enqueue 되면 안 됨").toBe(0);
    expect(send.scheduled).toBe(1);
    expect(send.detail).toContain("예약됨");

    const pending = await expectApi<ScheduledList>(
      request,
      "GET",
      "/messaging/scheduled/?status=pending&page_size=30",
      tokens.access,
    );
    const matched = pending.results.find(
      (item) => item.target_id === String(created.studentId) && item.status === "pending",
    );
    expect(matched, "방금 만든 예약 발송이 pending 목록에 보여야 함").toBeTruthy();
    expect(matched?.message_mode).toBe("alimtalk");
    expect(matched?.recipient_summary).toContain("010****");
    expect(matched?.message_preview).toContain("성적표 예약발송 검증");
    created.scheduledId = matched?.id;

    const cancelled = await expectApi<ScheduledItem>(
      request,
      "POST",
      `/messaging/scheduled/${created.scheduledId}/cancel/`,
      tokens.access,
    );
    expect(cancelled.status).toBe("cancelled");
    created.scheduledId = undefined;

    const afterCancel = await expectApi<ScheduledList>(
      request,
      "GET",
      "/messaging/scheduled/?status=pending&page_size=30",
      tokens.access,
    );
    expect(afterCancel.results.some((item) => item.id === cancelled.id)).toBe(false);
  });
});
