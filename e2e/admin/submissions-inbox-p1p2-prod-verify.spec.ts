/**
 * P1+P2 운영 배포 검증.
 *
 * P1: cascade signal — Exam/Homework 삭제 시 active submission auto-discard.
 *     (직접 검증은 destructive — 코드 path 만 회귀 spec 으로 봉인)
 * P2: target_resolved_reason / discard reason enum / discard-batch endpoint /
 *     homework candidates endpoint.
 *
 * 운영 데이터 변경 없이 endpoint 응답 + UI 동작만 검증.
 */
import { test, expect } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const TENANT_CODE = "hakwonplus";

async function getAccess(request: import("@playwright/test").APIRequestContext) {
  const r = await request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT_CODE },
  });
  expect(r.status()).toBe(200);
  const j = await r.json();
  return j.access as string;
}

test("pending API: target_resolved_reason 노출", async ({ request }) => {
  test.setTimeout(60_000);
  const access = await getAccess(request);
  const resp = await request.get(`${API_BASE}/api/v1/submissions/submissions/pending/?filter=pending`, {
    headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": TENANT_CODE },
  });
  expect(resp.status()).toBe(200);
  const data = await resp.json();
  expect(Array.isArray(data)).toBe(true);
  if (data.length === 0) {
    test.info().annotations.push({ type: "skip-reason", description: "0 rows" });
    return;
  }
  const row = data[0];
  console.log(`[KEYS] ${Object.keys(row).join(",")}`);
  expect(row).toHaveProperty("target_resolved");
  expect(row).toHaveProperty("target_resolved_reason");
  // 정합성: target_resolved=true 면 reason=null, false 면 string
  for (const r of data) {
    if (r.target_resolved) expect(r.target_resolved_reason).toBeNull();
    else expect(typeof r.target_resolved_reason).toBe("string");
  }
});

test("discard-batch endpoint: 빈 ids 거부 (실 폐기 없음)", async ({ request }) => {
  test.setTimeout(60_000);
  const access = await getAccess(request);
  const resp = await request.post(`${API_BASE}/api/v1/submissions/submissions/discard-batch/`, {
    headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": TENANT_CODE, "Content-Type": "application/json" },
    data: { submission_ids: [], reason: "operator_discarded" },
  });
  expect(resp.status()).toBe(400);
});

test("discard-batch endpoint: 501건 BATCH_TOO_LARGE 거부", async ({ request }) => {
  test.setTimeout(60_000);
  const access = await getAccess(request);
  // 존재하지 않는 id 501 개 — limit 가드 검증, 실제 폐기 없음
  const fakeIds = Array.from({ length: 501 }, (_, i) => -1 - i);
  const resp = await request.post(`${API_BASE}/api/v1/submissions/submissions/discard-batch/`, {
    headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": TENANT_CODE, "Content-Type": "application/json" },
    data: { submission_ids: fakeIds, reason: "operator_discarded" },
  });
  expect(resp.status()).toBe(400);
  const body = await resp.json();
  expect(body.code).toBe("BATCH_TOO_LARGE");
});

test("homework candidates endpoint: 404 (no homework_id) 또는 200", async ({ request }) => {
  test.setTimeout(60_000);
  const access = await getAccess(request);
  // 임의 ID — 존재 여부 무관, endpoint 라우팅만 확인
  const resp = await request.get(`${API_BASE}/api/v1/submissions/submissions/homework/999999999/candidates/`, {
    headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": TENANT_CODE },
  });
  // 라우트 자체는 등록됨 → 200(빈 배열) 또는 404. 405/500 이면 fail.
  expect([200, 404]).toContain(resp.status());
});
