/**
 * tchul (박철) /core/me/ 실데이터 확인.
 * 후속 fix(meToStaffRole) 적용 시 박철에게 어떤 라벨이 보일지 예측에 사용.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("tchul-admin");

test("tchul me raw data", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUI(page, "tchul-admin");

  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  // 1) 페이지 컨텍스트에서 axios 호출 — 토큰/테넌트 헤더 자동 첨부
  const me = await page.evaluate(async () => {
    try {
      const tok = localStorage.getItem("access") || "";
      const code = sessionStorage.getItem("tenantCode") || "tchul";
      const r = await fetch("https://api.hakwonplus.com/api/v1/core/me/", {
        headers: {
          "Authorization": tok ? `Bearer ${tok}` : "",
          "X-Tenant-Code": code,
        },
        credentials: "include",
      });
      const text = await r.text();
      let body: any = null;
      try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
      return { status: r.status, body };
    } catch (e: any) {
      return { error: String(e) };
    }
  });
  console.log("[ME RESP]", JSON.stringify(me, null, 2));

  const staffMe = await page.evaluate(async () => {
    try {
      const tok = localStorage.getItem("access") || "";
      const code = sessionStorage.getItem("tenantCode") || "tchul";
      const r = await fetch("https://api.hakwonplus.com/api/v1/staffs/me/", {
        headers: {
          "Authorization": tok ? `Bearer ${tok}` : "",
          "X-Tenant-Code": code,
        },
        credentials: "include",
      });
      const text = await r.text();
      let body: any = null;
      try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
      return { status: r.status, body };
    } catch (e: any) {
      return { error: String(e) };
    }
  });
  console.log("[STAFF ME RESP]", JSON.stringify(staffMe, null, 2));

  // 3) 헤더 우상단 프로필 이름·아바타 확인
  const header = await page.locator("header, [class*='ds-header'], [class*='AppHeader']").first().innerText().catch(() => "(no header)");
  console.log("[HEADER TEXT]", header.slice(0, 200));

  expect(me.status ?? 0).toBeGreaterThanOrEqual(200);
});
