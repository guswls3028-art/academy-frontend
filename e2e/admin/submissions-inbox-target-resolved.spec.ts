/**
 * Backend deploy 검증 — pending API 응답에 target_resolved 필드 노출 확인.
 * (frontend fallback 제거 가능 시점 결정용)
 */
import { test, expect } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const TENANT_CODE = "hakwonplus";

test("pending API 응답에 target_resolved 필드 노출", async ({ request }) => {
  test.setTimeout(60_000);

  const tokenResp = await request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT_CODE },
  });
  expect(tokenResp.status()).toBe(200);
  const { access } = await tokenResp.json();

  const resp = await request.get(`${API_BASE}/api/v1/submissions/submissions/pending/?filter=pending`, {
    headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": TENANT_CODE },
  });
  expect(resp.status()).toBe(200);
  const data = await resp.json();
  expect(Array.isArray(data)).toBe(true);

  console.log(`[INFO] rows=${data.length}`);
  if (data.length === 0) {
    test.info().annotations.push({ type: "skip-reason", description: "0 rows — field 검증 skip" });
    return;
  }

  const sample = data[0];
  console.log(`[SAMPLE] keys=${Object.keys(sample).join(",")}`);
  expect(sample).toHaveProperty("target_resolved");
  expect(typeof sample.target_resolved).toBe("boolean");

  const orphanCount = data.filter((r: { target_resolved: boolean }) => !r.target_resolved).length;
  const resolvedCount = data.filter((r: { target_resolved: boolean }) => r.target_resolved).length;
  console.log(`[STATS] resolved=${resolvedCount} orphan=${orphanCount}`);
});
