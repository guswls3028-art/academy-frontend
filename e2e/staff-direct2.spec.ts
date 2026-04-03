import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";

test("직원 근태 직접 검증", async ({ page }) => {
  await loginViaUI(page, "admin");
  
  // JWT 토큰 가져오기
  const token = await page.evaluate(() => localStorage.getItem("access"));
  
  // API로 직원 목록 조회
  const resp = await page.request.get(`${API}/api/v1/staffs/`, {
    headers: { 
      "X-Tenant-Code": "hakwonplus",
      "Authorization": `Bearer ${token}`,
    },
  });
  const body = await resp.text();
  console.log("API status:", resp.status(), "body preview:", body.slice(0, 300));
  
  const data = JSON.parse(body);
  // 응답이 { results: [...], owner: {...} } 형태일 수 있음
  const staffList = Array.isArray(data) ? data : (data.results || []);
  console.log("Staff count:", staffList.length);
  
  if (staffList.length === 0) {
    console.log("No staff, skip");
    return;
  }
  
  const staff = staffList[0];
  console.log("Staff:", staff.id, staff.name, staff.role);

  // 근태 탭 접근
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  
  await page.goto(`${B}/admin/staff/attendance?staffId=${staff.id}&year=${y}&month=${m}`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/staff-att-final.png", fullPage: true });

  // 근무기록 API 조회
  const recResp = await page.request.get(`${API}/api/v1/staffs/work-records/?staff=${staff.id}&date_from=${y}-${String(m).padStart(2,'0')}-01&date_to=${y}-${String(m).padStart(2,'0')}-30`, {
    headers: { "X-Tenant-Code": "hakwonplus", "Authorization": `Bearer ${token}` },
  });
  const recData = JSON.parse(await recResp.text());
  const records = Array.isArray(recData) ? recData : (recData.results || []);
  console.log("Work records:", records.length);
  for (const r of records.slice(0, 3)) {
    console.log(`  ${r.date} ${r.start_time}~${r.end_time || '진행중'} hours=${r.work_hours} amount=${r.amount}원 type=${r.work_type_name}`);
  }

  // 월 마감 탭
  await page.goto(`${B}/admin/staff/month-lock?staffId=${staff.id}&year=${y}&month=${m}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/staff-lock-final.png", fullPage: true });
});
