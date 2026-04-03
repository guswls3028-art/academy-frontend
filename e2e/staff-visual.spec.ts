import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";

test("직원 근태 — 실데이터로 시각 확인", async ({ page }) => {
  await loginViaUI(page, "admin");
  const token = await page.evaluate(() => localStorage.getItem("access"));
  const h = { "X-Tenant-Code": "hakwonplus", "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  // 기존 직원(선생, id=20)에게 시급태그 할당 + 근무기록 3건 생성
  const staffId = 20;

  // 시급태그가 있는지 확인
  const wtResp = await page.request.get(`${API}/api/v1/staffs/work-types/`, { headers: h });
  const wts = await wtResp.json();
  const wtList = Array.isArray(wts) ? wts : (wts.results || []);
  let wtId = wtList[0]?.id;
  if (!wtId) {
    const cr = await page.request.post(`${API}/api/v1/staffs/work-types/`, { headers: h, data: { name: "정규근무", base_hourly_wage: 15000, color: "#3b82f6" } });
    wtId = (await cr.json()).id;
  }

  // 직원-태그 연결 (이미 있으면 skip)
  const swtResp = await page.request.get(`${API}/api/v1/staffs/staff-work-types/?staff=${staffId}`, { headers: h });
  const swts = await swtResp.json();
  const swtList = Array.isArray(swts) ? swts : (swts.results || []);
  if (swtList.length === 0) {
    await page.request.post(`${API}/api/v1/staffs/staff-work-types/`, { headers: h, data: { staff: staffId, work_type_id: wtId } });
  }

  // 근무기록 3건 생성 (3/29, 3/30, 3/31)
  for (const [d, s, e, brk] of [
    ["2026-03-29", "09:00", "18:00", 60],
    ["2026-03-30", "10:00", "19:30", 60],
    ["2026-03-31", "09:30", "17:00", 30],
  ]) {
    const r = await page.request.post(`${API}/api/v1/staffs/work-records/`, {
      headers: h,
      data: { staff: staffId, work_type: wtId, date: d, start_time: s, end_time: e, break_minutes: brk },
    });
    console.log(`Record ${d}:`, r.status());
  }

  // 비용 1건
  await page.request.post(`${API}/api/v1/staffs/expense-records/`, {
    headers: h, data: { staff: staffId, date: "2026-03-30", title: "교통비", amount: 8000, memo: "버스비" },
  });

  // 3월 근태 탭 캡처 (데이터 있는 상태)
  await page.goto(`${B}/admin/staff/attendance?staffId=${staffId}&year=2026&month=3`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/visual-attendance-data.png", fullPage: true });

  // 비용 탭
  await page.goto(`${B}/admin/staff/expenses?staffId=${staffId}&year=2026&month=3`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/visual-expenses-data.png", fullPage: true });

  // 직원 홈 (태그 뱃지 확인)
  await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/visual-staff-home.png", fullPage: true });

  // 4월 근태 (오늘 출퇴근 포함)
  await page.goto(`${B}/admin/staff/attendance?staffId=${staffId}&year=2026&month=4`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/visual-attendance-apr.png", fullPage: true });
});
