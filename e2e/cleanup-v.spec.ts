import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const API = "https://api.hakwonplus.com";
test("V데이터 정리", async ({ page }) => {
  await loginViaUI(page, "admin");
  const token = await page.evaluate(() => localStorage.getItem("access"));
  const h = { "X-Tenant-Code": "hakwonplus", "Authorization": `Bearer ${token}` };
  const staffR = await page.request.get(`${API}/api/v1/staffs/`, { headers: h });
  for (const s of ((await staffR.json()).results || [])) {
    if (s.name.includes("[V]")) {
      // 근무기록 삭제
      const wr = await page.request.get(`${API}/api/v1/staffs/work-records/?staff=${s.id}&date_from=2026-01-01&date_to=2026-12-31`, { headers: h });
      for (const r of ((await wr.json()).results || [])) await page.request.delete(`${API}/api/v1/staffs/work-records/${r.id}/`, { headers: h });
      // 비용 삭제
      const ex = await page.request.get(`${API}/api/v1/staffs/expense-records/?staff=${s.id}&date_from=2026-01-01&date_to=2026-12-31`, { headers: h });
      for (const r of ((await ex.json()).results || [])) await page.request.delete(`${API}/api/v1/staffs/expense-records/${r.id}/`, { headers: h });
      // staff-work-types 삭제
      const swt = await page.request.get(`${API}/api/v1/staffs/staff-work-types/?staff=${s.id}`, { headers: h });
      for (const r of ((await swt.json()).results || [])) await page.request.delete(`${API}/api/v1/staffs/staff-work-types/${r.id}/`, { headers: h });
      // 직원 삭제
      const dr = await page.request.delete(`${API}/api/v1/staffs/${s.id}/`, { headers: h });
      console.log("Del staff:", s.name, dr.status());
    }
  }
  const wtR = await page.request.get(`${API}/api/v1/staffs/work-types/`, { headers: h });
  for (const wt of ((await wtR.json()).results || (await wtR.json()) || [])) {
    if (wt.name?.includes("[V]")) {
      const dr = await page.request.delete(`${API}/api/v1/staffs/work-types/${wt.id}/`, { headers: h });
      console.log("Del wt:", wt.name, dr.status());
    }
  }
});
