import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";

test("직원 근태 — API로 직원 ID 확보 후 직접 접근", async ({ page }) => {
  await loginViaUI(page, "admin");
  
  // API로 직원 목록 조회
  const resp = await page.request.get(`${API}/api/v1/staffs/`, {
    headers: { "X-Tenant-Code": "hakwonplus" },
  });
  const data = await resp.json();
  const staffList = data.results || data;
  console.log("Staff count:", staffList.length);
  
  if (staffList.length === 0) {
    console.log("No staff found, skipping");
    return;
  }
  
  const firstStaff = staffList[0];
  console.log("First staff:", JSON.stringify({ id: firstStaff.id, name: firstStaff.name, role: firstStaff.role }));

  // 근태 탭에 staffId 파라미터로 직접 접근
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  await page.goto(`${B}/admin/staff/attendance?staffId=${firstStaff.id}&year=${year}&month=${month}`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/staff-att-with-id.png", fullPage: true });

  // 비용/경비 탭
  await page.goto(`${B}/admin/staff/expenses?staffId=${firstStaff.id}&year=${year}&month=${month}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/staff-exp-with-id.png", fullPage: true });

  // 월 마감 탭
  await page.goto(`${B}/admin/staff/month-lock?staffId=${firstStaff.id}&year=${year}&month=${month}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/staff-lock-with-id.png", fullPage: true });

  // 근무기록 API 확인
  const recResp = await page.request.get(`${API}/api/v1/staffs/work-records/?staff=${firstStaff.id}&date_from=${year}-${String(month).padStart(2,'0')}-01&date_to=${year}-${String(month).padStart(2,'0')}-30`, {
    headers: { "X-Tenant-Code": "hakwonplus" },
  });
  const records = await recResp.json();
  console.log("Work records count:", (records.results || records).length);
  if ((records.results || records).length > 0) {
    const r = (records.results || records)[0];
    console.log("Sample record:", JSON.stringify({ date: r.date, start: r.start_time, end: r.end_time, hours: r.work_hours, amount: r.amount }));
  }
});
