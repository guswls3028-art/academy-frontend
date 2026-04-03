import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const API = "https://api.hakwonplus.com";
test("E2E 데이터 정리", async ({ page }) => {
  await loginViaUI(page, "admin");
  const token = await page.evaluate(() => localStorage.getItem("access"));
  const h = { "X-Tenant-Code": "hakwonplus", "Authorization": `Bearer ${token}` };
  // 비용 id=4 삭제
  let r = await page.request.delete(`${API}/api/v1/staffs/expense-records/4/`, { headers: h });
  console.log("Del expense:", r.status());
  // 이전 E2E 직원들 정리 (API로 목록 확인)
  const staffR = await page.request.get(`${API}/api/v1/staffs/`, { headers: h });
  const staffData = await staffR.json();
  for (const s of (staffData.results || [])) {
    if (s.name.includes("[E2E-")) {
      r = await page.request.delete(`${API}/api/v1/staffs/${s.id}/`, { headers: h });
      console.log("Del staff:", s.name, r.status());
    }
  }
  // E2E 시급태그 정리
  const wtR = await page.request.get(`${API}/api/v1/staffs/work-types/`, { headers: h });
  const wtData = await wtR.json();
  for (const wt of (Array.isArray(wtData) ? wtData : wtData.results || [])) {
    if (wt.name.includes("[E2E-")) {
      r = await page.request.delete(`${API}/api/v1/staffs/work-types/${wt.id}/`, { headers: h });
      console.log("Del worktype:", wt.name, r.status());
    }
  }
  console.log("Cleanup done");
});
