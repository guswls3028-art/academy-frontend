import { test } from "@playwright/test";

const LOCAL = "http://localhost:5173";
const API = "https://api.hakwonplus.com";
const TENANT = "hakwonplus";

test.use({ viewport: { width: 1600, height: 1000 } });

test("고해상도 정렬 확인", async ({ page }) => {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: TENANT },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
  });
  const tokens = await resp.json() as { access: string; refresh: string };
  await page.goto(`${LOCAL}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch {}
  }, { access: tokens.access, refresh: tokens.refresh, code: TENANT });

  const token = tokens.access;
  const lr = await page.request.get(`${API}/api/v1/lectures/lectures/`, {
    headers: { "Authorization": `Bearer ${token}`, "X-Tenant-Code": TENANT },
  });
  const lects = await lr.json();
  const lectures = Array.isArray(lects) ? lects : lects.results ?? [];
  let tLec: any, tSess: any;
  for (const l of lectures.slice(0, 5)) {
    const sr = await page.request.get(`${API}/api/v1/lectures/sessions/?lecture=${l.id}`, {
      headers: { "Authorization": `Bearer ${token}`, "X-Tenant-Code": TENANT },
    });
    const sd = await sr.json();
    for (const s of (Array.isArray(sd) ? sd : sd.results ?? [])) {
      const ar = await page.request.get(`${API}/api/v1/lectures/attendance/?session=${s.id}&page_size=1`, {
        headers: { "Authorization": `Bearer ${token}`, "X-Tenant-Code": TENANT },
      });
      const ad = await ar.json();
      if ((ad.count ?? 0) > 0) { tLec = l; tSess = s; break; }
    }
    if (tSess) break;
  }

  await page.goto(`${LOCAL}/admin/lectures/${tLec.id}/sessions/${tSess.id}/attendance`, {
    waitUntil: "load", timeout: 20000,
  });
  await page.waitForTimeout(3000);

  // 테이블만 크게 캡처 (scale 2x)
  const tableEl = page.locator("table").first();
  await tableEl.screenshot({ path: "e2e/screenshots/90-alignment-check.png" });
  await page.screenshot({ path: "e2e/screenshots/91-full-page.png", fullPage: true });
});
