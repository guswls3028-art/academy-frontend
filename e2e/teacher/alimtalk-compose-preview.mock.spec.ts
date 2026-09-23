import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { realMessagingSkipReason } from "../helpers/safety";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
const STUDENTS = [
  { id: 910001, name: "김민준", phone: "01011112222", parent_phone: "01033334444", ps_number: "E2E-910001", is_managed: true, grade: 1, enrollments: [], tags: [] },
  { id: 910002, name: "박서연", phone: "01055556666", parent_phone: "01077778888", ps_number: "E2E-910002", is_managed: true, grade: 2, enrollments: [], tags: [] },
];

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
}

async function installMessagingMocks(page: Page, onPreflight: (payload: Record<string, unknown>) => boolean, onSend: (payload: Record<string, unknown>) => void) {
  let savedTemplate = { id: 41, name: "상담 안내", category: "attendance", body: "저장한 문구", is_system: false };
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, localJwt());

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (["/core/program/", "/core/me/", "/token/refresh/", "/results/admin/clinic-targets/"].includes(path)) {
      return route.fallback();
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (path === "/students/" && request.method() === "GET") {
      return route.fulfill({ json: { count: STUDENTS.length, results: STUDENTS } });
    }
    if (path === "/messaging/templates/" && request.method() === "GET") {
      return route.fulfill({ json: { count: 1, results: [savedTemplate] } });
    }
    if (path === "/messaging/templates/41/" && request.method() === "PATCH") {
      savedTemplate = { ...savedTemplate, ...request.postDataJSON() };
      return route.fulfill({ json: savedTemplate });
    }
    if (path === "/messaging/send/preflight/" && request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      if (onPreflight(payload)) return route.fulfill({ status: 503, json: { detail: "사전 확인 연결 실패" } });
      return route.fulfill({ json: {
        ok: true,
        can_send: true,
        mode: "now",
        send_to: payload.send_to,
        recipient: { selected: 2, resolved: 2, valid_phone: 2, skipped_no_phone: 0, duplicate_phone: 0, unique_phone: 2, invalid_or_deleted: 0, limit: 500 },
        template: { ok: true, name: "출석 안내", detail: "" },
        preview_recipients: STUDENTS.map((student) => ({
          student_id: student.id,
          student_name: student.name,
          phone: `010****${student.parent_phone.slice(-4)}`,
          excluded: false,
          exclude_reason: "",
          full_message_body: `예담학원입니다.\n${student.name} 학생님.\n${String(payload.raw_body)}\nhttps://yedam.example.com`,
        })),
        blockers: [],
        warnings: [],
      } });
    }
    if (path === "/messaging/send/" && request.method() === "POST") {
      onSend(request.postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { detail: "accepted", enqueued: 2 } });
    }
    return route.fulfill({ json: { count: 0, results: [] } });
  });
}

test.use({ serviceWorkers: "block" });

test("선생님은 저장 문구를 수정하고 서버의 학생별 전체 문구를 확인한 뒤 발송한다", async ({ page }) => {
  const mockOnlyReason = realMessagingSkipReason(BASE, "", "0");
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), mockOnlyReason ?? "알림톡 route-mock 검증은 로컬 서버 전용");
  let preflightCalls = 0;
  let sendPayload: Record<string, unknown> | null = null;
  await installMessagingMocks(page, () => ++preflightCalls === 1, (payload) => { sendPayload = payload; });

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto(`${BASE}/workspace/mobile/students`, { waitUntil: "commit" });
  await expect(page.getByText("학생 관리", { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "전체 선택" }).click();
  await page.getByRole("button", { name: "알림톡", exact: true }).click();

  const sheet = page.getByRole("dialog", { name: "2명에게 알림톡" });
  await sheet.getByLabel("저장한 문구 불러오기").selectOption("41");
  await expect(sheet.getByLabel("선생님 안내문 (자유롭게 수정)")).toHaveValue("저장한 문구");
  await sheet.getByLabel("선생님 안내문 (자유롭게 수정)").fill("이번 주 과제를 확인해 주세요.");
  await sheet.getByRole("button", { name: "실제 문구 확인하기" }).click();
  await expect(sheet.getByRole("alert")).toContainText("사전 확인 연결 실패");
  expect(sendPayload).toBeNull();

  await sheet.getByRole("button", { name: "실제 문구 확인하기" }).click();
  const review = page.getByRole("dialog", { name: "보내기 전 마지막 확인" });
  await expect(review).toContainText("김민준 학생님.");
  await expect(review.getByLabel("카카오톡 실제 발송 미리보기")).toContainText("이번 주 과제를 확인해 주세요.");
  await review.getByLabel("문구를 확인할 학생").selectOption("910002");
  await expect(review.getByLabel("카카오톡 실제 발송 미리보기")).toContainText("박서연 학생님.");
  expect(sendPayload).toBeNull();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await review.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await review.getByRole("button", { name: "문구 수정" }).click();
  await expect(page.getByRole("dialog", { name: "2명에게 알림톡" }).getByLabel("선생님 안내문 (자유롭게 수정)"))
    .toHaveValue("이번 주 과제를 확인해 주세요.");
  await page.getByRole("dialog", { name: "2명에게 알림톡" }).getByRole("button", { name: "실제 문구 확인하기" }).click();
  await page.getByRole("dialog", { name: "보내기 전 마지막 확인" }).getByRole("button", { name: "발송하기" }).click();
  await expect.poll(() => sendPayload).toMatchObject({
    student_ids: [910001, 910002],
    send_to: "parent",
    message_mode: "alimtalk",
    raw_body: "이번 주 과제를 확인해 주세요.",
    block_category: "attendance",
  });
  expect(preflightCalls).toBe(3);

  await page.goto(`${BASE}/workspace/mobile/message-templates`, { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "알림톡 문구" })).toBeVisible();
  await page.getByRole("button", { name: "상담 안내 편집" }).click();
  const editSheet = page.getByRole("dialog", { name: "문구 편집" });
  await editSheet.getByLabel("본문 *").fill("다음 주 상담 일정을 확인해 주세요.");
  await editSheet.getByRole("button", { name: "수정", exact: true }).click();
  await expect(page.getByText("다음 주 상담 일정을 확인해 주세요.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("다음 주 상담 일정을 확인해 주세요.")).toBeVisible();
});
